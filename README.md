# Records Management App

Web app for tracking document review records through intake, in-review, on-hold, and completed states. Built for role-based access across Analyst, Manager, Administrator, and Viewer users.

## Features

- **Records** — tabular document tracking with filters, saved views, and record detail sheets
- **My Snapshot** — personal workload summary (in-review, completed, on-hold)
- **Dashboard** — analytics charts for internal and external visibility
- **Audit Log** — change history for file records
- **Account** — signed-in user profile and settings
- Role-based sidebar navigation and permissions

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
├── src/
│   ├── api/              # API client
│   ├── auth/             # Auth context
│   ├── components/       # UI and feature components
│   ├── pages/            # Route pages
│   └── lib/              # Shared helpers (roles, filters, status)
└── public/
```

## Data

Local development data lives under `data/` (file records, users, audit log, saved views, and lookup tables). The Express server reads and writes these CSV files.

## License

Private project.
