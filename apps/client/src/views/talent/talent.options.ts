import { use, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { getTimeOption, getTimeOptionsFromParams, TimeOptions } from '../../common/components/view-params-editor/common.options';
import { OptionTitle } from '../../common/components/view-params-editor/constants';
import { ViewOption } from '../../common/components/view-params-editor/viewParams.types';
import { PresetContext } from '../../common/context/PresetContext';

export const DEFAULT_TALENT_PREFIX = 'TALENT -';
export const DEFAULT_VMIX_PORT = 8088;
export const DEFAULT_VMIX_HOST = '10.12.0.71';
export const DEFAULT_SCOREBOARD_URL = 'http://10.12.0.62/scoreboard/time/formatted';

export const getTalentOptions = (timeFormat: string): ViewOption[] => {
  return [
    { title: OptionTitle.ClockOptions, collapsible: true, options: [getTimeOption(timeFormat)] },
    {
      title: OptionTitle.DataSources,
      collapsible: true,
      options: [
        {
          id: 'talent-prefix',
          title: 'Talent prefix',
          description: 'Only events whose title starts with this prefix are shown as talent events',
          type: 'string',
          defaultValue: DEFAULT_TALENT_PREFIX,
          placeholder: DEFAULT_TALENT_PREFIX,
        },
        {
          id: 'scoreboard-url',
          title: 'Scoreboard URL',
          description: 'Endpoint returning the scoreboard time, polled every second',
          type: 'string',
          defaultValue: DEFAULT_SCOREBOARD_URL,
          placeholder: DEFAULT_SCOREBOARD_URL,
        },
      ],
    },
    {
      title: OptionTitle.BehaviourOptions,
      collapsible: true,
      options: [
        {
          id: 'vmix-host',
          title: 'vMix host',
          description: 'Hostname or IP of the vMix instance',
          type: 'string',
          defaultValue: DEFAULT_VMIX_HOST,
          placeholder: DEFAULT_VMIX_HOST,
        },
        {
          id: 'vmix-input',
          title: 'vMix input',
          description: 'Input number, key or title to track on the program/preview buses',
          type: 'string',
          placeholder: '1',
        },
      ],
    },
  ];
};

export type TalentOptions = {
  talentPrefix: string;
  scoreboardUrl: string | null;
  vmixHost: string | null;
  vmixInput: string | null;
} & TimeOptions;

function getOptionsFromParams(searchParams: URLSearchParams, defaultValues?: URLSearchParams): TalentOptions {
  const getValue = (key: string) => defaultValues?.get(key) ?? searchParams.get(key);

  return {
    talentPrefix: getValue('talent-prefix') || DEFAULT_TALENT_PREFIX,
    scoreboardUrl: getValue('scoreboard-url') || DEFAULT_SCOREBOARD_URL,
    vmixHost: getValue('vmix-host') || DEFAULT_VMIX_HOST,
    vmixInput: getValue('vmix-input'),
    timeformat: getTimeOptionsFromParams(searchParams, defaultValues),
  };
}

/**
 * Hook exposes the talent view options
 */
export function useTalentOptions(): TalentOptions {
  const [searchParams] = useSearchParams();
  const maybePreset = use(PresetContext);

  const options = useMemo(() => {
    const defaultValues = maybePreset ? new URLSearchParams(maybePreset.search) : undefined;
    return getOptionsFromParams(searchParams, defaultValues);
  }, [maybePreset, searchParams]);

  return options;
}
