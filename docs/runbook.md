# Operations runbook

## Payments

A browser redirect is never proof of payment. Compare the invoice, payment attempts, recorded payments and callback events. Unknown sessions, late or mismatched amounts and duplicate payments require finance review. Do not refund automatically. Manual full-payment recording requires an uploaded `payment_proof` document, bank reference, paid-at timestamp and typed amount. Refund recording documents a refund performed outside the platform; it does not call Xendit to refund money.

If Xendit is down, switch to manual payment handling, then reconcile the existing Xendit attempts before restoring checkout. Check flagged invoices and failed notifications daily. The reconciliation worker compares near-expiry Xendit attempts every 15 minutes and runs a full pass at 02:00 WIB and imports completed sessions through the same event processor.

## Admin access

Each administrator enrolls TOTP and stores their own ten one-time recovery codes. Recovery codes work on the TOTP verification screen after password sign-in. To recover an account with no usable codes, require an identity check by the designated Citadel owner, stop API/worker for local storage, and run `pnpm admin:reset-totp admin@example.com` from a controlled server terminal. The command clears that admin’s enrollment, removes their recovery codes and sessions, and writes an audit entry; the administrator must enroll again. Never provide a general MFA bypass or share an admin account.

## Documents and publication

Verify booking/traveler assignment before publication. Private uploads never appear to members. A publish action sends one update per lead booker in the batch, regardless of the number of files/items. Withdraw an incorrect document promptly; five-minute signed application URLs can remain usable until expiration. Local signed URLs also check withdrawal at retrieval.

## Privacy and deletion

Members request deletion through their profile; administrators complete anonymization after active trips are resolved. Preserve invoice, payment and refund records. Passport numbers are AES-256-GCM encrypted, masks expose only the final three characters, and admin reveals are audited. The retention worker removes passport data and date of birth after 180 days without a newer relevant booking. Confirm financial retention requirements with Citadel's accountant.

For a suspected breach, isolate affected credentials, revoke sessions, preserve an access-controlled incident record and contact Citadel's designated privacy owner. That owner decides required notices and timing with counsel; the original PRD calls for a 72-hour notification procedure. Populate the responsible names and contacts before release.

## Backups and keys

Enable daily backups and point-in-time recovery on managed PostgreSQL. Back up the production `local-data` Docker volume with the database; it contains private booking documents and generated files. Preserve public media in the R2 public bucket according to the content retention policy. Keep backups protected and encrypted. Keep the encryption key in the secret store and an independently protected recovery copy. Restore a backup into a scratch database and volume, compare record counts and sample invoice/document links, and record elapsed time. Revoke the scratch environment afterwards.

To rotate passport encryption keys, decrypt with the old key and re-encrypt with the new key in a controlled migration, advancing `passport_key_version`; use `ENCRYPTION_KEY_VERSION`, the previous key ring and `pnpm keys:rotate --dry-run` / `pnpm keys:rotate`. Rotation handles both passports and TOTP secrets transactionally. Simply changing `ENCRYPTION_KEY` makes existing passports and TOTP secrets unreadable. Session-key rotation requires revoking sessions and OAuth state cookies. Rotate Xendit callback tokens in both the API and dashboard together.

## Content

Event changes update the public fixture only. Review affected batches/bookings, update departure plans separately, then send the prepared notification. Never move batches automatically. Do not publish testimonials without recorded consent, club/event logos without permission, or sample legal policies as final text. Seed dates came from the supplied brief and remain Provisional until checked by Citadel.

## Local verification and recovery tools

`node infra/backup.mjs` creates a restricted-permission custom PostgreSQL dump; `node infra/restore.mjs` restores to a separate empty scratch database. Set `BACKUP_OUTPUT`, `BACKUP_INPUT`, and `RESTORE_DATABASE_URL` in the command environment; never include credentials in command arguments or logs. The isolated PostgreSQL tests exercise a timed restore and compare every business table's row count. Managed daily backups and seven-day PITR must still be enabled with the database provider.

Finance can download payment acknowledgments for late/mismatched funds, record external refunds, and close a reviewed flag only after the recorded balance is resolved. Acknowledgments never confirm a journey. Admin private document previews are audited. Check Admin → Deletion requests, Webhook review and flagged invoices daily.

Before production, assign a primary and backup owner for operations, finance, privacy incidents, provider credentials and recovery. Record their real names and contact routes in the deployment secret/runbook system; none are invented in this repository.
