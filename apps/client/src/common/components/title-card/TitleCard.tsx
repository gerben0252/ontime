import { OntimeEvent } from 'ontime-types';
import { ForwardedRef, forwardRef } from 'react';

import { useTranslation } from '../../../translation/TranslationProvider';
import { ExtendedEntry } from '../../utils/rundownMetadata';
import { cx, enDash } from '../../utils/styleUtils';

import './TitleCard.scss';
import ScheduleTime from '../schedule-time/ScheduleTime';

type TitleCardMainProps = {
  title?: string;
  label?: 'now' | 'next';
  secondary?: string;
  className?: string;
  colour?: string;
  textAlign?: 'left' | 'right' | 'center';
  size?: 'md' | 'lg';
  placeholder?: string;
};

type TitleCardExpectedProps = TitleCardMainProps & {
  event: ExtendedEntry<OntimeEvent>;
  expectedStart: number;
  showExpected: boolean;
};

type TitleCardNoExpectedProps = TitleCardMainProps & {
  event?: undefined;
  expectedStart?: undefined;
  showExpected?: false;
};

type TitleCardProps = TitleCardExpectedProps | TitleCardNoExpectedProps;

const TitleCard = forwardRef((props: TitleCardProps, ref: ForwardedRef<HTMLDivElement>) => {
  'use memo';
  const {
    label,
    title,
    secondary,
    className = '',
    colour = 'transparent',
    textAlign = 'left',
    size = 'md',
    event,
    showExpected = false,
    placeholder = enDash,
    expectedStart,
  } = props;
  const { getLocalizedString } = useTranslation();

  const accent = label === 'now';

  return (
    <div className={cx(['title-card', className, size])} style={{ borderColor: colour }} ref={ref}>
      {event && <ScheduleTime event={event} expectedStart={expectedStart} showExpected={showExpected} />}
      <span className='title-card__title' style={{ textAlign }} data-placeholder={placeholder}>
        {title === '' ? null : title}
      </span>
      <span className={cx(['title-card__label', accent && 'title-card__label--accent'])}>
        {label && getLocalizedString(`common.${label}`)}
      </span>
      <div className='title-card__secondary'>{secondary}</div>
    </div>
  );
});

TitleCard.displayName = 'TitleCard';
export default TitleCard;
