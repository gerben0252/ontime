import type { RundownImportDestination, RundownImportMergeStrategy, SpreadsheetPreviewResponse } from 'ontime-types';
import { isOntimeEvent, isPlayableEvent, Playback } from 'ontime-types';
import { useEffect, useState } from 'react';

import Button from '../../../../../../common/components/buttons/Button';
import { usePlayback, useSelectedEventId } from '../../../../../../common/hooks/useSocket';

interface ApplyImportButtonProps {
  preview: SpreadsheetPreviewResponse | null;
  destination: RundownImportDestination;
  strategy: RundownImportMergeStrategy;
  disabled: boolean;
  loading: boolean;
  onApply: () => void;
}

/**
 * Apply action for the spreadsheet import.
 * Subscribes to playback state on its own so playback updates do not re-render the whole editor.
 * Requires a second click to confirm when applying would stop a running playback.
 */
export default function ApplyImportButton({
  preview,
  destination,
  strategy,
  disabled,
  loading,
  onApply,
}: ApplyImportButtonProps) {
  const playback = usePlayback();
  const loadedEventId = useSelectedEventId();

  // the loaded (playing) event loses its playback unless it survives a merge as a playable event
  const loadedEntry = loadedEventId ? preview?.rundown.entries[loadedEventId] : undefined;
  const willLoadedEventBeOverriden = !(
    loadedEntry !== undefined &&
    isOntimeEvent(loadedEntry) &&
    isPlayableEvent(loadedEntry)
  );

  // applying stops playback when creating/replacing a rundown, or when a merge drops the playing event
  const willStopPlayback =
    playback !== Playback.Stop && (destination === 'new' || strategy === 'override' || willLoadedEventBeOverriden);

  // two-step confirmation before applying an import that stops playback
  const [confirmStop, setConfirmStop] = useState(false);
  useEffect(() => {
    setConfirmStop(false);
  }, [destination, strategy, preview]);

  const handleClick = () => {
    if (willStopPlayback && !confirmStop) {
      setConfirmStop(true);
      return;
    }
    onApply();
  };

  return (
    <Button variant='primary' onClick={handleClick} disabled={disabled} loading={loading}>
      {willStopPlayback && confirmStop ? 'Confirm — stop playback & apply import' : 'Apply import'}
    </Button>
  );
}
