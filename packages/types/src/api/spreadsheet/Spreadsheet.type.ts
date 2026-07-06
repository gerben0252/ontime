import type { CustomFields } from '../../definitions/core/CustomFields.type.js';
import type { Rundown } from '../../definitions/core/Rundown.type.js';
import type { RundownSummary } from '../rundown-controller/BackendResponse.type.js';

export type SpreadsheetWorksheetMetadata = {
  worksheet: string;
  headers: string[];
};

export type SpreadsheetWorksheetOptions = {
  worksheets: string[];
  metadata: SpreadsheetWorksheetMetadata | null;
  title?: string;
};

export type SpreadsheetPreviewResponse = {
  rundown: Rundown;
  customFields: CustomFields;
  summary: RundownSummary;
};

/**
 * Where the imported data should land
 * - current: reconcile with the currently loaded rundown
 * - new: create a fresh rundown from the import
 */
export type RundownImportDestination = 'current' | 'new';

/**
 * How elements matched by id should be reconciled when importing into an existing rundown
 * - override: imported data replaces the whole matched element (automations dropped)
 * - merge: imported data updates the matched element but preserves fields the sheet
 *   cannot express (triggers/automations, timeStrategy)
 */
export type RundownImportMergeStrategy = 'override' | 'merge';

/**
 * Payload for the rundown import endpoint
 * Note: the 'override' strategy does not use this endpoint, it goes through the generic PATCH /db
 */
export type RundownImportPayload = {
  mode: 'merge' | 'new';
  /** required when mode === 'merge' */
  targetRundownId?: string;
  rundown: Rundown;
  customFields: CustomFields;
};
