import { MaybeNumber } from 'ontime-types';

import { useAnimatedProgress } from '../../hooks/useAnimatedProgress';

import './RemainingBar.scss';

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

interface RemainingBarProps {
  current: MaybeNumber;
  duration: MaybeNumber;
  /** remaining time at which the warning zone starts */
  warning: MaybeNumber;
  /** remaining time at which the danger zone starts */
  danger: MaybeNumber;
  warningColor: string;
  dangerColor: string;
  className?: string;
}

/**
 * Progress bar which marks the warning and danger zones on the track.
 * The elapsed portion is filled from the left, so the zones stay visible
 * on the part of the bar that has not been played yet.
 */
export default function RemainingBar(props: RemainingBarProps) {
  const { current, duration, warning, danger, warningColor, dangerColor, className } = props;
  const progress = useAnimatedProgress(current, duration);

  const total = duration !== null && duration > 0 ? duration : null;
  const dangerPct = total !== null && danger !== null ? clampPct((danger / total) * 100) : 0;
  const warningPct = total !== null && warning !== null ? Math.max(0, clampPct((warning / total) * 100) - dangerPct) : 0;

  return (
    <div className={`remaining-bar ${className ?? ''}`}>
      <div className='remaining-bar__zones'>
        <div className='remaining-bar__normal' />
        <div className='remaining-bar__warning' style={{ width: `${warningPct}%`, backgroundColor: warningColor }} />
        <div className='remaining-bar__danger' style={{ width: `${dangerPct}%`, backgroundColor: dangerColor }} />
      </div>
      <div className='remaining-bar__fill' style={{ width: `${progress}%` }} />
    </div>
  );
}
