import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_VMIX_PORT, vmixMergeToInput } from '../../common/utils/vmix';
import { useVmixInputs, VmixInput } from './useVmixInputs';

export interface Fragments {
  inputs: VmixInput[];
  /** input number on the program bus */
  active: string | null;
  /** plays the fragment, or returns to the studio when it is already live */
  press: (input: string) => void;
  /** a live fragment cannot be stopped until we know where to return to */
  isDisabled: (input: string) => boolean;
}

/**
 * The prefixed vMix inputs talent may play, and the rule for stopping them.
 *
 * Whatever sits on program that is not a fragment is taken to be the studio, so
 * tapping a live fragment can merge back to where it came from.
 */
export function useFragments(host: string | null, prefix: string, mergeDuration: number): Fragments {
  const { inputs, active } = useVmixInputs(host, DEFAULT_VMIX_PORT, prefix);
  const [studioInput, setStudioInput] = useState<string | null>(null);

  const fragmentNumbers = useMemo(() => new Set(inputs.map((input) => input.number)), [inputs]);

  useEffect(() => {
    if (active && !fragmentNumbers.has(active)) {
      setStudioInput(active);
    }
  }, [active, fragmentNumbers]);

  const press = useCallback(
    (input: string) => {
      if (!host) return;
      const target = input === active ? studioInput : input;
      // nothing to return to yet, eg. the page loaded while a fragment was already live
      if (!target) return;
      vmixMergeToInput(host, DEFAULT_VMIX_PORT, target, mergeDuration);
    },
    [host, active, studioInput, mergeDuration],
  );

  const isDisabled = useCallback(
    (input: string) => input === active && !studioInput,
    [active, studioInput],
  );

  return { inputs, active, press, isDisabled };
}
