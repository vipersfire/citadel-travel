# Citadel Tour Travel — Sports Travel Platform: Pilot Spec (V2)

Oct 11, 2026 · @Faisal

## How to read this spec

Citadel Tour Travel (Sports Travel line) is a bilingual (ID/EN) enquiry, booking and trip-management platform for Indonesian fans travelling to sporting events in Europe. The catalog is **sport only**. Luxury is a quality of the design (restraint, materials, typography, motion), not a product category. Visitors enquire without an account. A member with a verified account requests a trip, admin issues an offer, and the member approves it and pays through Xendit. Admin runs every departure as a **batch**: the roster, flights, hotels, event tickets, visa status, itinerary and documents. The baseline launch target is Monday 14 December 2026, and it is **conditional** on team readiness, supplier proof, payments and UAT.

The spec is split into seven tabs. Read the V2 tab first, because it sets the claims, copy and priorities that the other tabs implement. Then read the rest in order; each one only depends on the tabs before it.

1. **V2 · Brand & Market**: positioning, claims policy, ID/EN front-page copy, page structure, proof per product, validation plan, 30-day measures.
2. **PRD**: who it is for, scope, requirements with IDs (`FR-xx`), draft catalog and publish gates.
3. **App Flow**: every screen and state transition for members and admin, including offer approval, payment and event-change flows.
4. **TRD**: architecture, stack, auth, Xendit integration, notifications, security, hosting.
5. **Backend Schema**: PostgreSQL tables, enums, constraints and indexes (Drizzle-ready), plus the V2 migration 0002.
6. **Design Brief**: the design direction (where the luxury lives), tokens, components, screen notes, and prompts for AI image and video generation.
7. **Implementation Plan**: 9 weeks of numbered tasks with verification gates, a V2 re-plan, a pitfall checklist and a launch checklist.

Requirement IDs (`FR-`, `NFR-`), table names and route names are shared across tabs. An agent working on one task should get the relevant PRD requirements, the schema tables it touches, and the task block from the Implementation Plan.

## V2 revision (18 October 2026)

This spec was revised from the V2 creative and market brief (18 October 2026) and one owner direction (23 October 2026). **Rule:** a V2 clause overrides the matching baseline clause, and everything else still applies. V2 is a specification, not proof that anything is built. Build progress has not been verified, so no gate before this revision is treated as passed.

**Owner direction:** luxury is not a product category and is not on the same level as sport. It describes the design: look, feel, UI and UX. The business is sport tourism only. So there is no Luxury collection, no luxury trips, no `luxury` package kind, and no “luxury” in public copy.

| Tab | What V2 changed |
| --- | --- |
| V2 · Brand & Market | New. Positioning, claims policy, ID/EN copy, page structure, proof per product, validation plan, measures. |
| PRD | Sport-only catalog; light enquiry without account; interest-only concepts; package readiness; four certainties; offer readiness and member approval snapshot; handover targets; team and claims guard; analytics and lead metrics; updated risks and publish gates. |
| App Flow | Light enquiry and interest flow; offer readiness and approval flow; override notes for Flows 2 and 3; ticket-app delivery; new state-machine rows. |
| TRD | CMS contract (public site reads only what is published and ready); approval snapshot; readiness guard; TBA dates; minimum first-party analytics; claims lint. |
| Backend Schema | Migration 0002: dates nullable, package readiness, offer approvals and readiness checks, handover fields, lead attribution, team members, analytics events. Luxury kind removed. |
| Design Brief | Luxury as a design principle only; cross-sport identity; V2 home and mobile layouts; real-photo policy; luxury prompts retired. |
| Implementation Plan | Gate status is unverified; supplier and content gate earlier; V2 tasks; validation work; commercial UAT; smoke-test correction. |

## Locked pilot decisions

These are fixed for the pilot. Changing one means re-checking every tab that cites its ID.

| ID | Decision | Consequence for the build |
| --- | --- | --- |
| D-01 | Parent brand is **Citadel Tour Travel**, with the descriptor *Sports Travel*. No legal or company name change. G2 is the back-office supplier and is never shown to members. | No supplier names in member-facing UI, emails or PDFs. Supplier refs are admin-only fields. Public copy says “Citadel”. |
| D-02 | **Enquiry or request, then admin offers, then the member approves.** Members send a booking request. Admin confirms availability, assigns a batch, then issues an offer. | No instant checkout and no real-time inventory. Capacity is checked by admin, with a soft counter per batch. |
| D-03 | **Full payment once** for the package invoice. | One package invoice per booking. Admin can still add supplement invoices for later extras (single room, upgrades). |
| D-04 | **Price on request.** No public prices. Compensate with known night range, hotel type, event coverage and exclusions on each product page. | Public pages show “Discuss this trip” and, when ready, “Request this journey”. Prices exist only inside offers and invoices. |
| D-05 | **Bilingual: Indonesian (default) and English.** | Locale-prefixed routes `/id/...` and `/en/...`. Every CMS text field stores both languages. |
| D-06 | **Lead booker plus companions.** One account books and pays. Each traveler has a profile but no login. | `travelers` belong to a user. `booking_travelers` links them to a booking. |
| D-07 | **Visa = status tracking only.** Documents are exchanged offline (WhatsApp/email). | No passport-scan uploads. Admin updates visa status and a checklist per traveler. |
| D-08 | **Single admin role** for the pilot. | Mandatory TOTP 2FA for admins, a full audit log, and typed confirmation on money actions to offset the lack of separation. |
| D-09 | **Email + WhatsApp** notifications. | Email via a transactional provider. WhatsApp via approved utility templates. No in-app inbox at pilot. |
| D-10 | **React Router v7 framework mode on Vite** for the web app. **Fastify v5** for the API. **PostgreSQL**. **Xendit** for payments. | Public pages are server-rendered for SEO. Member and admin areas live in the same web app under `/account` and `/admin`. |
| D-11 | **Sport-only catalog. Luxury is a design principle, not a product** (owner direction, 23 Oct 2026). | No `packages.kind`, no Luxury collection, no luxury trips, no “luxury” in copy. Upgrades (hospitality seats, hotel upgrade, private transfer) stay as plain add-ons. “Beyond the event” is city, food and companion content attached to sport trips. |
| D-12 | **Launch target: Monday 14 December 2026, conditional** on team readiness, supply, payments and UAT. | 9 build weeks from Monday 12 October. Gate status is not verified (see Implementation Plan). Scope cuts are listed there. |
| D-13 | **Enquiry without an account.** A verified account is required for booking, offers and private documents (R2 04). | Light enquiry form with no passport. `leads` store attribution. Booking, offers and documents sit behind verified login. |
| D-14 | **Four certainties are separate facts:** event schedule, ticket allocation, departure, payment (R2 06). | Four separate fields and four separate chips. A “confirmed” on one never implies another. |
| D-15 | **Offer readiness check and member approval snapshot before any pay link is active** (R2 07). | `offer_readiness_checks` block issuing. `offer_approvals` stores an immutable snapshot. Pay now requires an approval. |
| D-16 | **Package readiness states:** draft, interest only, ready to offer. Publish as ready only after supplier and service coverage are verified. | `packages.readiness`. Booking requests exist only for ready products. Interest-only products collect interest. |
| D-17 | **Event dates can be empty.** An event without a verified date shows as “Akan diumumkan / To be announced”. | `events.starts_on` and `ends_on` nullable. `date_verified_at` needs an official source. |
| D-18 | **Handover target per service.** Tickets that must use an official app are not forced into PDFs (R2 08). | `services.handover_target_on`, `delivery_method`, `delivery_instructions`. The portal shows instructions, not a fake PDF. |
| D-19 | **Claims policy:** no “first”, official partner, VIP access, specific seats or 24-hour service unless proven (R2 02). | CMS publish lint (FR-94). The trust line is off until the flow delivers it. |
| D-20 | **Pilot goal: at least two sport products ready to sell** (R2 03). | Others stay draft or interest-only. No content added just to fill numbers. |

Defaults I chose where no answer was given: currency is IDR only, refunds are processed outside the platform and recorded by admin, and hosting is a single container host plus managed Postgres in a Jakarta or Singapore region. Each of these appears again under open questions.

## Open questions

The first five block week 1. Start them on 12 October, because their lead time is outside your control.

**Blocking, start now**

- [ ] **OQ-01 Xendit account:** Is Citadel's Xendit business account already verified, and which payment channels are active (VA, cards, QRIS, e-wallets)? Live-mode activation can take days to weeks.
- [ ] **OQ-02 Per-channel limits:** What is the maximum transaction per channel for invoices of IDR 100M–500M? Card and e-wallet limits are often far below one package invoice. Get this in writing from Xendit.
- [ ] **OQ-03 WhatsApp sender:** Which phone number and Meta Business account will send WhatsApp? Will it go through Meta's Cloud API directly or a local provider (BSP)? Business verification and template approval take time.
- [ ] **OQ-04 Domain and email:** What is the production domain, and who controls its DNS? This is needed for SPF/DKIM/DMARC, the Google OAuth consent screen, and the Xendit webhook URL.
- [ ] **OQ-05 Legal pages:** Who supplies the terms of sale, cancellation and refund policy, and privacy policy in both languages? These are needed for UU PDP compliance and for Xendit go-live.

**Shapes scope, needed by week 3**

- [ ] **OQ-06 G2 quotation:** When will G2 deliver the quotation the brief asks for (net price per pax for 10/15/20, hotel category, nights, ticket categories, payment schedule, cancellation terms)? Batches can be built without it, but offers cannot.
- [ ] **OQ-07 Passport data:** Visa is offline, but airlines need passport details. Should passport number and expiry be collected in the platform (encrypted) or also offline? Default: collected in the platform, encrypted, admin-editable only after confirmation.
- [ ] **OQ-08 Payment deadline:** How many days does a member have to pay an issued offer? This also releases the held seats. Default: 3 days, admin can override per offer.
- [ ] **OQ-09 Supplements:** Under "full payment once", can admin still bill later extras (single room, hospitality upgrade) as a second invoice? Default: yes, as supplement invoices.
- [ ] **OQ-10 Refunds:** Are refunds processed outside the platform by Citadel finance and only recorded here? Default: yes.
- [ ] **OQ-11 Hosting region:** Does Citadel require data hosted in Indonesia, or is Singapore acceptable? Default: Jakarta region if the budget allows, otherwise Singapore, with a cross-border transfer clause in the privacy policy.
- [ ] **OQ-12 Admin users:** How many Citadel staff need admin access at launch? Default: 2–4, each with their own login and 2FA, never shared. The admin UI is English-only at pilot; confirm that works for them.
- [ ] **OQ-13 Brand assets:** Does Citadel Tour Travel already have a logo and wordmark? V2 keeps the dark green, brass and chalk identity. Confirm Citadel accepts it.
- [ ] **OQ-14 Club and event marks:** Does Citadel or G2 have any license to use club names, crests or event logos in marketing? Default: no. Use descriptive text only ("Manchester United vs Everton at Old Trafford") and no logos or crests.

## Open questions added by V2

OQ-15 to OQ-17 decide which products can be sold at all. Treat them as blocking for the supplier and content gate.

- [ ] **OQ-15 Supplier proof per product:** For each of the six products, what written proof exists today of sales rights, final quotation, price, availability, ticket categories and verified dates? V2 says none is on file. Until it is, a product stays draft (D-16).
- [ ] **OQ-16 Berlin Marathon route:** Race entries are sold only through registered official partners ([S5](https://www.generali-berlin-marathon.com/en/registration/tour-operators)). Is Citadel or G2 registered? If not, BM launches as a companion-only product or stays interest-only.
- [ ] **OQ-17 Wimbledon ticket route:** Which route is used (and how are tickets delivered, e.g. an official app)? Court, dates and entry rules for the 2027 season must be verified again ([S4](https://www.wimbledon.com/pdf/2025_Debenture_Handbook.pdf)).
- [ ] **OQ-18 El Clásico host and venue:** Confirm the host and venue for the 2027 edition from an official source. The baseline assumes Bernabéu on 9 May 2027, and V2 says not to assume Madrid for every edition.
- [ ] **OQ-19 First two products:** Which two sport products are the pilot goal (R2 03)? Default: the two with the strongest written supplier proof by the supplier and content gate.
- [ ] **OQ-20 Team and proof content:** Who appears in “Team and proof”, and who approves names and photos? Only verified team profiles are published.
- [ ] **OQ-21 Validation owners:** Who runs the 12 buyer interviews (4 per segment) and the 5-person comprehension test, and by when? This is a recommended method and has not been done.
- [ ] **OQ-22 First response:** Who answers enquiries within one business day, and on which channel and hours? The target is one business day.
- [ ] **OQ-23 Analytics and consent:** Default is first-party events only (no third-party ad cookies), with a short consent notice. Confirm this is acceptable and which consent text Citadel wants.
- [ ] **OQ-24 AI images:** V2 says production uses real photos with clear usage rights. Are AI-generated images acceptable at launch as atmosphere placeholders, or must every public image be licensed or commissioned? Default: AI images allowed on staging, flagged with a warning on production until replaced.
