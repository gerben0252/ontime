/**
 * Fixed configuration shared by the talent views.
 *
 * These are conventions of the production rather than per-view settings, so they
 * live here instead of the view options: changing one is a change to how the whole
 * show is wired, not something to tweak per screen.
 */

/** rundown events are only shown to talent when their title starts with this */
export const TALENT_PREFIX = 'TALENT -';

/** vMix inputs with this prefix in their title become fragment buttons */
export const VMIX_FRAGMENT_PREFIX = 'TALENT -';

/** custom field holding the notes talent writes for themselves */
export const PRESENTER_FIELD = 'Presenter_Notes';

/** length in ms of the Merge transition used when switching to a fragment */
export const MERGE_DURATION = 500;

/** stroke width of the telestrator pen and arrow */
export const TELESTRATOR_WIDTH = 10;
