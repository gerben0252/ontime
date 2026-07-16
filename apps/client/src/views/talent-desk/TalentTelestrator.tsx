import { OntimeView } from 'ontime-types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoArrowBack } from 'react-icons/io5';
import { LuCheck, LuEraser, LuMoveUpRight, LuPause, LuPen, LuPlay, LuRewind, LuFastForward, LuTv, LuUndo2 } from 'react-icons/lu';
import { Link } from 'react-router';

import EmptyPage from '../../common/components/state/EmptyPage';
import ViewParamsEditor from '../../common/components/view-params-editor/ViewParamsEditor';
import { Telestrator, TelestratorTool } from '../../common/components/vmix-telestrator/telestrator';
import VmixVideo from '../../common/components/vmix-video/VmixVideo';
import useCustomFields from '../../common/hooks-query/useCustomFields';
import { useVmixAuth } from '../../common/hooks-query/useVmixAuth';
import { findVmixInput, useVmixSnapshot } from '../../common/hooks-query/useVmixSnapshot';
import { useWindowTitle } from '../../common/hooks/useWindowTitle';
import { cx } from '../../common/utils/styleUtils';
import { DEFAULT_VMIX_PORT, sendVmixFunction } from '../../common/utils/vmix';
import Loader from '../common/loader/Loader';
import { MERGE_DURATION, PRESENTER_FIELD, TALENT_PREFIX, TELESTRATOR_WIDTH, VMIX_FRAGMENT_PREFIX } from '../talent/talent.constants';
import { getPhaseColor, toClock } from '../talent/talent.presentation';
import { TalentData, useTalentData } from '../talent/useTalentData';
import { useTalentState } from '../talent/useTalentState';
import DeskPanel from './DeskPanel';
import { getTalentTelestratorOptions, TELESTRATOR_COLORS, useTalentTelestratorOptions } from './talentTelestrator.options';
import { useFragments } from './useFragments';
import { useScrub } from './useScrub';

import './TalentTelestrator.scss';

export default function TalentTelestratorLoader() {
  const { data, status } = useTalentData();

  useWindowTitle('Telestrator');

  if (status === 'pending') {
    return <Loader />;
  }

  if (status === 'error') {
    return <EmptyPage text='There was an error fetching data, please refresh the page.' />;
  }

  return <TalentTelestrator {...data} />;
}

function TalentTelestrator({ entries, flatOrder }: TalentData) {
  const { vmixHost, telestratorInput, telestratorOverlay } = useTalentTelestratorOptions();

  const { nowTalentEvent, eventRemaining, warningThreshold, dangerThreshold } = useTalentState(
    entries,
    flatOrder,
    TALENT_PREFIX,
  );

  // vMix mints new socket tokens on every restart, so they are read from vMix itself
  const { video: vmixAuth, telestrator: telestratorAuth } = useVmixAuth(vmixHost, DEFAULT_VMIX_PORT);

  const { data: customFields } = useCustomFields();
  const snapshot = useVmixSnapshot(vmixHost, DEFAULT_VMIX_PORT);
  const fragments = useFragments(vmixHost, VMIX_FRAGMENT_PREFIX, MERGE_DURATION);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const telestratorRef = useRef<Telestrator | null>(null);

  const [tool, setTool] = useState<TelestratorTool>('line');
  const [color, setColor] = useState<string>(TELESTRATOR_COLORS[0].value);
  const [isConnected, setConnected] = useState(false);

  const deskOptions = useMemo(() => getTalentTelestratorOptions(), []);

  const presenterNotes = (nowTalentEvent?.custom[PRESENTER_FIELD] as string | undefined) ?? '';
  const presenterLabel = customFields[PRESENTER_FIELD]?.label ?? 'Notes';
  const eventPhaseColor = getPhaseColor(eventRemaining, warningThreshold, dangerThreshold);

  // the telestrator input sitting on its overlay channel means the drawing is on air
  const isOnAir = Boolean(
    telestratorInput &&
      snapshot.overlays[String(telestratorOverlay)] === findVmixInput(snapshot, telestratorInput)?.number,
  );

  // everything below acts on whatever is on the program bus
  const activeInput = snapshot.inputs.find((input) => input.number === snapshot.active);
  // a paused camera in vMix is a live pause, ie. a frozen picture
  const isPaused = activeInput?.state === 'Paused';
  const canSeek = (activeInput?.duration ?? 0) > 0;

  const scrub = useScrub(vmixHost, snapshot.active, activeInput?.position ?? 0, activeInput?.duration ?? 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !tempCanvas || !vmixHost || !telestratorAuth) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${vmixHost}:${DEFAULT_VMIX_PORT}/telestratorsocket?auth=${encodeURIComponent(telestratorAuth)}`;

    const instance = new Telestrator({ canvas, tempCanvas, serverUrl: url, onConnectionChange: setConnected });
    telestratorRef.current = instance;

    return () => {
      instance.stop();
      telestratorRef.current = null;
    };
  }, [vmixHost, telestratorAuth]);

  // keep the engine in step with the toolbar
  useEffect(() => telestratorRef.current?.setTool(tool), [tool]);
  useEffect(() => telestratorRef.current?.setColor(color), [color]);
  useEffect(() => telestratorRef.current?.setWidth(TELESTRATOR_WIDTH), []);

  const toggleOnAir = () => {
    if (!vmixHost || !telestratorInput) return;
    // the toggle function handles both directions with the configured transition
    sendVmixFunction(vmixHost, DEFAULT_VMIX_PORT, `OverlayInput${telestratorOverlay}`, { Input: telestratorInput });
  };

  const togglePause = () => {
    if (!vmixHost || !snapshot.active) return;
    sendVmixFunction(vmixHost, DEFAULT_VMIX_PORT, isPaused ? 'Play' : 'Pause', { Input: snapshot.active });
  };

  return (
    <div className='tele' data-testid='talent-telestrator-view'>
      <ViewParamsEditor target={OntimeView.TalentTelestrator} viewOptions={deskOptions} />

      {/* the vMix feed with the drawing surface laid exactly on top */}
      <div className='tele__stage'>
        <div className='tele__frame'>
          <VmixVideo className='tele__video' host={vmixHost} auth={vmixAuth} />
          <canvas ref={canvasRef} className='tele__canvas' />
          <canvas ref={tempCanvasRef} className='tele__canvas tele__canvas--draw' />
          {/* tally: the drawing is on air */}
          {isOnAir && <div className='tele__tally' />}
          {!isConnected && <div className='tele__offline'>Telestrator offline</div>}
        </div>
      </div>

      <div className='tele__side'>
        <div className='tele__top'>
          <Link to='/talent-desk' className='tele__back'>
            <IoArrowBack />
            Talent desk
          </Link>
          <div className='tele__time' style={{ color: eventPhaseColor }}>
            {toClock(eventRemaining)}
          </div>
        </div>

        <DeskPanel title='Draw live' className='tele__draw'>
          <button
            type='button'
            // without a telestrator input we have nothing to put on air
            disabled={!telestratorInput}
            className={cx(['tele__action', isOnAir && 'tele__action--live'])}
            onClick={toggleOnAir}
          >
            <LuTv />
            {isOnAir ? 'Hide drawing' : 'Show drawing'}
          </button>
        </DeskPanel>

        <DeskPanel title='Playback' className='tele__playback'>
          <div className='tele__segment'>
            <HoldButton
              label='Rewind'
              disabled={!canSeek}
              onHold={() => scrub.start(-1)}
              onRelease={scrub.stop}
              icon={<LuRewind />}
            />
            <button
              type='button'
              disabled={!snapshot.active}
              className={cx(['tele__tool', isPaused && 'tele__tool--frozen'])}
              onClick={togglePause}
            >
              {isPaused ? <LuPlay /> : <LuPause />}
              {isPaused ? 'Play' : 'Pause'}
            </button>
            <HoldButton
              label='Forward'
              disabled={!canSeek}
              onHold={() => scrub.start(1)}
              onRelease={scrub.stop}
              icon={<LuFastForward />}
            />
          </div>
        </DeskPanel>

        <DeskPanel title='Fragments' className='tele__fragments'>
          {fragments.inputs.length === 0 ? (
            <div className='tele__empty'>No vMix inputs matching “{VMIX_FRAGMENT_PREFIX}”</div>
          ) : (
            <div className='tele__fragments-grid'>
              {fragments.inputs.map((input) => (
                <button
                  key={input.number}
                  type='button'
                  disabled={fragments.isDisabled(input.number)}
                  className={cx(['tele__action', input.number === fragments.active && 'tele__action--live'])}
                  onClick={() => fragments.press(input.number)}
                >
                  {input.label}
                </button>
              ))}
            </div>
          )}
        </DeskPanel>

        {/* takes the slack, so the sidebar always fills the full height */}
        <DeskPanel title={presenterLabel} className='tele__notes'>
          <div className='tele__notes-value'>{presenterNotes}</div>
        </DeskPanel>

        <DeskPanel title='Tools' className='tele__tools'>
          {/* segmented control, the selected tool is inverted so it reads at a glance */}
          <div className='tele__segment' role='group'>
            <button
              type='button'
              aria-pressed={tool === 'line'}
              className={cx(['tele__tool', tool === 'line' && 'tele__tool--active'])}
              onClick={() => setTool('line')}
            >
              <LuPen />
              Pen
            </button>
            <button
              type='button'
              aria-pressed={tool === 'arrow'}
              className={cx(['tele__tool', tool === 'arrow' && 'tele__tool--active'])}
              onClick={() => setTool('arrow')}
            >
              <LuMoveUpRight />
              Arrow
            </button>
          </div>

          <div className='tele__colors'>
            {TELESTRATOR_COLORS.map((option) => (
              <button
                key={option.value}
                type='button'
                aria-label={option.label}
                aria-pressed={color === option.value}
                className={cx(['tele__color', color === option.value && 'tele__color--active'])}
                style={{ backgroundColor: option.value }}
                onClick={() => setColor(option.value)}
              >
                {color === option.value && <LuCheck />}
              </button>
            ))}
          </div>

          <div className='tele__segment'>
            <button type='button' className='tele__tool' onClick={() => telestratorRef.current?.undo()}>
              <LuUndo2 />
              Undo
            </button>
            <button type='button' className='tele__tool' onClick={() => telestratorRef.current?.erase()}>
              <LuEraser />
              Clear
            </button>
          </div>
        </DeskPanel>
      </div>
    </div>
  );
}

interface HoldButtonProps {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onHold: () => void;
  onRelease: () => void;
}

/**
 * Acts while held and stops on release.
 * Pointer capture means the release still lands if the finger slides off the button,
 * which would otherwise leave the playhead running away.
 */
function HoldButton({ label, icon, disabled, onHold, onRelease }: HoldButtonProps) {
  return (
    <button
      type='button'
      disabled={disabled}
      className='tele__tool'
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onHold();
      }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      // a lost pointer, eg. the browser stealing it, must still stop the scrub
      onLostPointerCapture={onRelease}
    >
      {icon}
      {label}
    </button>
  );
}
