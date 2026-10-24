# Local security review

14 October 2026. Scope: the isolated development application, built SSR/client bundles and PostgreSQL fixtures. No production credentials or customer database were used.

## Evidence

- Fastify route registry tests require password-session/MFA on every protected admin route, deny members on every admin route, and require sign-in on every `/api/me` route.
- Cross-member booking, traveler, document and receipt access is rejected. Private uploads stay hidden until publication; payment proofs are never exposed to members. Admin previews and passport reveals are audited.
- Origin checks, SameSite/HttpOnly cookies, password-token reuse/expiry, idle admin sessions, recovery-code reuse, per-user payment limits and forged Xendit callback tokens are checked.
- The PostgreSQL comparison covers all 41 business tables, defaults, enum order, check/foreign-key definitions and indexes. Migration `0003_safe_wither.sql` corrects five missing cascade rules without rewriting prior migrations.
- `pnpm audit --prod --audit-level high` reports zero vulnerabilities after updating sharp.
- A ZAP baseline scan against the isolated public application reported **zero high-risk alerts**, zero failures and eight warning categories. Reports are in `.data/checks/security/zap.json` / `zap.html`.
- Production Compose parses successfully. Caddy configuration validates and only trusts configured proxy CIDRs before deriving the client IP. No deployment was executed.

## ZAP warnings reviewed

| Warning                                                     | Local assessment                                                                                                                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anti-CSRF token absent                                      | Native forms trigger a heuristic. API mutations validate Origin and use SameSite session cookies. Cross-origin and missing-origin writes are rejected by tests.               |
| `style-src unsafe-inline`                                   | Needed for numeric focal positions and inline first-paint styles. Script execution requires a nonce; rich text is rendered as escaped React content.                          |
| CSP / nosniff / Permissions Policy absent on some resources | Direct SSR preview serves static assets/XML without the Caddy edge headers. Production Caddy supplies common security headers; nonce CSP applies to HTML.                     |
| COEP / COOP / CORP absent                                   | Cross-origin isolation is not a pilot requirement; Google navigation, Turnstile and private signed file downloads need a separate compatibility review before enabling those policies. |

This baseline is a passive public scan. Authenticated active DAST, independent authorization review and production-edge verification remain staging gates. The local results do not certify a production deployment or compliance with legal obligations.
