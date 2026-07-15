import { useViewportSize } from '@mantine/hooks';
import { MaybeNumber, OffsetMode, OntimeEvent, OntimeView, SupportedEntry, TimerPhase } from 'ontime-types';
import { dayInMs, isPlaybackActive, millisToString, parseUserTime, removeLeadingZero } from 'ontime-utils';
import { useMemo } from 'react';

import EmptyPage from '../../common/components/state/EmptyPage';
import ViewParamsEditor from '../../common/components/view-params-editor/ViewParamsEditor';
import { useAnimatedProgress } from '../../common/hooks/useAnimatedProgress';
import { useAutoTickingClock } from '../../common/hooks/useAutoTickingClock';
import { useTalentSocket } from '../../common/hooks/useSocket';
import { useWindowTitle } from '../../common/hooks/useWindowTitle';
import { useEditorSettings } from '../../common/stores/editorSettings';
import { timerPlaceholderMin } from '../../common/utils/styleUtils';
import { formatTime, getDefaultFormat } from '../../common/utils/time';
import Loader from '../common/loader/Loader';
import { DEFAULT_VMIX_PORT, getTalentOptions, useTalentOptions } from './talent.options';
import { buildTalentSegments, isTalentEvent, selectTalentSegments } from './talent.utils';
import { TalentData, useTalentData } from './useTalentData';
import { useScoreboard } from './useScoreboard';
import { useVmixStatus, VmixStatus } from './useVmixStatus';

import './Talent.scss';

const COLOR_LIVE = '#FF383C';
const COLOR_PREVIEW = '#34C759';
const COLOR_IDLE = '#8E8E93';

// warning/danger colours for the timer boxes: danger matches the LIVE red, warning a clear orange
const COLOR_WARNING = '#FF9500';
const COLOR_DANGER = COLOR_LIVE;

function toClock(value: MaybeNumber): string {
  return removeLeadingZero(millisToString(value, { fallback: timerPlaceholderMin }));
}

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

function Talent({ entries, isMirrored, settings }: TalentData) {
  const { timeformat, talentPrefix, scoreboardUrl, vmixHost, vmixInput } = useTalentOptions();
  const { eventNow, groupNow, time, clock, currentDay, actualGroupStart, groupExpectedEnd, offsetMode } =
    useTalentSocket();

  const vmix = useVmixStatus(vmixHost, DEFAULT_VMIX_PORT, vmixInput);
  const scoreboard = useScoreboard(scoreboardUrl);
  const localClock = useAutoTickingClock();
  const { width, height } = useViewportSize();

  // default warning/danger thresholds configured in the Ontime settings
  const defaultWarnTime = useEditorSettings((state) => state.defaultWarnTime);
  const defaultDangerTime = useEditorSettings((state) => state.defaultDangerTime);

  // view options editor
  const defaultFormat = getDefaultFormat(settings?.timeFormat);
  const talentOptions = useMemo(() => getTalentOptions(defaultFormat), [defaultFormat]);

  // ordered events of the current group
  const groupEvents = useMemo(() => {
    if (!groupNow) return [];
    return groupNow.entries
      .map((id) => entries[id])
      .filter((entry): entry is OntimeEvent => entry?.type === SupportedEntry.Event);
  }, [groupNow, entries]);

  const segments = useMemo(() => buildTalentSegments(groupEvents, talentPrefix), [groupEvents, talentPrefix]);
  const { now: nowSegment, next: nextSegment } = useMemo(
    () => selectTalentSegments(segments, groupEvents, eventNow?.id ?? null),
    [segments, groupEvents, eventNow?.id],
  );

  const isRunning = isPlaybackActive(time.playback) && time.phase !== TimerPhase.Pending;
  const normalizedClock = clock + currentDay * dayInMs;

  // EVENT: remaining time of the current talent segment (spans interrupting batches / clones)
  // Derive from the server authoritative running timer (offset aware) plus the scheduled tail
  // between the running event's end and the segment end. Planned times alone would clamp to 0
  // whenever the show runs behind schedule.
  const eventDuration = nowSegment ? nowSegment.timeEnd - nowSegment.timeStart : null;
  const eventRemaining = (() => {
    if (!nowSegment || !isRunning || !eventNow || time.current === null) return null;
    const runningEventEnd = eventNow.timeStart + eventNow.duration + eventNow.dayOffset * dayInMs;
    const tail = Math.max(0, nowSegment.timeEnd - runningEventEnd);
    return Math.max(0, time.current + tail);
  })();

  // SEGMENT: remaining time of the current group
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

  // Warning / danger thresholds. Both boxes use the configurable default thresholds from the
  // Ontime settings (same source that seeds the viewer thresholds), applied against their own
  // remaining time. Groups carry no native thresholds so this is also the group source.
  const warningThreshold = parseUserTime(defaultWarnTime);
  const dangerThreshold = parseUserTime(defaultDangerTime);

  const eventPhaseColor = getPhaseColor(eventRemaining, warningThreshold, dangerThreshold);
  const groupPhaseColor = getPhaseColor(groupRemaining, warningThreshold, dangerThreshold);

  // NOW notes: prefer the running talent event, otherwise the original talent event of the segment
  const nowNote = (() => {
    if (!nowSegment) return '';
    if (eventNow && isTalentEvent(eventNow, talentPrefix) && nowSegment.memberIds.includes(eventNow.id)) {
      return eventNow.note;
    }
    const firstMember = entries[nowSegment.memberIds[0]];
    return firstMember?.type === SupportedEntry.Event ? firstMember.note : '';
  })();

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

          {/* program / preview video area */}
          <div className='talent__video' />

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

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

/** Returns the warning/danger colour for a remaining time, or undefined when in the normal phase */
function getPhaseColor(remaining: MaybeNumber, warning: MaybeNumber, danger: MaybeNumber): string | undefined {
  if (remaining === null) return undefined;
  if (danger !== null && remaining <= danger) return COLOR_DANGER;
  if (warning !== null && remaining <= warning) return COLOR_WARNING;
  return undefined;
}

interface RemainingBarProps {
  current: MaybeNumber;
  duration: MaybeNumber;
  warning: MaybeNumber;
  danger: MaybeNumber;
  warningColor: string;
  dangerColor: string;
}

function RemainingBar({ current, duration, warning, danger, warningColor, dangerColor }: RemainingBarProps) {
  const progress = useAnimatedProgress(current, duration);
  const total = duration !== null && duration > 0 ? duration : null;
  const dangerPct = total !== null && danger !== null ? clampPct((danger / total) * 100) : 0;
  const warningPct = total !== null && warning !== null ? Math.max(0, clampPct((warning / total) * 100) - dangerPct) : 0;

  return (
    <div className='talent__bar'>
      {/* warning/danger zones sit on the not-yet-elapsed (right) side of the track */}
      <div className='talent__bar-zones'>
        <div className='talent__bar-normal' />
        <div className='talent__bar-warning' style={{ width: `${warningPct}%`, backgroundColor: warningColor }} />
        <div className='talent__bar-danger' style={{ width: `${dangerPct}%`, backgroundColor: dangerColor }} />
      </div>
      {/* dark fill covers the elapsed portion from the left */}
      <div className='talent__bar-fill' style={{ width: `${progress}%` }} />
    </div>
  );
}

interface VmixDisplay {
  text: string;
  color: string;
  barColor: string;
}

function getVmixDisplay(vmix: VmixStatus): VmixDisplay {
  switch (vmix.state) {
    case 'live':
      return { text: 'LIVE', color: COLOR_LIVE, barColor: COLOR_LIVE };
    case 'preview': {
      // exception: while in preview, show the on-air media countdown in green instead of STANDBY
      const text =
        vmix.programRemaining !== null && vmix.programRemaining > 0 ? toClock(vmix.programRemaining) : 'STANDBY';
      return { text, color: COLOR_PREVIEW, barColor: COLOR_PREVIEW };
    }
    default:
      return { text: 'OFF', color: COLOR_IDLE, barColor: '#404040' };
  }
}
