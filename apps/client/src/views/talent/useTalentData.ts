import { RundownEntries, Settings, ViewSettings } from 'ontime-types';

import useRundown from '../../common/hooks-query/useRundown';
import useSettings from '../../common/hooks-query/useSettings';
import useViewSettings from '../../common/hooks-query/useViewSettings';
import { useViewOptionsStore } from '../../common/stores/viewOptions';
import { ViewData, aggregateQueryStatus } from '../utils/viewLoader.utils';

export interface TalentData {
  entries: RundownEntries;
  isMirrored: boolean;
  settings: Settings;
  viewSettings: ViewSettings;
}

export function useTalentData(): ViewData<TalentData> {
  // persisted app state
  const isMirrored = useViewOptionsStore((state) => state.mirror);

  // HTTP API data
  const { data: rundownData, status: rundownStatus } = useRundown();
  const { data: settings, status: settingsStatus } = useSettings();
  const { data: viewSettings, status: viewSettingsStatus } = useViewSettings();

  return {
    data: {
      entries: rundownData.entries,
      isMirrored,
      settings,
      viewSettings,
    },
    status: aggregateQueryStatus([rundownStatus, settingsStatus, viewSettingsStatus]),
  };
}
