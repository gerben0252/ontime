import { use, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { OptionTitle } from '../../common/components/view-params-editor/constants';
import { ViewOption } from '../../common/components/view-params-editor/viewParams.types';
import { PresetContext } from '../../common/context/PresetContext';
import { DEFAULT_VMIX_HOST } from '../talent/talent.options';

/** the telestrator input is identified by its title, which survives a vMix restart */
export const DEFAULT_TELESTRATOR_INPUT = 'Telestrator';
export const DEFAULT_TELESTRATOR_OVERLAY = 5;

/** the three colours talent can draw with */
export const TELESTRATOR_COLORS = [
  { value: '#ffee00', label: 'Geel' },
  { value: '#2f9bff', label: 'Blauw' },
  { value: '#ff3b30', label: 'Rood' },
] as const;

export const getTalentTelestratorOptions = (): ViewOption[] => {
  return [
    {
      title: OptionTitle.Vmix,
      collapsible: true,
      options: [
        {
          id: 'vmix-host',
          title: 'vMix IP address',
          description: 'The stream vMix instance serving the video and telestrator sockets',
          type: 'string',
          defaultValue: DEFAULT_VMIX_HOST,
          placeholder: DEFAULT_VMIX_HOST,
        },
      ],
    },
    {
      title: OptionTitle.Telestrator,
      collapsible: true,
      options: [
        {
          id: 'telestrator-input',
          title: 'Telestrator input',
          description: 'Title of the vMix telestrator input, needed to put the drawing on air',
          type: 'string',
          defaultValue: DEFAULT_TELESTRATOR_INPUT,
          placeholder: DEFAULT_TELESTRATOR_INPUT,
        },
        {
          id: 'telestrator-overlay',
          title: 'Telestrator overlay channel',
          description: 'vMix overlay channel the telestrator is placed on',
          type: 'number',
          defaultValue: DEFAULT_TELESTRATOR_OVERLAY,
          placeholder: String(DEFAULT_TELESTRATOR_OVERLAY),
        },
      ],
    },
  ];
};

export type TalentTelestratorOptions = {
  vmixHost: string | null;
  telestratorInput: string;
  telestratorOverlay: number;
};

function toNumber(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getOptionsFromParams(searchParams: URLSearchParams, defaultValues?: URLSearchParams): TalentTelestratorOptions {
  const getValue = (key: string) => defaultValues?.get(key) ?? searchParams.get(key);

  return {
    vmixHost: getValue('vmix-host') || DEFAULT_VMIX_HOST,
    telestratorInput: getValue('telestrator-input') || DEFAULT_TELESTRATOR_INPUT,
    telestratorOverlay: toNumber(getValue('telestrator-overlay'), DEFAULT_TELESTRATOR_OVERLAY),
  };
}

/**
 * Hook exposes the talent telestrator view options
 */
export function useTalentTelestratorOptions(): TalentTelestratorOptions {
  const [searchParams] = useSearchParams();
  const maybePreset = use(PresetContext);

  const options = useMemo(() => {
    const defaultValues = maybePreset ? new URLSearchParams(maybePreset.search) : undefined;
    return getOptionsFromParams(searchParams, defaultValues);
  }, [maybePreset, searchParams]);

  return options;
}
