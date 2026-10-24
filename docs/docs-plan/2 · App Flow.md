# 2 · App Flow

One web app serves three areas: the public site (`/:lang/...`), the member account (`/:lang/account/...`) and the admin panel (`/admin/...`). A booking moves through one state machine from request to completed. Money and documents only move when admin acts or a verified Xendit webhook arrives. The admin UI is English-only at pilot; public and member areas are ID/EN. V2 override: the section “V2 changes to the flows” at the end of this tab changes Flow 2 (steps 3, 5 and 6), Flow 3 (step 1) and Flow 7, adds Flows 8 to 10 and new state-machine rows. Read it with Flows 1 to 7.

## Booking lifecycle

&#91;embedded content: booking lifecycle · 5 main states, 3 exits\]

Members and admin can decline or cancel any time before confirmation. After confirmation, only admin records a cancellation and any refund (dashed path).

## Route map

`:lang` is `id` (default) or `en`. A bare `/` redirects to `/id`, or to `/en` when the browser prefers English and no choice is stored.

| Area | Route | Screen | Auth |
| --- | --- | --- | --- |
| Public | `/:lang` | Home | none |
| Public | `/:lang/sport` and `/:lang/sport/:sport` | Sport collection (football, motorsport, tennis, running) | none |
| Public | `/:lang/beyond-the-event` | Beyond the event (cities, food, companion activities; secondary to sport content) | none |
| Public | `/:lang/trips/:slug` | Package page | none |
| Public | `/:lang/enquire` | Light enquiry and interest form (no account, no passport) (`?package=slug`) | none |
| Public | `/:lang/how-it-works`, `/:lang/about`, `/:lang/faq`, `/:lang/contact` | Static pages | none |
| Public | `/:lang/legal/:slug` | Terms, privacy, cancellation policy | none |
| Auth | `/:lang/sign-in`, `/:lang/sign-up` | Sign in, sign up (Google or email) | guest only |
| Auth | `/:lang/verify-email`, `/:lang/forgot-password`, `/:lang/reset-password` | Email flows | token |
| Auth | `/auth/google/start`, `/auth/google/callback` | OAuth redirect handlers (API) | none |
| Member | `/:lang/account` | My trips | member |
| Member | `/:lang/account/request/:packageSlug` | New booking request (3 steps) | verified member |
| Member | `/:lang/account/trips/:code` | Trip overview | owner |
| Member | `/:lang/account/trips/:code/itinerary` | Itinerary and PDF download | owner |
| Member | `/:lang/account/trips/:code/documents` | Travel documents, flights, hotels, experiences | owner |
| Member | `/:lang/account/trips/:code/travelers` | Travelers and visa status | owner |
| Member | `/:lang/account/trips/:code/payments` | Offer, invoices, pay, receipts | owner |
| Member | `/:lang/account/travelers` | Traveler profiles | member |
| Member | `/:lang/account/profile` | Profile, language, WhatsApp opt-in, password, Google link, delete account | member |
| Admin | `/admin/sign-in` | Email, password, TOTP | guest only |
| Admin | `/admin` | Dashboard: work queues | admin |
| Admin | `/admin/requests`, `/admin/requests/:code` | Request queue and detail, offer builder | admin |
| Admin | `/admin/bookings/:code` | Booking detail (all tabs a member sees, plus internal data) | admin |
| Admin | `/admin/batches`, `/admin/batches/:id` | Batch list. Detail tabs: Overview, Roster, Operations, Rooms, Itinerary, Documents, Visa, Broadcast | admin |
| Admin | `/admin/events` | Events and date status | admin |
| Admin | `/admin/packages`, `/admin/packages/:id`, `/admin/addons` | Catalog | admin |
| Admin | `/admin/members`, `/admin/members/:id`, `/admin/leads` | People | admin |
| Admin | `/admin/invoices` | All invoices and payments, reconciliation flags | admin |
| Admin | `/admin/content/...` | Home sections, pages, FAQ, testimonials, media library, site settings | admin |
| Admin | `/admin/notifications`, `/admin/audit`, `/admin/admins` | Send log, audit log, admin accounts | admin |

## Flow 1 · Sign up and sign in

1. A guest taps "Request this journey" on a package page. They are sent to `/:lang/sign-in?next=/:lang/account/request/:slug`.
2. **Google:** `/auth/google/start` stores `state`, a PKCE verifier and `next` in a short-lived cookie, then redirects to Google. The callback verifies `state` and exchanges the code.
   - Known Google account: sign in.
   - New Google account whose email matches an existing *verified* user: link it and sign in.
   - Email matches an *unverified* password account: refuse linking, ask them to sign in with the password or reset it. This prevents account takeover.
   - Otherwise create the user, mark the email verified, and sign in.
3. **Email:** sign-up takes name, email, password (minimum 10 characters, checked against a breached-password list), WhatsApp number and language. It sends a verification link (valid 24 h). The user is signed in but cannot submit a request until verified.
4. The session cookie is set (`__Host-citadel_sid`, httpOnly, Secure, SameSite=Lax). The user lands on `next`.
5. **First request, no WhatsApp number on file:** ask for it inline, with a WhatsApp notification opt-in checkbox (unticked by default).
6. **Admin:** `/admin/sign-in` takes email and password, then a TOTP code. On first sign-in, admin must enroll TOTP before reaching any page. Admin sessions expire after 8 h idle; member sessions after 30 days.

## Flow 2 · Booking request to confirmed trip

1. **Request, step 1 (When):** choose a departure batch (open batches show dates and event date status), or "Flexible, suggest dates".
2. **Step 2 (Who):** pick existing travelers or add new ones inline. For each, choose the package option (e.g. Runner or Companion) and confirm passport details. The 6-month passport warning shows here.
3. **Step 3 (Preferences):** room preference, add-ons of interest, dietary summary (prefilled from travelers), notes. Review, then **Send request**.
4. The system creates `bookings` (status `requested`) and `booking_travelers`, sends "Request received" by email and WhatsApp, and puts it in the admin queue.
5. **Admin opens the request:** status becomes `reviewing` (member sees *Reviewing*). Admin checks capacity with G2 outside the platform, then either:
   - **Declines** with a reason in ID/EN: status `declined`, member notified.
   - **Waitlists** for a full batch: status `waitlisted`, member notified.
   - **Builds the offer:** assigns the batch, adds lines (package price per traveler and option, single supplement, add-ons, discount), sets the deadline (default 3 days, OQ-08) and allowed payment channels, then **Issues offer**. The invoice becomes `issued`, the booking `offered`, and the seats are held (BR-01). The member is notified.
6. **Member reviews the offer** on the Payments tab: lines, total, deadline, cancellation terms.
   - **Decline offer:** asks for a reason. Status `declined`, seats released.
   - **Pay now:** Flow 3.
7. **24 hours before the deadline,** an unpaid offer sends a reminder. **At the deadline,** the invoice becomes `expired`, the booking `expired`, seats are released and the member is notified. Admin can re-issue a new offer, which creates a new invoice.
8. **Payment lands:** the invoice is `paid`, the booking `confirmed`, the seats confirmed, and travelers locked (BR-04). The member gets the receipt.
9. **Operations (Flow 4)** fill the trip workspace over the following weeks.
10. The day after the batch end date, a daily job marks bookings in that batch as `completed`.

The member can cancel while `requested`, `reviewing`, `waitlisted` or `offered`. After `confirmed`, cancellation is a conversation with Citadel, and admin records the outcome (`cancelled` plus a refund record if any).

## Flow 3 · Paying an invoice with Xendit

1. Member taps **Pay now** on an `issued` invoice. The web app calls `POST /api/invoices/:id/pay`.
2. The API checks that the requester owns the booking, the invoice is `issued` and the deadline has not passed. If any check fails, it returns a clear error and nothing is created.
3. If the invoice has an `active` payment session that expires more than 10 minutes from now, the API returns its URL (BR-05). Otherwise it creates a new Xendit Payment Session: `session_type: PAY`, `mode: PAYMENT_LINK`, amount, `IDR`, `ID`, the invoice's line items, customer, the allowed channels, `expires_at` = the earlier of the invoice deadline and 24 h from now, and the return URLs. It stores the attempt row, then returns the URL.
4. The browser goes to the Xendit-hosted page. The member pays by VA, card, QRIS or another enabled channel.
5. **Webhook** (`POST /api/webhooks/xendit`): verify the `x-callback-token` header with a constant-time compare. Store the raw event in `webhook_events` (unique per event ID, so duplicates do nothing). Return 200 quickly, then process in a job.
6. **Processing, in one database transaction:** find the attempt by `payment_session_id` / `reference_id`. Check that the amount and currency match the invoice. Insert `payments`, mark the attempt `completed` and the invoice `paid`. If it is the package invoice, set the booking `confirmed` and its seat holds confirmed. Write the audit entry and enqueue notifications.
7. **Return URL:** the member lands on `/:lang/account/trips/:code/payments?result=success`. The page shows "Confirming your payment" and re-checks every 3 seconds for up to 60 seconds. If no webhook arrives, it says the payment is being verified and that they will get a WhatsApp/email message. It never claims success from the redirect alone (FR-41).
8. **Payment cancelled or expired on Xendit:** the attempt becomes `expired`/`canceled`. The invoice stays `issued` until its own deadline, so the member can try again.
9. **Paid after the invoice expired, or paid twice:** the payment is still recorded and the invoice is flagged `needs_review` for admin. Nothing is auto-refunded (OQ-10).
10. **Nightly reconciliation** (FR-47): for each attempt still `active` past its expiry, or any `paid` invoice without a payment, fetch `GET /sessions/{id}` and flag differences on `/admin/invoices`.

## Flow 4 · Running a batch (admin)

1. **Create the batch** from a package: code (e.g. `OT-27-0313`), linked event, dates, nights, capacity 10/15/20, minimum pax, request cutoff, tour leader. The package's sample itinerary is copied into the batch itinerary. Status starts at `draft`.
2. **Open** the batch. It appears as a choice in booking requests.
3. Requests arrive and offers are issued (Flow 2). The seat counter shows capacity, held, confirmed and remaining.
4. **Close** the batch when full or past cutoff. It no longer appears in new requests.
5. **Confirm** the batch once minimum pax is paid and G2 confirms allocations. If it is short at cutoff, admin may **Cancel** it (BR-08), and every booking gets a templated notice.
6. **Operations board:** rows are travelers, columns are Flight · Hotel · Event ticket · Transfer · Visa · Insurance. Admin creates services (bulk for selected rows or the whole batch), enters details, and moves status: `not_started → requested → pending_allocation → confirmed → issued`.
7. **Rooms:** assign travelers to rooms per hotel stay.
8. **Documents:** upload files to a traveler or booking. Bulk upload matches files named `<booking-code>_<traveler-surname>_<type>.pdf` and shows unmatched files for manual assignment. Files stay private.
9. **Publish:** admin selects services, documents and itinerary items and publishes them. Each lead booker gets one "Your trip has been updated" message per publish, listing what is new.
10. **Pre-departure check, 7 days out:** the batch overview shows a checklist of missing items per traveler (no flight issued, no hotel voucher, visa not approved, unpaid supplement). The member reminder goes out automatically.
11. **In progress** on the start date, **Completed** after the end date (daily job). Admin can still edit.

## Flow 5 · Event date changes

1. Admin edits an event: a new date/time, or status `changed`, `postponed` or `cancelled`.
2. Before saving, the screen lists affected batches and the count of bookings by status.
3. On save, the event is updated and audited. The public site shows the new date with a *Changed* label.
4. Admin chooses **Notify affected members** and picks a template ("Date confirmed", "Date changed, we are adjusting your trip", "Event cancelled, we will contact you"). It goes to lead bookers of `offered` and `confirmed` bookings.
5. Batches are never moved automatically (BR-07). Admin edits batch dates and services separately.

## Flow 6 · Visa tracking

1. When a booking is confirmed, the system creates one visa record per traveler for each destination that needs one (from the package's countries; e.g. Schengen for France, UK for London/Manchester). The stage starts at `not_started`. Admin can mark one `not_required`.
2. Admin attaches a checklist from a template per visa type, editable per traveler. Members see the checklist and that documents go to Citadel by WhatsApp or email, not by upload (D-07).
3. Admin moves stages: `collecting_documents → appointment_booked (with date) → submitted → approved / refused`. Each change notifies the lead booker.
4. The pre-departure check flags any traveler not `approved` or `not_required` 14 days before the start date.

## Flow 7 · Guest enquiry

1. A guest submits the enquiry form (rate-limited, with a honeypot field and Cloudflare Turnstile).
2. A `leads` row is created. Admin gets an email, and the guest gets an auto-reply in their language.
3. Admin contacts them via WhatsApp and moves the lead to *Contacted*. When the guest signs up with the same email, the lead links to the user and becomes *Converted*.

## State machines

Only the transitions listed here are allowed. The API rejects any other with `409 invalid_transition`.

| Entity | From | To | Who or what triggers it |
| --- | --- | --- | --- |
| Booking | `requested` | `reviewing`, `declined`, `waitlisted`, `cancelled` | Admin opens / declines / waitlists; member cancels |
| Booking | `reviewing` | `offered`, `declined`, `waitlisted`, `cancelled` | Admin issues offer / declines / waitlists; member cancels |
| Booking | `waitlisted` | `reviewing`, `cancelled` | Admin reopens; member cancels |
| Booking | `offered` | `confirmed`, `expired`, `declined`, `cancelled` | Package invoice paid / deadline passes / member declines / either cancels |
| Booking | `expired` | `reviewing` | Admin re-opens to re-issue |
| Booking | `confirmed` | `completed`, `cancelled` | Batch end + 1 day job / admin records cancellation |
| Invoice | `draft` | `issued`, `void` | Admin |
| Invoice | `issued` | `paid`, `expired`, `void` | Webhook or manual record / deadline job / admin |
| Payment session | `active` | `completed`, `expired`, `canceled` | Xendit webhook or reconciliation |
| Batch | `draft` | `open`, `cancelled` | Admin |
| Batch | `open` | `closed`, `cancelled` | Admin |
| Batch | `closed` | `open`, `confirmed`, `cancelled` | Admin |
| Batch | `confirmed` | `in_progress`, `cancelled` | Start date job / admin |
| Batch | `in_progress` | `completed` | End date + 1 day job |
| Service | `not_started` | `requested` | Admin |
| Service | `requested` | `pending_allocation`, `confirmed`, `cancelled` | Admin |
| Service | `pending_allocation` | `confirmed`, `cancelled` | Admin |
| Service | `confirmed` | `issued`, `cancelled` | Admin |
| Visa | `not_started` | `collecting_documents`, `not_required` | Admin |
| Visa | `collecting_documents` | `appointment_booked`, `submitted` | Admin |
| Visa | `appointment_booked` | `submitted` | Admin |
| Visa | `submitted` | `approved`, `refused` | Admin |
| Document | `private` | `published` | Admin publish |
| Document | `published` | `withdrawn` | Admin (member no longer sees it) |

**Member-facing labels.** Booking: *Request received* (requested), *Reviewing* (reviewing, waitlisted shows *On waitlist*), *Offer ready* (offered), *Confirmed*, *Completed*, *Declined*, *Expired*, *Cancelled*. Service: *Being arranged* (not\_started, requested, pending\_allocation), *Confirmed*, *Ready* (issued). Supplier references and internal notes never appear.

## Edge and empty states

| Situation | What the member sees | What the system does |
| --- | --- | --- |
| No trips yet | "Your trips will appear here" plus a link to the 2027 season | Nothing |
| Request sent, no batch open | "We'll suggest dates" | Request with `preferred_batch_id` null |
| Offer deadline passed while on the Xendit page | Xendit shows the session expired | Session `expires_at` never exceeds the invoice deadline |
| Webhook late | "Confirming your payment" for up to 60 s, then "We're verifying it" | Reconciliation job catches it |
| Payment after expiry | Receipt, plus "Our team will contact you" | Invoice `needs_review`, admin alerted |
| Document withdrawn | It disappears from Documents | Old signed URLs already expire in 5 min |
| Event date changed | *Changed* label and new date on trip and package pages | Flow 5 |
| Account deletion with a confirmed upcoming trip | "Contact us first" | Admin handles; deletion waits until trip completes |
| WhatsApp send fails | Nothing extra | Email still sent; failure logged; admin can resend |

## V2 changes to the flows

These changes override the matching steps above (V2 brief, 18 October 2026). The catalog is sport only: there is no luxury collection, so `/:lang/luxury` is replaced by `/:lang/beyond-the-event`.

### Flow 2 overrides

- **Step 3 (request):** the request wizard exists only for products that are *Ready to offer*. For *Interest only* products the member is routed to the interest form (Flow 7). The wizard never asks for a passport at the request step; passport details are collected at traveler profile time as before.
- **Step 5 (admin builds the offer):** before **Issue offer**, admin completes the readiness checklist (Flow 8). The invoice moves `draft → issued` only when every required check has a pass and a note. Admin also lists services and exclusions in the offer.
- **Step 6 (member reviews):** the member sees lines, total, deadline, ticket category and seating policy, services, exclusions, change terms and cancellation terms. The member then chooses **Approve offer** or **Decline offer**. Approval stores an immutable snapshot (FR-36). Only then does “Pay now” appear.
- **Edits after issue:** admin editing an issued offer creates version n+1, voids the unpaid previous version’s payment session, and the member must approve again.

### Flow 3 override

- **Step 1 and 2:** “Pay now” is shown only for approved offers. The API also checks that an approval exists for the invoice’s current `offer_version`. Otherwise it returns `409 approval_required`. Each payment attempt stores the `approval_id` it was created from.

### Flow 7 replacement · Light enquiry and interest

1. A visitor taps **Discuss this trip** (or **Diskusikan perjalanan**) on a product page, the hero, or a sport hub.
2. The form asks for name, WhatsApp number, travel interest (product or sport) and number of travelers. Preferred time, email and budget are optional. No passport. Turnstile, a honeypot field and rate limits apply.
3. For an *Interest only* product, the same form is labeled as interest, and the lead stores `interest_kind = concept`.
4. The system creates a `leads` row with attribution (landing page, referrer, UTM, language, anonymous session ID) and logs `enquiry_submitted` or `interest_submitted`.
5. Admin gets an email. The guest gets an auto-reply in their language that states the first human response target of one business day.
6. Admin contacts the guest by WhatsApp, which sets `first_response_at`, then moves the lead to *Contacted*.
7. Admin marks the lead *Qualified* when it has event interest, number of travelers, a date range and an actionable contact (FR-102).
8. When the guest signs up with the same email or WhatsApp number, the lead links to the user and becomes *Converted* once a booking is requested.
9. A tap on the WhatsApp button logs `whatsapp_click` only. It never creates a lead.

### Flow 8 · Offer readiness and approval

1. Admin opens the request and builds the offer (batch, lines, deadline, channels, note, services, exclusions).
2. The readiness panel lists six checks. Each needs a pass and a note (for example a quotation reference):
   - `supplier_confirmation`: G2 confirmed availability and rights in writing.
   - `quotation_price`: prices come from the supplier quotation.
   - `ticket_source_category`: ticket source and category are named.
   - `event_date_status`: the event date is verified, or the offer states it is to be announced.
   - `services_exclusions`: services and exclusions are listed.
   - `terms_attached`: cancellation and change terms for this product are attached.
3. **Issue offer** stays disabled until all required checks pass. Issuing sets `readiness_confirmed_at`, notifies the member, and holds seats.
4. The member approves. The system writes `offer_approvals` with the snapshot, its hash, the terms version, language, IP and time.
5. The member taps **Pay now** and the flow continues in Flow 3.

### Flow 9 · Event without a verified date

1. Admin creates an event with no date, or with a date that is not yet verified. Public pages show it under “Akan diumumkan / To be announced”, with no date.
2. To verify, admin enters the official source URL and the date, then saves. The system sets `date_verified_at` and moves `date_status` to *Confirmed*.
3. The event then appears in the season as a dated fixture stub.
4. Later changes (date, *Changed*, *Postponed*, *Cancelled*) follow Flow 5.

### Flow 10 · Tickets through official apps

1. Admin creates the event-ticket service and sets `delivery_method = external_app`, the app name, the handover target date and member-visible instructions in ID/EN.
2. The service status moves through the usual states. Handover status stays *Planned* until tickets are actually transferred.
3. The member sees the access category, the instructions and the target date in Documents and Experiences. No PDF is shown for these tickets.
4. When admin marks the handover done, `handed_over_at` is set and the member gets one “trip updated” message.
5. If the target date passes without handover, the service appears in admin’s overdue list and in the pre-departure check.

### Four-status chips on the trip

| Chip | Values shown | Source |
| --- | --- | --- |
| Event schedule | Confirmed · Changed · Postponed · Cancelled · To be announced | `events.date_status`, `date_verified_at` |
| Ticket allocation | Not requested · Requested · Partly allocated · Allocated | `batches.ticket_allocation_status` |
| Departure | Not yet confirmed · Departure confirmed · Cancelled | `batches.status` and `departure_confirmed_at` |
| Payment | No invoice yet · Offer to approve · Awaiting payment · Paid · Expired | latest package invoice and `offer_approvals` |

### State-machine additions

| Entity | From | To | Triggered by |
| --- | --- | --- | --- |
| Package readiness | `draft` | `interest_only`, `ready_to_offer` (guard FR-89) | Admin |
| Package readiness | `interest_only` | `ready_to_offer` (guard FR-89), `draft` | Admin |
| Package readiness | `ready_to_offer` | `interest_only`, `draft` | Admin. Open batches stay open for existing bookings; no new requests. |
| Invoice (offer) | `issued` version n | approved | Member approval (stores `offer_approvals`) |
| Invoice (offer) | `issued` version n | `void` and replaced by version n+1 | Admin edits the offer |
| Ticket allocation | `not_requested` | `requested` | Admin |
| Ticket allocation | `requested` | `partial`, `allocated` | Admin |
| Ticket allocation | `partial` | `allocated`, `requested` | Admin |
| Event date status | `provisional` or `tba` | `confirmed` | Admin, with official source URL |
| Event date status | `confirmed` | `changed`, `postponed`, `cancelled` | Admin (Flow 5) |
| Lead | `new` | `contacted`, `closed` | Admin |
| Lead | `contacted` | `qualified`, `closed` | Admin |
| Lead | `qualified` | `converted`, `closed` | System on booking request, or admin |
| Service handover | `planned` | `handed_over`, `not_applicable` | Admin |

### New edge and empty states

| Situation | What the member sees | What the system does |
| --- | --- | --- |
| Event has no verified date | “To be announced”, no date | Hidden from the dated season list |
| Payment received but tickets not allocated | Payment *Paid*, Ticket allocation *Not requested* or *Requested* | Chips stay separate; no “confirmed tickets” wording |
| Departure not confirmed (below minimum pax) | Departure *Not yet confirmed* | Admin decides at cutoff (BR-08) |
| Offer edited after approval | “The offer was updated. Please review and approve again.” | New version, old payment session voided |
| Interest-only product | “We are preparing this trip” and an interest form | No booking request allowed |
| App-only ticket | Instructions and handover date, no download | Handover target tracked |
