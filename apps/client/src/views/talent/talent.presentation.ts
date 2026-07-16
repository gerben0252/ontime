import { MaybeNumber } from 'ontime-types';
import { millisToString, removeLeadingZero } from 'ontime-utils';

import { VmixStatus } from '../../common/hooks-query/useVmixStatus';
import { timerPlaceholderMin } from '../../common/utils/styleUtils';

export const COLOR_LIVE = '#FF383C';
export const COLOR_PREVIEW = '#34C759';
export const COLOR_IDLE = '#8E8E93';

// warning/danger colours for the timer boxes: danger matches the LIVE red, warning a clear orange
export const COLOR_WARNING = '#FF9500';
export const COLOR_DANGER = COLOR_LIVE;

/** formats a duration as m:ss, falling back to a placeholder */
export function toClock(value: MaybeNumber): string {
  return removeLeadingZero(millisToString(value, { fallback: timerPlaceholderMin }));
}

/** Returns the warning/danger colour for a remaining time, or undefined when in the normal phase */
export function getPhaseColor(remaining: MaybeNumber, warning: MaybeNumber, danger: MaybeNumber): string | undefined {
  if (remaining === null) return undefined;
  if (danger !== null && remaining <= danger) return COLOR_DANGER;
  if (warning !== null && remaining <= warning) return COLOR_WARNING;
  return undefined;
}

export interface VmixDisplay {
  text: string;
  color: string;
  barColor: string;
}

export function getVmixDisplay(vmix: VmixStatus): VmixDisplay {
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
