import { use, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { OptionTitle } from '../../common/components/view-params-editor/constants';
import { ViewOption } from '../../common/components/view-params-editor/viewParams.types';
import { PresetContext } from '../../common/context/PresetContext';
import { DEFAULT_TALENT_PREFIX, DEFAULT_VMIX_HOST } from '../talent/talent.options';

/** TeamPerformance always serves its datasources on this port and path, only the host changes */
const TEAM_PERFORMANCE_PORT = 5005;
const TEAM_PERFORMANCE_PATH = '/api/datasource';

/** the datasources exposed by TeamPerformance, in tab order */
export const TEAM_PERFORMANCE_SHEETS = ['lineup', 'facts', 'scoreview'] as const;
export type TeamPerformanceSheet = (typeof TEAM_PERFORMANCE_SHEETS)[number];

export const DEFAULT_TEAM_PERFORMANCE_IP = '10.12.0.71';
export const DEFAULT_VMIX_DATASOURCE = 'lineup';
export const DEFAULT_VMIX_BUTTON_PREFIX = 'TALENT-';
export const DEFAULT_MERGE_DURATION = 500;
export const DEFAULT_LINEUP_OVERLAY = 1;
/** custom field key holding the presenter notes, shown under the event note and edited from the popup */
export const DEFAULT_PRESENTER_FIELD = 'Presenter_Notes';

/** Builds a TeamPerformance datasource endpoint from the configured host */
export function buildDatasourceUrl(ip: string, sheet: TeamPerformanceSheet): string {
  return `http://${ip}:${TEAM_PERFORMANCE_PORT}${TEAM_PERFORMANCE_PATH}/${sheet}`;
}

export const getTalentDeskOptions = (): ViewOption[] => {
  return [
    {
      title: OptionTitle.DataSources,
      collapsible: true,
      options: [
        {
          id: 'talent-prefix',
          title: 'Talent prefix',
          description: 'Events are only shown to talent when their title starts with this prefix',
          type: 'string',
          defaultValue: DEFAULT_TALENT_PREFIX,
          placeholder: DEFAULT_TALENT_PREFIX,
        },
        {
          id: 'presenter-field',
          title: 'Presenter notes field',
          description: 'Custom field shown under the notes and edited in the notes popup',
          type: 'string',
          defaultValue: DEFAULT_PRESENTER_FIELD,
          placeholder: DEFAULT_PRESENTER_FIELD,
        },
      ],
    },
    {
      title: OptionTitle.Vmix,
      collapsible: true,
      options: [
        {
          id: 'vmix-host',
          title: 'vMix IP address',
          description: 'The stream vMix instance. Every button on this view targets it',
          type: 'string',
          defaultValue: DEFAULT_VMIX_HOST,
          placeholder: DEFAULT_VMIX_HOST,
        },
        {
          id: 'vmix-button-prefix',
          title: 'Switch button prefix',
          description: 'A switch button appears for every vMix input whose title starts with this prefix',
          type: 'string',
          defaultValue: DEFAULT_VMIX_BUTTON_PREFIX,
          placeholder: DEFAULT_VMIX_BUTTON_PREFIX,
        },
        {
          id: 'merge-duration',
          title: 'Merge duration',
          description: 'Length in milliseconds of the Merge transition used by the switch buttons',
          type: 'number',
          defaultValue: DEFAULT_MERGE_DURATION,
          placeholder: String(DEFAULT_MERGE_DURATION),
        },
      ],
    },
    {
      title: OptionTitle.TeamPerformance,
      collapsible: true,
      options: [
        {
          id: 'teamperformance-ip',
          title: 'TeamPerformance IP address',
          description: `Host serving the lineup, facts and scoreview sheets on :${TEAM_PERFORMANCE_PORT}${TEAM_PERFORMANCE_PATH}`,
          type: 'string',
          defaultValue: DEFAULT_TEAM_PERFORMANCE_IP,
          placeholder: DEFAULT_TEAM_PERFORMANCE_IP,
        },
        {
          id: 'vmix-datasource',
          title: 'vMix data source',
          description: 'Name of the lineup data source in vMix, as "Name" or "Name,Table"',
          type: 'string',
          defaultValue: DEFAULT_VMIX_DATASOURCE,
          placeholder: 'lineup,Sheet1',
        },
        {
          id: 'lineup-input',
          title: 'Lineup graphic input',
          description: 'vMix input shown when a team is tapped, tapping does nothing until this is set',
          type: 'string',
          placeholder: '4',
        },
        {
          id: 'lineup-overlay',
          title: 'Lineup overlay channel',
          description: 'vMix overlay channel the lineup graphic is placed on',
          type: 'number',
          defaultValue: DEFAULT_LINEUP_OVERLAY,
          placeholder: String(DEFAULT_LINEUP_OVERLAY),
        },
      ],
    },
  ];
};

export type TalentDeskOptions = {
  talentPrefix: string;
  presenterField: string;
  /** host serving the TeamPerformance datasources */
  teamPerformanceIp: string;
  vmixHost: string | null;
  vmixButtonPrefix: string;
  mergeDuration: number;
  vmixDatasource: string;
  lineupInput: string | null;
  lineupOverlay: number;
};

function toNumber(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getOptionsFromParams(searchParams: URLSearchParams, defaultValues?: URLSearchParams): TalentDeskOptions {
  const getValue = (key: string) => defaultValues?.get(key) ?? searchParams.get(key);

  return {
    talentPrefix: getValue('talent-prefix') || DEFAULT_TALENT_PREFIX,
    presenterField: getValue('presenter-field') || DEFAULT_PRESENTER_FIELD,
    teamPerformanceIp: getValue('teamperformance-ip') || DEFAULT_TEAM_PERFORMANCE_IP,
    vmixHost: getValue('vmix-host') || DEFAULT_VMIX_HOST,
    vmixButtonPrefix: getValue('vmix-button-prefix') || DEFAULT_VMIX_BUTTON_PREFIX,
    mergeDuration: toNumber(getValue('merge-duration'), DEFAULT_MERGE_DURATION),
    vmixDatasource: getValue('vmix-datasource') || DEFAULT_VMIX_DATASOURCE,
    lineupInput: getValue('lineup-input'),
    lineupOverlay: toNumber(getValue('lineup-overlay'), DEFAULT_LINEUP_OVERLAY),
  };
}

/**
 * Hook exposes the talent desk view options
 */
export function useTalentDeskOptions(): TalentDeskOptions {
  const [searchParams] = useSearchParams();
  const maybePreset = use(PresetContext);

  const options = useMemo(() => {
    const defaultValues = maybePreset ? new URLSearchParams(maybePreset.search) : undefined;
    return getOptionsFromParams(searchParams, defaultValues);
  }, [maybePreset, searchParams]);

  return options;
}
