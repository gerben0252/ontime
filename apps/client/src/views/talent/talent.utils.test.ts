import { OntimeEvent, SupportedEntry } from 'ontime-types';
import { dayInMs } from 'ontime-utils';

import { buildTalentSegments, isTalentEvent, selectTalentSegments, stripTalentPrefix } from './talent.utils';

const PREFIX = 'TALENT -';

/** Minimal event builder — only the fields exercised by the segment logic are set. */
function makeEvent(patch: Partial<OntimeEvent> & { id: string; title: string }): OntimeEvent {
  return {
    type: SupportedEntry.Event,
    timeStart: 0,
    duration: 0,
    dayOffset: 0,
    ...patch,
  } as OntimeEvent;
}

describe('isTalentEvent / stripTalentPrefix', () => {
  it('recognises the prefix case-insensitively', () => {
    expect(isTalentEvent(makeEvent({ id: 'a', title: 'TALENT - Coach' }), PREFIX)).toBe(true);
    expect(isTalentEvent(makeEvent({ id: 'b', title: 'talent - coach' }), PREFIX)).toBe(true);
    expect(isTalentEvent(makeEvent({ id: 'c', title: 'Graphics lower third' }), PREFIX)).toBe(false);
  });

  it('strips the prefix and trims', () => {
    expect(stripTalentPrefix('TALENT - Coach TOP', PREFIX)).toBe('Coach TOP');
    expect(stripTalentPrefix('Coach TOP', PREFIX)).toBe('Coach TOP');
  });
});

describe('buildTalentSegments', () => {
  it('ignores non-talent events', () => {
    const events = [
      makeEvent({ id: '1', title: 'Graphics' }),
      makeEvent({ id: '2', title: 'Wide shot' }),
    ];
    expect(buildTalentSegments(events, PREFIX)).toHaveLength(0);
  });

  it('creates one segment per standalone talent event', () => {
    const events = [
      makeEvent({ id: '1', title: 'TALENT - Intro', timeStart: 0, duration: 60_000 }),
      makeEvent({ id: '2', title: 'TALENT - Interview', timeStart: 60_000, duration: 120_000 }),
    ];
    const segments = buildTalentSegments(events, PREFIX);
    expect(segments.map((s) => s.title)).toEqual(['Intro', 'Interview']);
    expect(segments[0].timeStart).toBe(0);
    expect(segments[0].timeEnd).toBe(60_000);
    expect(segments[1].timeEnd).toBe(180_000);
  });

  it('merges a clone across an interrupting non-talent batch', () => {
    const events = [
      makeEvent({ id: 'a', title: 'TALENT - Interview', timeStart: 0, duration: 60_000 }),
      makeEvent({ id: 'gfx', title: 'Graphics lower third', timeStart: 60_000, duration: 30_000 }),
      makeEvent({ id: 'b', title: 'TALENT - Interview', timeStart: 90_000, duration: 60_000 }),
    ];
    const segments = buildTalentSegments(events, PREFIX);
    expect(segments).toHaveLength(1);
    expect(segments[0].title).toBe('Interview');
    // spans from start of first talent event to end of the clone
    expect(segments[0].timeStart).toBe(0);
    expect(segments[0].timeEnd).toBe(150_000);
    // the interrupting batch is part of the segment
    expect(segments[0].memberIds).toEqual(['a', 'gfx', 'b']);
  });

  it('does not merge across a different talent title', () => {
    const events = [
      makeEvent({ id: 'a', title: 'TALENT - Interview', timeStart: 0, duration: 60_000 }),
      makeEvent({ id: 'gfx', title: 'Graphics', timeStart: 60_000, duration: 10_000 }),
      makeEvent({ id: 'b', title: 'TALENT - Weather', timeStart: 70_000, duration: 60_000 }),
    ];
    const segments = buildTalentSegments(events, PREFIX);
    expect(segments.map((s) => s.title)).toEqual(['Interview', 'Weather']);
    // the trailing non-talent event before a different title is not absorbed
    expect(segments[0].memberIds).toEqual(['a']);
  });

  it('applies the day offset to the normalised times', () => {
    const events = [makeEvent({ id: 'a', title: 'TALENT - Late', timeStart: 0, duration: 60_000, dayOffset: 1 })];
    const segments = buildTalentSegments(events, PREFIX);
    expect(segments[0].timeStart).toBe(dayInMs);
    expect(segments[0].timeEnd).toBe(dayInMs + 60_000);
  });
});

describe('selectTalentSegments', () => {
  const events = [
    makeEvent({ id: 'a', title: 'TALENT - Interview', timeStart: 0, duration: 60_000 }),
    makeEvent({ id: 'gfx', title: 'Graphics', timeStart: 60_000, duration: 30_000 }),
    makeEvent({ id: 'b', title: 'TALENT - Interview', timeStart: 90_000, duration: 60_000 }),
    makeEvent({ id: 'c', title: 'TALENT - Weather', timeStart: 150_000, duration: 60_000 }),
  ];
  const segments = buildTalentSegments(events, PREFIX);

  it('resolves now/next when on the original talent event', () => {
    const { now, next } = selectTalentSegments(segments, events, 'a');
    expect(now?.title).toBe('Interview');
    expect(next?.title).toBe('Weather');
  });

  it('keeps now on the segment while inside the interrupting batch', () => {
    const { now, next } = selectTalentSegments(segments, events, 'gfx');
    expect(now?.title).toBe('Interview');
    expect(next?.title).toBe('Weather');
  });

  it('treats the clone as part of now, not as next', () => {
    const { now, next } = selectTalentSegments(segments, events, 'b');
    expect(now?.title).toBe('Interview');
    expect(next?.title).toBe('Weather');
  });

  it('falls back to the upcoming segment for an orphan selection', () => {
    const orphanEvents = [
      makeEvent({ id: 'pre', title: 'Countdown', timeStart: 0, duration: 10_000 }),
      makeEvent({ id: 't', title: 'TALENT - Show', timeStart: 10_000, duration: 60_000 }),
    ];
    const orphanSegments = buildTalentSegments(orphanEvents, PREFIX);
    const { now, next } = selectTalentSegments(orphanSegments, orphanEvents, 'pre');
    expect(now).toBeNull();
    expect(next?.title).toBe('Show');
  });
});
