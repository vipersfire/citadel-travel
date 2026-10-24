# 1 · PRD — Product Requirements

The pilot lets Indonesian sports fans enquire about, request, approve, pay for and follow a European sport trip with Citadel Tour Travel in one place. It also lets Citadel run each departure as a batch without spreadsheets. Success means a visitor can go from a product page to an enquiry without an account, and a verified member can go from an issued offer to a paid, confirmed booking. From then until departure, they find their flight, hotel, ticket access, visa status and itinerary in their account without asking on WhatsApp. The 14 December 2026 launch is a conditional target (D-12). Positioning, copy and claims live in the V2 tab.

## Problem

Citadel resells G2-sourced packages to Indonesian customers. Without a platform, every booking runs on WhatsApp threads and spreadsheets. Event schedule, ticket allocation, departure and payment status live in different places and get mixed up, and customers ask the same questions repeatedly. The brief to G2 (meeting 5 October 2026) covers six 2027 sport products. These need a storefront and an operations tool before selling windows open. An Indonesian operator already lists a sport-holiday category, so Citadel’s position has to be more specific than “sport tourism”: European sports experiences, with ticket and service detail spelled out before payment.

## Goals and pilot success metrics

| Goal | Metric | Pilot target |
| --- | --- | --- |
| Be easy to start | Successful enquiries (no account needed) | Tracked from launch. No target until a baseline exists. |
| Find real buyers | Qualified leads: event interest, party size, date range and an actionable contact | Reported with numerator and denominator per stage. |
| Respond fast | First human response to an enquiry | At most 1 business day. Offer issue time is reported separately. |
| Sell only what is supplied | Products at “Ready to offer” with written supplier proof | At least 2 by launch (D-20). |
| Turn interest into offers | Offers issued | Tracked from launch. |
| Get paid cleanly | Valid payments reconciled automatically from Xendit webhooks | 100%, with 0 unmatched payments. |
| Reduce “where is my…” chats | Travelers with every service handed over or with clear instructions 7 days before departure | 100% |
| Look premium | Lighthouse performance on mobile for home and product pages | 85 or higher |
| Stay safe | Critical or high findings open at launch (DAST plus manual review) | 0 |

## Users

- **Prospective guest (no account):** an Indonesian sports fan who wants to ask about an event. Gives a name, WhatsApp number, travel interest and party size. No passport at this stage.
- **Lead booker (member):** a prospective guest who verified an account to request a trip. Uses a phone first and lives on WhatsApp. Books for a spouse, family or colleagues. Age 30–55, home city, halal needs, companion language and group size are **team assumptions** to confirm in buyer interviews, not market data.
- **Starting segments (hypotheses, not research):** football and motorsport fans; tennis-watching couples or families; runners and their companions.
- **Companion (traveler without login):** has a traveler profile owned by the lead booker. Receives nothing directly at pilot; the lead booker forwards documents.
- **Citadel admin:** one role that covers operations, finance and content. Two to four people at launch.
- **G2 (supplier, not a user):** sends quotations, tickets and hotel confirmations to admin. Admin uploads them. G2 never logs in (D-01).

## Scope

**In the pilot:** public bilingual sport catalog, light enquiry without an account, interest collection for concept products, member accounts (Google or email), traveler profiles, booking requests for ready products, admin offers with a readiness check, member approval of an offer snapshot, Xendit payment of full invoices, manual payment recording, batch operations (roster, services, handover targets, documents, visa status, itinerary), downloadable itinerary PDF, email and WhatsApp notifications, CMS for all public content with a claims guard, minimum first-party analytics, audit log.

**Not in the pilot:** instant checkout, public prices, installments, a luxury collection or luxury trips (the catalog is sport only), in-platform refunds through Xendit, visa document uploads, companion logins, G2 supplier portal, in-app chat or inbox, loyalty or member tiers, multi-currency, native mobile apps, journal and deeper sport editorial (P1), indicative price testing (P1).

## Functional requirements

Priority **P0** must ship on 14 December. **P1** can follow within 6 weeks of launch.

### A. Public site

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | Home page in the V2 order: hero (one atmosphere photo, tagline, two CTAs), Why Citadel, Pick a sport, The season (chronological fixture stubs), Beyond the event, How to book, Team and proof. Hero video is optional and never blocks first paint. | P0 |
| FR-02 | Sport hub pages for football, tennis, motorsport and running. Spectator and participant paths (for example a runner) are separate. There is no Luxury collection. | P0 |
| FR-03 | Product page: hero media, fixture strip (event, date with status, venue), story, highlights, sample itinerary, inclusions and exclusions, hotel type, known night range, the pre-payment details from `packages.proof_points` (ticket category, seating policy, change terms), add-ons, FAQ. CTAs: “Discuss this trip” (enquiry) and, only when the product is ready to offer, “Request this journey”. No price (D-04). | P0 |
| FR-04 | Wherever a date appears, show its status: *Confirmed*, *Changed*, *Postponed* or *Cancelled*. An event without a verified date shows no date and is listed under “Akan diumumkan / To be announced” (BR-13). | P0 |
| FR-04A | Event schedule, ticket allocation, departure and payment are four separate facts and never merge into one “confirmed” badge. Public pages show the event schedule, plus ticket allocation and departure for open batches. Payment appears only to the member (BR-10). | P0 |
| FR-05 | Light enquiry without an account. Required: name, WhatsApp number, travel interest (product or sport) and number of travelers. Optional: preferred time, email, budget. No passport. Rate-limited with Turnstile. Creates a lead with attribution (FR-101). | P0 |
| FR-05A | Interest collection: concept products that are not yet verified can appear with the label “Kami sedang menyiapkan perjalanan ini / We are preparing this trip” and an interest form only. No booking request is possible (BR-17). | P0 |
| FR-06 | Static pages: About Citadel, Team and proof, How to book, FAQ, Terms, Privacy, Cancellation policy, Contact. | P0 |
| FR-07 | Language switch ID/EN on every page. It keeps the same page and remembers the choice. | P0 |
| FR-08 | SEO: server-rendered HTML, per-page title/description/OG image in both languages, `hreflang`, sitemap.xml, robots.txt. Interest-only products are indexable but marked as interest pages. | P0 |
| FR-09 | Journal and deeper sport editorial. | P1 |

### B. Accounts and sign-in

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-10 | Sign up and sign in with Google. | P0 |
| FR-11 | Sign up with email and password, with email verification required before a booking request. | P0 |
| FR-12 | Password reset by email link (expires in 30 minutes, single use). | P0 |
| FR-13 | Link Google to an existing email account with the same verified email. | P0 |
| FR-14 | Profile: full name, WhatsApp number (E.164), preferred language, WhatsApp notification opt-in. | P0 |
| FR-15 | Admin sign-in uses email, password and TOTP 2FA. Google sign-in is not allowed for admin accounts. | P0 |
| FR-16 | Member can request account deletion; admin completes it (anonymize, keep financial records). | P0 |

### C. Travelers

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-20 | Member manages traveler profiles: self plus companions. Fields: name exactly as in passport (given names, surname), gender, date of birth, nationality, passport number and expiry, dietary needs (halal, vegetarian, none, other), medical/mobility notes, relationship. | P0 |
| FR-21 | Passport number is encrypted at rest and shown masked (last 3 characters) to members. | P0 |
| FR-22 | After a booking is confirmed, travelers on it are locked for the member. Changes go through admin ("details controlled by admin"). | P0 |
| FR-23 | Warn when passport expiry is less than 6 months after the trip end date. | P0 |

### D. Booking requests and offers

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-30 | Signed-in, verified member submits a booking request for a product that is **ready to offer**: preferred departure batch (or “flexible”), travelers, package option per traveler (e.g. runner vs companion), room preference (twin, double, single), add-ons of interest, notes. Interest-only products use FR-05A instead. | P0 |
| FR-31 | Member sees request status: *Request received → Reviewing → Offer ready → Confirmed*, or *Declined / Expired / Cancelled*. | P0 |
| FR-32 | Member can cancel a request before paying. | P0 |
| FR-33 | Admin builds an offer: assigns the batch, adds invoice lines (per-traveler package price, supplements, add-ons, discount), sets the payment deadline and allowed payment channels, lists services and exclusions, and writes a note in ID/EN. Issuing is blocked until the readiness checks pass (FR-37). Issuing notifies the member. | P0 |
| FR-34 | Member reviews the offer (lines, total, deadline, ticket category and seating policy, services, exclusions, change and cancellation terms) and either declines with a reason or **approves** it. | P0 |
| FR-35 | Admin can decline a request with a reason, or put it on a waitlist for a full batch. | P0 |
| FR-36 | Approval snapshot: when the member approves, the system stores an immutable snapshot of exactly what they saw (lines, total, deadline, terms version, services, ticket categories, event date status, language) with time, user and IP. | P0 |
| FR-37 | Readiness check before issuing: supplier confirmation or quotation reference, price taken from the quotation, ticket source and category, event date status, services and exclusions listed, terms attached. Each required check is marked by an admin with a note. | P0 |
| FR-38 | Offer versions: editing an issued offer creates version n+1, voids the unpaid previous version’s payment session, and needs a new approval. | P0 |

### E. Invoices and payments

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-40 | “Pay now” is available only on an **approved** offer (FR-36). It opens a Xendit-hosted payment page for the full invoice amount in IDR and returns to the trip page on success or cancel. | P0 |
| FR-41 | The invoice is marked paid only from a verified Xendit webhook, or from admin manual recording. A browser redirect never marks it paid. | P0 |
| FR-42 | Paying the package invoice confirms the booking and its seats. It does not by itself confirm departure or ticket allocation (BR-10). | P0 |
| FR-43 | Admin records an offline payment (bank transfer) with amount, date, reference and proof file, after typed confirmation. | P0 |
| FR-44 | Admin issues supplement invoices on a confirmed booking (D-03, OQ-09). They follow the same readiness and approval rules. | P0 |
| FR-45 | Admin voids an unpaid invoice. A paid invoice is never voided: admin records a refund done outside the platform (amount, date, method, reason). | P0 |
| FR-46 | Member downloads a receipt PDF for each paid invoice. | P0 |
| FR-47 | A nightly reconciliation compares open payment sessions with Xendit and flags mismatches to admin. | P0 |

### F. Member trip workspace

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-50 | **My trips:** upcoming and past bookings, each as a trip pass showing event, dates, status chips and countdown. | P0 |
| FR-51 | **Trip overview:** status timeline, tour leader name and WhatsApp, meeting point, key dates, and what is still needed from the member, written as plain sentences with dates. | P0 |
| FR-52 | **Itinerary:** day-by-day with times, places, notes, and a map link for each item. Downloadable as a branded PDF in the member’s language. | P0 |
| FR-53 | **Travel documents:** grouped by traveler and type (flight e-ticket, hotel voucher, event ticket, transfer voucher, insurance, other). View and download. Only shows what admin published. | P0 |
| FR-54 | **Flights and hotels:** structured details (airline, flight numbers, times, PNR, baggage; hotel name, address, check-in/out, room type, confirmation number). | P0 |
| FR-55 | **Visa status per traveler:** stage, appointment date, checklist of what to send offline, and admin notes. | P0 |
| FR-56 | **Experiences:** event ticket category and seating, stadium tour, add-ons, dining, with status. Ticket access shows the delivery method (PDF, wallet, paper, in person or an official external app), instructions and the handover target. App-only tickets are never forced into a PDF. | P0 |
| FR-57 | **Payments:** the offer and its approval, invoices with status, pay button, and receipts. | P0 |
| FR-58 | **Four-status panel** on the trip overview: Event schedule, Ticket allocation, Departure, Payment. Each has its own label, date and one-sentence explanation. Text always accompanies color. | P0 |
| FR-59 | **Handover targets:** each service shows a target date and a status (planned, handed over). Admin sees overdue targets. | P0 |

### G. Admin: requests, members, leads

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-60 | Request queue filtered by status, package and batch, sorted oldest first, with an age indicator. | P0 |
| FR-61 | Request detail: member, travelers, preferences, notes, history; actions are assign batch, build offer, decline, waitlist. | P0 |
| FR-62 | Members list and detail: profile, travelers, bookings, invoices, notifications sent; admin can edit traveler data at any time. | P0 |
| FR-63 | Leads inbox from the enquiry and interest forms, with statuses *New, Contacted, Qualified, Converted, Closed*. Shows landing page, UTM source, interest, party size and a first-response timer (target: 1 business day). | P0 |
| FR-64 | Admin marks a lead *Qualified* using the FR-102 definition. A WhatsApp click never creates a lead. | P0 |

### H. Admin: batches and operations

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-70 | Create a batch for a package: code, linked event, start/end dates (may be empty while the batch is a draft), nights, capacity, minimum pax, hotel category, tour leader, request cutoff, status, and **ticket allocation status** (*Not requested, Requested, Partial, Allocated*). | P0 |
| FR-71 | Batch roster: travelers from all bookings assigned to the batch, with booking status, payment status, room assignment, dietary needs and passport-expiry warning. Export to CSV. | P0 |
| FR-72 | Seat counter on each batch: capacity, held (offer issued), confirmed (paid), remaining. Warn before exceeding capacity. | P0 |
| FR-73 | **Operations board:** a grid of travelers (rows) against service types (flight, hotel, event ticket, transfer, visa, insurance). Each cell shows status and opens the service detail. Bulk-set status for selected rows. | P0 |
| FR-74 | Service records at batch, booking or traveler level, with type-specific details, supplier reference (admin-only), status, delivery method, handover target, member-visible instructions and notes. | P0 |
| FR-75 | Upload documents to a traveler or booking, single or bulk. Each document is private until published. Publishing notifies the member once per batch publish, not per file. | P0 |
| FR-76 | Batch itinerary editor: days and timed items, copied from the package’s sample itinerary on batch creation, then edited. | P0 |
| FR-77 | Visa tracker per traveler: destination, stage, appointment date, checklist, notes. | P0 |
| FR-78 | Room list: assign travelers to rooms (twin, double, single) per hotel stay. | P0 |
| FR-79 | Batch broadcast: send a templated email and WhatsApp message to every lead booker in the batch. | P0 |
| FR-80 | Batch status lifecycle: *Draft → Open → Closed → Confirmed → In progress → Completed*, or *Cancelled*. | P0 |
| FR-80A | Departure confirmation: moving a batch to *Confirmed* records `departure_confirmed_at`. Admin sees minimum pax paid and ticket allocation status first, and gets a warning if allocation is not *Allocated*. | P0 |

### I. Admin: catalog and events

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-85 | Packages: create and edit all public fields in ID/EN, media, sample itinerary, inclusions and exclusions, package options, pre-payment proof points, FAQs, SEO. Two separate states: publish state (*Draft, Published, Archived*) and readiness (*Draft, Interest only, Ready to offer*). | P0 |
| FR-86 | Add-ons catalog (hospitality seats, hotel upgrade, private transfer, dining, city experiences), attachable to any package. They are plain add-ons, not a luxury tier. | P0 |
| FR-87 | Events: name, sport, competition, teams or participants, venue, city, start and end date (**optional until verified**), start time, date status, official source URL, verification time and who verified. An event with no verified date is shown as “To be announced”. | P0 |
| FR-88 | Changing an event’s date or status lists the affected batches and bookings, then offers to notify them with a prepared template. | P0 |
| FR-89 | Readiness guard: a package can be set to *Ready to offer* only when supplier and sales rights are verified, service coverage is verified, an event with a verified date (or an explicit TBA) is linked, and terms are attached. | P0 |

### J. Admin: content

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-90 | Media library: upload images and videos, alt text in ID/EN, focal point for crops, usage-rights status and license note per asset. | P0 |
| FR-91 | Home page sections (V2 order), testimonials, FAQ, and static pages are editable in ID/EN with preview before publish. | P0 |
| FR-92 | Site settings: contact details, WhatsApp click-to-chat number, social links, default OG image, trust-line switch. | P0 |
| FR-93 | Team profiles (name, role, short bio, photo) shown only after admin marks them verified. Testimonials need recorded consent. | P0 |
| FR-94 | Claims guard: publishing public text that contains blocked terms (“first”, “official partner”, “VIP”, “24 hours” and their Indonesian equivalents) needs an admin reason, which is stored in the audit log. | P0 |

### K. Notifications

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-95 | Email and WhatsApp (if opted in) for: account verification and password reset (email only), request received, offer issued, payment reminder 24h before deadline, payment received, offer expired, documents published, visa status changed, event date changed, batch broadcast, 7 days before departure. | P0 |
| FR-96 | Every send is logged with channel, template, status and provider message ID. Admin can resend. | P0 |
| FR-97 | Templates in ID/EN, editable by admin for email. WhatsApp templates are fixed once Meta approves them. | P0 |

### L. Audit and security

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-99 | Every admin write is recorded in the audit log: who, what, before, after, when, IP. Money actions also require typing the amount to confirm. | P0 |

### M. Analytics and lead metrics

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-100 | Minimum first-party analytics events: product view, enquiry started, enquiry submitted, interest submitted, WhatsApp click, offer issued, offer approved, valid payment. Anonymous session ID, no third-party ad cookies, short consent notice (OQ-23). | P0 |
| FR-101 | Lead attribution: landing page, referrer, UTM fields, language and product interest are stored on the lead. | P0 |
| FR-102 | **Qualified lead** = event interest + number of travelers + date range (“flexible” counts) + a contact the team can act on. Budget is recorded if offered. | P0 |
| FR-103 | A WhatsApp click is logged as a click only. It is never counted as a lead or a booking. | P0 |
| FR-104 | Funnel export (CSV at launch, admin page P1): product views, enquiries, qualified leads, offers issued, offers approved, valid payments, each with numerator and denominator; first-response time and offer-issue time reported separately. Registered users and buyers are never merged. | P1 |

## Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Mobile first. Every member screen works at 360 px width. |
| NFR-02 | Public pages: LCP under 2.5 s on 4G and CLS under 0.1. Hero video never blocks first paint. |
| NFR-03 | Accessibility: WCAG 2.2 AA for public and member areas. Keyboard and screen-reader usable. Respects reduced motion. |
| NFR-04 | Privacy: complies with Indonesia's personal data protection law (UU PDP, Law 27/2022). Collects only what the trip needs, encrypts passport numbers, gives access and deletion on request, and has a breach procedure. |
| NFR-05 | Money is stored as integer IDR. Totals are always computed server-side. |
| NFR-06 | Private documents are served only through short-lived signed URLs (5 minutes) after an ownership check. |
| NFR-07 | Availability target: 99.5% monthly. Daily backups with point-in-time recovery, and a tested restore before launch. |
| NFR-08 | Every timestamp is stored in UTC and shown in Asia/Jakarta for members. Event times are shown in local venue time, labeled. |

## Business rules

1. **BR-01 Holds:** an issued offer holds its travelers’ seats in the batch until the invoice deadline. A paid package invoice turns the hold into a confirmed seat.
2. **BR-02 Expiry:** when the deadline passes unpaid, the invoice expires, the booking expires, the seats are released and the member is notified. Admin can re-issue.
3. **BR-03 Confirmation:** a booking is confirmed only when its package invoice is fully paid (Xendit webhook or manual record).
4. **BR-04 Locking:** members edit their travelers until confirmation. After confirmation, only admin edits them.
5. **BR-05 One active payment link:** an invoice has at most one active Xendit payment session at a time. “Pay now” reuses it while it is active.
6. **BR-06 Visibility:** members see a document, service detail or itinerary item only when admin marks it published.
7. **BR-07 Event changes:** a changed event date never moves a batch automatically. Admin decides and the member is told.
8. **BR-08 Minimum pax:** if a batch is below its minimum by its cutoff, admin can cancel it. Refunds are processed outside the platform and recorded (OQ-10).
9. **BR-09 Language:** notifications go out in the member’s preferred language. Missing EN text falls back to ID, never to blank.
10. **BR-10 Four certainties:** event schedule, ticket allocation, departure and payment are separate facts with separate fields and chips. Payment confirms the booking and seats only. It never implies confirmed tickets or a guaranteed departure.
11. **BR-11 Approval before payment:** no pay link exists for an offer version without an approval snapshot of that same version.
12. **BR-12 Readiness before issuing:** an offer cannot be issued until every required readiness check is passed with a note.
13. **BR-13 To be announced:** an event without a verified date has no public date and appears under “To be announced”. Verifying a date needs an official source URL.
14. **BR-14 Claims:** public copy makes no claim of being first, an official partner, VIP access, specific seats or 24-hour service unless proven. The trust line is off until offer readiness and approval are live.
15. **BR-15 Sales rights:** a product whose right to sell is unverified (for example Berlin Marathon race entries, which are limited to official registered partners) is never *Ready to offer*.
16. **BR-16 Official-app tickets:** tickets that must be delivered through an official app are never forced into a PDF. The portal keeps access category, instructions and a handover target.
17. **BR-17 Interest is not booking:** interest-only products collect interest, never booking requests.

## Pilot catalog

These event dates come from the original Citadel brief (checked on 4 October 2026). They are event dates, not departure dates. V2 does not validate them: every date stays a **draft** until an organizer source and a commercial confirmation exist, and an event without a verified date is shown as “Akan diumumkan / To be announced” (BR-13). G2 proposes trip dates and nights in its quotation (OQ-06). The six products are the draft catalog. Each becomes *Ready to offer* only through the publish gate in the last column.

| Code | Product | Event and date (draft, unverified) | Venue | Batches to seed | Publish gate: verify before “Ready to offer” |
| --- | --- | --- | --- | --- | --- |
| OT | Old Trafford Experience | Man United vs Everton, 13 Mar 2027 · vs Crystal Palace, 24 Apr 2027 · vs Fulham, 30 May 2027 | Old Trafford, Manchester | 1 draft batch per match. Open the one G2 recommends. | The chosen match, stand category, seats-together policy, kickoff-change terms, ticket source. |
| EC | El Clásico Experience | Real Madrid vs Barcelona, 9 May 2027 | Bernabéu, Madrid (baseline) | 1 | Host and venue for this edition from an official source (do not assume Madrid). Ticket allocation. Final date and time. |
| RG | Paris Tennis & Lifestyle | Roland-Garros main draw 23 May–6 Jun 2027. Pilot options: 23–25 May or 28–29 May | Paris | 2 options, as 2 batches | Court, dates and sessions; seat category. No specific player is promised. |
| WB | Wimbledon & London | 28 Jun–11 Jul 2027 | London | 1 (dates from G2) | Ticket route, court, dates, how tickets are received, entry rules for the 2027 season. |
| F1 | Monza Race Weekend | Italian Grand Prix, 3–5 Sep 2027 | Monza | 1, with an optional Milan or Como extension | Access days, grandstand or general admission, transfers, hospitality if included. |
| BM | Berlin Marathon Experience | 26 Sep 2027 | Berlin | 1, with options *Runner (race entry)* and *Companion (no entry)* | Race entries are sold only through official registered partners. Confirm Citadel’s route and rights first. The companion package may be offered separately. Allocation confirmed. |

**Pilot goal (D-20):** at least two sport products reach *Ready to offer* by launch. The others stay draft or interest-only, so the platform sells only what is actually supplied. Football fixtures can still move, so FR-88 matters most for the OT and EC products. There are no luxury products in the catalog: luxury is a design quality of the site, not something sold.

## Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Xendit live activation or channel limits late | Cannot take payment on launch day | OQ-01/02 on day 1. Manual payment recording (FR-43) as fallback. |
| WhatsApp templates rejected | No WhatsApp notifications | Email works alone. Submit templates in week 1. Utility wording only, no promotion. |
| G2 quotation or supplier proof late | Offers cannot be priced; products cannot be marked ready | Build and test with sample data. Offers are per booking, so nothing is hard-coded. Products stay draft or interest-only until proof exists (D-16). |
| Sales rights unverified (for example Berlin race entry, official partners only) | Selling something Citadel may not be allowed to sell | The rights check is part of the publish gate (FR-89). BM can launch companion-only or interest-only (OQ-16). |
| 2027 dates in the baseline are not validated | Wrong dates sold | Dates stay draft. “To be announced” until verified with an official source (BR-13). |
| Market hypotheses unvalidated | Wrong product mix or message | 12 buyer interviews and a 5-person comprehension test (Implementation Plan, V2 tasks). |
| Build status and the 18 Oct gate not verified | Plan dates may not reflect reality | Gate status table in the plan. Re-plan at the first verified gate. |
| March Old Trafford sells too late for the UK visa | Travelers cannot depart | Show a visa lead-time note on the product page. Admin sets the request cutoff. |
| Use of club or event marks | Legal complaint | OQ-14. Descriptive names only, no crests or logos. Real or licensed photography preferred. |
| Claim creep (“official”, “VIP”, “first”) | Misleading promises, legal exposure | Claims policy and CMS guard (FR-94). Trust line stays off until the flow delivers it. |
| 9-week timeline is conditional | Scope slips | P1 list is pre-agreed. The Implementation Plan has a cut line. Launch moves if gates fail. |
