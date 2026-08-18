# Setting up SIXSYNC on a new laptop

Full flow to clone this repo elsewhere and get a fully seeded demo (1000 IP reports across 26 Indian orgs) running.

## Prerequisites

- Docker + Docker Compose
- Git

## 1. Clone and check out the right branch

All current work (threat globe, threat-intel enrichment, confirmation history, score breakdown, campaign detail, search, bulk seed) lives on the `improvements` branch. Until it's merged into `main`, check it out explicitly:

```sh
git clone https://github.com/Kartikk1820/SIXSYNC.git
cd SIXSYNC
git checkout improvements
```

## 2. Configure environment

```sh
cp .env.example .env
```

`.env` is git-ignored on purpose — secrets never get committed. Fill in:

| Variable | What it's for |
|---|---|
| `ABUSEIPDB_API_KEY` | Free key from [abuseipdb.com](https://www.abuseipdb.com/) — powers real abuse-confidence scoring on IP/domain/URL reports |
| `ENABLE_TI_ENRICHMENT` | Set to `true` to turn on live AbuseIPDB + ip-api.com lookups. Leave `false` to run fully offline (reports still work, just no live abuse score/geolocation) |
| `ENABLE_LLM_ENRICHMENT` / `ANTHROPIC_API_KEY` | Optional — adds an LLM confidence pass to report classification. Leave off for a fully offline demo |

Everything else in `.env.example` (ports, JWT secret, Postgres credentials) works out of the box for local use.

## 3. Bring the stack up

```sh
docker compose up --build -d
```

This builds and starts four containers: `postgres`, `ledger`, `backend`, `frontend`. On first boot the backend automatically runs Prisma migrations and the base seed script — 5 organizations, 3 confirmed/critical phishing reports, 1 campaign (see main `README.md` for that walkthrough).

Check everything's healthy:

```sh
docker compose ps
```

- Frontend: http://localhost:3200 (or whatever `FRONTEND_HOST_PORT` you set)
- Backend API: http://localhost:4200

## 4. Run the bulk seed (1000 IP reports, 26 Indian orgs)

The base seed only gives you 5 orgs and a handful of reports — good for a scripted walkthrough, thin for a live "look how much data this handles" demo. Run the bulk seed on top of it:

```sh
docker compose exec backend npm run seed:bulk
```

This creates:
- 26 additional organizations (ICICI Bank, State Bank of India, HDFC Bank, Axis Bank, Punjab National Bank, Bank of Baroda, Kotak Mahindra Bank, AIIMS Delhi, Apollo Hospitals, Fortis Healthcare, Max Healthcare, NPCI, UIDAI, Ministry of Electronics & IT, Income Tax Department, IIT Delhi/Bombay/Madras, IISc Bangalore, Infosys, TCS, Wipro, HCL Technologies, Reliance Jio, CERT-In, NCIIPC)
- 1000 IP threat reports, geolocated worldwide, spread across the last 30 days, with realistic MITRE technique variety (phishing, ransomware, C2, brute force, DDoS, recon, exploitation, malware)
- A realistic mix of confirmations/disputes, producing a spread of REPORTED / CONFIRMED / CRITICAL / DISPUTED statuses
- Auto-detected campaigns (one per MITRE technique typically appears, given the volume)

Takes a few minutes — each report is anchored to the ledger sequentially (one block per report, by design — see main `README.md`'s "key design choices" section), so this can't be parallelized.

**It's safe to re-run.** The script checks for an org named "ICICI Bank" first and skips entirely if it already exists, so running it twice never double-seeds.

Demo login for every bulk-seeded org (same as the base seed):

```
password: sixsync-demo-2026
```

Emails follow the pattern `soc@icicibank.demo`, `cybercell@sbi.demo`, `infosec@hdfcbank.demo`, etc. — see `backend/prisma/seedBulk.ts` for the full org→email list.

## 5. Resetting everything

```sh
docker compose down -v   # drops the Postgres and ledger volumes — wipes ALL data
docker compose up --build -d
docker compose exec backend npm run seed:bulk
```

## Troubleshooting

- **Ports already in use**: override the `*_HOST_PORT` variables in `.env` (internal container ports stay fixed, so services still talk to each other regardless).
- **Bulk seed says "already exists, skipping"**: it already ran against this database. Use the reset flow above if you want a fresh run.
- **No abuse scores / no geolocation showing up**: check `ENABLE_TI_ENRICHMENT=true` and a valid `ABUSEIPDB_API_KEY` are set in `.env`, then restart the backend: `docker compose up -d backend`.
