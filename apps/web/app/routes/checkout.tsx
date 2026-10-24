import { useLoaderData, useNavigate } from 'react-router';
import { useState } from 'react';
import { serverApi, api } from '../api';
import { money } from '@citadel/i18n';
import { Alert } from '../components';
import { BrandMark } from '../site-shell';
export async function loader({ request, params }: any) {
  return serverApi(request, '/api/dev/checkout/' + params.reference);
}
export default function Checkout() {
  const a = useLoaderData<typeof loader>(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main id="main" className="container checkout">
      <BrandMark to="/" />
      <span className="chip wait">Development checkout</span>
      <h1>Simulate your payment.</h1>
      <p>This records a development payment event. No money is collected.</p>
      <div className="panel">
        <p>
          {a.number} · {a.code}
        </p>
        <h2>{money(a.amount)}</h2>
        <Alert message={error} />
        <button
          className="button full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api('/api/dev/checkout/' + a.reference_id + '/complete', { method: 'POST' });
              navigate(
                `/${a.locale}/account/trips/${a.code}/payments?result=success&invoice=${a.invoice_id}`,
              );
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? 'Processing…' : 'Simulate successful payment'} →
        </button>
        <button
          className="text-button"
          onClick={() => navigate(`/${a.locale}/account/trips/${a.code}/payments?result=cancelled`)}
        >
          Cancel checkout
        </button>
      </div>
    </main>
  );
}
