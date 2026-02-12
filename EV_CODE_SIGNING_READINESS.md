# EV Code Signing Readiness (Windows)

## Goal
Prepare LyricVault for future EV code signing without redesigning packaging/release flow.

## Certificate Requirements
- Certificate type: EV Code Signing Certificate (hardware-backed token or cloud HSM).
- Certificate subject should match publisher identity used in release metadata.
- Timestamp authority required for long-term trust validity.

## Secure Storage and Access
- Do not store private keys in repository, local plaintext files, or committed `.env` files.
- Use hardware token middleware or CI-integrated secure signing service.
- Restrict signing permission to release maintainers only.
- Audit log each signing invocation (who, when, artifact hashes).

## Electron Builder Configuration Flip Criteria
Update `electron-builder.yml` after certificate procurement:
- `signAndEditExecutable: true`
- `forceCodeSigning: true`

Environment and signing hooks to configure:
- Publisher certificate thumbprint/identity.
- Secure secret injection for signing credentials (if cloud-based signer).
- Timestamp server URL (RFC3161).

## Release Pipeline Steps (Post-Procurement)
1. Build unsigned artifacts in CI.
2. Sign installer and portable executable.
3. Verify signatures:
   - `Get-AuthenticodeSignature`
   - checksum verification (`.\VERIFY_RELEASE.ps1`)
4. Attach signed artifacts and checksums to GitHub release.

## Acceptance Before Enabling Enforcement
- Signing works non-interactively in release environment.
- Signature validation is automated and blocking on failure.
- Timestamping is confirmed for every signed artifact.
- Rollback path documented for signing service outages.
