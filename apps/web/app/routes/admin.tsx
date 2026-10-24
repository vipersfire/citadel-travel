import { readinessKeys } from '@citadel/contracts';
import {
  Link,
  redirect,
  useLoaderData,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BrandMark } from '../site-shell';
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  Users,
  FileText,
  Settings,
  ArrowUpRight,
  LogOut,
  Plus,
  Search,
  Upload,
  Menu,
  X,
} from 'lucide-react';
import { api, serverApi } from '../api';
import { text, money, date } from '@citadel/i18n';
import { Chip, Empty } from '@citadel/ui';
import { Alert, RichText } from '../components';
import {
  OperationsBoard,
  BookingTabs,
  StructuredObjectEditor,
  MediaCropEditor,
  uploadFile,
  ServiceEditor,
  ReferenceField,
  EventImpact,
  VisaEditor,
} from '../admin-tools';
import { Dialog } from '@citadel/ui/widgets';
async function allRows(request: Request, path: string) {
  const rows: any[] = [];
  let cursor: string | null = null;
  do {
    const data = await serverApi(
      request,
      path +
        (path.includes('?') ? '&' : '?') +
        'limit=100' +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
    );
    rows.push(...data.rows);
    cursor = data.next_cursor;
  } while (cursor);
  return { rows };
}
export async function loader({ request }: any) {
  const path = new URL(request.url).pathname.replace(/^\/admin\/?/, '');
  const auth = await serverApi(request, '/api/auth/me');
  if (path === 'sign-in') return { path, user: auth.user, mfa: auth.mfa_verified };
  if (!auth.user || auth.user.role !== 'admin' || !auth.mfa_verified)
    throw redirect('/admin/sign-in');
  if (path === 'deletion-requests' || path === 'webhook-review')
    return {
      path,
      user: auth.user,
      resource: path,
      data: { ...(await serverApi(request, '/api/admin/' + path)), fields: [], readonly: true },
    };
  if (path.startsWith('requests/') || path.startsWith('bookings/'))
    return {
      path,
      user: auth.user,
      detail: await serverApi(request, '/api/admin/bookings/' + path.split('/')[1]),
      workspace: await serverApi(
        request,
        '/api/admin/bookings/' + path.split('/')[1] + '/workspace',
      ),
      channelLimits: (await serverApi(request, '/api/admin/channel-limits')).limits,
    };
  if (path.startsWith('batches/')) {
    const id = path.split('/')[1];
    const [batches, roster, services, documents, itinerary, rooms, checklist] = await Promise.all([
      serverApi(request, '/api/admin/batches/' + id),
      serverApi(request, `/api/admin/batches/${id}/roster`),
      allRows(request, `/api/admin/data/services?batch_id=${id}`),
      allRows(request, `/api/admin/data/documents?batch_id=${id}`),
      allRows(request, `/api/admin/data/itinerary?batch_id=${id}`),
      allRows(request, `/api/admin/data/rooms?batch_id=${id}`),
      serverApi(request, `/api/admin/batches/${id}/checklist`),
    ]);
    return {
      path,
      user: auth.user,
      batch: batches,
      visas: await allRows(request, `/api/admin/data/visas?batch_id=${id}`),
      roster,
      services: services.rows,
      documents: documents.rows,
      itinerary: itinerary.rows,
      rooms: rooms.rows,
      checklist,
    };
  }
  if (path.startsWith('members/'))
    return {
      path,
      user: auth.user,
      member: await serverApi(request, '/api/admin/members/' + path.split('/')[1]),
    };
  if (!path)
    return {
      path,
      user: auth.user,
      dashboard: await serverApi(request, '/api/admin/dashboard'),
      requests: (await serverApi(request, '/api/admin/data/requests?limit=6')).rows,
    };
  const resource = path.replace('content/', '');
  return {
    path,
    user: auth.user,
    resource,
    data: await serverApi(
      request,
      '/api/admin/data/' + resource + '?' + new URL(request.url).searchParams.toString(),
    ),
  };
}
export function headers({ parentHeaders }: any) {
  return { ...Object.fromEntries(parentHeaders), 'Cache-Control': 'no-store' };
}
export function meta() {
  return [{ title: 'Citadel Operations' }, { name: 'robots', content: 'noindex, nofollow' }];
}
const menu = [
  ['', 'Overview', LayoutDashboard],
  ['requests', 'Requests', Inbox],
  ['deletion-requests', 'Deletion requests', Users],
  ['webhook-review', 'Webhook review', FileText],
  ['batches', 'Departure batches', CalendarDays],
  ['invoices', 'Invoices', FileText],
  ['payments', 'Payments', FileText],
  ['refunds', 'Refund records', FileText],
  ['packages', 'Journeys', CalendarDays],
  ['events', 'Events', CalendarDays],
  ['members', 'Members', Users],
  ['admins', 'Administrators', Users],
  ['travelers', 'Travelers', Users],
  ['leads', 'Enquiries', Inbox],
  ['services', 'Services', Settings],
  ['visas', 'Visa tracker', FileText],
  ['rooms', 'Rooms', Settings],
  ['itinerary', 'Itinerary editor', FileText],
  ['documents', 'Documents', FileText],
  ['addons', 'Add-ons', Plus],
  ['options', 'Package options', Settings],
  ['sample-itinerary', 'Sample itineraries', FileText],
  ['content/pages', 'Pages', FileText],
  ['content/sections', 'Home sections', LayoutDashboard],
  ['content/faqs', 'FAQ', FileText],
  ['content/team', 'Team and proof', Users],
  ['content/testimonials', 'Testimonials', Users],
  ['media', 'Media library', Upload],
  ['settings', 'Site settings', Settings],
  ['templates', 'Email templates', FileText],
  ['notifications', 'Notifications', Inbox],
  ['audit', 'Audit log', FileText],
] as const;
const menuGroups: [string, string[]][] = [
  ['Bookings', ['', 'leads', 'requests', 'invoices', 'payments', 'refunds']],
  [
    'Trip operations',
    ['batches', 'travelers', 'services', 'visas', 'rooms', 'itinerary', 'documents'],
  ],
  ['Catalogue', ['packages', 'events', 'options', 'addons', 'sample-itinerary']],
  [
    'Website',
    [
      'content/pages',
      'content/sections',
      'content/faqs',
      'content/team',
      'content/testimonials',
      'media',
    ],
  ],
  [
    'Administration',
    [
      'members',
      'admins',
      'settings',
      'templates',
      'notifications',
      'webhook-review',
      'deletion-requests',
      'audit',
    ],
  ],
];
const readinessLabels: Record<string, string> = {
  supplier_confirmation: 'Supplier confirmation',
  quotation_price: 'Quotation price',
  ticket_source_category: 'Ticket source and category',
  event_date_status: 'Event date status',
  services_exclusions: 'Services and exclusions',
  terms_attached: 'Terms attached',
};
export default function Admin() {
  const data = useLoaderData<typeof loader>() as any,
    navigate = useNavigate(),
    [navOpen, setNavOpen] = useState(false);
  const navToggle = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  useEffect(() => setNavOpen(false), [data.path]);
  useEffect(() => {
    if (navOpen) navigation.current?.querySelector('a')?.focus();
  }, [navOpen]);
  if (data.path === 'sign-in') return <AdminSignIn user={data.user} mfa={data.mfa} />;
  const title = data.detail
    ? 'Booking request'
    : data.batch
      ? 'Departure workspace'
      : data.member
        ? 'Member profile'
        : menu.find(([p]) => p === data.path)?.[1] || 'Operations';
  return (
    <div className="admin-shell">
      <aside
        className="admin-sidebar"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && navOpen) {
            setNavOpen(false);
            navToggle.current?.focus();
          }
        }}
      >
        <div className="admin-side-heading">
          <BrandMark to="/admin" light descriptor="Operations" />
          <button
            type="button"
            className="icon-button admin-menu-toggle"
            ref={navToggle}
            aria-controls="operations-navigation"
            aria-expanded={navOpen}
            aria-label={navOpen ? 'Close operations navigation' : 'Open operations navigation'}
            onClick={() => setNavOpen(!navOpen)}
          >
            {navOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
        <div className="admin-role">{data.user.full_name}</div>
        <div
          id="operations-navigation"
          className="admin-navigation"
          data-open={navOpen}
          ref={navigation}
        >
          <nav
            aria-label="Operations navigation"
            onClick={(event) => {
              if ((event.target as Element).closest('a')) setNavOpen(false);
            }}
          >
            {menuGroups.map(([group, paths]) => (
              <div className="admin-nav-group" key={group}>
                <p>{group}</p>
                {paths.map((path) => {
                  const item = menu.find(([key]) => key === path)!;
                  const [, title, Icon] = item;
                  const selected = path
                    ? data.path === path || data.path.startsWith(path + '/')
                    : !data.path;
                  return (
                    <Link
                      key={path}
                      className={selected ? 'selected' : ''}
                      aria-current={selected ? 'page' : undefined}
                      to={'/admin' + (path ? '/' + path : '')}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {title}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <Link to="/en" className="admin-public">
            View public site <ArrowUpRight size={15} />
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <span>Operations / {title}</span>
          <button
            className="text-button"
            onClick={async () => {
              await api('/api/auth/sign-out', { method: 'POST' });
              navigate('/admin/sign-in');
            }}
          >
            Sign out <LogOut size={15} />
          </button>
        </header>
        <main id="main">
          <div className="admin-page-heading">
            <span className="section-index">Citadel Tour Travel</span>
            <h1>{data.detail ? data.detail.code : data.batch ? data.batch.code : title}</h1>
          </div>
          {data.dashboard ? (
            <>
              <div className="stats">
                {[
                  ['requests', 'New requests', 'requests'],
                  ['expiring', 'Offers due in 24h', 'invoices'],
                  ['review', 'Payments to review', 'invoices'],
                  ['departures', 'Departing in 14 days', 'batches'],
                  ['failed', 'Failed notifications', 'notifications'],
                  ['overdue_handovers', 'Overdue handovers', 'services'],
                  ['overdue_leads', 'Enquiries past response target', 'leads'],
                ].map(([key, label, path]) => (
                  <Link
                    className="stat"
                    to={
                      '/admin/' +
                      path +
                      (
                        {
                          requests: '?status=requested',
                          expiring: '?due_within=24h',
                          review: '?needs_review=true',
                          departures: '?departures_within=14d',
                          failed: '?status=failed',
                          overdue_handovers: '?overdue=true',
                          overdue_leads: '?overdue=true',
                        } as any
                      )[key]
                    }
                    key={key}
                  >
                    <span>{label}</span>
                    <strong>{data.dashboard[key]}</strong>
                    <ArrowUpRight size={18} />
                  </Link>
                ))}
              </div>
              <p>
                <a className="text-link" href="/api/admin/reports/funnel.csv">
                  Download funnel CSV ↗
                </a>
              </p>
              <div className="section-head">
                <h2>Request queue</h2>
                <Link className="text-link" to="/admin/requests">
                  All requests ↗
                </Link>
              </div>
              <div className="table-scroll" role="region" aria-label="Request queue" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Booking</th>
                      <th>Status</th>
                      <th>Received</th>
                      <th>Age</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map((b: any) => (
                      <tr key={b.id}>
                        <td>{b.code}</td>
                        <td>
                          <Chip value={b.status} />
                        </td>
                        <td>{date(b.requested_at, 'en')}</td>
                        <td>
                          {Math.floor((Date.now() - new Date(b.requested_at).getTime()) / 3600000)}h
                        </td>
                        <td>
                          <Link to={'/admin/requests/' + b.code}>Open ↗</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.requests.length && <Empty title="Your request queue is clear." />}
              <div className="notice subtle">
                Open a request to review the party and departure. Check all six readiness items
                before issuing an offer for member approval.
              </div>
            </>
          ) : data.detail ? (
            <>
              <RequestDetail detail={data.detail} channelLimits={data.channelLimits} />
              <BookingTabs workspace={data.workspace} />
            </>
          ) : data.member ? (
            <MemberAdmin member={data.member} />
          ) : data.batch ? (
            <BatchWorkspace data={data} />
          ) : (
            <Resource data={data.data} resource={data.resource} />
          )}
        </main>
      </div>
    </div>
  );
}
function AdminSignIn({ user, mfa: _mfa }: { user: any; mfa: boolean }) {
  const navigate = useNavigate(),
    revalidator = useRevalidator(),
    [error, setError] = useState(''),
    [secret, setSecret] = useState<any>(null),
    [codes, setCodes] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (!user) {
        const result = await api('/api/auth/sign-in', {
          method: 'POST',
          body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
        });
        if (result.user.role !== 'admin') throw new Error('An administrator account is required.');
        revalidator.revalidate();
      } else {
        const result = await api('/api/admin/auth/totp/verify', {
          method: 'POST',
          body: JSON.stringify({ code: f.get('code') }),
        });
        if (result.recovery_codes) setCodes(result.recovery_codes);
        else navigate('/admin');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="admin-login">
      <BrandMark to="/" descriptor="Operations" />
      <h1>
        {codes.length
          ? 'Save your recovery codes.'
          : user
            ? 'Two-factor authentication'
            : 'Operations sign in'}
      </h1>
      <Alert message={error} />
      {codes.length ? (
        <>
          <p>Keep these codes in a safe place. Each can be used once.</p>
          <pre className="recovery-codes">{codes.join('\n')}</pre>
          <button className="button" onClick={() => navigate('/admin')}>
            I’ve saved these codes →
          </button>
        </>
      ) : (
        <>
          {user && !user.totp_enabled_at && !secret && (
            <>
              <p>Enroll your authenticator app before accessing operations.</p>
              <button
                className="button outline"
                onClick={async () => {
                  try {
                    setSecret(await api('/api/admin/auth/totp/enroll', { method: 'POST' }));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Set up authenticator
              </button>
            </>
          )}
          {secret && (
            <div className="notice subtle totp-setup">
              <div className="totp-qr-card">
                <QRCodeSVG
                  value={secret.uri}
                  size={192}
                  level="M"
                  marginSize={4}
                  bgColor="#ffffff"
                  fgColor="#12291f"
                  title="Authenticator setup QR code"
                />
                <p>Scan with your authenticator app.</p>
              </div>
              <div className="totp-setup-details">
                <p>Can’t scan the QR code? Enter this setup key manually:</p>
                <code className="secret-key">{secret.secret}</code>
                <p>
                  <a href={secret.uri}>Open authenticator app</a>
                </p>
                <p className="totp-security-note">
                  Keep this screen private. Anyone with the QR code or key can generate your codes.
                </p>
              </div>
            </div>
          )}
          <form method="post" className="form-stack" onSubmit={login}>
            {!user ? (
              <>
                <label>
                  Email
                  <input name="email" type="email" autoComplete="username" required />
                </label>
                <label>
                  Password
                  <input name="password" type="password" autoComplete="current-password" required />
                </label>
              </>
            ) : (
              <label>
                Authenticator or recovery code
                <input name="code" autoComplete="one-time-code" required inputMode="numeric" />
              </label>
            )}
            <button
              className="button full"
              disabled={busy || !!(user && !user.totp_enabled_at && !secret)}
            >
              {busy ? '…' : user ? 'Verify code' : 'Sign in'} →
            </button>
          </form>
        </>
      )}
    </main>
  );
}
function DraftReadiness({ invoice, onDone }: { invoice: any; onDone: () => void }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <details>
      <summary>Complete readiness and issue draft</summary>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError('');
          try {
            for (const key of readinessKeys)
              await api(`/api/admin/invoices/${invoice.id}/readiness/${key}`, {
                method: 'POST',
                body: JSON.stringify({ passed: true, note: f.get(key) }),
              });
            await api(`/api/admin/invoices/${invoice.id}/issue`, {
              method: 'POST',
              body: JSON.stringify({ confirm_amount: f.get('confirm_amount') }),
            });
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Alert message={error} />
        <div className="readiness-checklist">
          {readinessKeys.map((key) => (
            <label key={key}>
              {readinessLabels[key]} · required evidence note
              <input name={key} required maxLength={4000} />
            </label>
          ))}
        </div>
        <label>
          Type invoice total to confirm
          <input name="confirm_amount" required inputMode="numeric" />
        </label>
        <button className="button" disabled={busy}>
          {busy ? 'Issuing…' : 'Pass checks and issue draft'}
        </button>
      </form>
    </details>
  );
}
function RequestDetail({
  detail: b,
  channelLimits = {},
}: {
  detail: any;
  channelLimits?: Record<string, number>;
}) {
  const revalidator = useRevalidator(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [readyChecks, setReadyChecks] = useState(false),
    [missingChecks, setMissingChecks] = useState<string[]>([...readinessKeys]),
    [lines, setLines] = useState([
      { description: 'Journey package', quantity: b.travelers.length, unit_amount: 0 },
    ]);
  async function move(status: string) {
    try {
      await api(`/api/admin/bookings/${b.code}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      revalidator.revalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Alert message={error} />
      <div className="detail-summary">
        <div>
          <h2>{text(b.title, 'en')}</h2>
          <p>
            {b.full_name} · {b.email}
          </p>
          <p>Room preference: {b.room_preference}</p>
          <p>{b.member_notes}</p>
        </div>
        <Chip value={b.status} />
      </div>
      <div className="actions">
        {['requested', 'waitlisted', 'expired'].includes(b.status) && (
          <button className="button" onClick={() => move('reviewing')}>
            Review request
          </button>
        )}
        {['requested', 'reviewing'].includes(b.status) && (
          <>
            <button className="button outline" onClick={() => move('waitlisted')}>
              Waitlist
            </button>
            <details>
              <summary>Decline request</summary>
              <form
                method="post"
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  try {
                    await api(`/api/admin/bookings/${b.code}/status`, {
                      method: 'POST',
                      body: JSON.stringify({
                        status: 'declined',
                        reason: { id: form.get('id'), en: form.get('en') },
                      }),
                    });
                    revalidator.revalidate();
                  } catch (error) {
                    setError((error as Error).message);
                  }
                }}
              >
                <label>
                  Reason · Bahasa Indonesia
                  <textarea name="id" required />
                </label>
                <label>
                  Reason · English
                  <textarea name="en" />
                </label>
                <button className="button outline">Decline with reason</button>
              </form>
            </details>
          </>
        )}
      </div>
      <h2>Travelers</h2>
      {['requested', 'reviewing', 'waitlisted', 'offered', 'confirmed'].includes(b.status) && (
        <details>
          <summary>Cancel booking</summary>
          <p>
            Paid invoices and payments remain on record. Process any refund outside the platform,
            then record it in Payments.
          </p>
          <form
            method="post"
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(`/api/admin/bookings/${b.code}/status`, {
                  method: 'POST',
                  body: JSON.stringify({
                    status: 'cancelled',
                    reason: new FormData(e.currentTarget).get('reason'),
                  }),
                });
                revalidator.revalidate();
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            <label>
              Reason
              <textarea name="reason" required />
            </label>
            <button className="button outline">Confirm booking cancellation</button>
          </form>
        </details>
      )}
      <div className="table-scroll" role="region" aria-label="Booking travelers" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Name on passport</th>
              <th>Dietary needs</th>
              <th>Passport expiry</th>
            </tr>
          </thead>
          <tbody>
            {b.travelers.map((t: any) => (
              <tr key={t.id}>
                <td>
                  {t.given_names} {t.surname}
                </td>
                <td>{t.dietary.join(', ') || '—'}</td>
                <td>{t.passport_expiry || 'Not provided'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {['reviewing', 'offered', 'confirmed'].includes(b.status) && (
        <form
          method="post"
          className="panel form-stack offer-builder"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const f = new FormData(e.currentTarget);
            const issueNow =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'draft';
            try {
              await api(`/api/admin/bookings/${b.code}/offer`, {
                method: 'POST',
                body: JSON.stringify({
                  batch_id: f.get('batch_id'),
                  issue_now: issueNow,
                  kind: b.status === 'confirmed' ? 'supplement' : 'package',
                  replaces_invoice_id: f.get('replaces_invoice_id') || undefined,
                  readiness_checks: Object.fromEntries(
                    readinessKeys.map((key) => [
                      key,
                      {
                        passed: f.get('check_' + key) === 'on',
                        note: String(f.get('check_note_' + key) || ''),
                      },
                    ]),
                  ),
                  offer_details: {
                    services: [
                      { id: String(f.get('services_id')), en: String(f.get('services_en') || '') },
                    ],
                    exclusions: [
                      {
                        id: String(f.get('exclusions_id')),
                        en: String(f.get('exclusions_en') || ''),
                      },
                    ],
                    ...Object.fromEntries(
                      [
                        'ticket_category',
                        'seating_policy',
                        'change_terms',
                        'cancellation_terms',
                      ].map((k) => [
                        k,
                        { id: String(f.get(k + '_id')), en: String(f.get(k + '_en') || '') },
                      ]),
                    ),
                  },
                  lines: lines.map((l) => ({
                    ...l,
                    description: { id: l.description, en: l.description },
                  })),
                  discount: Number(f.get('discount') || 0),
                  confirm_amount: String(f.get('confirm_amount')),
                  due_at: new Date(String(f.get('due_at'))).toISOString(),
                  allowed_channels: f.getAll('channels'),
                  note: { id: String(f.get('note_id') || ''), en: String(f.get('note_en') || '') },
                }),
              });
              revalidator.revalidate();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{b.status === 'confirmed' ? 'Issue supplement invoice' : 'Build your offer'}</h2>
          {(b.status === 'offered' || b.status === 'confirmed') && (
            <label>
              Offer to replace
              <select name="replaces_invoice_id" required={b.status === 'offered'}>
                {b.status === 'confirmed' && <option value="">New supplement invoice</option>}
                {b.invoices
                  .filter(
                    (i: any) =>
                      i.status === 'issued' &&
                      i.kind === (b.status === 'confirmed' ? 'supplement' : 'package'),
                  )
                  .map((i: any) => (
                    <option key={i.id} value={i.id}>
                      {i.number} · version {i.offer_version}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Departure batch
            <select
              name="batch_id"
              required
              defaultValue={b.batch_id || b.preferred_batch_id || ''}
            >
              <option value="">Choose a batch</option>
              {b.batches.map((ba: any) => (
                <option
                  key={ba.id}
                  value={ba.id}
                  disabled={!['open', 'closed', 'confirmed'].includes(ba.status)}
                >
                  {ba.code} · {ba.status} · {ba.remaining} seats available
                </option>
              ))}
            </select>
          </label>
          <div className="offer-lines">
            {lines.map((l, i) => (
              <div className="offer-line-edit" key={i}>
                <label>
                  Description
                  <input
                    value={l.description}
                    onChange={(e) =>
                      setLines(
                        lines.map((v, j) => (j === i ? { ...v, description: e.target.value } : v)),
                      )
                    }
                    required
                  />
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) =>
                      setLines(
                        lines.map((v, j) =>
                          j === i ? { ...v, quantity: Number(e.target.value) } : v,
                        ),
                      )
                    }
                    required
                  />
                </label>
                <label>
                  Unit amount (IDR)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={l.unit_amount}
                    onChange={(e) =>
                      setLines(
                        lines.map((v, j) =>
                          j === i ? { ...v, unit_amount: Number(e.target.value) } : v,
                        ),
                      )
                    }
                    required
                  />
                </label>
                <button
                  type="button"
                  className="text-button"
                  disabled={lines.length === 1}
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setLines([
                ...lines,
                { description: 'Supplement / add-on', quantity: 1, unit_amount: 0 },
              ])
            }
          >
            + Add invoice line
          </button>
          <div className="form-grid">
            <label>
              Discount (IDR)
              <input name="discount" type="number" min={0} step={1} defaultValue={0} />
            </label>
            <label>
              Payment deadline (your local time)
              <input
                name="due_at"
                type="datetime-local"
                required
                defaultValue={new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16)}
              />
            </label>
          </div>
          <fieldset>
            <legend>Allowed payment channels</legend>
            {Object.entries(channelLimits).map(([channel, cap]) =>
              lines.reduce((sum, line) => sum + line.quantity * line.unit_amount, 0) > cap ? (
                <p className="error-text" key={channel}>
                  {channel}: total exceeds your configured cap of {money(cap)}.
                </p>
              ) : null,
            )}
            <p className="muted small">
              Leave all unchecked to use all activated channels. Confirm provider caps before
              issuing a high-value invoice.
            </p>
            <div className="checkbox-row">
              {[
                'BCA_VIRTUAL_ACCOUNT',
                'BNI_VIRTUAL_ACCOUNT',
                'BRI_VIRTUAL_ACCOUNT',
                'MANDIRI_VIRTUAL_ACCOUNT',
                'CARDS',
                'QRIS',
              ].map((c) => (
                <label className="checkbox" key={c}>
                  <input type="checkbox" name="channels" value={c} />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-grid">
            <label>
              Note · Bahasa Indonesia
              <textarea name="note_id" defaultValue="Penawaran pribadi Anda." required />
            </label>
            <label>
              Note · English
              <textarea name="note_en" defaultValue="Your personal offer." />
            </label>
          </div>
          <div className="invoice-total">
            <span>Subtotal before discount</span>
            <strong>{money(lines.reduce((s, l) => s + l.quantity * l.unit_amount, 0))}</strong>
          </div>
          <label>
            Type the total after discount to confirm (whole IDR)
            <input name="confirm_amount" inputMode="numeric" required />
          </label>
          <fieldset
            className="readiness-checklist"
            onChange={(e) => {
              const form = e.currentTarget.closest('form')!;
              const missing = readinessKeys.filter(
                (k) =>
                  !(form.elements.namedItem('check_' + k) as HTMLInputElement)?.checked ||
                  !(form.elements.namedItem('check_note_' + k) as HTMLInputElement)?.value.trim(),
              );
              setMissingChecks(missing);
              setReadyChecks(missing.length === 0);
            }}
          >
            <legend>Offer readiness · all six checks need a pass and a note</legend>
            {readinessKeys.map((key) => (
              <div className="readiness-row" key={key}>
                <label className="checkbox">
                  <input name={'check_' + key} type="checkbox" required />
                  {readinessLabels[key]}
                </label>
                <label>
                  Evidence / quotation reference
                  <input name={'check_note_' + key} required maxLength={4000} />
                </label>
              </div>
            ))}
          </fieldset>
          <fieldset>
            <legend>Details the member will review and approve</legend>
            {[
              'services',
              'exclusions',
              'ticket_category',
              'seating_policy',
              'change_terms',
              'cancellation_terms',
            ].map((key) => (
              <div className="form-grid" key={key}>
                <label>
                  {key.replaceAll('_', ' ')} · Bahasa Indonesia
                  <textarea name={key + '_id'} required />
                </label>
                <label>
                  {key.replaceAll('_', ' ')} · English
                  <textarea name={key + '_en'} />
                </label>
              </div>
            ))}
          </fieldset>
          {b.status !== 'offered' && (
            <button
              className="button outline"
              type="submit"
              value="draft"
              formNoValidate
              disabled={busy}
            >
              Save priced draft
            </button>
          )}
          <p className="small muted" id="readiness-remaining" role="status">
            {missingChecks.length
              ? 'Before issuing, complete: ' +
                missingChecks.map((key) => readinessLabels[key]).join('; ') +
                '.'
              : 'All six readiness checks have a pass and an evidence note.'}
          </p>
          <button
            className="button"
            type="submit"
            value="issue"
            disabled={busy || !readyChecks}
            aria-describedby="readiness-remaining"
          >
            {busy ? 'Issuing…' : 'Issue offer & hold seats'} ↗
          </button>
        </form>
      )}
      {b.invoices.length > 0 && (
        <>
          <h2>Invoices</h2>
          <div className="table-scroll" role="region" aria-label="Booking invoices" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {b.invoices.map((i: any) => (
                  <tr key={i.id}>
                    <td>{i.number}</td>
                    <td>
                      <Chip value={i.status} />
                    </td>
                    <td>{money(i.total)}</td>
                    <td>
                      {date(i.due_at, 'en')}
                      {i.status === 'draft' && (
                        <DraftReadiness invoice={i} onDone={() => revalidator.revalidate()} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
const defaults: Record<string, any> = {
  admins: { email: '', full_name: '', password: '' },
  team: {
    name: '',
    role: { id: '', en: '' },
    bio: { id: '', en: '' },
    photo_media_id: null,
    verified_at: null,
    status: 'draft',
    sort_order: 0,
  },
  packages: {
    code: '',
    slug: '',
    readiness: 'draft',
    sport: 'football',
    status: 'draft',
    supplier_verified_at: null,
    coverage_verified_at: null,
    sales_rights_note: '',
    quotation_ref: '',
    proof_points: [],
    nights_note: { id: '', en: '' },
    interest_label: {
      id: 'Kami sedang menyiapkan perjalanan ini',
      en: 'We are preparing this trip',
    },
    title: { id: '', en: '' },
    subtitle: { id: '', en: '' },
    summary: { id: '', en: '' },
    story: { id: '', en: '' },
    countries: ['GB'],
    cities: ['Manchester'],
    seo: { image: '/placeholders/manchester.webp' },
  },
  events: {
    name: { id: '', en: '' },
    sport: 'football',
    venue: '',
    city: '',
    country: 'GB',
    starts_on: '2027-03-13',
    ends_on: '2027-03-13',
    timezone: 'Europe/London',
    date_status: 'provisional',
  },
  batches: {
    package_id: '',
    event_id: null,
    code: '',
    start_date: '2027-03-11',
    end_date: '2027-03-15',
    capacity: 20,
    min_pax: 10,
    hotel_category: '',
    status: 'draft',
    ticket_allocation_status: 'not_requested',
  },
  addons: { code: '', name: { id: '', en: '' }, status: 'draft', applies_to_all: true },
  options: {
    package_id: '',
    code: 'STANDARD',
    name: { id: '', en: '' },
    includes_event_entry: true,
  },
  'sample-itinerary': {
    package_id: '',
    day_number: 1,
    title: { id: '', en: '' },
    body: { id: '', en: '' },
    city: '',
  },
  services: {
    batch_id: '',
    booking_id: null,
    traveler_id: null,
    type: 'flight',
    status: 'not_started',
    title: { id: '', en: '' },
    details: { segments: [] },
  },
  itinerary: {
    batch_id: '',
    day_number: 1,
    timezone: 'Europe/London',
    title: { id: '', en: '' },
    body: { id: '', en: '' },
    location_name: '',
  },
  rooms: { batch_id: '', room_type: 'twin', label: 'Room 1' },
  pages: { slug: '', title: { id: '', en: '' }, body: { id: '', en: '' }, status: 'draft' },
  sections: {
    kind: 'hero',
    data: {
      title: { id: '', en: '' },
      body: { id: '', en: '' },
      poster: '/placeholders/hero.webp',
      video: '',
    },
    status: 'draft',
  },
  faqs: { question: { id: '', en: '' }, answer: { id: '', en: '' }, status: 'draft' },
  testimonials: {
    quote: { id: '', en: '' },
    author_name: '',
    consent_on_file: false,
    status: 'draft',
  },
  settings: { key: 'contact', value: { email: '', whatsapp: '', address: 'Jakarta, Indonesia' } },
};
const visibleColumns: Record<string, string[]> = {
  requests: ['code', 'status', 'requested_at', 'room_preference', 'age'],
  'deletion-requests': ['full_name', 'email', 'created_at'],
  'webhook-review': ['provider', 'event_type', 'error', 'received_at'],
  batches: [
    'code',
    'status',
    'start_date',
    'end_date',
    'capacity',
    'held',
    'confirmed',
    'remaining',
  ],
  packages: ['code', 'title', 'sport', 'readiness', 'status'],
  events: ['name', 'starts_on', 'venue', 'city', 'date_status'],
  members: ['full_name', 'email', 'whatsapp_e164', 'email_verified_at'],
  travelers: ['given_names', 'surname', 'passport_masked', 'passport_expiry', 'locked_at'],
  leads: [
    'name',
    'whatsapp_e164',
    'party_size',
    'preferred_period',
    'utm_source',
    'landing_path',
    'response_due_at',
    'response_overdue',
    'status',
  ],
  invoices: ['number', 'kind', 'status', 'total', 'due_at', 'needs_review'],
  audit: ['action', 'entity_type', 'entity_id', 'created_at'],
  notifications: ['template_key', 'channel', 'to_address', 'status', 'attempts'],
  documents: ['filename', 'type', 'status', 'booking_id', 'published_at'],
};
const dateFields = new Set([
  'starts_on',
  'ends_on',
  'start_date',
  'end_date',
  'request_cutoff',
  'submitted_on',
  'decided_on',
]);
const editorValue = (key: string, value: any) =>
  dateFields.has(key) && value ? String(value).slice(0, 10) : value;
function ChoiceField({
  name,
  value,
  options,
  onChange,
  allowCustom = false,
  invalid = false,
}: {
  name: string;
  value: any;
  options: readonly string[];
  onChange: (value: string) => void;
  allowCustom?: boolean;
  invalid?: boolean;
}) {
  const [other, setOther] = useState(false);
  const current = value == null ? '' : String(value);
  const known = options.includes(current);
  const showCustom = allowCustom && (other || (current !== '' && !known));
  const label = name.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return (
    <>
      <label className={invalid ? 'field-invalid' : undefined} data-field={name}>
        {label}
        <select
          required={!allowCustom}
          aria-invalid={invalid || undefined}
          value={showCustom ? '__custom__' : current}
          onChange={(e) => {
            if (allowCustom && e.target.value === '__custom__') {
              setOther(true);
              if (known) onChange('');
              return;
            }
            setOther(false);
            onChange(e.target.value);
          }}
        >
          {current === '' && <option value="">Choose {label.toLowerCase()}…</option>}
          {current !== '' && !known && !allowCustom && (
            <option value={current}>
              {current.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
            </option>
          )}
          {options.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
            </option>
          ))}
          {allowCustom && <option value="__custom__">Other / custom</option>}
        </select>
      </label>
      {showCustom && (
        <label className={invalid ? 'field-invalid' : undefined} data-field={name}>
          Custom {label.toLowerCase()}
          <input
            aria-invalid={invalid || undefined}
            value={current}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter a custom value"
          />
        </label>
      )}
    </>
  );
}
function Resource({ data, resource }: { data: any; resource: string }) {
  const [params, setParams] = useSearchParams(),
    [eventReview, setEventReview] = useState<any>(null);
  const query = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete('cursor');
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const revalidator = useRevalidator(),
    [search, setSearch] = useState(params.get('search') || ''),
    [filter, setFilter] = useState(params.get('status') || ''),
    [editor, setEditor] = useState<any>(null),
    [current, setCurrent] = useState<any>(null),
    [error, setError] = useState(''),
    [invalidFields, setInvalidFields] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const cols =
    visibleColumns[resource] ||
    Object.keys(data.rows[0] || defaults[resource] || {})
      .filter((k) => !['id', 'updated_at', 'created_by'].includes(k))
      .slice(0, 5);
  const rows = data.rows;
  const stateOptions: Record<string, string[]> = {
    requests: [
      'requested',
      'reviewing',
      'waitlisted',
      'offered',
      'confirmed',
      'completed',
      'declined',
      'expired',
      'cancelled',
    ],
    bookings: [
      'requested',
      'reviewing',
      'waitlisted',
      'offered',
      'confirmed',
      'completed',
      'declined',
      'expired',
      'cancelled',
    ],
    invoices: ['draft', 'issued', 'paid', 'expired', 'void'],
    batches: ['draft', 'open', 'closed', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    notifications: ['queued', 'sending', 'sent', 'failed', 'skipped'],
    leads: ['new', 'contacted', 'qualified', 'converted', 'closed'],
  };
  const states =
    stateOptions[resource] ||
    ([
      ...new Set(data.rows.map((r: any) => r.status || r.date_status).filter(Boolean)),
    ] as string[]);
  function edit(row: any) {
    setCurrent(row);
    setEditor(
      Object.fromEntries(
        data.fields
          .filter((k: string) => row[k] !== undefined)
          .map((k: string) => [
            k,
            ['focal_x', 'focal_y'].includes(k)
              ? Number(row[k])
              : k === 'alt' && !row[k]
                ? { id: '', en: '' }
                : editorValue(k, row[k]),
          ]),
      ),
    );
    setError('');
    setInvalidFields([]);
  }
  async function action(path: string, body: any = {}) {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      revalidator.revalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Alert message={error} />
      <div className="table-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label="Search records"
            placeholder="Search records…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              query('search', e.target.value);
            }}
          />
        </label>
        {states.length > 0 && (
          <select
            aria-label="Filter by status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              query('status', e.target.value);
            }}
          >
            <option value="">All statuses</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        )}
        {['requests', 'bookings', 'batches'].includes(resource) && (
          <>
              <select
                value={params.get('package_id') || ''}
                onChange={(e) => query('package_id', e.target.value)}
              >
                <option value="">All packages</option>
                {data.filter_options?.packages?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {text(p.title, 'en')}
                    {p.code ? ` · ${p.code}` : ''}
                  </option>
                ))}
              </select>
            {resource !== 'batches' && (
              <label>
                Batch
                <select
                  value={params.get('batch_id') || ''}
                  onChange={(e) => query('batch_id', e.target.value)}
                >
                  <option value="">All batches</option>
                  {data.filter_options?.batches?.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {(!data.readonly || resource === 'admins') && defaults[resource] && (
          <button
            className="button"
            onClick={() => {
              setCurrent(null);
              setError('');
              setInvalidFields([]);
              setEditor({ ...defaults[resource] });
            }}
          >
            <Plus size={15} />
            Create record
          </button>
        )}
        {['documents', 'media'].includes(resource) && (
          <UploadForm media={resource === 'media'} onDone={() => revalidator.revalidate()} />
        )}
      </div>
      {editor && resource === 'services' && (
        <ServiceEditor
          initial={current || editor}
          onClose={() => setEditor(null)}
          onSaved={() => revalidator.revalidate()}
        />
      )}
      {editor && resource !== 'services' && (
        <form
          method="post"
          className={`panel form-stack record-editor${invalidFields.length ? ' validation-failed' : ''}`}
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
              if (
                resource === 'events' &&
                current &&
                ['starts_on', 'ends_on', 'start_time_local', 'date_status'].some(
                  (k) => editor[k] !== editorValue(k, current[k]),
                )
              ) {
                setEventReview(await api('/api/admin/events/' + current.id + '/impact'));
                return;
              }
              await api(
                resource === 'admins'
                  ? '/api/admin/admins'
                  : '/api/admin/data/' +
                      resource +
                      (current ? '/' + (current.id || current.key) : ''),
                { method: current ? 'PATCH' : 'POST', body: JSON.stringify(editor) },
              );
              setEditor(null);
              revalidator.revalidate();
            } catch (e) {
              const failure = e as Error & {
                code?: string;
                details?: { fieldErrors?: Record<string, unknown> };
              };
              setError(failure.message);
              setInvalidFields(
                failure.code === 'validation'
                  ? Object.keys(failure.details?.fieldErrors || {})
                  : [],
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="section-head">
            <h2>{current ? 'Edit record' : 'Create record'}</h2>
            <button className="text-button" type="button" onClick={() => setEditor(null)}>
              Close ×
            </button>
          </div>
          {resource === 'batches' && (
            <>
              <p>
                Confirming departure requires the minimum paid travelers. Ticket allocation:{' '}
                {editor.ticket_allocation_status ||
                  current?.ticket_allocation_status ||
                  'not_requested'}
                .
              </p>
              {(editor.ticket_allocation_status || current?.ticket_allocation_status) !==
                'allocated' && <p role="status">Warning: ticket allocation is not complete.</p>}
              <label
                className={invalidFields.includes('override_reason') ? 'field-invalid' : undefined}
                data-field="override_reason"
              >
                Reason to override minimum paid travelers
                <input
                  value={editor.override_reason || ''}
                  aria-invalid={invalidFields.includes('override_reason') || undefined}
                  onChange={(e) => setEditor({ ...editor, override_reason: e.target.value })}
                />
              </label>
            </>
          )}
          {resource === 'media' && current && (
            <MediaCropEditor media={current} value={editor} onChange={setEditor} />
          )}
          <label
            className={invalidFields.includes('claims_reason') ? 'field-invalid' : undefined}
            data-field="claims_reason"
          >
            Claims evidence / override reason
            <input
              value={editor.claims_reason || ''}
              aria-invalid={invalidFields.includes('claims_reason') || undefined}
              onChange={(e) => setEditor({ ...editor, claims_reason: e.target.value })}
            />
          </label>
          {['packages', 'sections'].includes(resource) && (
            <label
              className={invalidFields.includes('rights_reason') ? 'field-invalid' : undefined}
              data-field="rights_reason"
            >
              AI placeholder rights reason
              <input
                value={editor.rights_reason || ''}
                aria-invalid={invalidFields.includes('rights_reason') || undefined}
                onChange={(e) => setEditor({ ...editor, rights_reason: e.target.value })}
              />
            </label>
          )}
          <div className="form-grid">
            {Object.entries(editor)
              .filter(
                ([key]) => !['claims_reason', 'rights_reason', 'override_reason'].includes(key),
              )
              .map(([key, value]) =>
                value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                'id' in value &&
                typeof (value as any).id === 'string' ? (
                  <fieldset
                    key={key}
                    className={`bilingual-field${invalidFields.includes(key) ? ' field-invalid' : ''}`}
                    data-field={key}
                    aria-invalid={invalidFields.includes(key) || undefined}
                  >
                    <legend>{key.replaceAll('_', ' ')}</legend>
                    <label>
                      Bahasa Indonesia
                      <input
                        value={(value as any).id || ''}
                        onChange={(e) =>
                          setEditor({ ...editor, [key]: { ...value, id: e.target.value } })
                        }
                      />
                    </label>
                    <label>
                      English{' '}
                      {!((value as any).en || '').trim() && (
                        <small className="translation-warning">Missing English</small>
                      )}
                      <input
                        value={(value as any).en || ''}
                        onChange={(e) =>
                          setEditor({ ...editor, [key]: { ...value, en: e.target.value } })
                        }
                      />
                    </label>
                  </fieldset>
                ) : [
                    'package_id',
                    'batch_id',
                    'event_id',
                    'booking_id',
                    'traveler_id',
                    'media_id',
                    'hero_media_id',
                    'hero_video_id',
                    'poster_asset_id',
                    'hotel_service_id',
                    'service_id',
                  ].includes(key) ? (
                  <ReferenceField
                    key={key}
                    field={key}
                    value={value as string | null}
                    invalid={invalidFields.includes(key)}
                    onChange={(v) => setEditor({ ...editor, [key]: v })}
                  />
                ) : key === 'kind' && resource === 'sections' ? (
                  <label
                    key={key}
                    className={invalidFields.includes(key) ? 'field-invalid' : undefined}
                    data-field={key}
                  >
                    Home section
                    <select
                      value={String(value)}
                      aria-invalid={invalidFields.includes(key) || undefined}
                      onChange={(e) => {
                        const kind = e.target.value;
                        setEditor({
                          ...editor,
                          kind,
                          data: {
                            title: { id: '', en: '' },
                            body: { id: '', en: '' },
                            ...(['why', 'how_to_book'].includes(kind)
                              ? { items: [{ title: { id: '', en: '' }, body: { id: '', en: '' } }] }
                              : {}),
                            ...(kind === 'hero'
                              ? {
                                  poster: '',
                                  mobile_poster: '',
                                  video: '',
                                  intro: { id: '', en: '' },
                                }
                              : {}),
                          },
                        });
                      }}
                    >
                      {[
                        'hero',
                        'why',
                        'sports',
                        'season',
                        'beyond',
                        'how_to_book',
                        'team',
                        'cta',
                      ].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                ) : data.field_options?.[key]?.length ? (
                  <ChoiceField
                    key={`${current?.id || 'new'}:${key}`}
                    name={key}
                    value={value}
                    options={data.field_options[key]}
                    onChange={(next) => setEditor({ ...editor, [key]: next })}
                    allowCustom={resource === 'batches' && key === 'hotel_category'}
                    invalid={invalidFields.includes(key)}
                  />
                ) : typeof value === 'boolean' ? (
                  <label
                    key={key}
                    className={`checkbox${invalidFields.includes(key) ? ' field-invalid' : ''}`}
                    data-field={key}
                  >
                    <input
                      type="checkbox"
                      checked={value}
                      aria-invalid={invalidFields.includes(key) || undefined}
                      onChange={(e) => setEditor({ ...editor, [key]: e.target.checked })}
                    />
                    {key.replaceAll('_', ' ')}
                  </label>
                ) : value && typeof value === 'object' ? (
                  <StructuredObjectEditor
                    key={key}
                    name={key}
                    value={value}
                    invalid={invalidFields.includes(key)}
                    onChange={(v) => setEditor({ ...editor, [key]: v })}
                  />
                ) : (
                  <label
                    key={key}
                    className={invalidFields.includes(key) ? 'field-invalid' : undefined}
                    data-field={key}
                  >
                    {key.replaceAll('_', ' ')}
                    <input
                      value={value === null ? '' : String(value)}
                      aria-invalid={invalidFields.includes(key) || undefined}
                      type={
                        dateFields.has(key)
                          ? 'date'
                          : key === 'password'
                            ? 'password'
                            : typeof value === 'number'
                              ? 'number'
                              : 'text'
                      }
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          [key]:
                            typeof value === 'number'
                              ? Number(e.target.value)
                              : value === null && e.target.value === ''
                                ? null
                                : e.target.value,
                        })
                      }
                    />
                  </label>
                ),
              )}
          </div>
          <details>
            <summary>Preview bilingual content</summary>
            <div className="form-grid">
              {(['id', 'en'] as const).map((lang) => (
                <div className="panel" key={lang}>
                  <span className="section-index">
                    {lang === 'id' ? 'Bahasa Indonesia' : 'English'}
                  </span>
                  <h3>
                    {text(
                      editor.title || editor.name || editor.question || editor.data?.title,
                      lang,
                    )}
                  </h3>
                  <RichText
                    value={
                      editor.body ||
                      editor.story ||
                      editor.summary ||
                      editor.answer ||
                      editor.quote ||
                      editor.data?.body
                    }
                    lang={lang}
                  />
                </div>
              ))}
            </div>
          </details>
          <details>
            <summary>Add optional fields</summary>
            <select
              aria-label="Add a field"
              value=""
              onChange={(e) =>
                setEditor({
                  ...editor,
                  [e.target.value]: [
                    'highlights',
                    'inclusions',
                    'exclusions',
                    'cities',
                    'countries',
                  ].includes(e.target.value)
                    ? []
                    : [
                          'member_note',
                          'meeting_point',
                          'hotel_style',
                          'visa_note',
                          'terms',
                          'description',
                        ].includes(e.target.value)
                      ? { id: '', en: '' }
                      : '',
                })
              }
            >
              <option value="">Choose a field…</option>
              {data.fields
                .filter((k: string) => !(k in editor))
                .map((k: string) => (
                  <option key={k}>{k}</option>
                ))}
            </select>
          </details>
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save record'}
          </button>
        </form>
      )}
      <div className="table-scroll" role="region" aria-label={`${resource} records`} tabIndex={0}>
        <table>
          <thead>
            <tr>
              {cols.map((c: string) => (
                <th key={c}>{c.replaceAll('_', ' ')}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id || r.key}>
                {cols.map((c: string) => (
                  <td key={c}>
                    {['status', 'date_status', 'stage'].includes(c) ? (
                      <Chip value={r[c] || 'draft'} />
                    ) : c === 'total' ? (
                      money(r[c])
                    ) : typeof r[c] === 'object' ? (
                      r[c]?.id || r[c]?.en || JSON.stringify(r[c]).slice(0, 90)
                    ) : typeof r[c] === 'boolean' ? (
                      r[c] ? (
                        'Yes'
                      ) : (
                        'No'
                      )
                    ) : (
                      String(r[c] ?? '—')
                    )}
                  </td>
                ))}
                <td className="table-actions">
                  {resource === 'deletion-requests' && (
                    <Link to={'/admin/members/' + r.user_id}>Review deletion request</Link>
                  )}
                  {resource === 'webhook-review' && (
                    <button
                      className="text-button"
                      onClick={() => action('/api/admin/webhook-review/' + r.id + '/retry')}
                    >
                      Retry stored event
                    </button>
                  )}
                  {resource === 'members' ? (
                    <Link to={'/admin/members/' + r.id}>Open member ↗</Link>
                  ) : resource === 'requests' || resource === 'bookings' ? (
                    <Link to={'/admin/requests/' + r.code}>Open ↗</Link>
                  ) : resource === 'batches' ? (
                    <>
                      <Link to={'/admin/batches/' + r.id}>Workspace ↗</Link>
                      <button className="text-button" onClick={() => edit(r)}>
                        Edit
                      </button>
                    </>
                  ) : !data.readonly ? (
                    <button className="text-button" onClick={() => edit(r)}>
                      Edit
                    </button>
                  ) : (
                    <details>
                      <summary>Details</summary>
                      <pre>{JSON.stringify(r, null, 2)}</pre>
                    </details>
                  )}
                  {resource === 'events' && (
                    <>
                      <EventActions event={r} onAction={action} />
                      <details>
                        <summary>Verify date with official source</summary>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void action(`/api/admin/events/${r.id}/verify-date`, {
                              starts_on: f.get('starts_on'),
                              ends_on: f.get('ends_on'),
                              source_url: f.get('source_url'),
                            });
                          }}
                        >
                          <label>
                            Start
                            <input name="starts_on" type="date" required />
                          </label>
                          <label>
                            End
                            <input name="ends_on" type="date" required />
                          </label>
                          <label>
                            Official source URL
                            <input name="source_url" type="url" required />
                          </label>
                          <button className="button">Verify date</button>
                        </form>
                      </details>
                    </>
                  )}{' '}
                  {resource === 'invoices' && r.status === 'issued' && (
                    <MoneyActions invoice={r} onAction={action} />
                  )}{' '}
                  {resource === 'payments' && <RefundForm payment={r} onAction={action} />}{' '}
                  {resource === 'notifications' && ['failed', 'skipped'].includes(r.status) && (
                    <button
                      className="text-button"
                      onClick={() => action(`/api/admin/notifications/${r.id}/resend`)}
                    >
                      Resend
                    </button>
                  )}
                  {resource === 'documents' && r.status === 'published' && (
                    <button
                      className="text-button"
                      onClick={() => action(`/api/admin/documents/${r.id}/withdraw`)}
                    >
                      Withdraw
                    </button>
                  )}
                  {resource === 'members' && (
                    <details>
                      <summary>Delete account</summary>
                      <p>Financial records are retained. Active trips block anonymization.</p>
                      <button
                        className="button outline"
                        onClick={() => action(`/api/admin/members/${r.id}/anonymize`)}
                      >
                        Anonymize member
                      </button>
                    </details>
                  )}
                  {resource === 'documents' && (
                    <a
                      className="button outline"
                      href={'/api/admin/documents/' + r.id + '/download'}
                    >
                      Download privately
                    </a>
                  )}
                  {resource === 'travelers' && <TravelerAdmin traveler={r} onAction={action} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty title="No records here yet." />}
      {eventReview && (
        <Dialog
          open
          title="Review event impact before saving"
          onOpenChange={(v) => {
            if (!v) setEventReview(null);
          }}
        >
          <p>
            These batches and bookings may be affected. Their departure dates will stay as entered.
          </p>
          <EventImpact impact={eventReview} />
          <button
            className="button"
            onClick={async () => {
              await api('/api/admin/data/events/' + current.id, {
                method: 'PATCH',
                body: JSON.stringify(editor),
              });
              setEventReview(null);
              setEditor(null);
              revalidator.revalidate();
            }}
          >
            Confirm event change
          </button>
        </Dialog>
      )}
      {data.next_cursor && (
        <Link
          className="button outline"
          to={`?${new URLSearchParams({ ...Object.fromEntries(params), cursor: data.next_cursor })}`}
        >
          Next page →
        </Link>
      )}
    </>
  );
}
function UploadForm({
  onDone,
  media = false,
  batchId,
}: {
  onDone: () => void;
  media?: boolean;
  batchId?: string;
}) {
  const [error, setError] = useState(''),
    [done, setDone] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <details className="upload-panel">
      <summary className="button outline">
        <Upload size={15} />
        {media ? 'Upload media' : 'Upload document'}
      </summary>
      <form
        method="post"
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const f = new FormData(e.currentTarget),
              file = f.get('file') as File;
            const r = await uploadFile(
              file,
              Object.fromEntries(
                [...f.entries()]
                  .filter(([k, v]) => k !== 'file' && typeof v === 'string')
                  .map(([k, v]) => [k, String(v)]),
              ),
              media,
            );
            setDone(`Uploaded: ${r.filename || r.storage_key}${r.id ? ' · ID: ' + r.id : ''}`);
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Alert message={error} />
        <Alert message={done} success />
        {!media && (
          <>
            <ReferenceField field="batch_id" value={batchId || null} name="batch_id" />
            <ReferenceField field="booking_id" value={null} name="booking_id" />
            <ReferenceField field="traveler_id" value={null} name="traveler_id" />
            <label>
              Title
              <input name="title" required />
            </label>
            <label>
              Type
              <select name="type">
                {[
                  'flight_ticket',
                  'hotel_voucher',
                  'event_ticket',
                  'transfer_voucher',
                  'insurance',
                  'itinerary',
                  'payment_proof',
                  'other',
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          File
          <input
            name="file"
            type="file"
            required
            accept={
              media
                ? 'image/jpeg,image/png,image/webp,video/mp4,video/webm'
                : 'application/pdf,image/jpeg,image/png'
            }
          />
        </label>
        <button className="button" disabled={busy}>
          {busy ? 'Uploading…' : media ? 'Upload media' : 'Upload privately'}
        </button>
      </form>
    </details>
  );
}
function MoneyActions({
  invoice: i,
  onAction,
}: {
  invoice: any;
  onAction: (url: string, body: any) => void;
}) {
  return (
    <details>
      <summary>Record payment / void</summary>
      <UploadForm onDone={() => undefined} />
      {i.needs_review && (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            onAction(`/api/admin/invoices/${i.id}/resolve-review`, {
              note: new FormData(e.currentTarget).get('note'),
            });
          }}
        >
          <p>Review recorded funds and external refunds before closing the flag.</p>
          <label>
            Finance resolution note
            <textarea name="note" required minLength={10} />
          </label>
          <button className="button outline">Close resolved review</button>
        </form>
      )}
      <form
        method="post"
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onAction(`/api/admin/invoices/${i.id}/manual-payment`, {
            amount: Number(f.get('amount')),
            confirm_amount: f.get('confirm_amount'),
            reference: f.get('reference'),
            paid_at: new Date(String(f.get('paid_at'))).toISOString(),
            proof_document_id: f.get('proof_document_id'),
          });
        }}
      >
        <h3>Offline bank transfer</h3>
        <label>
          Amount (IDR)
          <input name="amount" type="number" defaultValue={i.total} required />
        </label>
        <label>
          Type amount to confirm
          <input name="confirm_amount" required />
        </label>
        <label>
          Bank reference
          <input name="reference" required />
        </label>
        <label>
          Paid at
          <input name="paid_at" type="datetime-local" required />
        </label>
        <ReferenceField field="proof_document_id" value={null} name="proof_document_id" required />
        <button className="button">Record full payment</button>
      </form>
      <form
        method="post"
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onAction(`/api/admin/invoices/${i.id}/void`, {
            confirm_amount: f.get('confirm_amount'),
            reason: f.get('reason'),
          });
        }}
      >
        <h3>Void unpaid invoice</h3>
        <label>
          Type {i.total} to confirm
          <input name="confirm_amount" required />
        </label>
        <label>
          Reason
          <input name="reason" required />
        </label>
        <button className="button outline">Void invoice</button>
      </form>
    </details>
  );
}
function RefundForm({
  payment: p,
  onAction,
}: {
  payment: any;
  onAction: (url: string, body: any) => void;
}) {
  return (
    <details>
      <summary>Record external refund</summary>
      <form
        method="post"
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onAction(`/api/admin/payments/${p.id}/refunds`, {
            amount: Number(f.get('amount')),
            confirm_amount: f.get('confirm_amount'),
            method: f.get('method'),
            reason: f.get('reason'),
            processed_on: f.get('processed_on'),
            reference: String(f.get('reference') || ''),
          });
        }}
      >
        {['amount', 'confirm_amount', 'method', 'reason', 'reference', 'processed_on'].map((k) => (
          <label key={k}>
            {k.replaceAll('_', ' ')}
            <input
              name={k}
              type={k === 'amount' ? 'number' : k === 'processed_on' ? 'date' : 'text'}
              required
            />
          </label>
        ))}
        <button className="button">Record refund</button>
      </form>
    </details>
  );
}
function EventActions({
  event,
  onAction,
}: {
  event: any;
  onAction: (path: string, body: any) => void;
}) {
  const [impact, setImpact] = useState<any>(null),
    [template, setTemplate] = useState('changed');
  return (
    <details>
      <summary>Impact & notification</summary>
      <button
        className="text-button"
        onClick={async () => setImpact(await api(`/api/admin/events/${event.id}/impact`))}
      >
        Show affected batches
      </button>
      {impact && <EventImpact impact={impact} />}
      <p>Batch dates do not move automatically. Review affected bookings before sending.</p>
      <form
        method="post"
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onAction(`/api/admin/events/${event.id}/notify-template`, {
            template,
            ...(String(f.get('id') || '').trim()
              ? { message: { id: f.get('id'), en: f.get('en') } }
              : {}),
          });
        }}
      >
        <label>
          Prepared notice
          <select value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="confirmed">Date confirmed</option>
            <option value="changed">Date changed; adjusting your journey</option>
            <option value="cancelled">Event cancelled; we will contact you</option>
          </select>
        </label>
        <label>
          Optional message · Bahasa Indonesia
          <textarea name="id" />
        </label>
        <label>
          Optional message · English
          <textarea name="en" />
        </label>
        <button className="button outline">Notify affected lead bookers</button>
      </form>
    </details>
  );
}
function TravelerAdmin({
  traveler: t,
  onAction: _onAction,
}: {
  traveler: any;
  onAction: (url: string, body: any) => void;
}) {
  const revalidator = useRevalidator(),
    [reveal, setReveal] = useState(''),
    [error, setError] = useState(''),
    [value, setValue] = useState<any>({
      given_names: t.given_names,
      surname: t.surname,
      nationality: t.nationality || 'ID',
      date_of_birth: t.date_of_birth,
      gender: t.gender,
      passport_expiry: t.passport_expiry,
      dietary: t.dietary || [],
      dietary_notes: t.dietary_notes || '',
      medical_notes: t.medical_notes || '',
      relationship: t.relationship || '',
    });
  return (
    <details>
      <summary>Manage traveler</summary>
      <button
        className="text-button"
        onClick={async () => {
          try {
            setReveal(
              (await api(`/api/admin/travelers/${t.id}/reveal`, { method: 'POST' }))
                .passport_number || 'Not supplied',
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Reveal passport (audited)
      </button>
      {reveal && <p>{reveal}</p>}
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api(`/api/admin/travelers/${t.id}`, {
              method: 'PATCH',
              body: JSON.stringify(value),
            });
            revalidator.revalidate();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {error && <p role="alert">{error}</p>}
        <div className="form-grid">
          {[
            'given_names',
            'surname',
            'nationality',
            'date_of_birth',
            'passport_expiry',
            'relationship',
          ].map((k) => (
            <label key={k}>
              {k.replaceAll('_', ' ')}
              <input
                type={['date_of_birth', 'passport_expiry'].includes(k) ? 'date' : 'text'}
                value={value[k] || ''}
                onChange={(e) =>
                  setValue({
                    ...value,
                    [k]:
                      e.target.value ||
                      (['date_of_birth', 'passport_expiry'].includes(k) ? null : ''),
                  })
                }
              />
            </label>
          ))}
        </div>
        <label>
          New passport number (leave blank to retain)
          <input
            autoComplete="off"
            onChange={(e) => {
              const next = { ...value };
              if (e.target.value) next.passport_number = e.target.value;
              else delete next.passport_number;
              setValue(next);
            }}
          />
        </label>
        <label>
          Gender
          <select
            value={value.gender || ''}
            onChange={(e) => setValue({ ...value, gender: e.target.value || null })}
          >
            <option value="">Not supplied</option>
            {['female', 'male', 'x'].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Dietary preferences</legend>
          {['halal', 'vegetarian', 'vegan', 'no_pork', 'no_alcohol', 'other'].map((d) => (
            <label key={d} className="checkbox">
              <input
                type="checkbox"
                checked={value.dietary.includes(d)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    dietary: e.target.checked
                      ? [...value.dietary, d]
                      : value.dietary.filter((x: string) => x !== d),
                  })
                }
              />
              {d.replaceAll('_', ' ')}
            </label>
          ))}
        </fieldset>
        {['dietary_notes', 'medical_notes'].map((k) => (
          <label key={k}>
            {k.replaceAll('_', ' ')}
            <textarea
              value={value[k]}
              onChange={(e) => setValue({ ...value, [k]: e.target.value })}
            />
          </label>
        ))}
        <button className="button outline">Save details</button>
      </form>
    </details>
  );
}

function BatchWorkspace({ data }: { data: any }) {
  const revalidator = useRevalidator(),
    b = data.batch,
    [tab, setTab] = useState('Overview'),
    [error, setError] = useState('');
  async function action(url: string, body: any) {
    try {
      await api(url, { method: 'POST', body: JSON.stringify(body) });
      revalidator.revalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Alert message={error} />
      <div className="batch-summary">
        <Chip value={b.status} />
        <div className="seat-bar">
          <span style={{ width: `${(Number(b.confirmed) / b.capacity) * 100}%` }} />
          <span className="held" style={{ width: `${(Number(b.held) / b.capacity) * 100}%` }} />
        </div>
        <span>
          {b.confirmed} confirmed · {b.held} held · {b.remaining} remaining / {b.capacity}
        </span>
        <span>
          {date(b.start_date, 'en')} — {date(b.end_date, 'en')}
        </span>
      </div>
      <nav className="filter-tabs" aria-label="Batch workspace">
        {[
          'Overview',
          'Operations',
          'Checklist',
          'Roster',
          'Itinerary',
          'Documents',
          'Rooms',
          'Visa',
          'Broadcast',
        ].map((t) => (
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
      {tab === 'Operations' ? (
        <OperationsBoard data={data} onTab={setTab} />
      ) : tab === 'Overview' ? (
        <div className="panel">
          <h2>Departure readiness</h2>
          <p>
            {b.confirmed} confirmed, {b.held} held, {b.remaining} places available.
          </p>
          <p>Tour leader: {b.tour_leader_name || 'To be assigned'}</p>
          <p>Meeting point: {text(b.meeting_point, 'en') || 'To be confirmed'}</p>
          <button className="button outline" onClick={() => setTab('Checklist')}>
            Review missing items
          </button>
        </div>
      ) : tab === 'Visa' ? (
        <div className="stack">
          {data.visas.rows.map((v: any) => (
            <div className="panel" key={v.id}>
              <h3>
                {data.roster.find((t: any) => t.traveler_id === v.traveler_id)?.given_names} ·{' '}
                {v.destination}
              </h3>
              <Chip value={v.stage} />
              {v.appointment_at && (
                <p>
                  {date(v.appointment_at, 'en', true)} · {v.appointment_location}
                </p>
              )}
              <VisaEditor visa={v} onSaved={() => revalidator.revalidate()} />
            </div>
          ))}
        </div>
      ) : tab === 'Checklist' ? (
        <>
          <h2>Before departure</h2>
          {data.checklist.length ? (
            data.checklist.map((t: any) => (
              <div className="panel" key={t.traveler_id}>
                <h3>
                  {t.name} · {t.code}
                </h3>
                {t.missing.length ? (
                  <ul>
                    {t.missing.map((v: string) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <Chip value="confirmed" label="All arrangements ready" />
                )}
              </div>
            ))
          ) : (
            <Empty title="No confirmed travelers yet." />
          )}
        </>
      ) : tab === 'Roster' ? (
        <>
          <a className="button outline" href={`/api/admin/batches/${b.id}/roster.csv`}>
            Download roster CSV
          </a>
          <div className="table-scroll" role="region" aria-label="Departure roster" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Traveler</th>
                  <th>Booking</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Dietary</th>
                  <th>Rooms / hotel stay</th>
                  <th>Passport expiry</th>
                </tr>
              </thead>
              <tbody>
                {data.roster.map((t: any) => (
                  <tr key={t.booking_traveler_id}>
                    <td>
                      {t.given_names} {t.surname}
                    </td>
                    <td>{t.code}</td>
                    <td>
                      <Chip value={t.booking_status} />
                    </td>
                    <td>{t.payment_status || 'No invoice'}</td>
                    <td>{t.dietary.join(', ')}</td>
                    <td>
                      {t.rooms
                        ?.map((r: any) => `${r.hotel_name || 'Stay'}: ${r.label}`)
                        .join('; ') || 'Unassigned'}
                    </td>
                    <td>
                      {t.passport_expiry || 'Missing'} · {t.passport_warning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === 'Itinerary' ? (
        <>
          <div className="actions">
            <Link className="button outline" to="/admin/itinerary">
              Edit itinerary items ↗
            </Link>
            <button
              className="button"
              onClick={() =>
                action(`/api/admin/batches/${b.id}/publish`, {
                  itinerary: data.itinerary.map((i: any) => i.id),
                })
              }
            >
              Publish itinerary
            </button>
          </div>
          {data.itinerary.map((i: any) => (
            <div className="panel" key={i.id}>
              <span>
                Day {i.day_number} · {i.starts_at_local || ''} {i.timezone}
              </span>
              <h3>{text(i.title, 'en')}</h3>
              <p>{text(i.body, 'en')}</p>
              <Chip value={i.published_at ? 'published' : 'draft'} />
            </div>
          ))}
        </>
      ) : tab === 'Documents' ? (
        <>
          <div className="actions">
            <UploadForm batchId={b.id} onDone={() => revalidator.revalidate()} />
            <button
              className="button"
              onClick={() =>
                action(`/api/admin/batches/${b.id}/publish`, {
                  documents: data.documents
                    .filter((d: any) => d.status === 'private' && d.type !== 'payment_proof')
                    .map((d: any) => d.id),
                })
              }
            >
              Publish private documents
            </button>
          </div>
          <BulkDocumentUpload
            batchId={b.id}
            roster={data.roster}
            onDone={() => revalidator.revalidate()}
          />
          {data.documents.map((d: any) => (
            <div className="document-row" key={d.id}>
              <FileText size={20} />
              <div>
                {d.filename}
                <p className="small muted">{d.type}</p>
              </div>
              <Chip value={d.status} />
            </div>
          ))}
        </>
      ) : tab === 'Rooms' ? (
        <>
          <Link className="button outline" to="/admin/rooms">
            Create / edit rooms ↗
          </Link>
          {data.rooms.map((r: any) => (
            <form
              method="post"
              className="panel form-stack"
              key={r.id}
              onSubmit={(e) => {
                e.preventDefault();
                action(`/api/admin/rooms/${r.id}/occupants`, {
                  booking_traveler_ids: new FormData(e.currentTarget).getAll('occupants'),
                });
              }}
            >
              <h3>
                {r.label} · {r.room_type} ·{' '}
                {data.services.find((s: any) => s.id === r.hotel_service_id)?.details?.hotel_name ||
                  'Unassigned hotel stay'}
              </h3>
              {data.roster.map((t: any) => (
                <label className="checkbox" key={t.booking_traveler_id}>
                  <input
                    type="checkbox"
                    name="occupants"
                    value={t.booking_traveler_id}
                    defaultChecked={t.rooms?.some((room: any) => room.room_id === r.id)}
                  />
                  {t.given_names} {t.surname}
                </label>
              ))}
              <button className="button">Save room assignment</button>
            </form>
          ))}
        </>
      ) : (
        <form
          method="post"
          className="panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            action(`/api/admin/batches/${b.id}/broadcast`, {
              message: {
                id: new FormData(e.currentTarget).get('id'),
                en: new FormData(e.currentTarget).get('en'),
              },
            });
          }}
        >
          <h2>Message all lead bookers</h2>
          <label>
            Utility message · Bahasa Indonesia
            <textarea name="id" rows={5} required />
          </label>
          <label>
            Utility message · English
            <textarea name="en" rows={5} />
          </label>
          <button className="button">Send batch message</button>
        </form>
      )}
    </>
  );
}

function MemberAdmin({ member }: { member: any }) {
  return (
    <>
      <h2>{member.user.full_name}</h2>
      <p>
        {member.user.email} · {member.user.whatsapp_e164}
      </p>
      <h3>Traveler profiles</h3>
      {member.travelers.map((t: any) => (
        <div className="panel" key={t.id}>
          <h3>
            {t.given_names} {t.surname}
          </h3>
          <p>
            {t.passport_masked} · {t.dietary.join(', ')}
          </p>
          <TravelerAdmin traveler={t} onAction={() => window.location.reload()} />
        </div>
      ))}
      <h3>Journeys</h3>
      {member.bookings.map((b: any) => (
        <div className="document-row" key={b.id}>
          <Link className="text-link" to={'/admin/bookings/' + b.code}>
            {b.code} · {text(b.title, 'en')} ↗
          </Link>
          <Chip value={b.status} />
        </div>
      ))}
      <h3>Invoices</h3>
      {member.invoices.map((i: any) => (
        <div className="document-row" key={i.id}>
          <span>
            {i.number} · {money(i.total)}
          </span>
          <Chip value={i.status} />
        </div>
      ))}
      <h3>Notification history</h3>
      {member.notifications.map((n: any, i: number) => (
        <div className="document-row" key={i}>
          <span>
            {n.template_key} · {n.channel}
          </span>
          <Chip value={n.status} />
        </div>
      ))}
    </>
  );
}

function BulkDocumentUpload({
  batchId,
  roster,
  onDone,
}: {
  batchId: string;
  roster: any[];
  onDone: () => void;
}) {
  const [items, setItems] = useState<
      { file: File; travelerId: string; type: string; done: boolean }[]
    >([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const types = [
    'flight_ticket',
    'hotel_voucher',
    'event_ticket',
    'transfer_voucher',
    'insurance',
    'itinerary',
    'other',
  ];
  return (
    <details>
      <summary>Bulk upload documents</summary>
      <p className="small muted">
        Name files booking-code_surname_type.pdf. Review automatic matches and assign unmatched
        files before upload.
      </p>
      <label>
        Documents
        <input
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) =>
            setItems(
              Array.from(e.target.files || []).map((file) => {
                const match = file.name.match(/^([^_]+)_([^_]+)_(.+)\.(pdf|jpe?g|png)$/i),
                  traveler = match
                    ? roster.find(
                        (t) =>
                          t.code.toLowerCase() === match[1].toLowerCase() &&
                          t.surname.toLowerCase() === match[2].toLowerCase(),
                      )
                    : null;
                return {
                  file,
                  travelerId: traveler?.booking_traveler_id || '',
                  type: match && types.includes(match[3]) ? match[3] : 'other',
                  done: false,
                };
              }),
            )
          }
        />
      </label>
      <Alert message={error} />
      {items.map((item, i) => (
        <div className="panel form-grid" key={i}>
          <span>
            {item.file.name} · {item.done ? 'Uploaded' : item.travelerId ? 'Matched' : 'Unmatched'}
          </span>
          <label>
            Assign traveler
            <select
              value={item.travelerId}
              disabled={item.done}
              onChange={(e) =>
                setItems(items.map((v, j) => (j === i ? { ...v, travelerId: e.target.value } : v)))
              }
            >
              <option value="">Choose a traveler</option>
              {roster.map((t) => (
                <option key={t.booking_traveler_id} value={t.booking_traveler_id}>
                  {t.code} · {t.given_names} {t.surname}
                </option>
              ))}
            </select>
          </label>
          <label>
            Document type
            <select
              value={item.type}
              disabled={item.done}
              onChange={(e) =>
                setItems(items.map((v, j) => (j === i ? { ...v, type: e.target.value } : v)))
              }
            >
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
      ))}
      {items.length > 0 && (
        <button
          className="button"
          disabled={busy || items.some((i) => !i.travelerId)}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              for (const [i, item] of items.entries()) {
                if (item.done) continue;
                const t = roster.find((t) => t.booking_traveler_id === item.travelerId);
                await uploadFile(item.file, {
                  batch_id: batchId,
                  booking_id: t.booking_id,
                  traveler_id: t.traveler_id,
                  type: item.type,
                  title: item.file.name,
                });
                setItems((old) => old.map((v, j) => (j === i ? { ...v, done: true } : v)));
              }
              onDone();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Uploading…' : 'Upload assigned files privately'}
        </button>
      )}
    </details>
  );
}
