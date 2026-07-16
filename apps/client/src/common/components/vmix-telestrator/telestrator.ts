/**
 * Minimal telestrator client for the vMix telestrator socket.
 *
 * This is a bespoke rewrite of the vMix Telestrator Javascript Library
 * (Copyright 2024 StudioCoast Pty Ltd), reduced to the two tools talent needs
 * and extended with a local undo history.
 *
 * Protocol note: the socket only understands the vMix command set, which has no
 * arrow. An arrow is therefore sent as a `line` whose paths trace the shaft and
 * both head strokes, which vMix renders as an arrow without knowing what it is.
 */

export type TelestratorTool = 'line' | 'arrow';

export interface TelestratorPoint {
  x: number;
  y: number;
}

interface Stroke {
  paths: TelestratorPoint[];
  color: string;
  width: number;
}

/** vMix renders the telestrator at 1080p regardless of how it is displayed */
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

/** ~60fps, matches the stock library's send rate */
const MOVE_THROTTLE_MS = 16;
/** how long to wait before reconnecting a dropped socket */
const RECONNECT_DELAY_MS = 2000;

/* The pen is smoothed by filtering the points themselves rather than the local
   rendering: vMix redraws the stroke from the paths we send, so a curve drawn
   only on our canvas would not survive the trip. */

/** how hard each new sample pulls the pen. Lower is smoother but lags the finger */
const PEN_SMOOTHING = 0.4;
/** minimum gap between committed points, drops the cluster of jitter when the hand is still */
const PEN_MIN_DISTANCE = 6;

/* A moderate drop shadow. The stock library stamps a hard black copy at +2px,
   which reads as a harsh double line. */
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.5)';
const SHADOW_BLUR_RATIO = 1.1;
const SHADOW_OFFSET_RATIO = 0.2;

/** arrow head length relative to the shaft, capped so short arrows stay sane */
const ARROW_HEAD_RATIO = 0.32;
const ARROW_HEAD_MIN_RATIO = 4;
/** angle between the shaft and each head stroke */
const ARROW_HEAD_SPREAD = Math.PI / 7;

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

/**
 * Exponential moving average toward the raw sample.
 * Folding every pointer sample through this turns the hand's jitter into a
 * gentle curve before it is ever committed to a path.
 */
export function smoothTowards(previous: TelestratorPoint, raw: TelestratorPoint, alpha: number): TelestratorPoint {
  return {
    x: previous.x + (raw.x - previous.x) * alpha,
    y: previous.y + (raw.y - previous.y) * alpha,
  };
}

export function distanceBetween(a: TelestratorPoint, b: TelestratorPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** the protocol carries whole pixels */
function roundPoint(point: TelestratorPoint): TelestratorPoint {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

/**
 * Builds an arrow as a single polyline: shaft, one head stroke, back to the tip,
 * then the other head stroke. With round joins this reads as a solid arrow.
 */
export function buildArrowPaths(from: TelestratorPoint, to: TelestratorPoint, width: number): TelestratorPoint[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  // too short to have a head yet
  if (length < 1) return [from, to];

  const angle = Math.atan2(dy, dx);
  const headLength = Math.min(length * ARROW_HEAD_RATIO, Math.max(width * ARROW_HEAD_MIN_RATIO, 56));

  const head = (offset: number): TelestratorPoint => ({
    x: Math.round(to.x - headLength * Math.cos(angle + offset)),
    y: Math.round(to.y - headLength * Math.sin(angle + offset)),
  });

  return [from, to, head(-ARROW_HEAD_SPREAD), to, head(ARROW_HEAD_SPREAD)];
}

interface TelestratorOptions {
  canvas: HTMLCanvasElement;
  tempCanvas: HTMLCanvasElement;
  serverUrl: string;
  onConnectionChange?: (isConnected: boolean) => void;
}

export class Telestrator {
  private readonly id = makeId();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tempCanvas: HTMLCanvasElement;
  private readonly tempCtx: CanvasRenderingContext2D;
  private readonly serverUrl: string;
  private readonly onConnectionChange?: (isConnected: boolean) => void;

  private sock: WebSocket | null = null;
  private reconnectId: ReturnType<typeof setTimeout> | null = null;
  private isStopped = false;

  private tool: TelestratorTool = 'line';
  private color = '#ffee00';
  private width = 10;

  private isDrawing = false;
  private points: TelestratorPoint[] = [];
  private lastMove = 0;
  /** running filter state for the pen, unrounded */
  private smoothed: TelestratorPoint | null = null;

  /** committed strokes, kept so undo can redraw locally */
  private strokes: Stroke[] = [];
  /** paths of the in progress stroke of a remote client */
  private remotePaths: TelestratorPoint[] | null = null;

  constructor({ canvas, tempCanvas, serverUrl, onConnectionChange }: TelestratorOptions) {
    this.tempCanvas = tempCanvas;
    this.serverUrl = serverUrl;
    this.onConnectionChange = onConnectionChange;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    tempCanvas.width = CANVAS_WIDTH;
    tempCanvas.height = CANVAS_HEIGHT;

    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.tempCtx = tempCanvas.getContext('2d') as CanvasRenderingContext2D;

    tempCanvas.addEventListener('pointerdown', this.onPointerDown);
    tempCanvas.addEventListener('pointermove', this.onPointerMove);
    tempCanvas.addEventListener('pointerup', this.onPointerUp);
    tempCanvas.addEventListener('pointercancel', this.onPointerUp);

    this.connect();
  }

  /* ------------------------------ public api ------------------------------ */

  setTool(tool: TelestratorTool) {
    this.tool = tool;
  }

  setColor(color: string) {
    this.color = color;
  }

  setWidth(width: number) {
    this.width = width;
  }

  /** removes the last stroke locally and asks vMix to do the same */
  undo() {
    this.strokes.pop();
    this.redraw();
    this.send({ id: this.id, type: 'undo' });
  }

  /** clears every stroke locally and in vMix */
  erase() {
    this.strokes = [];
    this.redraw();
    this.clear(this.tempCtx);
    this.send({ id: this.id, type: 'erase' });
  }

  stop() {
    this.isStopped = true;
    this.tempCanvas.removeEventListener('pointerdown', this.onPointerDown);
    this.tempCanvas.removeEventListener('pointermove', this.onPointerMove);
    this.tempCanvas.removeEventListener('pointerup', this.onPointerUp);
    this.tempCanvas.removeEventListener('pointercancel', this.onPointerUp);

    if (this.reconnectId) clearTimeout(this.reconnectId);
    if (this.sock) {
      this.sock.removeEventListener('message', this.onMessage);
      this.sock.removeEventListener('open', this.onOpen);
      this.sock.removeEventListener('close', this.onClose);
      this.sock.close();
      this.sock = null;
    }
  }

  /* ------------------------------- socket -------------------------------- */

  private connect() {
    if (this.isStopped) return;
    this.sock = new WebSocket(this.serverUrl);
    this.sock.addEventListener('open', this.onOpen);
    this.sock.addEventListener('message', this.onMessage);
    this.sock.addEventListener('close', this.onClose);
  }

  private onOpen = () => {
    this.onConnectionChange?.(true);
  };

  /** the stock library reloads the page on close, we simply reconnect */
  private onClose = () => {
    this.onConnectionChange?.(false);
    if (this.isStopped) return;
    this.reconnectId = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  };

  private send(command: object) {
    if (this.sock?.readyState === WebSocket.OPEN) {
      this.sock.send(JSON.stringify(command));
    }
  }

  private onMessage = (event: MessageEvent) => {
    let payload: unknown;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    const commands = Array.isArray(payload) ? payload : [payload];
    commands.forEach((command) => this.receive(command as Record<string, unknown>));
  };

  /** draws what other telestrator clients are doing */
  private receive(command: Record<string, unknown>) {
    // our own strokes are already on the canvas
    if (command.id === this.id) return;

    if (command.type === 'clear' || command.type === 'erase') {
      this.strokes = [];
      this.redraw();
      this.clear(this.tempCtx);
      return;
    }

    if (command.type !== 'line') return;

    const isTemp = command.temp === true;
    const paths = command.addPath
      ? [...(this.remotePaths ?? []), command.addPath as TelestratorPoint]
      : (command.paths as TelestratorPoint[] | undefined) ?? [];

    if (isTemp) {
      this.remotePaths = paths;
      this.clear(this.tempCtx);
      this.stroke(this.tempCtx, paths, command.color as string, command.width as number);
      return;
    }

    this.remotePaths = null;
    this.clear(this.tempCtx);
    this.strokes.push({ paths, color: command.color as string, width: command.width as number });
    this.stroke(this.ctx, paths, command.color as string, command.width as number);
  }

  /* ------------------------------- drawing ------------------------------- */

  /** unrounded so the smoothing filter keeps its precision */
  private toCanvasPoint(event: PointerEvent): TelestratorPoint {
    const rect = this.tempCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (CANVAS_WIDTH / rect.width),
      y: (event.clientY - rect.top) * (CANVAS_HEIGHT / rect.height),
    };
  }

  private onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    // capture keeps the stroke alive if the finger leaves the canvas
    this.tempCanvas.setPointerCapture(event.pointerId);
    this.isDrawing = true;

    const point = this.toCanvasPoint(event);
    this.smoothed = point;
    this.points = [roundPoint(point)];
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.isDrawing) return;
    const raw = this.toCanvasPoint(event);

    if (this.tool === 'arrow') {
      // an arrow is a straight shaft, smoothing it would only lag the tip
      if (Date.now() - this.lastMove < MOVE_THROTTLE_MS) return;
      this.lastMove = Date.now();
      this.points = [this.points[0], roundPoint(raw)];
      this.previewAndSend(buildArrowPaths(this.points[0], this.points[1], this.width));
      return;
    }

    // every sample feeds the filter, even the ones we do not commit
    this.smoothed = smoothTowards(this.smoothed ?? raw, raw, PEN_SMOOTHING);

    if (Date.now() - this.lastMove < MOVE_THROTTLE_MS) return;

    const candidate = roundPoint(this.smoothed);
    const last = this.points[this.points.length - 1];
    // a still hand would otherwise pile up points and pucker the line
    if (distanceBetween(last, candidate) < PEN_MIN_DISTANCE) return;

    this.lastMove = Date.now();
    this.points.push(candidate);
    this.previewAndSend(this.points, true);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.smoothed = null;
    if (this.tempCanvas.hasPointerCapture(event.pointerId)) {
      this.tempCanvas.releasePointerCapture(event.pointerId);
    }

    if (this.tool === 'line') {
      // the filter trails the finger, so land the stroke on where it actually lifted
      const end = roundPoint(this.toCanvasPoint(event));
      if (distanceBetween(this.points[this.points.length - 1], end) >= 1) {
        this.points.push(end);
      }
    }

    const paths = this.tool === 'arrow' ? buildArrowPaths(this.points[0], this.points[1] ?? this.points[0], this.width) : this.points;

    // a tap with no movement leaves nothing to draw
    if (paths.length < 2) {
      this.clear(this.tempCtx);
      return;
    }

    this.clear(this.tempCtx);
    this.strokes.push({ paths, color: this.color, width: this.width });
    this.stroke(this.ctx, paths, this.color, this.width);

    // checkpoint lets vMix undo this stroke as one unit
    this.send({ id: this.id, type: 'checkpoint' });
    this.send({ id: this.id, type: 'line', color: this.color, width: this.width, temp: false, paths });
  };

  /** draws the in progress stroke locally and mirrors it to vMix */
  private previewAndSend(paths: TelestratorPoint[], canAppend = false) {
    this.clear(this.tempCtx);
    this.stroke(this.tempCtx, paths, this.color, this.width);

    const command = { id: this.id, type: 'line', color: this.color, width: this.width, temp: true };

    // freehand only needs to send the newest point once the stroke is established
    if (canAppend && paths.length > 2) {
      this.send({ ...command, addPath: paths[paths.length - 1] });
      return;
    }
    this.send({ ...command, paths });
  }

  private stroke(ctx: CanvasRenderingContext2D, paths: TelestratorPoint[], color: string, width: number) {
    if (paths.length === 0) return;

    ctx.save();
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.shadowColor = SHADOW_COLOR;
    ctx.shadowBlur = width * SHADOW_BLUR_RATIO;
    ctx.shadowOffsetX = width * SHADOW_OFFSET_RATIO;
    ctx.shadowOffsetY = width * SHADOW_OFFSET_RATIO;

    ctx.beginPath();
    paths.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  private clear(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  private redraw() {
    this.clear(this.ctx);
    this.strokes.forEach((stroke) => this.stroke(this.ctx, stroke.paths, stroke.color, stroke.width));
  }
}
