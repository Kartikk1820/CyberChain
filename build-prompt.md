# Project Build Prompt: Decentralized Cyber Defense & Trust Network

Copy everything below this line into Claude Code as your instructions.

---

## What we're building

A decentralized cybersecurity platform where organizations (banks, hospitals, companies, government agencies, universities) can:

1. Join the network with a cryptographic identity (DID + public/private keypair)
2. Report cyber threats (malicious IPs, domains, hashes, phishing URLs) signed with their private key
3. Have those reports analyzed (AI + rule-based), hashed, and anchored to a blockchain for tamper-evidence
4. Let other organizations independently **confirm** or **dispute** the same threat
5. Build a network-wide **Threat Confidence** score from those confirmations
6. Track each organization's **Reputation** based on report accuracy over time
7. Feed verified threats into a **Zero-Trust access engine** that computes a risk score for login/access attempts and can automatically ALLOW / require MFA / RESTRICT / BLOCK
8. Detect **coordinated attack campaigns** by correlating multiple related indicators reported across organizations

This is being built as a working prototype/demo (e.g. for a hackathon), so prioritize a fully functional end-to-end flow over exhaustive production hardening — but the architecture should still be clean and defensible.

## The three layers to keep in mind throughout

- **Layer 1 — TRUST**: Decentralized Identity → Digital Signatures → Blockchain anchoring → Evidence integrity (hashing) → Organization reputation. Answers: *Can I trust this information?*
- **Layer 2 — INTELLIGENCE**: Threat reports → AI/rule-based analysis → Correlation → Collaborative confirmation → Threat confidence score → Campaign detection. Answers: *What's actually happening?*
- **Layer 3 — DEFENSE**: Trusted threat feed → Zero-Trust risk engine → Security policy → ALLOW / MFA / RESTRICT / BLOCK. Answers: *What should we do about it?*

## Required: Docker

The entire project must run via **Docker and Docker Compose**. A single `docker compose up` (or `docker compose up --build`) from the repo root should bring up every service — no manual local installs of Postgres, Node, Python, etc. required. Deliverables:

- A `Dockerfile` per service (backend API, frontend, blockchain/ledger service, and any worker processes)
- A root `docker-compose.yml` wiring together: backend API, frontend, PostgreSQL, the ledger/blockchain service, and Redis if used for queues/caching
- A `.env.example` with all required environment variables documented
- Named volumes for Postgres data and any ledger data so state persists across restarts
- Healthchecks on the backend and database services, with the frontend/backend depending on the DB being healthy before starting
- A short `README.md` explaining how to run everything with Docker (env setup, `docker compose up --build`, default ports, and default seed/demo login info)

## Suggested tech stack

Use your judgment, but a sensible default:

- **Backend**: Node.js + TypeScript (Express or Fastify), or Python (FastAPI) — pick one and be consistent
- **Database**: PostgreSQL (via Prisma/TypeORM if Node, or SQLAlchemy if Python)
- **Blockchain / ledger layer**: Don't stand up a full public blockchain. Implement a lightweight, self-hosted append-only hash-chained ledger service (each block contains: index, timestamp, data hash, previous block hash, block hash) exposed via a small internal API. This is enough to demonstrate tamper-evidence and immutability without the complexity of running a real chain node. If you'd rather use a real lightweight chain (e.g. a local Hardhat/Ganache Ethereum node with a simple smart contract for anchoring hashes), that's also acceptable — but containerize it and keep it simple. State clearly in the README which approach was taken and why.
- **Crypto**: Standard asymmetric keypairs (Ed25519 or ECDSA/secp256k1) for organization identities and digital signatures; SHA-256 for evidence hashing
- **Frontend**: React + TypeScript + Tailwind, served as its own container (Vite build + nginx, or Next.js)
- **AI/analysis layer**: A rule-based classifier is required as the baseline (map indicators/descriptions to attack type, MITRE ATT&CK technique, severity) — this must work with zero external dependencies. Optionally, add an LLM-backed enrichment step (e.g. via the Anthropic API) behind a feature flag/env var, so the demo still works offline/without an API key.
- **Realtime**: WebSockets (or Server-Sent Events) so the dashboard updates live when new reports/confirmations/campaign alerts come in

## Core data models

- **Organization**: id, name, type (bank/hospital/company/government/university/CERT), DID, public key, reputation score (0–100), reports count, confirmed count, accuracy %, created_at
- **KeyPair**: organization_id, public_key, encrypted_private_key (private key generation can happen client-side or server-side for the demo — document your choice and its tradeoffs in the README)
- **ThreatReport**: id, reporter_org_id, indicator (IP/domain/hash/URL), indicator_type, attack_type, MITRE technique, severity, description, evidence_file_hash, digital_signature, ai_confidence, status (reported/confirmed/disputed), blockchain_block_id, created_at
- **Confirmation**: id, threat_report_id, confirming_org_id, type (confirm/dispute), evidence_note, created_at
- **ThreatConfidenceScore**: threat_report_id, current score (0–100), computed from reporter reputation + evidence quality + independent confirmations + AI confidence + freshness − disputes; recompute on every new confirmation/dispute
- **Block** (ledger): index, timestamp, payload_hash, previous_hash, hash
- **Campaign**: id, name, related indicator IDs, related org IDs, common MITRE techniques, confidence, detected_at
- **AccessAttempt** (Zero-Trust simulation): user, org_id, ip, device_fingerprint, password_valid, computed risk factors (identity/device/location/IP-threat/behavior), total risk score, decision (allow/mfa/restrict/block), policy applied, created_at
- **SecurityPolicy**: org_id, threshold rules (e.g. "if threat confidence > 90% then block IP + terminate session + force MFA + alert admin"), stored as structured JSON so it's editable per org

## Required functional flows to implement end-to-end

1. **Organization onboarding**: sign up an org → generate DID + keypair → show public key, keep private key client-side (or securely handled) → org starts at reputation 100
2. **Report a threat**: form for indicator, type, attack description, severity, time, evidence file upload → backend runs rule-based (+ optional AI) analysis → evidence gets SHA-256 hashed → report gets signed with the reporting org's private key → verification data gets written to the ledger → report appears in the shared feed with reporter identity, reputation, "blockchain verified ✓", "signature valid ✓", "evidence integrity ✓"
3. **Confirm/dispute a threat**: any other org can view an existing report and click Confirm or Dispute → threat confidence recalculates live → status escalates (e.g. reported → confirmed → critical) as more orgs confirm
4. **Reputation engine**: reputation updates automatically as reports get confirmed or disputed over time; show the trend
5. **Tamper detection demo**: an endpoint/UI action to simulate evidence tampering (change the stored evidence, recompute hash, compare to ledger-anchored hash) and surface a clear "EVIDENCE TAMPERING DETECTED" state
6. **Zero-Trust access simulation**: a page/endpoint simulating a login/access attempt against a company's system, using an IP from the verified threat feed to show the risk engine scoring it and the policy engine acting on it (deny/MFA/allow) with a visible breakdown of the risk score components
7. **Threat feed API**: a `GET /threat-feed` style endpoint returning verified high-confidence indicators, mimicking what a browser extension/agent would poll — build this even if you don't build a full browser extension
8. **Campaign correlation**: when multiple related indicators/techniques cluster together (shared MITRE techniques, multiple orgs, temporal proximity), auto-create a Campaign record and surface it distinctly in the UI
9. **Dashboard**: network-wide view of live threat feed, org leaderboard by reputation, active campaigns, and a demo panel to walk through the Zero-Trust access flow

## Nice-to-have if time allows (lower priority — build the core flow first)

- A minimal browser-extension stub (Manifest V3) that polls `/threat-feed` and blocks navigation to known-malicious indicators, to make the "judges can see it happen live" moment work
- Seed/demo script that pre-populates several organizations, a sample attack scenario (Bank A → Hospital B → CERT C confirming the same IP), and a sample campaign, so the demo works immediately after `docker compose up`
- Simple auth (JWT) per organization account

## What to deliver

1. Full source code, organized by service (`/backend`, `/frontend`, `/ledger`, etc.)
2. `docker-compose.yml` + Dockerfiles + `.env.example`
3. A seed script producing realistic demo data (matching the Bank A / Hospital B / CERT C scenario above is a nice touch)
4. `README.md` covering: architecture overview (the three layers), setup/run instructions via Docker, environment variables, API summary, and a suggested demo script/walkthrough for presenting the prototype
5. Basic API tests for the core flows (report creation, signature verification, confirmation, threat confidence recalculation, ledger tamper detection)

## Build approach

Please work incrementally and confirm the plan before writing a large volume of code:

1. Propose the concrete architecture (service boundaries, folder structure, chosen stack) and data schema first
2. Scaffold the Docker/Compose setup early so the environment is runnable from the start
3. Build Layer 1 (identity, signatures, ledger, evidence hashing) end-to-end first, since everything else depends on it
4. Then Layer 2 (reports, confirmations, threat confidence, reputation, campaign correlation)
5. Then Layer 3 (Zero-Trust engine, policies, access simulation) and the threat-feed endpoint
6. Then the frontend dashboard tying it all together
7. Finish with the seed script, README, and basic tests

Ask clarifying questions only if something is genuinely ambiguous and would change the architecture significantly — otherwise make reasonable, documented assumptions and keep moving.
