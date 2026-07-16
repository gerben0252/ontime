import { useQuery } from '@tanstack/react-query';

export interface VmixInput {
  number: string;
  /** title with the prefix stripped, used as the button label */
  label: string;
}

export interface VmixInputList {
  inputs: VmixInput[];
  /** input number currently on the program bus */
  active: string | null;
  /** input number currently on the preview bus */
  preview: string | null;
}

const emptyList: VmixInputList = { inputs: [], active: null, preview: null };

/**
 * Reads the vMix input list and keeps only the inputs whose title carries the
 * configured prefix, so talent only gets buttons for sources meant for them.
 * Also reports the program/preview buses so the buttons can show what is on air.
 */
async function fetchVmixInputs(host: string, port: number, prefix: string): Promise<VmixInputList> {
  const response = await fetch(`http://${host}:${port}/api`);
  if (!response.ok) return emptyList;

  const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
  if (xml.querySelector('parsererror')) return emptyList;

  const trimmedPrefix = prefix.trim();
  const normalizedPrefix = trimmedPrefix.toUpperCase();
  const inputs: VmixInput[] = [];

  for (const input of Array.from(xml.querySelectorAll('inputs > input'))) {
    const number = input.getAttribute('number');
    const title = input.getAttribute('title')?.trim();
    if (!number || !title) continue;
    if (!title.toUpperCase().startsWith(normalizedPrefix)) continue;

    const label = title.slice(trimmedPrefix.length).trim();
    inputs.push({ number, label: label || title });
  }

  return {
    inputs,
    active: xml.querySelector('vmix > active')?.textContent?.trim() ?? null,
    preview: xml.querySelector('vmix > preview')?.textContent?.trim() ?? null,
  };
}

export function useVmixInputs(host: string | null, port: number, prefix: string | null): VmixInputList {
  const enabled = Boolean(host) && Boolean(prefix);

  const { data } = useQuery({
    queryKey: ['vmix-inputs', host, port, prefix],
    queryFn: () => fetchVmixInputs(host as string, port, prefix as string),
    enabled,
    refetchInterval: 1000,
    retry: false,
    placeholderData: (previous) => previous,
  });

  return data ?? emptyList;
}
