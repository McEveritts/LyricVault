# Comprehensive Codebase Audit Report: LyricVault v0.4.8

## Executive Summary
LyricVault v0.4.8 has a substantially improved local security posture (localhost-only binding, production token auth, stricter input constraints, reduced polling via SSE, and CI dependency auditing). Runtime `yt-dlp` self-update via `pip install` is not supported (updates are delivered via signed app releases), removing a major supply-chain/code-execution risk from the default desktop threat model. Overall verdict: **Conditional Pass** (ship is reasonable for a desktop-local threat model, but not for hostile multi-tenant machines or “exposed LAN service” deployments without further hardening).

## Critical Vulnerabilities & Blockers (P0)
| ID | Category | Location | Description | Remediation |
|----|----------|----------|-------------|-------------|
| N/A | N/A | N/A | No P0 findings under the default production configuration after applied hardening. | N/A |

## High Priority Issues (P1)
*   **Rate limiting is best-effort and in-memory** (`backend/main.py:200-219`, `backend/utils/rate_limiter.py:1`): per-process token bucket limits abuse but won’t persist across restarts or multiple backend processes; it also doesn’t protect against non-HTTP resource exhaustion (disk fill via downloads).
*   **Broad exception handling reduces diagnosability** (examples: `backend/main.py:174-175`, `backend/services/ingestor.py:100`, `backend/services/lyricist.py:177-179`): multiple `except Exception:` paths either drop context or emit `print(...)` instead of structured logs; this makes production debugging and security incident triage harder.
*   **Worker lease correctness is improved but still SQLite-thread sensitive** (`backend/services/worker.py:38-48`, `backend/database/database.py:31-38`): WAL + busy_timeout reduce lock pain, and lease-grace + “owns job” checks reduce duplicate finalization, but SQLite + multithreading still needs careful operational constraints (single-user desktop OK; heavier concurrency likely fragile).

## Medium Priority Issues (P2)
*   **Local trust boundary is still the core assumption** (`backend/main.py:953`, `backend/main.py:78-79`): binding to `127.0.0.1` and requiring a token in non-dev is correct for desktop usage, but any future “LAN mode” would require real authn/authz, CSRF considerations (if cookie-based), and stronger abuse controls.
*   **SSE event bus is in-memory** (`backend/utils/event_bus.py:1`, `backend/main.py:234-250`): slow clients can drop events (bounded per-subscriber queues), and subscriber count is capped (`LYRICVAULT_MAX_SSE_SUBSCRIBERS`) to limit worst-case memory/CPU. For a single-renderer Electron app this is typically acceptable.
*   **Secrets storage has platform-dependent strength** (`backend/services/settings_service.py:54-72`, `backend/utils/dpapi.py:33-40`): DPAPI (Windows) is a solid default; non-Windows falls back to reversible base64 obfuscation. If cross-platform support matters, use OS keychains (Keychain/Libsecret) or a well-maintained secret storage library.

## Low Priority Issues (P3)
*   **Logging hygiene** (`electron/main.js:153-159`, `backend/main.py:39-46`): piping backend stdout/stderr into Electron logs is useful, but be careful to avoid ever printing secrets or full URLs containing tokens. Current code avoids Uvicorn access logs in production, which helps.
*   **Minor JS warning during packaging** (`npm run dist:quick` output): a dependency emits a deprecation warning about `shell: true` child processes. This is likely in build tooling, not runtime app code; monitor and upgrade dependencies as needed.

## Nice-to-Have Improvements (P4)
*   **Type hints and static checking**: add gradual typing (MyPy/Pyright) for backend services and shared response models; add TS types or Zod schemas for frontend/backend contracts.
*   **More hermetic integration tests**: add tests for `/events` auth behavior and basic end-to-end job lifecycle (enqueue -> claimed -> terminal) using ASGI transports; keep tests non-hanging and deterministic.

## Architecture & Code Quality Improvements
*   Separate “API layer” from “domain/job orchestration”: move job state transitions into a dedicated service with explicit invariants (allowed transitions, idempotency rules).
*   Centralize logging and error taxonomy: replace `print(...)` with structured logger calls; standardize failure reasons for ingestion/lyrics/AI (machine-readable + user-friendly).
*   Reduce mutable globals: the in-memory rate limiter and SSE event bus are fine for a single desktop instance, but should be explicitly documented as such.
*   Prefer removing risky self-update mechanisms entirely: avoid runtime package installation/updaters and deliver updates via signed app releases.

## Specific Component Audits
### Backend (`/backend`)
*   **Authn / hardening**: production token requirement + trusted hosts middleware (`backend/main.py:159-199`) is aligned with a localhost service threat model.
*   **Input validation**: Pydantic constraints for key request bodies exist (`backend/main.py:260-289`) and ingestion URL scheme/platform validation exists (`backend/services/ingestor.py:221-226`).
*   **Database reliability**: WAL + busy_timeout are set on connect (`backend/database/database.py:43-51`); still be cautious with concurrent writers and long transactions.
*   **Job/worker reliability**: lease grace window + “owns job” checks reduce double-processing/finalization (`backend/services/worker.py:38-48`, `backend/services/worker.py:433-449`).

### Frontend (`/frontend`)
*   **XSS posture**: no obvious dangerous DOM sinks found (`dangerouslySetInnerHTML`/`innerHTML` not present in `frontend/src/` as of this version).
*   **State correctness**: polling is replaced by SSE fan-out (`frontend/src/main.jsx:24-41`), reducing rehydration loops and “stale UI” failure modes.
*   **API auth propagation**: `fetch` is patched to inject `X-LyricVault-Token` for backend calls (`frontend/src/main.jsx:9-21`).

### Electron & Packaging
*   **Protocol hardening**: `app://` file resolution is directory-locked to the dist root (`electron/main.js:62-83`).
*   **Renderer hardening**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (`electron/main.js:236-245`).
*   **Backend spawn security**: backend is spawned with `shell: false` (`electron/main.js:145-151`) and passed a per-run token via env (`electron/main.js:123-130`), which is exposed to the renderer via preload (`electron/preload.js:10-20`).

## Final Verdict
**Pass (desktop-local threat model).**

Remaining improvements:
1) consider persisting/centralizing rate limiting if you ever run multiple backend processes or broaden the threat model beyond localhost, and
2) continue tightening exception handling (reduce broad `except Exception` where feasible) to improve diagnosability and correctness.
