import { useViewportSize } from '@mantine/hooks';
import { OntimeView } from 'ontime-types';
import { useMemo } from 'react';

import RemainingBar from '../../common/components/remaining-bar/RemainingBar';
import EmptyPage from '../../common/components/state/EmptyPage';
import ViewParamsEditor from '../../common/components/view-params-editor/ViewParamsEditor';
import VmixVideo from '../../common/components/vmix-video/VmixVideo';
import { useScoreboard } from '../../common/hooks-query/useScoreboard';
import { useVmixStatus } from '../../common/hooks-query/useVmixStatus';
import { useAutoTickingClock } from '../../common/hooks/useAutoTickingClock';
import { useWindowTitle } from '../../common/hooks/useWindowTitle';
import { timerPlaceholderMin } from '../../common/utils/styleUtils';
import { formatTime, getDefaultFormat } from '../../common/utils/time';
import Loader from '../common/loader/Loader';
import { COLOR_DANGER, COLOR_WARNING, getPhaseColor, getVmixDisplay, toClock } from './talent.presentation';
import { DEFAULT_VMIX_PORT, getTalentOptions, useTalentOptions } from './talent.options';
import { TalentData, useTalentData } from './useTalentData';
import { useTalentState } from './useTalentState';

import './Talent.scss';

export default function TalentLoader() {
  const { data, status } = useTalentData();

  useWindowTitle('Talent');

  if (status === 'pending') {
    return <Loader />;
  }

  if (status === 'error') {
    return <EmptyPage text='There was an error fetching data, please refresh the page.' />;
  }

  return <Talent {...data} />;
}

function Talent({ entries, flatOrder, isMirrored, settings }: TalentData) {
  const { timeformat, talentPrefix, scoreboardUrl, vmixHost, vmixInput, vmixAuth } = useTalentOptions();

  const {
    nowSegment,
    nextSegment,
    nowNote,
    eventRemaining,
    eventDuration,
    groupRemaining,
    groupDuration,
    warningThreshold,
    dangerThreshold,
  } = useTalentState(entries, flatOrder, talentPrefix);

  const vmix = useVmixStatus(vmixHost, DEFAULT_VMIX_PORT, vmixInput);
  const scoreboard = useScoreboard(scoreboardUrl);
  const localClock = useAutoTickingClock();
  const { width, height } = useViewportSize();

  // view options editor
  const defaultFormat = getDefaultFormat(settings?.timeFormat);
  const talentOptions = useMemo(() => getTalentOptions(defaultFormat), [defaultFormat]);

  const eventPhaseColor = getPhaseColor(eventRemaining, warningThreshold, dangerThreshold);
  const groupPhaseColor = getPhaseColor(groupRemaining, warningThreshold, dangerThreshold);

  // canvas scaling: the design is a fixed 1920x1080 surface centered in the viewport
  const scale = Math.min(width / 1920, height / 1080) || 1;
  const offsetX = (width - 1920 * scale) / 2;
  const offsetY = (height - 1080 * scale) / 2;
  const canvasTransform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

  const vmixDisplay = getVmixDisplay(vmix);

  return (
    <div className='talent' data-testid='talent-view'>
      <ViewParamsEditor target={OntimeView.Talent} viewOptions={talentOptions} />
      <div className={`talent__mirror ${isMirrored ? 'talent__mirror--flip' : ''}`}>
        <div className='talent__canvas' style={{ transform: canvasTransform }}>
          {/* SEGMENT — remaining time of the current group */}
          <div className='talent__box talent__segment'>
            <div className='talent__box-title'>Time left</div>
            <div className='talent__box-time' style={{ color: groupPhaseColor }}>
              {toClock(groupRemaining)}
            </div>
            <div className='talent__box-status'>
              <RemainingBar
                current={groupRemaining}
                duration={groupDuration}
                warning={warningThreshold}
                danger={dangerThreshold}
                warningColor={COLOR_WARNING}
                dangerColor={COLOR_DANGER}
              />
            </div>
          </div>

          {/* vMix status */}
          <div className='talent__box talent__vmix'>
            <div className='talent__box-title'>On air</div>
            <div
              className={`talent__box-time ${vmixDisplay.text === 'STANDBY' ? 'talent__box-time--small' : ''}`}
              style={{ color: vmixDisplay.color }}
            >
              {vmixDisplay.text}
            </div>
          </div>

          {/* EVENT — remaining time of the current talent segment */}
          <div className='talent__box talent__event'>
            <div className='talent__box-title'>This item</div>
            <div className='talent__box-time' style={{ color: eventPhaseColor }}>
              {toClock(eventRemaining)}
            </div>
            <div className='talent__box-status'>
              <RemainingBar
                current={eventRemaining}
                duration={eventDuration}
                warning={warningThreshold}
                danger={dangerThreshold}
                warningColor={COLOR_WARNING}
                dangerColor={COLOR_DANGER}
              />
            </div>
          </div>

          {/* vMix live status bar */}
          <div className='talent__live-bar' style={{ background: vmixDisplay.barColor }} />

          {/* live video feed from vMix */}
          <VmixVideo className='talent__video' host={vmixHost} port={DEFAULT_VMIX_PORT} auth={vmixAuth} />

          {/* NOW */}
          <div className='talent__panel talent__now'>
            <div className='talent__panel-section'>
              <div className='talent__panel-title'>Now</div>
              <div className='talent__panel-value talent__panel-value--upper'>{nowSegment?.title ?? ''}</div>
            </div>
            {nowNote && (
              <div className='talent__panel-section'>
                <div className='talent__panel-title'>Notes</div>
                <div className='talent__panel-value talent__panel-notes'>{nowNote}</div>
              </div>
            )}
          </div>

          {/* NEXT */}
          <div className='talent__panel talent__next'>
            <div className='talent__panel-section'>
              <div className='talent__panel-title'>Next</div>
              <div className='talent__panel-value talent__panel-value--upper talent__next-value'>
                {nextSegment?.title ?? ''}
              </div>
            </div>
          </div>

          {/* SCOREBOARD TIME */}
          <div className='talent__meta talent__scoreboard'>
            <div className='talent__meta-value'>{scoreboard?.time ?? timerPlaceholderMin}</div>
            <div className='talent__meta-label'>Scoreboard</div>
          </div>

          {/* LOCAL TIME */}
          <div className='talent__meta talent__localtime'>
            <div className='talent__meta-value'>{formatTime(localClock, { override: timeformat })}</div>
            <div className='talent__meta-label'>Time now</div>
          </div>
        </div>
      </div>
    </div>
  );
}
