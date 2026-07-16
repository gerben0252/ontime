import { useQuery } from '@tanstack/react-query';

export interface VmixInputInfo {
  number: string;
  key: string;
  title: string;
  /** Running, Paused or Completed. A paused camera is a live pause (freeze frame) */
  state: string;
  /** playback position in ms, 0 for inputs which cannot seek */
  position: number;
  /** total length in ms, 0 for live sources */
  duration: number;
}

export interface VmixSnapshot {
  inputs: VmixInputInfo[];
  /** input number on the program bus */
  active: string | null;
  /** input number on the preview bus */
  preview: string | null;
  /** input number currently on each overlay channel, keyed by channel */
  overlays: Record<string, string>;
}

const emptySnapshot: VmixSnapshot = { inputs: [], active: null, preview: null, overlays: {} };

async function fetchVmixSnapshot(host: string, port: number): Promise<VmixSnapshot> {
  const response = await fetch(`http://${host}:${port}/api`);
  if (!response.ok) return emptySnapshot;

  const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
  if (xml.querySelector('parsererror')) return emptySnapshot;

  const inputs: VmixInputInfo[] = [];
  for (const input of Array.from(xml.querySelectorAll('inputs > input'))) {
    const number = input.getAttribute('number');
    if (!number) continue;
    inputs.push({
      number,
      key: input.getAttribute('key') ?? '',
      title: input.getAttribute('title')?.trim() ?? '',
      state: input.getAttribute('state') ?? '',
      position: Number(input.getAttribute('position')) || 0,
      duration: Number(input.getAttribute('duration')) || 0,
    });
  }

  const overlays: Record<string, string> = {};
  for (const overlay of Array.from(xml.querySelectorAll('vmix > overlays > overlay'))) {
    const channel = overlay.getAttribute('number');
    const input = overlay.textContent?.trim();
    // an empty element means the channel is clear
    if (channel && input) overlays[channel] = input;
  }

  return {
    inputs,
    active: xml.querySelector('vmix > active')?.textContent?.trim() ?? null,
    preview: xml.querySelector('vmix > preview')?.textContent?.trim() ?? null,
    overlays,
  };
}

/**
 * Polls the vMix web API for the full state of the instance.
 * Shared by every consumer so the API is only hit once per interval.
 */
export function useVmixSnapshot(host: string | null, port: number): VmixSnapshot {
  const { data } = useQuery({
    queryKey: ['vmix-snapshot', host, port],
    queryFn: () => fetchVmixSnapshot(host as string, port),
    enabled: Boolean(host),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    retry: false,
    placeholderData: (previous) => previous,
  });

  return data ?? emptySnapshot;
}

/** Finds an input by number, key or title. The identifier is client specific */
export function findVmixInput(snapshot: VmixSnapshot, identifier: string | null): VmixInputInfo | undefined {
  if (!identifier) return undefined;
  const needle = identifier.trim();
  return snapshot.inputs.find(
    (input) => input.number === needle || input.key === needle || input.title === needle,
  );
}
