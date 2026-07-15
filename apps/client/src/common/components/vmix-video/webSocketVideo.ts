/**
 * WebSocket + MediaSource video player for vMix video streams.
 *
 * Ported from the vMix Telestrator Javascript Library (Copyright 2024 StudioCoast Pty Ltd)
 * to TypeScript, with the DOM logging and UI controls stripped out so it can be driven
 * by a React component.
 */

/** how often we check the buffer and correct drift */
const TICK_MS = 250;
/** latency above target before we gently speed up to catch up */
const CATCHUP_MARGIN = 0.15;
/** playback rate used to absorb small amounts of drift without a visible jump */
const CATCHUP_RATE = 1.1;
/** latency above target beyond which a smooth catch up would take too long, so we seek instead */
const HARD_RESYNC_LATENCY = 1.5;
/** seconds of already played video to keep buffered */
const KEEP_BEHIND = 4;
/** only evict once there is meaningfully more than KEEP_BEHIND to reclaim */
const EVICT_THRESHOLD = 8;

/** Safari exposes ManagedMediaSource instead of MediaSource */
type MediaSourceCtor = new () => MediaSource;

function getMediaSource(video: HTMLVideoElement): MediaSource | null {
  if ('MediaSource' in window) {
    return new MediaSource();
  }
  if ('ManagedMediaSource' in window) {
    const Managed = (window as unknown as { ManagedMediaSource: MediaSourceCtor }).ManagedMediaSource;
    // required for ManagedMediaSource to work with non-hls streams
    video.disableRemotePlayback = true;
    return new Managed();
  }
  return null;
}

function joinBuffers(first: ArrayBuffer | null, second: ArrayBuffer): ArrayBuffer {
  if (!first) return second;
  const merged = new Uint8Array(first.byteLength + second.byteLength);
  merged.set(new Uint8Array(first), 0);
  merged.set(new Uint8Array(second), first.byteLength);
  return merged.buffer;
}

export class WebSocketVideo {
  private readonly video: HTMLVideoElement;
  private readonly serverUrl: string;
  private readonly targetLatency: number;

  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private videoBuffer: ArrayBuffer | null = null;
  private sock: WebSocket | null = null;
  private tickId: ReturnType<typeof setInterval> | null = null;
  private objectUrl: string | null = null;
  private mimeCodec = '';

  constructor(video: HTMLVideoElement, serverUrl: string, targetLatency = 0.2) {
    this.video = video;
    this.serverUrl = serverUrl;
    this.targetLatency = targetLatency;
  }

  start() {
    this.mediaSource = getMediaSource(this.video);
    if (!this.mediaSource) return;

    this.mediaSource.addEventListener('sourceopen', this.sourceOpen);
    this.objectUrl = URL.createObjectURL(this.mediaSource);
    this.video.src = this.objectUrl;
    // autoplay can reject until the element is allowed to play, the tick will retry
    this.video.play().catch(() => undefined);
  }

  stop() {
    if (this.sock) {
      this.sock.removeEventListener('message', this.message);
      this.sock.close();
      this.sock = null;
    }
    if (this.tickId) {
      clearInterval(this.tickId);
      this.tickId = null;
    }
    this.sourceBuffer?.removeEventListener('updateend', this.updateEnd);
    this.mediaSource?.removeEventListener('sourceopen', this.sourceOpen);
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.video.playbackRate = 1;
    this.video.removeAttribute('src');
    this.video.load();
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.videoBuffer = null;
  }

  private sourceOpen = () => {
    if (!this.mediaSource) return;
    this.mediaSource.duration = Number.POSITIVE_INFINITY;
    this.sock = new WebSocket(this.serverUrl);
    this.sock.binaryType = 'arraybuffer';
    this.sock.addEventListener('message', this.message);
  };

  private beginStream() {
    if (!this.mediaSource || this.mediaSource.readyState !== 'open') return;
    this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeCodec);
    this.sourceBuffer.mode = 'sequence';
    this.sourceBuffer.addEventListener('updateend', this.updateEnd);
    this.tickId = setInterval(this.tick, TICK_MS);
  }

  /** flush anything that queued up while the buffer was busy */
  private updateEnd = () => {
    if (this.videoBuffer) {
      this.appendPending();
    }
  };

  private appendPending() {
    const buffer = this.sourceBuffer;
    if (!buffer || buffer.updating || !this.videoBuffer) return;

    const pending = this.videoBuffer;
    try {
      buffer.appendBuffer(pending);
      this.videoBuffer = null;
    } catch (error) {
      // the buffer is full: reclaim space and let the next tick retry the append
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.evictOldBuffer();
        return;
      }
      // any other append error means this chunk is unusable, drop it rather than wedge the stream
      this.videoBuffer = null;
    }
  }

  /** end of the newest buffered range, ie. the live edge */
  private getLiveEdge(): number | null {
    const { buffered } = this.video;
    if (buffered.length === 0) return null;
    return buffered.end(buffered.length - 1);
  }

  /** whether currentTime sits inside a buffered range; false means we are stalled in a gap */
  private isInBuffer(): boolean {
    const { buffered, currentTime } = this.video;
    for (let i = 0; i < buffered.length; i++) {
      if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) return true;
    }
    return false;
  }

  /** jump straight to the live edge, used when drift is too large to absorb smoothly */
  private resync(liveEdge: number) {
    this.video.playbackRate = 1;
    this.video.currentTime = liveEdge - this.targetLatency;
  }

  /**
   * Drops already played data so a long running stream does not grow without bound.
   * Without this the source buffer eventually hits the browser quota and appends start failing.
   */
  private evictOldBuffer() {
    const buffer = this.sourceBuffer;
    if (!buffer || buffer.updating) return;
    if (this.video.buffered.length === 0) return;

    const start = this.video.buffered.start(0);
    const removeUntil = this.video.currentTime - KEEP_BEHIND;
    if (removeUntil - start < EVICT_THRESHOLD - KEEP_BEHIND) return;

    try {
      buffer.remove(start, removeUntil);
    } catch {
      // removal is best effort, we retry on the next tick
    }
  }

  /**
   * Keeps playback pinned near the target latency.
   *
   * Drift builds up whenever the tab is throttled, a frame is dropped or the socket
   * stutters, so we correct continuously:
   *  - stalled in a buffer gap -> seek to the live edge
   *  - far behind -> seek to the live edge
   *  - slightly behind -> speed up slightly, which is invisible to the viewer
   */
  private tick = () => {
    const liveEdge = this.getLiveEdge();

    if (liveEdge !== null) {
      if (!this.isInBuffer()) {
        // playhead fell into a gap, it will never recover on its own
        this.resync(liveEdge);
      } else {
        const latency = liveEdge - this.video.currentTime;
        if (latency > this.targetLatency + HARD_RESYNC_LATENCY) {
          this.resync(liveEdge);
        } else if (latency > this.targetLatency + CATCHUP_MARGIN) {
          this.video.playbackRate = CATCHUP_RATE;
        } else if (this.video.playbackRate !== 1) {
          this.video.playbackRate = 1;
        }
      }
    }

    this.evictOldBuffer();
    // retry data that could not be appended earlier, eg. after a quota error
    this.appendPending();

    if (this.video.paused) {
      this.video.play().catch(() => undefined);
    }
  };

  private bufferReceived(data: ArrayBuffer) {
    this.videoBuffer = joinBuffers(this.videoBuffer, data);
    this.appendPending();
  }

  private message = (event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      this.bufferReceived(event.data);
      return;
    }
    const payload = JSON.parse(event.data) as { mimeType?: string };
    if (payload.mimeType) {
      this.mimeCodec = payload.mimeType;
      this.beginStream();
    }
  };
}
