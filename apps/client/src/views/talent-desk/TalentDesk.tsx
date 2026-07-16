import { OntimeView } from 'ontime-types';
import { useMemo, useState } from 'react';
import { LuChevronRight, LuPen } from 'react-icons/lu';
import { Link } from 'react-router';

import RemainingBar from '../../common/components/remaining-bar/RemainingBar';
import EmptyPage from '../../common/components/state/EmptyPage';
import ViewParamsEditor from '../../common/components/view-params-editor/ViewParamsEditor';
import useCustomFields from '../../common/hooks-query/useCustomFields';
import { useWindowTitle } from '../../common/hooks/useWindowTitle';
import { cx } from '../../common/utils/styleUtils';
import { DEFAULT_VMIX_PORT, vmixOverlayIn, vmixOverlayOut, vmixSelectDataSourceRow } from '../../common/utils/vmix';
import Loader from '../common/loader/Loader';
import { MERGE_DURATION, PRESENTER_FIELD, TALENT_PREFIX, VMIX_FRAGMENT_PREFIX } from '../talent/talent.constants';
import { COLOR_DANGER, COLOR_WARNING, getPhaseColor, toClock } from '../talent/talent.presentation';
import { TalentData, useTalentData } from '../talent/useTalentData';
import { useTalentState } from '../talent/useTalentState';
import DeskPanel from './DeskPanel';
import { getTalentDeskOptions, useTalentDeskOptions } from './talentDesk.options';
import TalentNotesDialog from './TalentNotesDialog';
import TeamPerformance from './TeamPerformance';
import { LineupTeam } from './teamPerformance.utils';
import { useFragments } from './useFragments';

import './TalentDesk.scss';

export default function TalentDeskLoader() {
  const { data, status } = useTalentData();

  useWindowTitle('Talent desk');

  if (status === 'pending') {
    return <Loader />;
  }

  if (status === 'error') {
    return <EmptyPage text='There was an error fetching data, please refresh the page.' />;
  }

  return <TalentDesk {...data} />;
}

function TalentDesk({ entries, flatOrder }: TalentData) {
  const { teamPerformanceIp, vmixHost, vmixDatasource, lineupInput, lineupOverlay } = useTalentDeskOptions();

  const {
    nowNote,
    nowTalentEvent,
    talentEvents,
    eventRemaining,
    eventDuration,
    groupRemaining,
    groupDuration,
    warningThreshold,
    dangerThreshold,
  } = useTalentState(entries, flatOrder, TALENT_PREFIX);

  const fragments = useFragments(vmixHost, VMIX_FRAGMENT_PREFIX, MERGE_DURATION);
  const { data: customFields } = useCustomFields();

  /** row of the team currently pushed to the lineup overlay, null when the overlay is out */
  const [shownTeamRow, setShownTeamRow] = useState<number | null>(null);
  const [isNotesOpen, setNotesOpen] = useState(false);

  // presenter notes of the talent event on air, shown under the event note
  const presenterNotes = (nowTalentEvent?.custom[PRESENTER_FIELD] as string | undefined) ?? '';
  const presenterLabel = customFields[PRESENTER_FIELD]?.label ?? 'Presenter notes';

  const deskOptions = useMemo(() => getTalentDeskOptions(), []);

  const eventPhaseColor = getPhaseColor(eventRemaining, warningThreshold, dangerThreshold);
  const groupPhaseColor = getPhaseColor(groupRemaining, warningThreshold, dangerThreshold);

  /**
   * Tapping a team selects its row in the vMix data source and brings the lineup overlay in.
   * Tapping the team that is already shown takes the overlay back out.
   */
  const onTeamPress = async (team: LineupTeam) => {
    if (!vmixHost) return;

    if (shownTeamRow === team.row) {
      setShownTeamRow(null);
      await vmixOverlayOut(vmixHost, DEFAULT_VMIX_PORT, lineupOverlay);
      return;
    }

    setShownTeamRow(team.row);
    // the row must be selected before the overlay comes in, otherwise the graphic shows the old team
    await vmixSelectDataSourceRow(vmixHost, DEFAULT_VMIX_PORT, vmixDatasource, team.row);
    if (lineupInput) {
      await vmixOverlayIn(vmixHost, DEFAULT_VMIX_PORT, lineupOverlay, lineupInput);
    }
  };

  return (
    <div className='desk' data-testid='talent-desk-view'>
      <ViewParamsEditor target={OntimeView.TalentDesk} viewOptions={deskOptions} />

      <DeskPanel title='Time left' className='desk__timeleft'>
        <div className='desk__time' style={{ color: groupPhaseColor }}>
          {toClock(groupRemaining)}
        </div>
        <RemainingBar
          current={groupRemaining}
          duration={groupDuration}
          warning={warningThreshold}
          danger={dangerThreshold}
          warningColor={COLOR_WARNING}
          dangerColor={COLOR_DANGER}
        />
      </DeskPanel>

      <DeskPanel title='This item' className='desk__thisitem'>
        <div className='desk__time' style={{ color: eventPhaseColor }}>
          {toClock(eventRemaining)}
        </div>
        <RemainingBar
          current={eventRemaining}
          duration={eventDuration}
          warning={warningThreshold}
          danger={dangerThreshold}
          warningColor={COLOR_WARNING}
          dangerColor={COLOR_DANGER}
        />
      </DeskPanel>

      <TeamPerformance
        ip={teamPerformanceIp}
        className='desk__teamperformance'
        shownTeamRow={shownTeamRow}
        onTeamPress={onTeamPress}
      />

      <div className='desk__side'>
        <DeskPanel
          title='Notes'
          className='desk__notes'
          action={
            <button type='button' className='desk__notes-edit' onClick={() => setNotesOpen(true)}>
              Edit
            </button>
          }
        >
          {nowNote && <div className='desk__notes-value'>{nowNote}</div>}
          {presenterNotes && (
            <div className='desk__notes-section'>
              <div className='desk__notes-label'>{presenterLabel}</div>
              <div className='desk__notes-value desk__notes-value--presenter'>{presenterNotes}</div>
            </div>
          )}
        </DeskPanel>

        <DeskPanel title='Fragmenten' className='desk__fragments'>
          {fragments.inputs.length === 0 ? (
            <div className='desk__fragments-empty'>No vMix inputs matching “{VMIX_FRAGMENT_PREFIX}”</div>
          ) : (
            <div className='desk__fragments-grid'>
              {fragments.inputs.map((input) => {
                const isLive = input.number === fragments.active;
                return (
                  <button
                    key={input.number}
                    type='button'
                    className={cx(['desk__button', isLive && 'desk__button--live'])}
                    // a live fragment can only be stopped once we know where to return to
                    disabled={fragments.isDisabled(input.number)}
                    title={isLive ? 'Back to studio' : undefined}
                    onClick={() => fragments.press(input.number)}
                  >
                    {input.label}
                  </button>
                );
              })}
            </div>
          )}
        </DeskPanel>

        {/* switching to the telestrator is a mode change, so it reads as its own action
            rather than a link tucked into a panel header */}
        <Link to='/talent-telestrator' className='desk__telestrator'>
          <LuPen className='desk__telestrator-icon' />
          <span className='desk__telestrator-label'>Telestrator</span>
          <LuChevronRight className='desk__telestrator-chevron' />
        </Link>
      </div>

      <TalentNotesDialog
        isOpen={isNotesOpen}
        onClose={() => setNotesOpen(false)}
        talentEvents={talentEvents}
        entries={entries}
        field={PRESENTER_FIELD}
        talentPrefix={TALENT_PREFIX}
        currentEventId={nowTalentEvent?.id ?? null}
      />
    </div>
  );
}
