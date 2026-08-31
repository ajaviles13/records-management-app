# Records Management App

Web app for tracking document review records through intake, in-review, on-hold, and completed states. Built for role-based access across Analyst, Manager, Administrator, and Viewer users.

## Features

- **Records** — tabular document tracking with column filters, saved views, pagination, CSV/Excel export, and a centered modal record editor opened from a pinned pencil column
- **My Snapshot** — workload summary with a date-range filter, clickable metrics that deep-link into filtered Records, and a stacked SLA met/missed bar chart
- **Configure** — Users (add and remove users, Manager and Administrator) and Connectors (Egnyte credentials, Administrator only)
- **Dashboard** — analytics charts for internal and external visibility
- **Audit Log** — change history for file records
- **Account** — signed-in user profile and settings
- Role-based navigation and permissions, enforced in the UI and again on the server
- Saved views shareable with individual users or whole roles, read-only for recipients

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Radix UI |
| Backend | Express API (local CSV store for development) |
| Routing | React Router |
| Charts | Recharts |

## Getting started

### Prerequisites

- Node.js 20+ recommended
- npm

### Install

```bash
npm install
```

### Run (API + web)

```bash
npm run dev
```

This starts the Express API and the Vite frontend together.

- Web: [http://localhost:5173](http://localhost:5173)
- API: served on the local Express port configured in `server/index.ts`

### Other scripts

```bash
npm run build    # production build
npm run preview  # preview production build
```

### Checks

```bash
npx tsc -b --force                      # typecheck
npx tsx scripts/navContract.test.ts     # deep-link and date-range contract
bash scripts/rbac-smoke.sh              # server-side role enforcement (needs npm run dev)
```

`rbac-smoke.sh` writes to `data/`. Run `git checkout -- data/` afterwards to discard the
test users and record edits it creates.

## Demo login

Use any of the seeded test emails with password `password`:

| Email | Role |
| --- | --- |
| `analyst1-test@test.com` | Analyst |
| `analyst2-test@test.com` | Analyst |
| `manager-test@test.com` | Manager |
| `administrator-test@test.com` | Administrator |
| `viewer-test@test.com` | Viewer |

## Project structure

```
├── data/                 # CSV-backed local data store
├── server/               # Express API + CSV persistence
├── scripts/              # Typecheck-adjacent smoke tests
├── src/
│   ├── api/              # API client
│   ├── auth/             # Auth context
│   ├── components/       # UI and feature components
│   ├── pages/            # Route pages
│   └── lib/              # Shared helpers (roles, filters, status, dates, export)
├── 0_Knowledge_Store/    # Design and architecture notes
└── public/
```

## Data

Local development data lives under `data/` (file records, users, audit log, saved views, and lookup tables). The Express server reads and writes these CSV files.

Authorization is enforced server-side. The API resolves the acting user from an
`x-user-id` header against `data/sla-users.csv` and never trusts a client-supplied role.
This is a development stand-in for a real auth provider.

## Environment

The Egnyte connector on Configure > Connectors writes `EGNYTE_CLIENT_ID` and
`EGNYTE_CLIENT_SECRET` to a gitignored `.env` (see `.env.example`). This is a local-first
placeholder; nothing consumes the credentials yet. In production they belong in AWS Systems
Manager Parameter Store, read by backend Lambdas, and are never served to the browser.

## Documentation

Design notes live in `0_Knowledge_Store/WebApp/`:

| Document | Covers |
| --- | --- |
| `RBAC_Matrix.md` | Roles, tab visibility, capabilities, user-administration hierarchy |
| `Data_Model.md` | CSV schemas, derived fields, date and boolean quirks |
| `Records_UX.md` | Pencil editing, modal, pagination, export, deep-link contract |
| `My_Snapshot.md` | Scope by role, date filter, metric links, SLA chart bucketing |
| `SavedViews_Inheritance.md` | Sharing views with users and roles, read-only rules |
| `Connectors_Egnyte.md` | Connector placeholder and the production design |

## License

Private project.
