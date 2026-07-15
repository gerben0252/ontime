import { useQueryClient } from '@tanstack/react-query';
import { RundownImportPayload } from 'ontime-types';
import { useCallback } from 'react';

import { CUSTOM_FIELDS, PROJECT_RUNDOWNS, RUNDOWN } from '../../../../../common/api/constants';
import { importRundownWithOptions } from '../../../../../common/api/rundown';

export default function useSpreadsheetImport() {
  const queryClient = useQueryClient();

  /** applies a spreadsheet import: override or merge into a rundown, or create a new one */
  const applyImport = useCallback(
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
    applyImport,
  };
}
