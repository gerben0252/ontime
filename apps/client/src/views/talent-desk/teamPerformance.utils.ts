/**
 * Parsers for the TeamPerformance datasources.
 * All endpoints answer with a single element array and use image/logo fields
 * which this view intentionally ignores.
 */

export type TeamPerformanceRow = Record<string, string | null>;

export interface Player {
  /** shirt number, eg. "25". Empty for entries without one, such as "Andere spelers" */
  number: string;
  /** full name, eg. "Nik van der Steen" */
  name: string;
}

/**
 * Splits "25. Nik van der Steen" into its shirt number and full name.
 * Falls back to the raw string as the name when there is no leading number.
 */
export function parsePlayer(raw: string | null): Player | null {
  if (!raw) return null;
  const match = /^\s*(\d+)\s*\.\s*(.+)$/.exec(raw);
  if (!match) {
    const name = raw.trim();
    return name ? { number: '', name } : null;
  }
  return { number: match[1], name: match[2].trim() };
}

/* ------------------------------- lineup ------------------------------- */

export interface LineupTeam {
  /** full team name, eg. "DVO/Transus" */
  team: string;
  /** short team name, eg. "DVO" */
  ateam: string;
  coach: string | null;
  offense: Player[];
  defense: Player[];
  /** zero based row of this team in the vMix data source */
  row: number;
}

/** collects PLAYER1..4 for a prefix, skipping entries which are not filled in */
function collectPlayers(entry: TeamPerformanceRow, prefix: string): Player[] {
  const players: Player[] = [];
  for (let i = 1; i <= 4; i++) {
    const player = parsePlayer(entry[`${prefix}${i}`]);
    if (player) players.push(player);
  }
  return players;
}

/**
 * Maps the lineup payload to the view model.
 * The array order is meaningful: it is the row index used by vMix DataSourceSelectRow.
 */
export function parseLineup(data: TeamPerformanceRow[]): LineupTeam[] {
  return data.map((entry, row) => ({
    team: entry.TEAM ?? '',
    ateam: entry.ATEAM ?? '',
    coach: entry.Coach,
    offense: collectPlayers(entry, 'OFF_PLAYER'),
    defense: collectPlayers(entry, 'DEF_PLAYER'),
    row,
  }));
}

/* -------------------------------- facts -------------------------------- */

export interface FactsStat {
  name: string;
  home: string;
  guest: string;
}

export interface Facts {
  title: string;
  homeTeam: string;
  guestTeam: string;
  homeScore: string;
  guestScore: string;
  stats: FactsStat[];
}

/** number of STAT_ slots the facts datasource exposes */
const FACTS_STAT_SLOTS = 10;

/** normalises the odd whitespace the datasource pads some values with */
function clean(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function parseFacts(data: TeamPerformanceRow[]): Facts | null {
  const entry = data[0];
  if (!entry) return null;

  const stats: FactsStat[] = [];
  for (let i = 1; i <= FACTS_STAT_SLOTS; i++) {
    const name = clean(entry[`STAT_NAME${i}`]);
    if (!name) continue;
    stats.push({
      name,
      home: clean(entry[`STAT_LEFT${i}`]),
      guest: clean(entry[`STAT_RIGHT${i}`]),
    });
  }

  return {
    title: clean(entry.TITLE) || 'Statistieken',
    homeTeam: clean(entry.HOMETEAM),
    guestTeam: clean(entry.GUESTTEAM),
    homeScore: clean(entry.HOMESCORE),
    guestScore: clean(entry.GUESTSCORE),
    stats,
  };
}

/* ------------------------------ scoreview ------------------------------ */

export interface ScorePlayer extends Player {
  score: string;
}

export interface ScoreviewTeam {
  team: string;
  score: string;
  offense: ScorePlayer[];
  defense: ScorePlayer[];
  /** aggregate row for players not in the starting eight */
  other: ScorePlayer | null;
}

export interface Scoreview {
  home: ScoreviewTeam;
  guest: ScoreviewTeam;
}

/** collects the four numbered player/score pairs for a side and line, eg. H_OFF_ */
function collectScorers(entry: TeamPerformanceRow, side: 'H' | 'G', line: 'OFF' | 'DEF'): ScorePlayer[] {
  const players: ScorePlayer[] = [];
  for (let i = 1; i <= 4; i++) {
    const player = parsePlayer(entry[`${side}_${line}_PLAYER${i}`]);
    if (!player) continue;
    players.push({ ...player, score: clean(entry[`${side}_${line}_SCORE${i}`]) });
  }
  return players;
}

function parseScoreviewTeam(entry: TeamPerformanceRow, side: 'H' | 'G'): ScoreviewTeam {
  const otherPlayer = parsePlayer(entry[`${side}_OTHERPLAYER`]);

  return {
    team: clean(entry[side === 'H' ? 'HOMETEAM' : 'GUESTTEAM']),
    score: clean(entry[side === 'H' ? 'HOMESCORE' : 'GUESTSCORE']),
    offense: collectScorers(entry, side, 'OFF'),
    defense: collectScorers(entry, side, 'DEF'),
    other: otherPlayer ? { ...otherPlayer, score: clean(entry[`${side}_OTHERSCORE`]) } : null,
  };
}

export function parseScoreview(data: TeamPerformanceRow[]): Scoreview | null {
  const entry = data[0];
  if (!entry) return null;

  return {
    home: parseScoreviewTeam(entry, 'H'),
    guest: parseScoreviewTeam(entry, 'G'),
  };
}
