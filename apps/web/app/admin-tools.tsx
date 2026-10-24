import { useState, useEffect, useMemo } from 'react';
import { Link, useRevalidator } from 'react-router';
import { Field, Button, Chip } from '@citadel/ui';
import { Dialog } from '@citadel/ui/widgets';
import { useReactTable, getCoreRowModel } from '@citadel/ui/table';
import { api } from './api';
import { date, text, money } from '@citadel/i18n';
export function ReferenceField({
  field,
  value,
  onChange,
  name,
  required = false,
  invalid = false,
}: {
  field: string;
  value: string | null;
  onChange?: (value: string | null) => void;
  name?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  const [search, setSearch] = useState(''),
    [options, setOptions] = useState<any[]>([]),
    [selectedOption, setSelectedOption] = useState<any>(null),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState('');
  async function fetchOptions(next?: string) {
    try {
      const query = new URLSearchParams({ search });
      if (next) query.set('cursor', next);
      if (value) query.set('selected_id', value);
      const data = await api('/api/admin/references/' + field + '?' + query.toString());
      setOptions((old) => (next ? [...old, ...data.rows] : data.rows));
      setCursor(data.next_cursor);
      setSelectedOption(data.selected || null);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void fetchOptions(), 200);
    return () => clearTimeout(timer);
  }, [field, search, value]);
  return (
    <fieldset
      className={`reference-field${invalid ? ' field-invalid' : ''}`}
      data-field={field}
      aria-invalid={invalid || undefined}
    >
      <legend>{field.replaceAll('_', ' ').replace(/ id$/, '')}</legend>
      <input
        aria-label={'Search ' + field.replaceAll('_', ' ')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search records…"
      />
      <select
        aria-label={'Choose ' + field.replaceAll('_', ' ')}
        name={name}
        value={onChange ? value || '' : undefined}
        defaultValue={onChange ? undefined : value || ''}
        required={required}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange?.(e.target.value || null)}
      >
        <option value="">{required ? 'Choose a record' : 'None / shared'}</option>
        {value && !options.some((o) => o.id === value) && (
          <option value={value}>
            {selectedOption?.id === value ? selectedOption.label : `Current selection · ${value}`}
          </option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {cursor && (
        <Button variant="text" onClick={() => fetchOptions(cursor)}>
          Load more matches
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
export function EventImpact({ impact }: { impact: any }) {
  const rows = Array.isArray(impact) ? impact : impact.batches || [];
  return (
    <div className="table-scroll" role="region" aria-label="Affected departures" tabIndex={0}>
      <table>
        <caption>Affected departures</caption>
        <thead>
          <tr>
            <th>Batch</th>
            <th>Departure</th>
            <th>Bookings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b: any) => (
            <tr key={b.id + '-' + b.status}>
              <td>
                <Link to={'/admin/batches/' + b.id}>{b.code}</Link>
              </td>
              <td>
                {date(b.start_date, 'en')} — {date(b.end_date, 'en')}
              </td>
              <td>
                {b.bookings ?? 0} · {b.status || 'no bookings'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>No affected departures.</p>}
    </div>
  );
}
export function VisaEditor({ visa, onSaved }: { visa: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState({ ...visa }),
    [error, setError] = useState('');
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Edit visa
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Visa progress">
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const keys = [
                'stage',
                'appointment_at',
                'appointment_location',
                'submitted_on',
                'decided_on',
                'checklist',
                'member_note',
                'internal_notes',
                'delivery_method',
                'external_app_name',
                'delivery_instructions',
                'handover_target_on',
                'handover_status',
              ];
              await api('/api/admin/data/visas/' + visa.id, {
                method: 'PATCH',
                body: JSON.stringify(
                  Object.fromEntries(
                    keys.filter((k) => value[k] !== undefined).map((k) => [k, value[k]]),
                  ),
                ),
              });
              setOpen(false);
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {error && <p role="alert">{error}</p>}
          <Field label="Stage">
            <select
              value={value.stage}
              onChange={(e) => setValue({ ...value, stage: e.target.value })}
            >
              {[
                'not_started',
                'collecting_documents',
                'appointment_booked',
                'submitted',
                'approved',
                'refused',
                'not_required',
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Appointment (your local time)">
            <input
              type="datetime-local"
              value={
                value.appointment_at
                  ? new Date(
                      new Date(value.appointment_at).getTime() -
                        new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
              onChange={(e) =>
                setValue({
                  ...value,
                  appointment_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </Field>
          <Field label="Appointment location">
            <input
              value={value.appointment_location || ''}
              onChange={(e) => setValue({ ...value, appointment_location: e.target.value })}
            />
          </Field>
          {['submitted_on', 'decided_on'].map((k) => (
            <Field key={k} label={k.replaceAll('_', ' ')}>
              <input
                type="date"
                value={value[k]?.slice(0, 10) || ''}
                onChange={(e) => setValue({ ...value, [k]: e.target.value || null })}
              />
            </Field>
          ))}
          <StructuredObjectEditor
            name="Checklist"
            value={value.checklist || []}
            onChange={(checklist) => setValue({ ...value, checklist })}
          />
          <StructuredObjectEditor
            name="Member note"
            value={value.member_note || { id: '', en: '' }}
            onChange={(member_note) => setValue({ ...value, member_note })}
          />
          <Field label="Internal notes">
            <textarea
              value={value.internal_notes || ''}
              onChange={(e) => setValue({ ...value, internal_notes: e.target.value })}
            />
          </Field>
          <Button type="submit">Save visa progress</Button>
        </form>
      </Dialog>
    </>
  );
}
function blankShape(value: any): any {
  if (Array.isArray(value)) return [];
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, ['type', 'kind'].includes(k) ? v : blankShape(v)]),
    );
  return typeof value === 'boolean' ? false : typeof value === 'number' ? 0 : '';
}
export async function uploadFile(file: File, fields: Record<string, string> = {}, media = false) {
  const optional = Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
  const reservation = await api('/api/admin/uploads/init', {
    method: 'POST',
    body: JSON.stringify({
      kind: media ? (file.type.startsWith('video/') ? 'video' : 'image') : 'document',
      filename: file.name,
      mime: file.type,
      bytes: file.size,
      ...optional,
      ...(optional.title ? { title: { id: optional.title, en: optional.title } } : {}),
    }),
  });
  const response = await fetch(reservation.url, {
    method: 'PUT',
    headers: reservation.headers,
    body: file,
  });
  if (!response.ok) throw new Error('Upload failed. Please try again.');
  return api('/api/admin/uploads/' + reservation.id + '/confirm', { method: 'POST' });
}
export function StructuredObjectEditor({
  name,
  value,
  onChange,
  rows = 2,
  invalid = false,
}: {
  name: string;
  value: any;
  onChange: (value: any) => void;
  rows?: number;
  invalid?: boolean;
}) {
  const fieldRows = name === 'body' ? Math.max(rows, 8) : rows;
  if (Array.isArray(value))
    return (
      <fieldset
        className={`structured-fields${invalid ? ' field-invalid' : ''}`}
        data-field={name}
        aria-invalid={invalid || undefined}
      >
        <legend>{name.replaceAll('_', ' ')}</legend>
        {value.map((item, i) => (
          <div className="structured-item" key={i}>
            <StructuredObjectEditor
              name={String(i + 1)}
              value={item}
              onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))}
              rows={fieldRows}
            />
            <Button variant="text" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              Remove item
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() =>
            onChange([
              ...value,
              value.length
                ? blankShape(value[0])
                : ['highlights', 'inclusions', 'exclusions'].includes(name)
                  ? { id: '', en: '' }
                  : name === 'blocks'
                    ? { type: 'paragraph', text: { id: '', en: '' } }
                    : name === 'fields'
                      ? { label: '', value: '' }
                      : '',
            ])
          }
        >
          Add item
        </Button>
      </fieldset>
    );
  if (value && typeof value === 'object')
    return (
      <fieldset
        className={`structured-fields${invalid ? ' field-invalid' : ''}`}
        data-field={name}
        aria-invalid={invalid || undefined}
      >
        <legend>{name.replaceAll('_', ' ')}</legend>
        {Object.entries(value).map(([key, v]) => (
          <StructuredObjectEditor
            key={key}
            name={key === 'id' ? 'Bahasa Indonesia' : key === 'en' ? 'English' : key}
            value={v}
            onChange={(next) => onChange({ ...value, [key]: next })}
            rows={fieldRows}
          />
        ))}
        {'id' in value && !value.en && (
          <span className="translation-warning">
            Missing English; published content falls back to Indonesian.
          </span>
        )}
      </fieldset>
    );
  return (
    <Field label={name.replaceAll('_', ' ')}>
      {typeof value === 'boolean' ? (
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      ) : (
        <textarea
          value={value ?? ''}
          rows={Math.max(fieldRows, String(value || '').length > 120 ? 4 : 2)}
          onChange={(e) =>
            onChange(typeof value === 'number' ? Number(e.target.value) : e.target.value)
          }
        />
      )}
    </Field>
  );
}
export function MediaCropEditor({
  media,
  value,
  onChange,
}: {
  media: any;
  value: any;
  onChange: (v: any) => void;
}) {
  const url = media.public_url || '/' + media.storage_key;
  if (media.kind === 'video')
    return (
      <figure>
        <video
          src={url}
          controls
          muted
          playsInline
          preload="metadata"
          style={{ maxWidth: '100%' }}
        />
        <figcaption>Video preview. Set a poster image and bilingual description below.</figcaption>
      </figure>
    );
  return (
    <fieldset className="media-crops">
      <legend>Focal point and crop preview</legend>
      <p>Click the landscape preview to place the focal point.</p>
      <div className="crop-grid">
        {[
          [16, 9],
          [4, 5],
          [9, 16],
        ].map(([w, h], i) => (
          <div key={w}>
            <button
              type="button"
              className="crop-preview"
              style={{ aspectRatio: `${w}/${h}` }}
              aria-label={i === 0 ? 'Set focal point' : 'Crop preview ' + w + ':' + h}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onChange({
                  ...value,
                  focal_x: Math.round((100 * (e.clientX - r.left)) / r.width),
                  focal_y: Math.round((100 * (e.clientY - r.top)) / r.height),
                });
              }}
              onKeyDown={(e) => {
                const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0,
                  dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
                if (dx || dy) {
                  e.preventDefault();
                  onChange({
                    ...value,
                    focal_x: Math.max(0, Math.min(100, Number(value.focal_x ?? 50) + dx)),
                    focal_y: Math.max(0, Math.min(100, Number(value.focal_y ?? 50) + dy)),
                  });
                }
              }}
            >
              <img
                src={url}
                alt="Crop preview"
                style={{ objectPosition: `${value.focal_x ?? 50}% ${value.focal_y ?? 50}%` }}
              />
              {i === 0 && (
                <span
                  className="focal-marker"
                  style={{ left: `${value.focal_x ?? 50}%`, top: `${value.focal_y ?? 50}%` }}
                />
              )}
            </button>
            <span>
              {w}:{h}
            </span>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
const detailFields: Record<string, string[]> = {
  flight: ['ticket_number'],
  hotel: [
    'hotel_name',
    'address',
    'city',
    'phone',
    'website',
    'check_in_date',
    'check_out_date',
    'room_type',
    'board',
    'star_rating',
  ],
  event_ticket: ['event_id', 'category', 'section', 'row', 'seat', 'hospitality', 'seats_together'],
  transfer: [
    'pickup_place',
    'dropoff_place',
    'pickup_local',
    'vehicle',
    'driver_name',
    'driver_phone',
  ],
  activity: ['name', 'place', 'meeting_point', 'duration_minutes', 'guide_language'],
  insurance: ['insurer', 'policy_number', 'coverage_summary', 'valid_from', 'valid_to'],
  dining: ['restaurant', 'place', 'time_local', 'halal', 'dress_code'],
  other: [],
};
const detailOptions: Record<string, readonly string[]> = {
  room_type: ['twin', 'double', 'single'],
  star_rating: ['1', '2', '3', '4', '5'],
};
export function ServiceEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<any>({
      ...initial,
      title: initial.title || { id: '', en: '' },
      details: initial.details || {},
    }),
    [error, setError] = useState(''),
    [invalidFields, setInvalidFields] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const setDetail = (key: string, v: any) =>
    setValue({ ...value, details: { ...value.details, [key]: v } });
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Travel arrangement"
      description="Save structured details. Publish separately when they are ready for the member."
    >
      <form
        className={`form-stack record-editor${invalidFields.length ? ' validation-failed' : ''}`}
        onChangeCapture={(event) => {
          let target = event.target as HTMLElement | null;
          while (target && target !== event.currentTarget) {
            const field = target.dataset.field;
            if (field && invalidFields.includes(field)) {
              setInvalidFields((fields) => fields.filter((name) => name !== field));
              break;
            }
            target = target.parentElement;
          }
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setInvalidFields([]);
          setBusy(true);
          try {
            const allowed = [
              'batch_id',
              'booking_id',
              'traveler_id',
              'type',
              'status',
              'title',
              'details',
              'starts_at',
              'ends_at',
              'confirmation_ref',
              'member_note',
              'supplier_name',
              'supplier_ref',
              'internal_notes',
            ];
            const body = Object.fromEntries(
              Object.entries(value).filter(([k]) => allowed.includes(k)),
            );
            await api('/api/admin/data/services' + (initial.id ? '/' + initial.id : ''), {
              method: initial.id ? 'PATCH' : 'POST',
              body: JSON.stringify(body),
            });
            onSaved();
            onClose();
          } catch (e) {
            const failure = e as Error & {
              code?: string;
              details?: { fieldErrors?: Record<string, unknown> };
            };
            setError(failure.message);
            setInvalidFields(
              failure.code === 'validation' ? Object.keys(failure.details?.fieldErrors || {}) : [],
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {!initial.id && (
          <div className="form-grid">
            {['batch_id', 'booking_id', 'traveler_id'].map((field) => (
              <ReferenceField
                key={field}
                field={field}
                value={value[field]}
                invalid={invalidFields.includes(field)}
                onChange={(v) => setValue({ ...value, [field]: v })}
                required={field === 'batch_id'}
              />
            ))}
          </div>
        )}
        <Field label="Service type">
          <select
            data-field="type"
            value={value.type}
            disabled={!!initial.id}
            aria-invalid={invalidFields.includes('type') || undefined}
            onChange={(e) => setValue({ ...value, type: e.target.value, details: {} })}
          >
            {Object.keys(detailFields).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <StructuredObjectEditor
          name="title"
          value={value.title}
          invalid={invalidFields.includes('title')}
          onChange={(title) => setValue({ ...value, title })}
        />
        <Field label="Service status">
          <select
            data-field="status"
            value={value.status || 'not_started'}
            aria-invalid={invalidFields.includes('status') || undefined}
            onChange={(e) => setValue({ ...value, status: e.target.value })}
          >
            {[
              'not_started',
              'requested',
              'pending_allocation',
              'confirmed',
              'issued',
              'cancelled',
            ].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
              </option>
            ))}
          </select>
        </Field>
        <fieldset
          className={invalidFields.includes('delivery_method') ? 'field-invalid' : undefined}
          data-field="delivery_method"
        >
          <legend>Delivery and handover</legend>
          <label>
            Delivery method
            <select
              data-field="delivery_method"
              value={value.delivery_method || ''}
              aria-invalid={invalidFields.includes('delivery_method') || undefined}
              onChange={(e) => setValue({ ...value, delivery_method: e.target.value || null })}
            >
              <option value="">Not applicable</option>
              {['pdf', 'wallet', 'external_app', 'paper', 'in_person'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {value.delivery_method === 'external_app' && (
            <label>
              Official app name
              <input
                value={value.external_app_name || ''}
                onChange={(e) => setValue({ ...value, external_app_name: e.target.value })}
                required
              />
            </label>
          )}
          <StructuredObjectEditor
            name="delivery_instructions"
            value={value.delivery_instructions || { id: '', en: '' }}
            invalid={invalidFields.includes('delivery_instructions')}
            onChange={(v) => setValue({ ...value, delivery_instructions: v })}
          />
          <label>
            Handover target
            <input
              type="date"
              data-field="handover_target_on"
              value={value.handover_target_on || ''}
              aria-invalid={invalidFields.includes('handover_target_on') || undefined}
              onChange={(e) => setValue({ ...value, handover_target_on: e.target.value || null })}
              required={value.delivery_method === 'external_app'}
            />
          </label>
          <label>
            Handover status
            <select
              value={value.handover_status || 'planned'}
              onChange={(e) => setValue({ ...value, handover_status: e.target.value })}
            >
              {['planned', 'handed_over', 'not_applicable'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </fieldset>
        {value.type === 'flight' && (
          <fieldset
            className={invalidFields.includes('details') ? 'field-invalid' : undefined}
            data-field="details"
          >
            <legend>Flight segments</legend>
            {(value.details.segments || []).map((segment: any, i: number) => (
              <div className="panel form-grid" key={i}>
                {[
                  'airline',
                  'flight_no',
                  'from_iata',
                  'to_iata',
                  'depart_local',
                  'arrive_local',
                  'depart_tz',
                  'arrive_tz',
                  'cabin',
                  'baggage',
                ].map((k) => (
                  <Field key={k} label={k.replaceAll('_', ' ')}>
                    <input
                      value={segment[k] || ''}
                      onChange={(e) =>
                        setDetail(
                          'segments',
                          value.details.segments.map((s: any, j: number) =>
                            j === i ? { ...s, [k]: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
                <Button
                  variant="text"
                  onClick={() =>
                    setDetail(
                      'segments',
                      value.details.segments.filter((_: any, j: number) => j !== i),
                    )
                  }
                >
                  Remove segment
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setDetail('segments', [
                  ...(value.details.segments || []),
                  {
                    airline: '',
                    flight_no: '',
                    from_iata: '',
                    to_iata: '',
                    depart_local: '',
                    arrive_local: '',
                    depart_tz: 'Europe/London',
                    arrive_tz: 'Europe/London',
                  },
                ])
              }
            >
              Add flight segment
            </Button>
          </fieldset>
        )}
        {value.type === 'other' && (
          <StructuredObjectEditor
            name="details"
            value={value.details.fields || [{ label: '', value: '' }]}
            invalid={invalidFields.includes('details')}
            onChange={(fields) => setDetail('fields', fields)}
          />
        )}
        <div
          className={`form-grid${invalidFields.includes('details') ? ' field-invalid' : ''}`}
          data-field="details"
        >
          {detailFields[value.type]?.map((k) => {
            const options = detailOptions[k];
            return (
              <Field key={k} label={k.replaceAll('_', ' ')}>
                {['halal', 'hospitality', 'seats_together'].includes(k) ? (
                  <input
                    type="checkbox"
                    data-field="details"
                    checked={!!value.details[k]}
                    aria-invalid={invalidFields.includes('details') || undefined}
                    onChange={(e) => setDetail(k, e.target.checked)}
                  />
                ) : options ? (
                  <select
                    data-field="details"
                    value={value.details[k] == null ? '' : String(value.details[k])}
                    aria-invalid={invalidFields.includes('details') || undefined}
                    onChange={(e) =>
                      setDetail(
                        k,
                        e.target.value === ''
                          ? undefined
                          : k === 'star_rating'
                            ? Number(e.target.value)
                            : e.target.value,
                      )
                    }
                  >
                    <option value="">Not specified</option>
                    {value.details[k] != null && !options.includes(String(value.details[k])) && (
                      <option value={String(value.details[k])}>
                        Existing value · {value.details[k]}
                      </option>
                    )}
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option
                          .replaceAll('_', ' ')
                          .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    data-field="details"
                    value={value.details[k] ?? ''}
                    aria-invalid={invalidFields.includes('details') || undefined}
                    type={
                      k.endsWith('_date') ? 'date' : k === 'duration_minutes' ? 'number' : 'text'
                    }
                    onChange={(e) =>
                      setDetail(
                        k,
                        k === 'duration_minutes' ? Number(e.target.value) : e.target.value,
                      )
                    }
                  />
                )}
              </Field>
            );
          })}
        </div>
        <Field label="Confirmation reference / PNR">
          <input
            data-field="confirmation_ref"
            value={value.confirmation_ref || ''}
            aria-invalid={invalidFields.includes('confirmation_ref') || undefined}
            onChange={(e) => setValue({ ...value, confirmation_ref: e.target.value })}
          />
        </Field>
        <StructuredObjectEditor
          name="member_note"
          value={value.member_note || { id: '', en: '' }}
          invalid={invalidFields.includes('member_note')}
          onChange={(member_note) => setValue({ ...value, member_note })}
        />
        <Field label="Supplier reference (internal)">
          <input
            data-field="supplier_ref"
            value={value.supplier_ref || ''}
            aria-invalid={invalidFields.includes('supplier_ref') || undefined}
            onChange={(e) => setValue({ ...value, supplier_ref: e.target.value })}
          />
        </Field>
        <Field label="Internal notes">
          <textarea
            data-field="internal_notes"
            value={value.internal_notes || ''}
            aria-invalid={invalidFields.includes('internal_notes') || undefined}
            onChange={(e) => setValue({ ...value, internal_notes: e.target.value })}
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save arrangement'}
        </Button>
      </form>
    </Dialog>
  );
}
export function OperationsBoard({ data, onTab }: { data: any; onTab: (tab: string) => void }) {
  const revalidator = useRevalidator(),
    [selected, setSelected] = useState<Record<string, boolean>>({}),
    [filter, setFilter] = useState(''),
    [missing, setMissing] = useState(false),
    [type, setType] = useState('flight'),
    [editor, setEditor] = useState<any>(null),
    [error, setError] = useState('');
  const find = (row: any, kind: string) =>
    data.services.find(
      (s: any) =>
        s.type === kind &&
        (!s.booking_id || s.booking_id === row.booking_id) &&
        (!s.traveler_id || s.traveler_id === row.traveler_id),
    );
  const rows = useMemo(
    () =>
      data.roster.filter(
        (r: any) =>
          (!filter || r.booking_status === filter) &&
          (!missing ||
            ['flight', 'hotel', 'event_ticket'].some(
              (t) => !['issued', 'confirmed'].includes(find(r, t)?.status),
            ) ||
            r.visas.some((v: any) => !['approved', 'not_required'].includes(v.stage))),
      ),
    [data.roster, data.services, filter, missing],
  );
  const table = useReactTable({
    data: rows,
    columns: useMemo(() => [{ accessorKey: 'given_names' }], []),
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r: any) => r.booking_traveler_id,
    state: { rowSelection: selected },
    onRowSelectionChange: setSelected,
    enableRowSelection: true,
  });
  const chosen = table.getSelectedRowModel().rows.map((r) => r.original as any),
    ids = chosen.map((r) => r.booking_traveler_id);
  const types = ['flight', 'hotel', 'event_ticket', 'transfer', 'insurance'];
  async function act(path: string, body: any) {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      revalidator.revalidate();
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="table-toolbar">
        <Field label="Booking status">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            {[
              'requested',
              'reviewing',
              'waitlisted',
              'offered',
              'confirmed',
              'completed',
              'declined',
              'expired',
              'cancelled',
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={missing} onChange={(e) => setMissing(e.target.checked)} />
          Missing items only
        </label>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">
        Arrows move between cells. Enter opens an arrangement. Space selects a traveler row.
      </p>
      <div className="table-toolbar">
        <span>{ids.length} travelers selected</span>
        <Field label="Service">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <select
          aria-label="Set status for selected travelers"
          defaultValue=""
          onChange={(e) => {
            const status = e.target.value;
            e.target.value = '';
            if (status) {
              const services = [...new Set(chosen.map((r) => find(r, type)?.id).filter(Boolean))];
              if (services.length)
                void act(`/api/admin/batches/${data.batch.id}/services/bulk`, {
                  ids: services,
                  status,
                });
            }
          }}
        >
          <option value="">Set status…</option>
          {['requested', 'pending_allocation', 'confirmed', 'issued', 'cancelled'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={!ids.length}
          onClick={() =>
            act(`/api/admin/batches/${data.batch.id}/services/create-bulk`, {
              booking_traveler_ids: ids,
              type,
            })
          }
        >
          Create arrangements
        </Button>
        <Button variant="outline" disabled={!ids.length} onClick={() => onTab('Documents')}>
          Upload documents
        </Button>
        <Button
          disabled={!ids.length}
          onClick={() =>
            act(`/api/admin/batches/${data.batch.id}/publish`, {
              services: [
                ...new Set(
                  chosen.flatMap((r) =>
                    data.services
                      .filter(
                        (s: any) =>
                          (!s.booking_id || s.booking_id === r.booking_id) &&
                          (!s.traveler_id || s.traveler_id === r.traveler_id),
                      )
                      .map((s: any) => s.id),
                  ),
                ),
              ],
            })
          }
        >
          Publish selected updates
        </Button>
      </div>
      <div className="table-scroll" role="region" aria-label="Traveler service status" tabIndex={0}>
        <table
          className="operations-table"
          aria-label="Traveler operations"
          onKeyDown={(e) => {
            const cell = (e.target as HTMLElement).closest('[data-grid-cell]') as HTMLElement;
            if (!cell) return;
            const row = Number(cell.dataset.row),
              col = Number(cell.dataset.col);
            const direction: Record<string, [number, number]> = {
              ArrowLeft: [0, -1],
              ArrowRight: [0, 1],
              ArrowUp: [-1, 0],
              ArrowDown: [1, 0],
            };
            if (direction[e.key]) {
              e.preventDefault();
              const [dr, dc] = direction[e.key];
              (
                e.currentTarget.querySelector(
                  `[data-row="${row + dr}"][data-col="${col + dc}"] button,[data-row="${row + dr}"][data-col="${col + dc}"] input`,
                ) as HTMLElement
              )?.focus();
            } else if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'INPUT') {
              e.preventDefault();
              const id = rows[row]?.booking_traveler_id;
              if (id) setSelected({ ...selected, [id]: !selected[id] });
            }
          }}
        >
          <thead>
            <tr>
              <th>
                <label className="grid-checkbox">
                  {' '}
                  <input
                    aria-label="Select all visible travelers"
                    type="checkbox"
                    checked={table.getIsAllRowsSelected()}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                  />
                </label>
              </th>
              <th>Traveler / booking</th>
              {types.map((t) => (
                <th key={t}>{t.replaceAll('_', ' ')}</th>
              ))}
              <th>Visa</th>
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => {
              const r = row.original as any;
              return (
                <tr key={row.id}>
                  <td data-grid-cell data-row={i} data-col={0}>
                    <label className="grid-checkbox">
                      {' '}
                      <input
                        aria-label={`Select ${r.given_names} ${r.surname}`}
                        type="checkbox"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                      />
                    </label>
                  </td>
                  <td>
                    <strong>
                      {r.given_names} {r.surname}
                    </strong>
                    <br />
                    <Link to={'/admin/bookings/' + r.code}>{r.code}</Link>
                  </td>
                  {types.map((kind, j) => {
                    const s = find(r, kind);
                    return (
                      <td key={kind} data-grid-cell data-row={i} data-col={j + 1}>
                        <button
                          className="grid-cell-button"
                          aria-label={`${r.given_names} ${kind} details`}
                          onClick={() =>
                            setEditor(
                              s || {
                                batch_id: data.batch.id,
                                booking_id: r.booking_id,
                                traveler_id: r.traveler_id,
                                type: kind,
                                status: 'not_started',
                                details: kind === 'flight' ? { segments: [] } : {},
                              },
                            )
                          }
                        >
                          <Chip value={s?.status || 'not_started'} />
                        </button>
                      </td>
                    );
                  })}
                  <td data-grid-cell data-row={i} data-col={6}>
                    <button className="grid-cell-button" onClick={() => onTab('Visa')}>
                      {r.visas.length
                        ? r.visas.map((v: any) => (
                            <span key={v.id}>
                              <Chip value={v.stage} />
                              {v.appointment_at && <small>{date(v.appointment_at, 'en')}</small>}
                            </span>
                          ))
                        : 'Not started'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editor && (
        <ServiceEditor
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={() => revalidator.revalidate()}
        />
      )}
    </>
  );
}
export function BookingTabs({ workspace }: { workspace: any }) {
  const [tab, setTab] = useState('Overview');
  return (
    <section className="booking-workspace">
      <nav className="filter-tabs" aria-label="Booking workspace">
        {['Overview', 'Itinerary', 'Documents', 'Travelers', 'Payments', 'History'].map((t) => (
          <button
            key={t}
            className={tab === t ? 'selected' : ''}
            aria-current={tab === t ? 'true' : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === 'Itinerary' && (
        <div className="stack">
          {workspace.services.map((s: any) => (
            <article key={s.id} className="panel">
              <h3>{text(s.title, 'en')}</h3>
              <Chip value={s.status} />
              <p>
                {s.published_at ? 'Published to member' : 'Draft'} · {s.confirmation_ref}
              </p>
              <StructuredRead value={s.details} />
              <p>
                Supplier: {s.supplier_name || 'Not supplied'} · {s.supplier_ref || ''}
              </p>
              <p>{s.internal_notes}</p>
            </article>
          ))}
        </div>
      )}
      {tab === 'Overview' ? (
        <div className="panel">
          <p>{text(workspace.next_action?.message, 'en')}</p>
          {workspace.next_action?.date && <p>{date(workspace.next_action.date, 'en')}</p>}
          <p>Internal notes: {workspace.booking.internal_notes || 'None'}</p>
          <p>Tour leader: {workspace.batch?.tour_leader_name || 'To be assigned'}</p>
        </div>
      ) : tab === 'History' ? (
        workspace.history.map((h: any) => (
          <div className="panel" key={h.created_at + h.action}>
            <strong>{h.action}</strong> · {date(h.created_at, 'en', true)}
            <StructuredRead value={h.after} />
          </div>
        ))
      ) : tab === 'Travelers' ? (
        workspace.travelers.map((t: any) => (
          <div className="panel" key={t.id}>
            <h3>
              {t.given_names} {t.surname}
            </h3>
            <p>
              {t.passport_masked} · expires {t.passport_expiry || 'missing'}
            </p>
            {workspace.visas
              .filter((v: any) => v.traveler_id === t.id)
              .map((v: any) => (
                <p key={v.id}>
                  {v.destination} · {v.stage} {v.appointment_at && date(v.appointment_at, 'en')}
                </p>
              ))}
          </div>
        ))
      ) : tab === 'Payments' ? (
        workspace.invoices.map((i: any) => (
          <div className="panel" key={i.id}>
            <h3>{i.number}</h3>
            <Chip value={i.status} />
            {i.lines.map((l: any) => (
              <p key={l.id}>
                {text(l.description, 'en')} · {l.quantity} × {money(l.unit_amount)}
              </p>
            ))}
            <p>
              Total {money(i.total)} · due {date(i.due_at, 'en', true)}
            </p>
            {i.payments?.map((p: any) => (
              <div key={p.id}>
                <p>
                  {p.method} · {money(p.amount)} · {date(p.paid_at, 'en', true)}
                </p>
                {p.refunds.map((r: any) => (
                  <p key={r.id}>
                    External refund {money(r.amount)} · {r.reason}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ))
      ) : (
        (tab === 'Itinerary' ? workspace.itinerary : workspace.documents).map((r: any) => (
          <div className="panel" key={r.id}>
            <h3>{text(r.title, 'en') || r.filename}</h3>
            <Chip value={r.status || (r.published_at ? 'published' : 'draft')} />
            <p>{text(r.body, 'en') || r.filename}</p>
            {tab === 'Documents' && (
              <a className="button outline" href={'/api/admin/documents/' + r.id + '/download'}>
                Download privately
              </a>
            )}
          </div>
        ))
      )}
    </section>
  );
}
function StructuredRead({ value }: { value: any }) {
  return value && typeof value === 'object' ? (
    <dl>
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <dt>{k.replaceAll('_', ' ')}</dt>
          <dd>{typeof v === 'object' ? text(v, 'en') || 'Updated' : String(v)}</dd>
        </div>
      ))}
    </dl>
  ) : null;
}
