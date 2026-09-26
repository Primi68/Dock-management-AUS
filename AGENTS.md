# Repository rules

- Never commit real operational records, trailer/container identifiers, item codes, shipment numbers, WMS data, photos or credentials. Use fictional DEMO-* values in tests, screenshots, PRs and releases. Private visibility does not waive this rule.
- Follow docs/SPEC.md. Preserve ascending Dock 1–20. No Dunnage-specific timing logic. Compare only with the previous inspection, never an Excel acknowledgement.
- Offline, single-user MVP. Do not add networking, analytics or cloud sync without a new product requirement.
- Settings stay outside daily editing. Saved checks, including older checks, can be edited by user request. Preserve originals until save/cancel; editing a check must not overwrite later observations or their creation-time baseline snapshots. Latest saved checks can be deleted with confirmation to undo accidental future checks.
- Verify with npm test, npm run test:ui, Android build/lint, and relevant device tests. Do not claim phone testing when only browsers/emulators were used.
- Keep outputs, signing credentials and operational exports out of Git. Preserve signing identity for updates.
- Commit and push completed code work units promptly. Do not build or publish an APK for every code push. After all requested changes and final verification are complete, update explanatory documents together and publish one final latest APK release. Ordinary main/PR pushes run verification only; APK build/publish is reserved for final release tags or explicitly requested manual builds.
