import { ReactNode } from 'react';

import { cx } from '../../common/utils/styleUtils';

import style from './DeskPanel.module.scss';

interface DeskPanelProps {
  /** section title, always shown so every panel is self describing */
  title: string;
  /** optional control rendered on the title row, eg. an edit button */
  action?: ReactNode;
  /** optional strip below the body, eg. the sheet tabs */
  footer?: ReactNode;
  /** removes the body padding, for panels which manage their own spacing */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The panel every section of the talent desk is built from: a titled container
 * with an optional action and footer. Keeps the view visually consistent and
 * makes each block self describing rather than a bare row of controls.
 */
export default function DeskPanel({ title, action, footer, flush, className, children }: DeskPanelProps) {
  return (
    <section className={cx([style.panel, className])}>
      <div className={style.header}>
        <span className={style.title}>{title}</span>
        {action}
      </div>
      <div className={cx([style.body, flush && style.bodyFlush])}>{children}</div>
      {footer && <div className={style.footer}>{footer}</div>}
    </section>
  );
}
