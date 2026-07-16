import { EntryId, MaybeNumber, OffsetMode, OntimeEvent, RundownEntries, SupportedEntry, TimerPhase } from 'ontime-types';
import { dayInMs, isPlaybackActive, parseUserTime } from 'ontime-utils';
import { useMemo } from 'react';

import { useTalentSocket } from '../../common/hooks/useSocket';
import { useEditorSettings } from '../../common/stores/editorSettings';
import { buildTalentSegments, isTalentEvent, selectTalentSegments, TalentSegment } from './talent.utils';

export interface TalentState {
  /** talent segment containing the running event, null while off talent */
  nowSegment: TalentSegment | null;
  /** next distinct talent segment, may live in a following group */
  nextSegment: TalentSegment | null;
  /** the talent event the current segment takes its notes from */
  nowTalentEvent: OntimeEvent | null;
  /** note of the talent event of the current segment */
  nowNote: string;
  /** every talent event in the rundown, in rundown order */
  talentEvents: OntimeEvent[];
  /** remaining time of the current segment, negative when it overruns */
  eventRemaining: MaybeNumber;
  eventDuration: MaybeNumber;
  /** remaining time of the current group */
  groupRemaining: MaybeNumber;
  groupDuration: MaybeNumber;
  warningThreshold: number;
  dangerThreshold: number;
}

/**
 * Shared talent timing state, used by both the talent view and the talent desk.
 * Keeps the segment/clone rules in a single place so the two views cannot drift apart.
 */
export function useTalentState(entries: RundownEntries, flatOrder: EntryId[], talentPrefix: string): TalentState {
  const { eventNow, groupNow, time, clock, currentDay, actualGroupStart, groupExpectedEnd, offsetMode } =
    useTalentSocket();

  const defaultWarnTime = useEditorSettings((state) => state.defaultWarnTime);
  const defaultDangerTime = useEditorSettings((state) => state.defaultDangerTime);

  // every event in rundown order. Segments never span a group, so NOW and the segment timer
  // stay scoped to the current group, but NEXT can still find a talent event in a later group
  const allEvents = useMemo(() => {
    return flatOrder
      .map((id) => entries[id])
      .filter((entry): entry is OntimeEvent => entry?.type === SupportedEntry.Event);
  }, [flatOrder, entries]);

  const segments = useMemo(() => buildTalentSegments(allEvents, talentPrefix), [allEvents, talentPrefix]);
  const { now: nowSegment, next: nextSegment } = useMemo(
    () => selectTalentSegments(segments, allEvents, eventNow?.id ?? null),
    [segments, allEvents, eventNow?.id],
  );

  const isRunning = isPlaybackActive(time.playback) && time.phase !== TimerPhase.Pending;
  const normalizedClock = clock + currentDay * dayInMs;

  // Derive from the server authoritative running timer (offset aware) plus the scheduled tail
  // between the running event's end and the segment end. Planned times alone would clamp to 0
  // whenever the show runs behind schedule. Goes negative when the segment overruns.
  const eventDuration = nowSegment ? nowSegment.timeEnd - nowSegment.timeStart : null;
  const eventRemaining = (() => {
    if (!nowSegment || !isRunning || !eventNow || time.current === null) return null;
    const runningEventEnd = eventNow.timeStart + eventNow.duration + eventNow.dayOffset * dayInMs;
    const tail = Math.max(0, nowSegment.timeEnd - runningEventEnd);
    return time.current + tail;
  })();

  const groupDuration = groupNow?.duration ?? null;
  const groupRemaining = (() => {
    if (!isRunning || !groupNow || groupNow.timeStart === null) return null;
    if (groupExpectedEnd !== null) {
      return Math.max(0, groupExpectedEnd - clock);
    }
    if (offsetMode === OffsetMode.Absolute) {
      return Math.max(0, groupNow.timeStart + groupNow.duration - normalizedClock);
    }
    if (actualGroupStart === null) return null;
    return Math.max(0, actualGroupStart + groupNow.duration - normalizedClock);
  })();

  // prefer the running talent event, otherwise the original talent event of the segment
  const nowTalentEvent = (() => {
    if (!nowSegment) return null;
    if (eventNow && isTalentEvent(eventNow, talentPrefix) && nowSegment.memberIds.includes(eventNow.id)) {
      return eventNow;
    }
    const firstMember = entries[nowSegment.memberIds[0]];
    return firstMember?.type === SupportedEntry.Event ? firstMember : null;
  })();

  const talentEvents = useMemo(
    () => allEvents.filter((event) => isTalentEvent(event, talentPrefix)),
    [allEvents, talentPrefix],
  );

  return {
    nowSegment,
    nextSegment,
    nowTalentEvent,
    nowNote: nowTalentEvent?.note ?? '',
    talentEvents,
    eventRemaining,
    eventDuration,
    groupRemaining,
    groupDuration,
    warningThreshold: parseUserTime(defaultWarnTime),
    dangerThreshold: parseUserTime(defaultDangerTime),
  };
}
