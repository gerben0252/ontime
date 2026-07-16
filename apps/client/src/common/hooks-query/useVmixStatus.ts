import { useQuery } from '@tanstack/react-query';

export type VmixInputState = 'live' | 'preview' | 'idle' | 'offline';

export interface VmixStatus {
  /** state of the configured input relative to the vMix program/preview buses */
  state: VmixInputState;
  /** remaining time (ms) of the media currently playing on the program bus, if any */
  programRemaining: number | null;
}

const offlineStatus: VmixStatus = { state: 'offline', programRemaining: null };

/**
 * Finds a vMix input by number, title or short title.
 * The input key is client specific and configured through the view options.
 */
function findInput(inputs: Element[], key: string): Element | undefined {
  const normalizedKey = key.trim();
  return inputs.find((input) => {
    return (
      input.getAttribute('number') === normalizedKey ||
      input.getAttribute('key') === normalizedKey ||
      input.getAttribute('title') === normalizedKey ||
      input.getAttribute('shortTitle') === normalizedKey
    );
  });
}

/** Resolves the input element an overlay/layer element references (by key, falling back to number) */
function resolveOverlayTarget(
  overlay: Element,
  byKey: Map<string, Element>,
  byNumber: Map<string, Element>,
): Element | undefined {
  const key = overlay.getAttribute('key');
  if (key && byKey.has(key)) return byKey.get(key);
  // program overlay channels reference the input by number in their text content, layers via attribute
  const number = overlay.getAttribute('number') ?? overlay.textContent?.trim();
  return number ? byNumber.get(number) : undefined;
}

/**
 * Whether the target input is composited inside the container input, at any depth.
 * vMix inputs can carry other inputs as layers/PiP/multiview via <overlay> children.
 */
function containsInput(
  container: Element,
  targetKey: string | null,
  targetNumber: string | null,
  byKey: Map<string, Element>,
  byNumber: Map<string, Element>,
  visited: Set<string>,
): boolean {
  const overlays = Array.from(container.children).filter((child) => child.tagName === 'overlay');
  for (const overlay of overlays) {
    const referenced = resolveOverlayTarget(overlay, byKey, byNumber);
    if (!referenced) continue;

    const refKey = referenced.getAttribute('key');
    const refNumber = referenced.getAttribute('number');
    if ((targetKey !== null && refKey === targetKey) || (targetNumber !== null && refNumber === targetNumber)) {
      return true;
    }

    const guard = refKey ?? refNumber;
    if (guard && !visited.has(guard)) {
      visited.add(guard);
      if (containsInput(referenced, targetKey, targetNumber, byKey, byNumber, visited)) {
        return true;
      }
    }
  }
  return false;
}

/** Whether the target input is on air on the given bus input, either directly or as a nested layer */
function isOnBus(
  busInput: Element | undefined,
  targetKey: string | null,
  targetNumber: string | null,
  byKey: Map<string, Element>,
  byNumber: Map<string, Element>,
): boolean {
  if (!busInput) return false;
  if (busInput.getAttribute('key') === targetKey || busInput.getAttribute('number') === targetNumber) return true;
  return containsInput(busInput, targetKey, targetNumber, byKey, byNumber, new Set());
}

/** remaining media time for an input, when it is actively playing */
function getInputRemaining(input: Element | undefined): number | null {
  if (!input) return null;
  if (input.getAttribute('state') !== 'Running') return null;
  const duration = Number(input.getAttribute('duration'));
  const position = Number(input.getAttribute('position'));
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const remaining = duration - position;
  return remaining > 0 ? remaining : null;
}

async function fetchVmixStatus(host: string, port: number, inputKey: string): Promise<VmixStatus> {
  const response = await fetch(`http://${host}:${port}/api`);
  if (!response.ok) {
    return offlineStatus;
  }

  const text = await response.text();
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) {
    return offlineStatus;
  }

  const active = xml.querySelector('vmix > active')?.textContent?.trim() ?? null;
  const preview = xml.querySelector('vmix > preview')?.textContent?.trim() ?? null;
  const inputs = Array.from(xml.querySelectorAll('inputs > input'));

  const byNumber = new Map<string, Element>();
  const byKey = new Map<string, Element>();
  for (const input of inputs) {
    const number = input.getAttribute('number');
    const key = input.getAttribute('key');
    if (number) byNumber.set(number, input);
    if (key) byKey.set(key, input);
  }

  const ourInput = findInput(inputs, inputKey);
  const ourNumber = ourInput?.getAttribute('number') ?? null;
  const ourKey = ourInput?.getAttribute('key') ?? null;

  const activeInput = active === null ? undefined : byNumber.get(active);
  const previewInput = preview === null ? undefined : byNumber.get(preview);

  // program overlay channels are composited onto the program output, so count as live
  const programOverlayNumbers = Array.from(xml.querySelectorAll('vmix > overlays > overlay'))
    .map((overlay) => overlay.textContent?.trim())
    .filter((value): value is string => Boolean(value));
  const onProgramOverlay =
    ourNumber !== null &&
    programOverlayNumbers.some(
      (number) =>
        number === ourNumber ||
        isOnBus(byNumber.get(number), ourKey, ourNumber, byKey, byNumber),
    );

  const isLive = onProgramOverlay || isOnBus(activeInput, ourKey, ourNumber, byKey, byNumber);
  const isPreview = !isLive && isOnBus(previewInput, ourKey, ourNumber, byKey, byNumber);

  let state: VmixInputState = 'idle';
  if (ourInput && isLive) {
    state = 'live';
  } else if (ourInput && isPreview) {
    state = 'preview';
  }

  // remaining time of whatever media is currently live on the program bus
  const programRemaining = getInputRemaining(activeInput);

  return { state, programRemaining };
}

/**
 * Polls the vMix web API (default port 8088) for the live/preview state of a
 * configured input. Returns an "offline" status when vMix is unreachable so the
 * view can degrade gracefully.
 */
export function useVmixStatus(host: string | null, port: number, inputKey: string | null): VmixStatus {
  const enabled = Boolean(host) && Boolean(inputKey);

  const { data } = useQuery({
    queryKey: ['vmix-status', host, port, inputKey],
    queryFn: () => fetchVmixStatus(host as string, port, inputKey as string),
    enabled,
    refetchInterval: 500,
    refetchIntervalInBackground: true,
    retry: false,
    placeholderData: (previous) => previous,
  });

  if (!enabled) {
    return { state: 'idle', programRemaining: null };
  }

  return data ?? offlineStatus;
}
