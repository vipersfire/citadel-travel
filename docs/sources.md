# Implementation references

The six PDFs in the workspace provide the product scope, flows, technology choices, 41-table schema, design direction and implementation sequence. The schedule was deliberately omitted at the user's request. Credentials are optional in development; production validates only enabled providers, with manual-payment and email-only operation supported.

Current primary references consulted during implementation:

- React Router framework configuration: https://reactrouter.com/api/framework-conventions/react-router.config.ts
- React Router Vite framework integration: https://reactrouter.com/upgrading/router-provider
- Drizzle custom types, generated columns and views: https://orm.drizzle.team/docs/custom-types, https://orm.drizzle.team/docs/generated-columns, https://orm.drizzle.team/docs/views
- Xendit Payment Sessions creation: https://docs.xendit.co/apidocs/create-session
- Xendit current payment channel codes: https://docs.xendit.co/docs/en/available-payment-channels
- Xendit legacy-to-session migration: https://docs.xendit.co/docs/migrate-to-payment-session
- [Cloudflare R2 JavaScript SDK and CORS](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/): presigned PUT configuration and browser-origin rules for public media uploads.

Current public media consists of original programmatic placeholder illustrations and silent placeholder videos generated for this implementation. The old branded/sample photographs are preserved privately in `.data/legacy-media` and are not used in the public experience. Placeholders do not represent a real venue, supplier, traveler or testimonial; see [the media inventory](media-placeholders.md). Fonts are self-hosted Google Fonts (Libre Caslon Display and Schibsted Grotesk), converted to WOFF2; their upstream OFL licenses apply.

## Gap completion references (14 October 2026)

- [Xendit Payment Sessions create schema](https://docs.xendit.co/apidocs/create-session) and [session webhook schema](https://docs.xendit.co/apidocs/webhook-notification-sent-defined-webhook-url-updates-payment-session): typed provider parsing and invoice item payloads. Local fixtures are synthetic; real account payloads remain a staging check.
- [Schibsted Grotesk source and license](https://github.com/google/fonts/tree/main/ofl/schibstedgrotesk): self-hosted variable font, with Latin/extended-Latin files served locally. No browser request to Google Fonts is required.
