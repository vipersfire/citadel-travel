import { useState } from 'react';
import { Button, Field, FixtureStub, Chip } from '@citadel/ui';
import { Select, Checkbox, Dialog, Tabs } from '@citadel/ui/widgets';
import { DateWithStatus } from '@citadel/ui/feedback';
import { TripPass } from '@citadel/ui/trip-pass';
import { serverApi } from '../api';
export async function loader({ request }: any) {
  const config = await serverApi(request, '/api/public/config');
  if (!config.development) throw new Response('Not found', { status: 404 });
  return null;
}
export function meta() {
  return [{ title: 'Component states · Citadel' }];
}
export default function UIGallery() {
  const [open, setOpen] = useState(false),
    [checked, setChecked] = useState(false),
    [tab, setTab] = useState('one'),
    [choice, setChoice] = useState('id');
  return (
    <main id="main" className="container section">
      <h1>Component states</h1>
      <div className="actions">
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Button variant="outline">Secondary action</Button>
        <Button disabled>Disabled action</Button>
      </div>
      <Field label="Traveler name" help="As written on the passport">
        <input autoComplete="name" />
      </Field>
      <Field label="Validation example" error="Enter a valid email">
        <input type="email" aria-invalid="true" />
      </Field>
      <Select
        label="Language"
        options={[
          { value: 'id', label: 'Bahasa Indonesia' },
          { value: 'en', label: 'English' },
        ]}
        value={choice}
        onValueChange={setChoice}
      />
      <Checkbox label="Receive journey updates" checked={checked} onCheckedChange={setChecked} />
      <div className="actions">
        {['confirmed', 'provisional', 'expired', 'needs_review'].map((v) => (
          <Chip key={v} value={v} />
        ))}
      </div>
      <DateWithStatus
        date="14 March 2027"
        status="changed"
        label="Changed"
        previousDate="13 March 2027"
      />
      <Tabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          {
            value: 'one',
            label: 'Overview',
            content: <p>Keyboard tabs use arrows to change selection.</p>,
          },
          { value: 'two', label: 'Documents', content: <p>Published documents appear here.</p> },
        ]}
      />
      <FixtureStub
        title="Manchester"
        event="A matchday evening"
        meta="Illustrative component"
        date="13 March 2027"
        status="provisional"
        statusLabel="Provisional"
        href="/en/sport"
        action="Request"
      />
      <TripPass code="DEMO-PASS" status="confirmed">
        <div>
          <h2>Manchester</h2>
          <p>13–17 March 2027</p>
        </div>
        <div className="trip-pass-stub">
          <Chip value="confirmed" />
          <span>23 days</span>
        </div>
      </TripPass>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Your arrangement"
        description="Dialog focus stays inside until you close it."
      >
        <Field label="Note">
          <input />
        </Field>
        <Button onClick={() => setOpen(false)}>Save and close</Button>
      </Dialog>
    </main>
  );
}
