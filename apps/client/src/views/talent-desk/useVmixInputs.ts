import { useMemo } from 'react';

import { useVmixSnapshot } from '../../common/hooks-query/useVmixSnapshot';

export interface VmixInput {
  number: string;
  /** title with the prefix stripped, used as the button label */
  label: string;
}

export interface VmixInputList {
  inputs: VmixInput[];
  /** input number currently on the program bus */
  active: string | null;
}

/**
 * The vMix inputs whose title carries the configured prefix, so talent only gets
 * buttons for sources meant for them. Also reports the program bus so the buttons
 * can show what is on air.
 */
export function useVmixInputs(host: string | null, port: number, prefix: string | null): VmixInputList {
  const snapshot = useVmixSnapshot(host, port);

  const inputs = useMemo(() => {
    if (!prefix) return [];
    const trimmedPrefix = prefix.trim();
    const normalizedPrefix = trimmedPrefix.toUpperCase();

    return snapshot.inputs
      .filter((input) => input.title.toUpperCase().startsWith(normalizedPrefix))
      .map((input) => ({
        number: input.number,
        label: input.title.slice(trimmedPrefix.length).trim() || input.title,
      }));
  }, [snapshot.inputs, prefix]);

  return { inputs, active: snapshot.active };
}
