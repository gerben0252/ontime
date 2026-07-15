import { EntryId, OntimeEvent } from 'ontime-types';
import { dayInMs } from 'ontime-utils';

/**
 * A talent segment groups a talent event together with any "clone" of that same
 * talent event that follows it after an interrupting batch of non-talent events.
 *
 * Since Ontime cannot run two events simultaneously, a talent event may be split
 * by events meant for other roles (eg. a graphics operator). When that happens the
 * operator places a clone of the talent event (same title) after the batch.
 * From the talent's perspective the whole run is a single continuous segment, so
 * the remaining time must span from the start of the first talent event to the end
 * of the last clone.
 */
export interface TalentSegment {
  /** talent title with the prefix removed */
  title: string;
  /** index of the first (original) talent event within the ordered list */
  startIndex: number;
  /** index of the last clone within the ordered list */
  endIndex: number;
  /** normalised start time (ms, day offset applied) of the first talent event */
  timeStart: number;
  /** normalised end time (ms, day offset applied) of the last clone */
  timeEnd: number;
  /** ids of every event that belongs to this segment (talent events + interrupting batch) */
  memberIds: EntryId[];
}

/** Whether an event title carries the configured talent prefix */
export function isTalentEvent(event: OntimeEvent, prefix: string): boolean {
  const normalizedPrefix = prefix.trim().toUpperCase();
  if (normalizedPrefix.length === 0) return false;
  return event.title.trim().toUpperCase().startsWith(normalizedPrefix);
}

/** Removes the talent prefix from a title, returning the trimmed remainder */
export function stripTalentPrefix(title: string, prefix: string): string {
  const trimmedTitle = title.trim();
  const trimmedPrefix = prefix.trim();
  if (trimmedTitle.toUpperCase().startsWith(trimmedPrefix.toUpperCase())) {
    return trimmedTitle.slice(trimmedPrefix.length).trim();
  }
  return trimmedTitle;
}

/** normalised start time taking the day offset into account */
function normStart(event: OntimeEvent): number {
  return event.timeStart + event.dayOffset * dayInMs;
}

/** normalised end time (start + duration) taking the day offset into account */
function normEnd(event: OntimeEvent): number {
  return event.timeStart + event.duration + event.dayOffset * dayInMs;
}

/**
 * Builds the ordered list of talent segments from a list of events (usually the
 * events of the current group).
 *
 * Merging rule: starting from a talent event with title T we keep absorbing
 * following events as long as we can reach another talent event with the same
 * title T across only non-talent events (the interrupting batch). A talent event
 * with a different title starts a new segment.
 *
 * Pass the whole (flat) rundown: a segment never spans a group boundary, so NOW and
 * the segment timer stay scoped to the current group, while the resulting segment list
 * still covers the full rundown so NEXT can look into a following group.
 */
export function buildTalentSegments(events: OntimeEvent[], prefix: string): TalentSegment[] {
  const segments: TalentSegment[] = [];

  let i = 0;
  while (i < events.length) {
    const event = events[i];
    if (!isTalentEvent(event, prefix)) {
      i += 1;
      continue;
    }

    const title = stripTalentPrefix(event.title, prefix);
    const parent = event.parent;
    const memberIds: EntryId[] = [event.id];
    let endIndex = i;
    let timeEnd = normEnd(event);

    // ids seen since the last confirmed clone; only merged in when a clone actually follows
    const pending: EntryId[] = [];
    let j = i + 1;
    while (j < events.length) {
      const candidate = events[j];
      // a group boundary always ends the segment: clones are never merged across groups
      if (candidate.parent !== parent) break;
      if (isTalentEvent(candidate, prefix)) {
        if (stripTalentPrefix(candidate.title, prefix) === title) {
          // clone confirmed: absorb the interrupting batch and the clone itself
          memberIds.push(...pending, candidate.id);
          pending.length = 0;
          endIndex = j;
          timeEnd = normEnd(candidate);
          j += 1;
          continue;
        }
        // different talent title -> this segment ends here
        break;
      }
      // non-talent event, tentatively part of the batch until a clone confirms it
      pending.push(candidate.id);
      j += 1;
    }

    segments.push({
      title,
      startIndex: i,
      endIndex,
      timeStart: normStart(event),
      timeEnd,
      memberIds,
    });

    i = endIndex + 1;
  }

  return segments;
}

export interface TalentSelection {
  now: TalentSegment | null;
  next: TalentSegment | null;
}

/**
 * Resolves the NOW and NEXT talent segments for the currently selected event.
 *
 * NOW is the segment whose members contain the selected event (works even when
 * the selected event is a non-talent event inside the interrupting batch).
 * NEXT is the following segment, which already excludes same-title clones because
 * they were merged into NOW.
 */
export function selectTalentSegments(
  segments: TalentSegment[],
  events: OntimeEvent[],
  selectedEventId: EntryId | null,
): TalentSelection {
  if (segments.length === 0) {
    return { now: null, next: null };
  }

  const currentIndex = selectedEventId === null ? -1 : segments.findIndex((s) => s.memberIds.includes(selectedEventId));

  if (currentIndex !== -1) {
    return {
      now: segments[currentIndex],
      next: segments[currentIndex + 1] ?? null,
    };
  }

  // selected event is not part of any talent segment (orphan / non-talent gap)
  // fall back to the first segment that starts after the selected event
  const selectedOrder = selectedEventId === null ? -1 : events.findIndex((e) => e.id === selectedEventId);
  const upcoming = segments.find((s) => s.startIndex > selectedOrder) ?? null;
  return { now: null, next: upcoming };
}
