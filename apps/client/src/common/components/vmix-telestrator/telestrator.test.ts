import { buildArrowPaths, distanceBetween, smoothTowards } from './telestrator';

describe('smoothTowards', () => {
  it('moves a fraction of the way toward the raw sample', () => {
    expect(smoothTowards({ x: 0, y: 0 }, { x: 100, y: 200 }, 0.4)).toEqual({ x: 40, y: 80 });
  });

  it('never overshoots the sample at alpha 1', () => {
    expect(smoothTowards({ x: 0, y: 0 }, { x: 100, y: 100 }, 1)).toEqual({ x: 100, y: 100 });
  });

  it('stays put at alpha 0', () => {
    expect(smoothTowards({ x: 10, y: 10 }, { x: 100, y: 100 }, 0)).toEqual({ x: 10, y: 10 });
  });

  it('converges on the sample when it is held still', () => {
    let point = { x: 0, y: 0 };
    for (let i = 0; i < 40; i++) {
      point = smoothTowards(point, { x: 100, y: 100 }, 0.4);
    }
    expect(point.x).toBeCloseTo(100, 3);
    expect(point.y).toBeCloseTo(100, 3);
  });

  it('damps jitter around a straight drag', () => {
    // a hand wobbling +/-8px either side of y=0 while moving right
    const jitter = [8, -8, 8, -8, 8, -8, 8, -8];
    let point = { x: 0, y: 0 };
    const ys: number[] = [];
    jitter.forEach((offset, index) => {
      point = smoothTowards(point, { x: index * 10, y: offset }, 0.4);
      ys.push(point.y);
    });

    // the filtered path swings far less than the raw input did
    const swing = Math.max(...ys) - Math.min(...ys);
    expect(swing).toBeLessThan(16);
  });
});

describe('distanceBetween', () => {
  it('measures euclidean distance', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distanceBetween({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });
});

describe('buildArrowPaths', () => {
  it('traces shaft, head, back to the tip, then the other head', () => {
    // the polyline must return to the tip so both head strokes start there
    const paths = buildArrowPaths({ x: 0, y: 0 }, { x: 400, y: 0 }, 10);
    expect(paths).toHaveLength(5);
    expect(paths[0]).toEqual({ x: 0, y: 0 });
    expect(paths[1]).toEqual({ x: 400, y: 0 });
    expect(paths[3]).toEqual({ x: 400, y: 0 });
  });

  it('puts the head behind the tip, symmetrical around the shaft', () => {
    const paths = buildArrowPaths({ x: 0, y: 0 }, { x: 400, y: 0 }, 10);
    const [, tip, headA, , headB] = paths;

    // both head points sit back along the shaft
    expect(headA.x).toBeLessThan(tip.x);
    expect(headB.x).toBeLessThan(tip.x);
    // and mirror each other across a horizontal shaft
    expect(headA.x).toBe(headB.x);
    expect(headA.y).toBe(-headB.y);
    expect(headA.y).not.toBe(0);
  });

  it('scales the head down for a short arrow so it cannot swallow the shaft', () => {
    const short = buildArrowPaths({ x: 0, y: 0 }, { x: 40, y: 0 }, 10);
    const [, tip, headA] = short;
    const headLength = Math.hypot(tip.x - headA.x, tip.y - headA.y);
    expect(headLength).toBeLessThan(40);
  });

  it('caps the head length on a long arrow', () => {
    const long = buildArrowPaths({ x: 0, y: 0 }, { x: 1600, y: 0 }, 10);
    const [, tip, headA] = long;
    const headLength = Math.hypot(tip.x - headA.x, tip.y - headA.y);
    // capped rather than growing to a third of the shaft
    expect(headLength).toBeLessThanOrEqual(60);
  });

  it('follows the shaft angle', () => {
    const paths = buildArrowPaths({ x: 0, y: 0 }, { x: 0, y: 400 }, 10);
    const [, tip, headA, , headB] = paths;
    // vertical shaft: the head mirrors across the vertical instead
    expect(headA.y).toBeLessThan(tip.y);
    expect(headB.y).toBeLessThan(tip.y);
    expect(headA.x).toBe(-headB.x);
  });

  it('degrades to a plain segment when there is no length yet', () => {
    const paths = buildArrowPaths({ x: 100, y: 100 }, { x: 100, y: 100 }, 10);
    expect(paths).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    ]);
  });

  it('returns integer coordinates, the protocol carries pixels', () => {
    const paths = buildArrowPaths({ x: 0, y: 0 }, { x: 333, y: 177 }, 10);
    paths.forEach((point) => {
      expect(Number.isInteger(point.x)).toBe(true);
      expect(Number.isInteger(point.y)).toBe(true);
    });
  });
});
