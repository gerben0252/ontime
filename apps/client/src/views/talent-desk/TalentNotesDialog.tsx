import { OntimeEvent, RundownEntries, SupportedEntry } from 'ontime-types';
import { useEffect, useState } from 'react';

import Button from '../../common/components/buttons/Button';
import Dialog from '../../common/components/dialog/Dialog';
import { useEntryActions } from '../../common/hooks/useEntryAction';
import { stripTalentPrefix } from '../talent/talent.utils';

import style from './TalentNotesDialog.module.scss';

interface TalentNotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** every talent event in the rundown, in rundown order */
  talentEvents: OntimeEvent[];
  entries: RundownEntries;
  /** custom field key the notes are written to */
  field: string;
  talentPrefix: string;
  /** id of the talent event currently on air, highlighted in the list */
  currentEventId: string | null;
}

/**
 * Lets talent add a note to any talent event in the rundown.
 * Notes are written to a custom field, so they live alongside the rundown
 * and are visible to the rest of the production.
 */
export default function TalentNotesDialog(props: TalentNotesDialogProps) {
  const { isOpen, onClose, talentEvents, entries, field, talentPrefix, currentEventId } = props;
  const { updateEntry } = useEntryActions();

  const saveNote = (id: string, value: string) => {
    // patching custom merges server side, so the other note fields are left alone
    updateEntry({ id, custom: { [field]: value } } as Partial<OntimeEvent>);
  };

  return (
    <Dialog
      isOpen={isOpen}
      title='Talent notes'
      showCloseButton
      showBackdrop
      onClose={onClose}
      bodyElements={
        <div className={style.list}>
          {talentEvents.length === 0 && <div className={style.empty}>No talent events in this rundown</div>}
          {talentEvents.map((event) => {
            const parent = event.parent ? entries[event.parent] : undefined;
            const groupTitle = parent?.type === SupportedEntry.Group ? parent.title : null;

            return (
              <NoteRow
                key={event.id}
                event={event}
                field={field}
                groupTitle={groupTitle}
                talentPrefix={talentPrefix}
                isCurrent={event.id === currentEventId}
                onSave={saveNote}
              />
            );
          })}
        </div>
      }
      footerElements={
        <Button variant='primary' size='large' onClick={onClose}>
          Done
        </Button>
      }
    />
  );
}

interface NoteRowProps {
  event: OntimeEvent;
  field: string;
  groupTitle: string | null;
  talentPrefix: string;
  isCurrent: boolean;
  onSave: (id: string, value: string) => void;
}

function NoteRow({ event, field, groupTitle, talentPrefix, isCurrent, onSave }: NoteRowProps) {
  const saved = (event.custom[field] as string | undefined) ?? '';
  const [draft, setDraft] = useState(saved);
  const [isEditing, setIsEditing] = useState(false);

  // pick up changes made elsewhere, but never while the user is typing in this field
  useEffect(() => {
    if (!isEditing) setDraft(saved);
  }, [saved, isEditing]);

  const commit = () => {
    setIsEditing(false);
    if (draft !== saved) {
      onSave(event.id, draft);
    }
  };

  return (
    <div className={style.row} data-current={isCurrent || undefined}>
      <div className={style.meta}>
        <span className={style.title}>{stripTalentPrefix(event.title, talentPrefix)}</span>
        {groupTitle && <span className={style.group}>{groupTitle}</span>}
      </div>
      <textarea
        className={style.input}
        value={draft}
        placeholder='Add a note'
        rows={2}
        onChange={(changeEvent) => setDraft(changeEvent.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={commit}
      />
    </div>
  );
}
