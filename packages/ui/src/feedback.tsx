import { lazy, Suspense } from 'react';
const ChangedDate = lazy(() => import('./changed-date.js'));
export function DateWithStatus({
  date,
  status,
  label,
  previousDate,
}: {
  date: string;
  status: string;
  label: string;
  previousDate?: string;
}) {
  return (
    <span className="date-with-status">
      {status !== 'tba' && <span>{date}</span>}
      {status === 'changed' && previousDate && <del className="previous-date">{previousDate}</del>}
      {status === 'changed' && previousDate ? (
        <Suspense fallback={<span className="chip neutral">{label}</span>}>
          <ChangedDate label={label} previousDate={previousDate} />
        </Suspense>
      ) : (
        <span className="chip neutral">{label}</span>
      )}
    </span>
  );
}
