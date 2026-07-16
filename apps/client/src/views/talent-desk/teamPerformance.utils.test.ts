import { parseFacts, parseLineup, parsePlayer, parseScoreview, TeamPerformanceRow } from './teamPerformance.utils';

describe('parsePlayer', () => {
  it('splits the shirt number from the full name', () => {
    expect(parsePlayer('25. Nik van der Steen')).toEqual({ number: '25', name: 'Nik van der Steen' });
    expect(parsePlayer('5. Rosalie Peet')).toEqual({ number: '5', name: 'Rosalie Peet' });
  });

  it('handles names with diacritics', () => {
    expect(parsePlayer('13. Daniëlle Boadi')).toEqual({ number: '13', name: 'Daniëlle Boadi' });
  });

  it('tolerates missing or odd spacing', () => {
    expect(parsePlayer('9.Jeffrey van Huenen')).toEqual({ number: '9', name: 'Jeffrey van Huenen' });
    expect(parsePlayer('  21.   Wouter Wildschut ')).toEqual({ number: '21', name: 'Wouter Wildschut' });
  });

  it('falls back to the raw name when there is no number', () => {
    expect(parsePlayer('Onbekende speler')).toEqual({ number: '', name: 'Onbekende speler' });
  });

  it('returns null for empty entries', () => {
    expect(parsePlayer(null)).toBeNull();
    expect(parsePlayer('')).toBeNull();
    expect(parsePlayer('   ')).toBeNull();
  });
});

describe('parseLineup', () => {
  // trimmed copy of the real datasource payload
  const payload = [
    {
      Coach: null,
      DEF_PLAYER4: '21. Gertjan Meerkerk',
      DEF_PLAYER3: '20. Menno van der Neut',
      DEF_PLAYER2: '16. Roos Scherrenburg',
      DEF_PLAYER1: '11. Quinty Stahli',
      OFF_PLAYER4: '24. Koen van Roekel',
      OFF_PLAYER3: '13. Daniëlle Boadi',
      OFF_PLAYER2: '9. Jeffrey van Huenen',
      OFF_PLAYER1: '5. Rosalie Peet',
      TEAM: 'DVO/Transus',
      ATEAM: 'DVO',
      CLUB_LOGO: null,
      OFF_PLAYER1_IMG: null,
    },
    {
      Coach: null,
      DEF_PLAYER4: '25. Nik van der Steen',
      DEF_PLAYER3: '18. Jordi van Elburg',
      DEF_PLAYER2: '8. Lindsy Krop',
      DEF_PLAYER1: '2. Roos van Groen',
      OFF_PLAYER4: '21. Wouter Wildschut',
      OFF_PLAYER3: '14. Merijn Mensink',
      OFF_PLAYER2: '12. Fleur Hoek',
      OFF_PLAYER1: '6. Renée van Ginkel',
      TEAM: 'Fortuna/Ruitenheer',
      ATEAM: 'FOR',
      CLUB_LOGO: null,
      OFF_PLAYER1_IMG: null,
    },
  ] as unknown as TeamPerformanceRow[];

  it('maps the array index to the vMix datasource row', () => {
    const teams = parseLineup(payload);
    expect(teams[0].ateam).toBe('DVO');
    expect(teams[0].row).toBe(0);
    expect(teams[1].ateam).toBe('FOR');
    expect(teams[1].row).toBe(1);
  });

  it('collects offense and defense in player order', () => {
    const [dvo] = parseLineup(payload);
    expect(dvo.offense.map((p) => p.number)).toEqual(['5', '9', '13', '24']);
    expect(dvo.defense.map((p) => p.number)).toEqual(['11', '16', '20', '21']);
    expect(dvo.offense[0]).toEqual({ number: '5', name: 'Rosalie Peet' });
  });

  it('keeps the full and short team names', () => {
    const [dvo] = parseLineup(payload);
    expect(dvo.team).toBe('DVO/Transus');
    expect(dvo.ateam).toBe('DVO');
  });

  it('skips players which are not filled in', () => {
    const sparse = [{ ...payload[0], DEF_PLAYER3: null, DEF_PLAYER4: null }] as unknown as TeamPerformanceRow[];
    const [team] = parseLineup(sparse);
    expect(team.defense.map((p) => p.number)).toEqual(['11', '16']);
  });
});

describe('parseFacts', () => {
  // trimmed copy of the real facts payload, including its padded whitespace
  const payload = [
    {
      STAT_NAME1: 'Goals',
      STAT_LEFT1: '0/0 - 0%',
      STAT_RIGHT1: '1/2 - 50%',
      STAT_NAME2: 'Afstand',
      STAT_LEFT2: '0/0 - 0%',
      STAT_RIGHT2: '0/0 - 0%',
      STAT_NAME10: 'Kaarten',
      STAT_LEFT10: '  0       0',
      STAT_RIGHT10: '  0       0',
      TITLE: 'Statistieken',
      HOMETEAM: 'DVO/Transus',
      GUESTTEAM: 'Fortuna/Ruitenheer',
      HOMESCORE: '3',
      GUESTSCORE: '5',
      HOMECLUB_LOGO: null,
    },
  ] as unknown as TeamPerformanceRow[];

  it('collects only the filled stat slots, in order', () => {
    const facts = parseFacts(payload);
    expect(facts?.stats.map((s) => s.name)).toEqual(['Goals', 'Afstand', 'Kaarten']);
    expect(facts?.stats[0]).toEqual({ name: 'Goals', home: '0/0 - 0%', guest: '1/2 - 50%' });
  });

  it('collapses the padded whitespace the datasource sends', () => {
    const facts = parseFacts(payload);
    expect(facts?.stats[2]).toEqual({ name: 'Kaarten', home: '0 0', guest: '0 0' });
  });

  it('reads the scoreline', () => {
    const facts = parseFacts(payload);
    expect(facts?.title).toBe('Statistieken');
    expect(facts?.homeTeam).toBe('DVO/Transus');
    expect(facts?.homeScore).toBe('3');
    expect(facts?.guestScore).toBe('5');
  });

  it('returns null for an empty payload', () => {
    expect(parseFacts([])).toBeNull();
  });
});

describe('parseScoreview', () => {
  // trimmed copy of the real scoreview payload
  const payload = [
    {
      H_OFF_PLAYER1: '24. Koen van Roekel',
      H_OFF_SCORE1: '2',
      H_DEF_PLAYER1: '21. Gertjan Meerkerk',
      H_DEF_SCORE1: '0',
      H_OTHERPLAYER: 'Andere spelers',
      H_OTHERSCORE: '1',
      G_OFF_PLAYER1: '14. Merijn Mensink',
      G_OFF_SCORE1: '3',
      G_DEF_PLAYER1: '25. Nik van der Steen',
      G_DEF_SCORE1: '0',
      G_OTHERPLAYER: 'Andere spelers',
      G_OTHERSCORE: '0',
      HOMETEAM: 'DVO/Transus',
      HOMESCORE: '3',
      GUESTTEAM: 'Fortuna/Ruitenheer',
      GUESTSCORE: '3',
    },
  ] as unknown as TeamPerformanceRow[];

  it('splits home and guest onto their own teams', () => {
    const view = parseScoreview(payload);
    expect(view?.home.team).toBe('DVO/Transus');
    expect(view?.guest.team).toBe('Fortuna/Ruitenheer');
    expect(view?.home.score).toBe('3');
  });

  it('pairs each player with their score', () => {
    const view = parseScoreview(payload);
    expect(view?.home.offense[0]).toEqual({ number: '24', name: 'Koen van Roekel', score: '2' });
    expect(view?.guest.offense[0]).toEqual({ number: '14', name: 'Merijn Mensink', score: '3' });
    expect(view?.home.defense[0]).toEqual({ number: '21', name: 'Gertjan Meerkerk', score: '0' });
  });

  it('keeps the aggregate row, which carries no shirt number', () => {
    const view = parseScoreview(payload);
    expect(view?.home.other).toEqual({ number: '', name: 'Andere spelers', score: '1' });
  });

  it('returns null for an empty payload', () => {
    expect(parseScoreview([])).toBeNull();
  });
});
