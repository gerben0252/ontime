import { useState } from 'react';

import { cx } from '../../common/utils/styleUtils';
import DeskPanel from './DeskPanel';
import { TEAM_PERFORMANCE_SHEETS, TeamPerformanceSheet } from './talentDesk.options';
import { Facts, LineupTeam, Scoreview, ScorePlayer, ScoreviewTeam } from './teamPerformance.utils';
import { useFacts, useLineup, useScoreview } from './useTeamPerformance';

import style from './TeamPerformance.module.scss';

const sheetLabels: Record<TeamPerformanceSheet, string> = {
  lineup: 'Lineup',
  facts: 'Statistieken',
  scoreview: 'Scoreview',
};

interface TeamPerformanceProps {
  ip: string;
  className?: string;
  /** row of the team currently pushed to the lineup overlay */
  shownTeamRow: number | null;
  onTeamPress: (team: LineupTeam) => void;
}

/**
 * The TeamPerformance datasources, presented as switchable sheets.
 * Only the visible sheet fetches, so the tabs also gate the polling.
 */
export default function TeamPerformance({ ip, className, shownTeamRow, onTeamPress }: TeamPerformanceProps) {
  const [sheet, setSheet] = useState<TeamPerformanceSheet>('lineup');

  const lineup = useLineup(ip, sheet === 'lineup');
  const facts = useFacts(ip, sheet === 'facts');
  const scoreview = useScoreview(ip, sheet === 'scoreview');

  return (
    <DeskPanel
      title='TeamPerformance'
      className={className}
      flush
      footer={
        <div className={style.tabs} role='tablist'>
          {TEAM_PERFORMANCE_SHEETS.map((name) => (
            <button
              key={name}
              type='button'
              role='tab'
              aria-selected={sheet === name}
              className={cx([style.tab, sheet === name && style.tabActive])}
              onClick={() => setSheet(name)}
            >
              {sheetLabels[name]}
            </button>
          ))}
        </div>
      }
    >
      {sheet === 'lineup' && <LineupSheet teams={lineup} shownTeamRow={shownTeamRow} onTeamPress={onTeamPress} />}
      {sheet === 'facts' && <FactsSheet facts={facts} />}
      {sheet === 'scoreview' && <ScoreviewSheet scoreview={scoreview} />}
    </DeskPanel>
  );
}

/* ------------------------------- lineup ------------------------------- */

interface LineupSheetProps {
  teams: LineupTeam[];
  shownTeamRow: number | null;
  onTeamPress: (team: LineupTeam) => void;
}

function LineupSheet({ teams, shownTeamRow, onTeamPress }: LineupSheetProps) {
  if (teams.length === 0) return <Empty />;

  return (
    <div className={style.columns}>
      {teams.map((team) => (
        <div className={style.column} key={team.ateam || team.row}>
          {/* tapping the header pushes this team to the lineup overlay */}
          <button
            type='button'
            className={cx([style.teamButton, shownTeamRow === team.row && style.teamButtonShown])}
            onClick={() => onTeamPress(team)}
          >
            <span className={style.teamName}>{team.team}</span>
            <span className={style.teamTag}>{shownTeamRow === team.row ? 'On air' : team.ateam}</span>
          </button>

          {team.coach && (
            <Group label='Coach'>
              <Row name={team.coach} />
            </Group>
          )}
          <Group label='Aanval'>
            {team.offense.map((player) => (
              <Row key={`${player.number}-${player.name}`} number={player.number} name={player.name} />
            ))}
          </Group>
          <Group label='Verdediging'>
            {team.defense.map((player) => (
              <Row key={`${player.number}-${player.name}`} number={player.number} name={player.name} />
            ))}
          </Group>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- facts -------------------------------- */

function FactsSheet({ facts }: { facts: Facts | null }) {
  if (!facts) return <Empty />;

  return (
    <div className={style.sheet}>
      <div className={style.scoreline}>
        <span className={style.scoreTeam}>{facts.homeTeam}</span>
        <span className={style.score}>
          {facts.homeScore} - {facts.guestScore}
        </span>
        <span className={cx([style.scoreTeam, style.scoreTeamRight])}>{facts.guestTeam}</span>
      </div>

      {facts.stats.map((stat) => (
        <div className={style.statRow} key={stat.name}>
          <span className={style.statValue}>{stat.home}</span>
          <span className={style.statName}>{stat.name}</span>
          <span className={cx([style.statValue, style.statValueRight])}>{stat.guest}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ scoreview ------------------------------ */

function ScoreviewSheet({ scoreview }: { scoreview: Scoreview | null }) {
  if (!scoreview) return <Empty />;

  return (
    <div className={style.columns}>
      <ScoreviewColumn team={scoreview.home} />
      <ScoreviewColumn team={scoreview.guest} />
    </div>
  );
}

function ScoreviewColumn({ team }: { team: ScoreviewTeam }) {
  return (
    <div className={style.column}>
      <div className={style.teamHeader}>
        <span className={style.teamName}>{team.team}</span>
        <span className={style.teamScore}>{team.score}</span>
      </div>
      <Group label='Aanval'>
        {team.offense.map((player) => (
          <ScoreRow key={`${player.number}-${player.name}`} player={player} />
        ))}
      </Group>
      <Group label='Verdediging'>
        {team.defense.map((player) => (
          <ScoreRow key={`${player.number}-${player.name}`} player={player} />
        ))}
      </Group>
      {team.other && (
        <Group label='Overig'>
          <ScoreRow player={team.other} />
        </Group>
      )}
    </div>
  );
}

function ScoreRow({ player }: { player: ScorePlayer }) {
  return <Row number={player.number} name={player.name} value={player.score} />;
}

/* ------------------------------- shared ------------------------------- */

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={style.group}>
      <div className={style.groupLabel}>{label}</div>
      {children}
    </div>
  );
}

function Row({ number, name, value }: { number?: string; name: string; value?: string }) {
  return (
    <div className={style.row}>
      <span className={style.rowNumber}>{number}</span>
      <span className={style.rowName}>{name}</span>
      {value !== undefined && <span className={style.rowValue}>{value}</span>}
    </div>
  );
}

function Empty() {
  return <div className={style.empty}>No data</div>;
}
