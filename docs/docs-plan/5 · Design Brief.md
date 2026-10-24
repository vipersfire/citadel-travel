# 5 · Design Brief

The direction is **"The Members' Stand"**: Citadel should feel like a private box at a historic ground, not a travel agency. The palette is club heritage (bottle green, brass, chalk white), the typography is matchday programme (a heritage serif for places, a news grotesk for facts), and there is one signature object: the **fixture stub**, a ticket with a perforated edge that carries each event and becomes the member's trip pass. Everything around it stays quiet. V2 (18 October 2026) and the owner direction of 23 October: luxury lives in this design and nowhere else. It is never a product list or a word in the copy. The “V2 design changes” section at the end overrides the home layout, header, hero line and the luxury prompts below.

## Subject, audience, job

- **Subject:** sport trips to Europe for Indonesian fans, designed to feel premium and well handled. Luxury is a quality of the design (restraint, materials, type, spacing, motion), never a product category or a claim in copy.
- **Audience:** Indonesian sports fans on a phone (the 30–55 age range and home cities are team assumptions to confirm in interviews), used to premium hotels and WhatsApp concierge service. Many are first-time attendees of these events. They want certainty: which match, which seats, halal food, an Indonesian-speaking leader.
- **The site's job:** make an event whose date is not yet confirmed feel safe to enquire about (public site), and make an upcoming trip feel handled (member area). The admin's job is speed and zero mistakes.

## What the references teach

| Reference | Take | Leave |
| --- | --- | --- |
| Quintessentially Travel | Restraint, few words per section, enquiry-led selling, phone number always visible | Generic "inspiration" grid of identical destination cards |
| Snami Travel | Emotional, specific copy per collection; image pairs with captions; strong sense of place | Long poetic paragraphs; all-caps headings everywhere |
| Travel Next Level | Bilingual switch in the header, account sign-in visible, WhatsApp channel | Affiliate-style price tiles ("from €36"), dense blog feed |

## Token plan

### Color

| Token | Hex | Role |
| --- | --- | --- |
| `chalk` | #F4F5F1 | Page background. A cool white, like pitch line paint, not warm cream. |
| `touchline` | #12291F | Primary ink and dark surfaces (hero overlay, footer, member trip pass). |
| `stand` | #56635C | Secondary text, captions, metadata. |
| `brass` | #A6814A | The only precious accent: stub perforations, focus rings on dark, one rule per section at most. Never for body text or large fills. |
| `rule` | #D8DCD3 | Hairlines, input borders, table rules. |
| `paper` | #FBFBF8 | Raised surfaces: stub, cards, inputs. |

Status colors are for member and admin UI only. Every status always has a text label, never color alone.

| Token | Hex | Used for |
| --- | --- | --- |
| `ok` | #2E6A4E | Confirmed, Ready, Paid, Approved |
| `wait` | #8A6A1F | To be announced, Being arranged, Awaiting payment |
| `alert` | #A23B3B | Expired, Refused, Cancelled, needs review |

Contrast checks: `touchline` on `chalk` is 14.1:1, `stand` on `chalk` 5.8:1, `brass` on `touchline` 4.8:1 (still reserved for large text and icons). Verify every pairing with a contrast checker when tokens are coded (task 2.1 gate).

### Type

| Role | Face | Notes |
| --- | --- | --- |
| Places and headlines | **Libre Caslon Display** (Google Fonts) | Programme-cover feel. Used large (40–88 px) and only for names of places, events and trips. Never for UI. |
| Facts, UI, body | **Schibsted Grotesk** (Google Fonts) | A newspaper grotesk with character. Weights 400/500/600. Tabular figures (`font-variant-numeric: tabular-nums`) for dates, times and amounts. |
| Upgrade path | GT Sectra or Canela + Söhne (licensed) | Only if Citadel buys licenses; same roles. |

Scale (1.25 ratio, 18 px body on public pages, 16 px in admin): 14 · 16 · 18 · 22 · 28 · 36 · 44 · 56 · 72 · 88. Body line-height is 1.55; serif display is 1.05. Line length stays under 68 characters. Sentence case everywhere: no all-caps labels, no tracked-out eyebrows.

### Layout

- 12-column grid, 1240 px max content width, 24 px gutters (16 px on mobile), page margins of at least 6% on desktop.
- **Left-aligned** editorial layout. Images bleed off one edge, alternating sides, so pages feel composed rather than stacked.
- Spacing scale 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72 · 112. Sections are separated by space and a single `rule` hairline, not by alternating background stripes.
- Radius: 2 px on inputs and buttons, 0 on images, and the stub has its own perforated edge. Using different radii marks hierarchy.

### Principles

1. **Spend boldness once.** The fixture stub is the memorable thing. Nothing else gets a gradient, a glow or a shadow beyond `0 1px 0 rule`.
2. **Certainty is the luxury.** Every date shows its status. Every "what's next" in the member area is a plain sentence with a date.
3. **Place before product.** Headlines name places and moments ("Old Trafford, a Saturday in March"), not features.
4. **Quiet admin.** Same tokens, no display serif, dense tables, keyboard-first.

## Checked against the usual defaults

The first draft defaulted to the standard luxury look: a near-black page with gold accents and an uppercase spaced eyebrow over every heading. That is what most luxury travel sites look like and would make Citadel indistinguishable. I changed three things:

- Black and gold became **bottle green and brass on cool chalk**, because it comes from English football heritage and racing green, which fits the sport catalog.
- Eyebrow labels were removed. Section headings are plain sentence-case serif, with facts set in the grotesk beneath.
- The repeated card grid became the **season calendar**: a chronological list of fixture stubs. The order is real (dates), so numbering by month is justified there and nowhere else.

## The fixture stub (signature component)

A horizontal ticket on `paper` with a perforated vertical seam (CSS mask, brass dots) splitting it into two parts.

```
┌──────────────────────────────────────┬────────────────┐
│ Old Trafford, Manchester             ┆  Sat 13 Mar 2027 │
│ Manchester United v Everton          ┆  Confirmed       │
│ Premier League, Old Trafford Exp.    ┆  Request         │
└──────────────────────────────────────┴────────────────┘
```

- **Left part:** place in the serif (28 px), event in the grotesk 600, then competition and package in `stand`.
- **Right part ("the stub"):** date in tabular figures, date status chip, and the action.
- **On mobile** the seam runs horizontally and the stub sits below.
- **In the member area** the same object becomes the **trip pass** on a `touchline` surface: trip name, dates, booking code, status, and a countdown in days. When a booking becomes confirmed, the stub part separates along the perforation once (300 ms, user-visible confirmation). That is the only celebratory motion in the product.

## Page layouts

### Home

```
[ header: Citadel wordmark | Olahraga  Beyond the event  Tentang | ID/EN | Sign in ]
[ HERO: full-bleed muted video loop, touchline gradient at bottom-left      ]
[   "Be There When It Matters."  (serif 72)          ]
[   Explore the 2027 season   ·   Talk to us on WhatsApp                  ]
[ The 2027 season          — month list of fixture stubs, Mar → Sep         ]
[ Beyond the event         — city, food, companion activities; image bleeds right           ]
[ How it works             — 4 steps: request, offer, pay, travel (a real   ]
[                            sequence, so numbered)                        ]
[ From our travelers       — one quote at a time, consented only           ]
[ Footer: contact, WhatsApp, legal, language                               ]
```

### Package page

```
[ hero image (focal-point crop), title in serif bottom-left               ]
[ fixture stub(s) for open batches                                        ]
[ story (left, 60ch) | sticky panel (right): stub + Request this journey ]
[ highlights — 3 short sentences with photographs, alternating sides       ]
[ sample itinerary — Day 1..n (numbered: a sequence)                      ]
[ included / not included — two plain lists side by side                  ]
[ hotel style · add-ons · visa note · FAQ (accordion)                     ]
[ closing CTA: Request this journey · Ask on WhatsApp                     ]
```

On mobile the sticky panel becomes a bottom bar with the date and the CTA.

### Member trip page

```
[ trip pass (touchline): El Clásico, Madrid · 6–10 May 2027 · CTD-27-00042 · Confirmed · 23 days ]
[ "What's next" — one sentence + date, e.g. "Visa appointment for Rina on 3 Apr, VFS Jakarta" ]
[ tabs: Overview | Itinerary | Documents | Travelers | Payments ]
[ Overview: status timeline · tour leader card with WhatsApp · meeting point ]
```

### Admin operations board

```
[ Batch EC-27-0509 · Open · seats 14/20 confirmed, 3 held, 3 left · [Publish updates] ]
[ filters: booking status · missing items only                                     ]
[ ☐ Traveler        Booking   Flight     Hotel      Ticket       Visa        Ins.  ]
[ ☐ Rina Hartono    CTD-42    Issued     Confirmed  Pending all. Appt 3 Apr  —    ]
[ ☐ Adi Hartono     CTD-42    Issued     Confirmed  Pending all. Collecting  —    ]
[ bulk bar: Set status ▾ · Upload documents · Create service for selected          ]
```

Cells use status text plus color. Keyboard: arrows move between cells, Enter opens the cell, Space selects the row.

## Components

| Component | Notes |
| --- | --- |
| Fixture stub / trip pass | Signature object, above. |
| Date with status | Tabular date + chip (*Confirmed, Changed, Postponed, Cancelled, or To be announced with no date*). Hovering or tapping *Changed* shows the previous date. |
| Status chip | Text label + token color, 2 px radius, never color alone. |
| Buttons | Primary: `touchline` fill, `chalk` text. Secondary: 1 px `touchline` outline. Text button: underline on hover. Labels say the action ("Request this journey", "Pay Rp 312.500.000", "Publish 6 updates"). |
| Offer summary | Lines in tabular figures, total in 28 px, deadline as a sentence ("Pay by Thursday 21 January, 23:59 WIB"), terms link. |
| Document row | Type icon, title, traveler, date published, Download. |
| Itinerary day | Day number + date, serif title, timed items with place and map link. |
| Bilingual field (admin) | ID and EN side by side, with a "missing EN" marker. Publishing is blocked if a required ID field is empty. |
| Media picker (admin) | Upload, alt text in ID/EN, click to set focal point, preview at 16:9, 4:5 and 9:16. |
| Seat counter (admin) | Bar segmented into confirmed, held and remaining, with numbers. |

## Motion

- **One orchestrated moment:** on home load, the hero poster appears at once, the video fades in over 800 ms after first paint, and the two headline lines rise 12 px and fade in, staggered 120 ms.
- **Feedback motion** only: accordions, tabs, dialog open, stub separation on confirmation.
- No scroll-triggered fade-ups on every section, no hover lifts on cards.
- `prefers-reduced-motion`: no video autoplay (the poster shows), no transitions over 100 ms.

## Copy voice

- Indonesian first, formal-warm ("Anda"), short sentences. English is international, not American slang.
- Specific over grand: "Kursi berdampingan untuk rombongan Anda" / "Seats together for your party", not "Unforgettable experiences".
- CTA pairs: *Ajukan perjalanan ini* / *Request this journey* · *Bayar sekarang* / *Pay now* · *Unduh itinerary* / *Download itinerary* · *Tanya via WhatsApp* / *Ask on WhatsApp*.
- Errors say what happened and what to do: "Batas pembayaran sudah lewat. Hubungi kami untuk penawaran baru." / "The payment deadline has passed. Contact us for a new offer."
- Never imply official partnership with clubs or tournaments. Never show invented reviews (testimonials need consent, enforced in the schema).

## Imagery direction

- Atmosphere over action: floodlight haze, architecture, crowd silhouettes, textures (clay, grass, tarmac), city streets at blue hour, hotel details.
- No club crests, sponsor logos, team kits in real colors, recognizable players, broadcast graphics or event logos (OQ-14).
- Grade: lifted blacks, green-leaning shadows, warm highlights, fine 35 mm grain. This makes AI and licensed photos sit together.
- People: Indonesian travelers, including women in hijab, couples and families, shown as guests (arriving, watching, dining), never as models posing at the camera.
- Every AI asset is flagged `is_ai_generated` in the media library. Replace hero assets with licensed or commissioned photography when budget allows. Never present AI people as real customers.

## AI image and video prompts

Paste the **style suffix** after every prompt and the **avoid list** into the negative-prompt field (or as "Avoid: …" for tools without one). Check your tool's commercial-use license before publishing. Generate 4–8 variants and pick the one with the cleanest composition for a left-aligned headline.

**Style suffix:** *cinematic editorial photograph, natural light, lifted blacks, deep bottle-green shadows, warm brass highlights, fine 35mm film grain, shallow depth of field, calm composition with negative space on the left third, premium travel magazine, no text*

**Avoid list:** *logos, crests, badges, sponsor boards, brand names, readable text, numbers on shirts, recognizable athletes, celebrities, team kits in red or white or blue club colors, watermarks, oversaturated colors, HDR look, lens flare, distorted hands, extra fingers, plastic skin*

| ID | Use | Ratio and size | Prompt |
| --- | --- | --- | --- |
| VID-01 | Home hero video (desktop) | 16:9, 1920×1080, 10 s seamless loop | *Slow dolly forward from a high stadium stand at dusk toward a floodlit football pitch, light mist catching the floodlights, crowd as soft dark silhouettes, steam of breath in cold air, camera move smooth and continuous, last frame matches first frame for a loop* |
| VID-02 | Home hero video (mobile) | 9:16, 1080×1920, 8 s loop | *Vertical shot looking up a stadium tunnel toward a bright green pitch, slow walk forward, light flooding in from the pitch end, concrete walls and brass handrail, no people visible* |
| VID-03 | Package hero, F1 | 16:9, 8 s loop | *Low angle at a historic race circuit at golden hour, an unbranded single-seater race car passing in heavy motion blur, plain dark green bodywork, heat haze over the tarmac, old concrete banking in the background* |
| VID-04 | Beyond the event hero (Como) | 16:9, 10 s loop | *A wooden classic motorboat gliding across a still alpine lake at sunrise, villas with terraced gardens on the shore, mist lifting off the water, camera drifting slowly sideways* |
| IMG-OT | Old Trafford Experience | 16:9 and 4:5 | *Red-brick terraced street in Manchester at blue hour after rain, wet cobblestones reflecting warm street lamps, the lit edge of a large football stadium roof at the end of the street, two well-dressed travelers walking toward it, seen from behind* |
| IMG-EC | El Clásico Trip | 16:9 and 4:5 | *Madrid grand boulevard at night, early-20th-century facades lit warm, light traffic trails, a modern stadium's curved metallic facade glowing softly in the distance, festive pre-match atmosphere without visible flags or colors* |
| IMG-RG | Paris Tennis & Lifestyle | 4:5 | *Close detail of a red clay tennis court with a crisp white line and a single tennis ball resting on it, late afternoon side light showing the clay texture, empty court, shallow focus* |
| IMG-RG-2 | Paris lifestyle | 4:5 | *Haussmann apartment balcony in Paris at morning, wrought-iron railing, a breakfast tray with coffee and croissants, rooftops and chimneys softly out of focus* |
| IMG-WB | Wimbledon & London Lifestyle | 4:5 | *Freshly mown grass tennis court at early morning with dew, stripes visible, crisp white baseline, green canvas backdrop with no lettering, soft English light* |
| IMG-WB-2 | London lifestyle | 4:5 | *Glass-roofed Victorian shopping arcade in London, polished wooden shopfronts with no readable names, an Indonesian woman in an elegant hijab and her companion browsing, seen from a distance* |
| IMG-F1 | F1 Monza – Milan – Como | 16:9 | *Terrace of a lakeside villa on an Italian lake at dusk, set table for two with linen and candles, mountains across the water, lights of a small town reflecting on the lake* |
| IMG-BM | Berlin Marathon Experience | 16:9 | *Wide Berlin boulevard at dawn during a city marathon, runners in plain clothing with motion blur, no readable bib numbers, neoclassical gate in soft focus in the distance, cool morning light* |
| IMG-BE-2 | Beyond the event: lakeside town | 4:5 | *A narrow cobbled street in a northern Italian lakeside town at dusk, café tables with warm lights, two travelers in casual smart clothes seen from behind, still water and mountains at the end of the street* |
| IMG-PPL-1 | How it works / About | 3:2 | *An Indonesian family of four, the mother wearing a hijab, sitting together in premium stadium seats, watching the match with delight, warm floodlight on their faces, seen from a three-quarter side angle, no team colors* |
| TEX-01 | Stub paper texture | 2048×2048, tileable | *Seamless tileable texture of fine off-white uncoated paper with subtle fibres, very low contrast, flat even lighting, no shadows* |

**Video tips:** ask for a 10–12 s clip and trim to the cleanest 8–10 s. Check the first and last frame for a seamless loop, or crossfade 0.5 s. Export H.264 MP4 and WebM under 6 MB, without audio. Generate the poster image from the first frame.

## Accessibility checklist

- [ ] Contrast meets WCAG 2.2 AA (4.5:1 text, 3:1 large text and UI) in both light surfaces and the `touchline` trip pass.
- [ ] Hero video has a pause control, never autoplays under reduced motion or Save-Data, and has a poster.
- [ ] Focus ring: 2 px `touchline` on light, 2 px `brass` on dark, always visible.
- [ ] Status never relies on color: text label always present.
- [ ] Tap targets at least 44 × 44 px. Forms work with autofill (name, email, tel, passport fields labeled).
- [ ] `lang` attribute switches with the route; screen readers pronounce Indonesian correctly.

## V2 design changes

These changes override the matching parts above. Sources: V2 brief (18 October 2026) and the owner direction of 23 October 2026.

### Luxury is a design quality

Luxury shows up in how the site looks and behaves, not in what is sold or said.

| It is | It is not |
| --- | --- |
| Restraint: one accent, hairlines, generous space. | A “Luxury” collection, a luxury product tier, or luxury trips. |
| Material: the paper stub, brass perforation, fine grain. | Gold gradients, glow, heavy shadows, black-and-gold. |
| Type: a heritage serif for places, a news grotesk for facts. | The words “luxury”, “VIP”, “exclusive” or “pertama” in copy. |
| Certainty: dates, statuses and terms stated plainly. | Promises of access, seats or service that are not proven (claims policy). |
| Quiet motion and real photography. | Stock-looking lifestyle imagery. |

### Brand lockup and header

- Wordmark: **Citadel Tour Travel** in Libre Caslon Display. The descriptor **Sports Travel** sits beside or under it in Schibsted Grotesk 14 px, `stand` color.
- Header navigation (ID / EN): *Olahraga / Sports* · *Beyond the event* · *Tentang / About* · language switch · *Akun / Account*. There is no Luxury item.
- Mobile header: wordmark, ID/EN switch, menu. The menu holds the same items plus “Hubungi Citadel / Contact Citadel”.

### Cross-sport identity

The palette stays the same across sports. Identity comes from shape and image, not from new colors.

- **Sport glyphs:** four line glyphs (football, tennis, motorsport, running) at 1.5 px stroke, drawn on a 24 px grid and used at 24 and 48 px. `touchline` on `chalk`, `brass` on `touchline`.
- **Sport hub header:** glyph, sport name in the serif, one sentence, then that sport’s fixture stubs.
- **Imagery per sport, same grade:** football — floodlights, stands, tunnels; tennis — clay or grass texture, white lines, empty courts; motorsport — tarmac, banking, heat haze; running — dawn boulevards, city gates.
- **Participant paths** (a runner entering a race) are labeled “Peserta / Participant” and separated from “Penonton / Spectator” on the sport hub and in the product options.

### Desktop home layout (V2)

```
[ header: Citadel Tour Travel · Sports Travel | Olahraga  Beyond the event  Tentang | ID/EN | Akun ]
[ 1 HERO: one atmosphere photo, tagline in serif 72, two CTAs                                 ]
[    Be There When It Matters.                                                                  ]
[    [Jelajahi pengalaman]   [Diskusikan perjalanan]                                            ]
[    Berbasis event · Penawaran personal · Portal perjalanan                                     ]
[ 2 Why Citadel: the offer process, trip coverage, guest portal (3 plain facts)                 ]
[ 3 Pick a sport: Sepak bola | Tenis | Motorsport | Lari  (glyph + one line each)               ]
[ 4 The season: fixture stubs in date order; "Akan diumumkan" group at the end                  ]
[ 5 Beyond the event: cities, food, companion activities; image bleeds right                    ]
[ 6 How to book: discuss, service check, offer, payment, preparation (numbered, a real sequence) ]
[ 7 Team and proof: verified profiles, real experience context, consented testimonials          ]
[ footer: contact, WhatsApp, legal, language                                                    ]
```

### Mobile home layout (V2)

```
[ Citadel Tour Travel      ID/EN   Menu ]
[ European sports experiences           ]
[ Be There                              ]
[ When It Matters.                      ]
[ Journeys for Indonesian fans, built   ]
[ around your chosen event.             ]
[ [Jelajahi pengalaman]                 ]
[ [Diskusikan perjalanan]               ]
[ Temukan momen Anda                    ]
[ Bola · Tenis · Motorsport · Lari      ]
[ stub: El Clásico · Madrid · Belum final ]
[ stub: Paris Tennis · Sesi di offer     ]
[ ----- fixed bottom bar ----------------]
[ [Lihat pengalaman]  [Hubungi Citadel] ]
```

- The bottom bar is fixed. The page adds bottom padding equal to its height (plus the device safe area) so it never covers content.
- Priorities: first identity and promise, second one primary explore button, then a light form, then clear statuses, then easy actions.
- Every operational label reads without color.

### Fixture stub variants

| Variant | Look and content |
| --- | --- |
| Dated | Place, event, competition; date in tabular figures; status chip; action. |
| To be announced | Dashed perforation, no date, label “Akan diumumkan / To be announced”. Grouped at the end of the season list. |
| Changed | New date; the previous date struck through; chip “Changed”. |
| Interest only | Label “Kami sedang menyiapkan perjalanan ini”; action “Saya tertarik / I’m interested”. |

### Four-status strip

Four labeled cells in one row on desktop and 2×2 on mobile: *Event schedule*, *Ticket allocation*, *Departure*, *Payment*. Each cell shows a word value and a short sentence. Color and icon only reinforce. There is never a single merged “confirmed” badge. Public batch cards show the first three. The member’s trip overview shows all four.

### Enquiry form

- Single column. WhatsApp number first with +62 prefilled, then travel interest (select), then number of travelers (stepper), then name.
- A collapsed “Tambahkan detail (opsional) / Add details (optional)” holds preferred time, email and budget.
- Helper text: “Tanpa paspor dulu / No passport needed yet”.
- Confirmation screen: “Kami membalas dalam 1 hari kerja / We reply within one business day”, plus a WhatsApp link.

### Offer review and approval screen

- Left column: lines, total in 28 px tabular figures, deadline as a sentence.
- Blocks below, in this order: *What is included*, *What is not included*, *Tickets and seating* (category and seating policy), *If the schedule changes*, *Cancellation terms*.
- Primary action **Setujui penawaran / Approve offer**. After approval the same page shows **Bayar sekarang / Pay now** as the primary action and a read-only “Apa yang Anda setujui / What you approved” snapshot link.
- If admin edits the offer, a notice reads “The offer was updated. Please review and approve again.”

### Ticket through an official app

A card with the app name, numbered instructions, the handover target date and a status chip. There is no download button. The card says plainly that the ticket will arrive through the official app.

### Admin readiness checklist

In the offer builder, a panel with six rows (supplier confirmation, quotation price, ticket source and category, event date status, services and exclusions, terms attached). Each row has a check and a required note. **Issue offer** stays disabled and lists the unmet items as text.

### Photography and media policy

- The venue illustrations in the V2 brief are composition markers only. Production uses real photographs with clear usage rights (V2).
- AI images and video are placeholders for staging and prototypes, flagged `ai_placeholder` in the media library, never shown as real customers, and replaced before launch where the budget allows. Whether AI images may stay on production is OQ-24.
- The prompts above stay valid for placeholders. The two luxury prompts are retired: VID-04 is now the Beyond the event hero (Como) and IMG-LUX-1 is now IMG-BE-2.

### Copy rules

- Use the ID/EN front-page copy from the V2 tab.
- No “luxury”, “VIP”, “exclusive”, “official partner”, “first” or “24 hours”. The trust line stays off until the offer flow delivers it.
- State what is known: nights or night range, hotel type, event coverage, exclusions. Say “Dijelaskan dalam penawaran personal Anda” for what depends on the offer.

### Accessibility additions

- [ ] Every status has a text value (four-status strip, chips, stubs).
- [ ] The fixed mobile bar never hides content and respects the safe area.
- [ ] The enquiry form works with autofill and a screen reader; the optional section is announced as optional.
- [ ] “To be announced” stubs are real text, not a dimmed look only.
