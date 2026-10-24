import { useRef, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { DateWithStatus } from './feedback.js';
export * from './native.js';
export function Chip({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`chip ${['confirmed', 'paid', 'issued', 'approved', 'published', 'completed', 'open'].includes(value) ? 'ok' : ['expired', 'cancelled', 'refused', 'declined', 'failed', 'needs_review'].includes(value) ? 'alert' : 'wait'}`}
    >
      <span className="status-dot" />
      {label || value.replaceAll('_', ' ')}
    </span>
  );
}
export function FixtureStub({
  title,
  event,
  meta,
  date,
  status,
  statusLabel,
  href,
  action,
  image,
  previousDate,
}: {
  title: string;
  event: string;
  meta: string;
  date: string;
  status: string;
  statusLabel: string;
  href: string;
  action: string;
  image?: string;
  previousDate?: string;
}) {
  const main = useRef<HTMLDivElement>(null),
    [seamY, setSeamY] = useState(0);
  useEffect(() => {
    if (!main.current) return;
    const resize = new ResizeObserver(() => setSeamY(main.current?.offsetHeight || 0));
    resize.observe(main.current);
    return () => resize.disconnect();
  }, []);
  return (
    <article
      className="fixture"
      data-date-status={status}
      style={{ '--seam-y': seamY + 'px' } as CSSProperties}
    >
      <div className="fixture-main" ref={main}>
        {image && <img src={image} alt="" loading="lazy" width="180" height="120" />}
        <div>
          <h3>
            <Link to={href}>{title}</Link>
          </h3>
          <p className="fixture-event">{event}</p>
          <p className="muted small">{meta}</p>
        </div>
      </div>
      <div className="fixture-stub">
        <DateWithStatus
          date={date}
          status={status}
          label={statusLabel}
          previousDate={previousDate}
        />
        <Link to={href} className="text-link">
          {action} <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
export function Empty({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {body && <p className="muted">{body}</p>}
      {href && (
        <Link className="button" to={href}>
          {action}
        </Link>
      )}
    </div>
  );
}
