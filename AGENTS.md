# Repository rules

- Never commit real operational records, trailer/container identifiers, item codes, shipment numbers, WMS data, photos or credentials. Use fictional DEMO-* values in tests, screenshots, PRs and releases. Private visibility does not waive this rule.
- Follow docs/SPEC.md. Preserve ascending Dock 1–20. No Dunnage-specific timing logic. Compare only with the previous inspection, never an Excel acknowledgement.
- Offline, single-user MVP. Do not add networking, analytics or cloud sync without a new product requirement.
- Settings stay outside daily editing. Historical records and their baseline/header snapshots remain immutable; only the newest saved check is editable.
- Verify with npm test, npm run test:ui, Android build/lint, and relevant device tests. Do not claim phone testing when only browsers/emulators were used.
- Keep outputs, signing credentials and operational exports out of Git. Preserve signing identity for updates.
