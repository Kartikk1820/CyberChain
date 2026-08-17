# CyberChain — Blockchain-Based Cybersecurity Solution

A prototype platform where organizations (banks, hospitals, CERTs, universities, companies) jointly build a trustworthy, tamper-evident threat intelligence network and feed it into a Zero-Trust access-control engine.

## Architecture — three layers

**Layer 1 — TRUST.** Every organization has a DID + Ed25519 keypair generated client-side in the browser. Threat reports are signed with that key, hashed, and anchored to an append-only hash-chained ledger (a separate microservice, separate datastore) so tampering is independently detectable. *"Can I trust this information?"*

**Layer 2 — INTELLIGENCE.** Reports are analyzed by a rule-based classifier (optionally boosted by the Anthropic API), independently confirmed or disputed by other organizations, and combined into a live Threat Confidence score. Reporter reputation moves based on report accuracy. Related indicators across organizations auto-cluster into detected Campaigns. *"What's actually happening?"*

**Layer 3 — DEFENSE.** The verified, high-confidence threat feed drives a Zero-Trust risk engine: every simulated login/access attempt is scored against identity, device, location, the live threat feed, and behavior, then resolved to ALLOW / MFA / RESTRICT / BLOCK by a per-organization editable policy. *"What should we do about it?"*

### Services

| Service | Tech | Role |
|---|---|---|
| `frontend` | React + TypeScript + Tailwind + Vite, served by nginx | Dashboard, onboarding, report/confirm flows, Zero-Trust simulator, policy editor |
| `backend` | Node.js + TypeScript + Fastify + Prisma | All API routes, WebSocket broadcast, rule-based classifier, campaign correlation worker |
| `ledger` | Node.js + TypeScript + Fastify + SQLite (`better-sqlite3`) | Independent, append-only hash-chained block store — a genuinely separate trust boundary from the backend's Postgres |
| `postgres` | PostgreSQL 16 | Primary application data |

**Why a lightweight self-hosted ledger instead of a real chain (Hardhat/Ganache):** the spec explicitly allows either approach. A real EVM node adds gas accounting, ABI plumbing, and a runtime with zero payoff at this scale. What actually matters for the demo — tamper-evidence — only requires that the ledger be a genuinely separate service with its own storage and a narrow, append-only API, which the SQLite-backed service provides at a fraction of the complexity.

## Running it

```sh
cp .env.example .env
docker compose up --build
```

That's it — Postgres, the ledger, the backend, and the frontend all start, migrations run automatically, and the backend seeds a realistic demo scenario (see below) the first time it starts against an empty database.

- Frontend: **http://localhost:3000** (or `$FRONTEND_HOST_PORT`)
- Backend API: **http://localhost:4000** (or `$BACKEND_HOST_PORT`)
- Ledger API: **http://localhost:4100** (or `$LEDGER_HOST_PORT`)
- Postgres: **localhost:5432** (or `$POSTGRES_HOST_PORT`)

If any of those default ports collide with something already running on your machine, override the corresponding `*_HOST_PORT` variable in `.env` — the containers still talk to each other over fixed internal ports regardless of what you expose to the host. Note that `VITE_API_URL` / `VITE_WS_URL` are baked into the frontend at **build** time, so if you change `BACKEND_HOST_PORT` update those too and re-run `docker compose up --build`.

### Demo login

The seed script creates five organizations, all with password:

```
sixsync-demo-2026
```

Emails: `security@bank-a.demo`, `soc@hospital-b.demo`, `watch@cert-c.demo`, `infosec@university-d.demo`, `security@company-e.demo`.

Seeded organizations' private keys are **not** persisted anywhere on disk (consistent with the platform's own "the server never holds your private key" design) — the one exception is Bank A's, which is printed to the backend's startup logs (`docker compose logs backend`) specifically so you can copy it into a keyfile and sign in as Bank A to demo confirming/reporting/simulating live. For everything else, the fastest path to a fully interactive session is registering a brand-new organization from the UI — that flow generates and downloads a real keypair for you.

### Resetting the demo data

```sh
docker compose down -v   # drops the Postgres and ledger volumes
docker compose up --build
```

## Environment variables

See `.env.example` for the full annotated list. The most relevant:

| Variable | Purpose |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials |
| `*_HOST_PORT` | Which host port each service is published on (internal container ports are fixed) |
| `JWT_SECRET` | Signs organization session tokens — change this for anything beyond local demo use |
| `LEDGER_DEBUG_ENDPOINTS` | Enables `POST /debug/corrupt-block/:idx` on the ledger for the chain-level tamper demo (see below) |
| `ENABLE_LLM_ENRICHMENT` / `ANTHROPIC_API_KEY` | Optional: when both are set, threat classification gets an additional confidence pass from Claude. Leave `ENABLE_LLM_ENRICHMENT=false` (the default) to run fully offline — the rule-based classifier alone satisfies the baseline requirement |

## Key design choices worth knowing before you read the code

- **Keys are generated client-side, never server-side.** The private key never touches the network. A one-time keyfile download is offered at registration; the key is then held in `sessionStorage` for the rest of that browser session so you can keep signing reports without re-uploading. This is the only choice consistent with the platform's non-repudiation story — a server that could generate (and therefore reconstruct) an org's private key could forge signed reports on its behalf.
- **What's actually signed:** the canonical JSON (deterministic key-sorted stringify) of `{reporterOrgId, indicator, indicatorType, attackType, mitreTechnique, severity, description, evidenceFileHash, timestamp}`, signed with Ed25519 directly (no separate pre-hash — Ed25519 is safe over arbitrary-length messages). A separate SHA-256 of that same canonical JSON (`payloadHash`) is what actually gets anchored to the ledger — a commitment, not part of the signature itself.
- **Ledger call is synchronous, one block per report,** made after signature verification and evidence hashing but before the HTTP response returns. If the ledger is unreachable, the report is not created — no queue, no eventual consistency. This trades throughput (irrelevant at this scale) for the "blockchain verified ✓" checkmark appearing the instant a report is submitted.
- **Only the reporter's reputation moves on confirm/dispute** — confirming/disputing orgs aren't scored on whether their vote was later borne out, since that would need a ground-truth resolution step this prototype doesn't have.
- **Zero-Trust's location/behavior risk are simple, explicit heuristics** (IP-prefix history and a static business-hours window, not real GeoIP or ML) — sufficient to demonstrate the scoring *mechanism*, which is the point.

The full list of these documented simplifications lives in the original build plan; none of them are accidental gaps.

## API summary

All endpoints are on the `backend` service (default `http://localhost:4000`).

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /orgs` | — | Register an organization (name, type, client-generated publicKey, email, password) → org + JWT |
| `POST /auth/login` | — | Email/password login → org + JWT |
| `GET /orgs` | — | Organization leaderboard (sorted by reputation) |
| `GET /orgs/:id` | — | Single organization |
| `POST /reports` | JWT | Submit a signed threat report (multipart, optional evidence file) — verifies signature, hashes evidence, anchors to the ledger, runs the classifier |
| `GET /reports` | — | All reports |
| `GET /reports/:id` | — | Report detail incl. live blockchain/evidence verification |
| `POST /reports/:id/simulate-tampering` | JWT | Demo endpoint: mutates the stored evidence bytes so `evidenceIntegrity` flips to `false` |
| `POST /reports/:id/confirmations` | JWT | Confirm or dispute a report — recomputes Threat Confidence, updates reputation, may trigger campaign correlation |
| `GET /threat-feed` | — | High-confidence (`CONFIRMED`/`CRITICAL`) indicators only — what a browser extension/agent would poll |
| `GET /campaigns` | — | Auto-detected coordinated campaigns |
| `POST /access-attempts` | JWT | Run a Zero-Trust simulation (user, ip, deviceFingerprint, passwordValid) → full risk breakdown + decision |
| `GET /access-attempts` | JWT | Your organization's recent simulated access attempts |
| `GET /policies` / `PUT /policies` | JWT | Read/update your organization's risk-decision policy (thresholds + override rules) |
| `GET /ledger/verify` | — | Full hash-chain integrity check |
| `GET /ws` | JWT | WebSocket — live `report:new`, `report:updated`, `confirmation:new`, `reputation:updated`, `campaign:new`/`campaign:updated`, `access_attempt:new`, `ledger:block_added`, `tamper:detected` |

Ledger service (`http://localhost:4100`) is normally only called by the backend, but is browsable directly: `GET /blocks/:idx`, `GET /verify`, and (only with `LEDGER_DEBUG_ENDPOINTS=true`) `POST /debug/corrupt-block/:idx` for the chain-level tamper demo.

## Suggested demo walkthrough

1. **Dashboard** (`/`) — after `docker compose up`, the seeded network is already live: 5 organizations, 3 confirmed/critical phishing reports, one auto-detected campaign.
2. **Register your own organization** (`/onboarding`) — watch the keypair get generated in-browser and the keyfile download.
3. **Report a threat** (`/report`) — submit an indicator; watch it get classified, signed, hashed, and anchored, then land on the dashboard in real time via WebSocket.
4. **Sign in as a second seeded org** (or register a second new one) and **confirm** the report you just made — watch its status escalate and its Threat Confidence score move live.
5. **Tamper demo** — open any report with evidence attached, click *Simulate Tampering*, watch the evidence-integrity badge flip to ✗ while the blockchain-verified badge (which checks the ledger-anchored hash, not the mutated evidence bytes) correctly stays independent.
6. **Zero-Trust simulator** (`/zero-trust`) — run an access attempt using one of the seeded network's confirmed-malicious IPs (e.g. `203.0.113.77`) as the source IP and watch `ipThreatRisk` dominate the score and the decision escalate to `BLOCK`/`MFA`.
7. **Policies** (`/policies`) — tighten your organization's thresholds and re-run the simulation to see the decision change.

## Tests

```sh
cd backend && npm test    # signature verification, threat-confidence formula, reputation formula, risk-engine/policy decisions
cd ledger && npm test     # hash-chaining, tamper detection (both evidence-level and chain-level)
```

Both suites run against pure/unit-level logic (no live DB required) except the ledger tests, which spin up an isolated temp SQLite file per run.
