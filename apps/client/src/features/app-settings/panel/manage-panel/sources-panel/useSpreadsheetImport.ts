import { useQueryClient } from '@tanstack/react-query';
import { CustomFields, ProjectRundowns, RundownImportPayload } from 'ontime-types';
import { useCallback } from 'react';

import { CUSTOM_FIELDS, PROJECT_RUNDOWNS, RUNDOWN } from '../../../../../common/api/constants';
import { patchData } from '../../../../../common/api/db';
import { importRundownWithOptions } from '../../../../../common/api/rundown';

export default function useSpreadsheetImport() {
  const queryClient = useQueryClient();

  /** overrides rundown and customFields in current project */
  const importRundown = useCallback(
    async (rundowns: ProjectRundowns, customFields: CustomFields) => {
      await patchData({ rundowns, customFields });
      // we are unable to optimistically set the rundown since we need
      // it to be normalised
      await queryClient.invalidateQueries({
        queryKey: RUNDOWN,
      });
      await queryClient.invalidateQueries({
        queryKey: CUSTOM_FIELDS,
      });
    },
    [queryClient],
  );

  /** merges an import into the current rundown or creates a new one */
  const applyImportWithOptions = useCallback(
    async (payload: RundownImportPayload) => {
      const response = await importRundownWithOptions(payload);
      // use the returned project rundowns to populate the cache instead of refetching
      queryClient.setQueryData(PROJECT_RUNDOWNS, response.data);
      // the loaded rundown and custom fields still need a refetch to get their normalised shape
      await queryClient.invalidateQueries({
        queryKey: RUNDOWN,
      });
      await queryClient.invalidateQueries({
        queryKey: CUSTOM_FIELDS,
      });
    },
    [queryClient],
  );

  return {
    importRundown,
    applyImportWithOptions,
  };
}
