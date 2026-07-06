import { useQueryClient } from '@tanstack/react-query';
import { CustomFields, ProjectRundowns, RundownImportPayload } from 'ontime-types';
import { useCallback } from 'react';

import { CUSTOM_FIELDS, PROJECT_RUNDOWNS, RUNDOWN } from '../../../../../common/api/constants';
import { patchData } from '../../../../../common/api/db';
import { importRundownWithOptions } from '../../../../../common/api/rundown';

export default function useSpreadsheetImport() {
  const queryClient = useQueryClient();

  /** applies rundown and customFields to current project (override strategy) */
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

  /** applies an import using a merge strategy or into a new rundown */
  const applyImportWithOptions = useCallback(
    async (payload: RundownImportPayload) => {
      await importRundownWithOptions(payload);
      await queryClient.invalidateQueries({
        queryKey: RUNDOWN,
      });
      await queryClient.invalidateQueries({
        queryKey: CUSTOM_FIELDS,
      });
      await queryClient.invalidateQueries({
        queryKey: PROJECT_RUNDOWNS,
      });
    },
    [queryClient],
  );

  return {
    importRundown,
    applyImportWithOptions,
  };
}
