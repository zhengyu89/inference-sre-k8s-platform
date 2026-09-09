# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state (read this first)

`README.md` and `docs/Techinical_info.md` describe a full target platform (React dashboard, Node.js
inference API, Redis, PostgreSQL/Supabase, Kubernetes with Kustomize overlays, Helm, Argo CD,
Prometheus/Grafana, GitHub Actions). **Almost none of that exists yet.** The actual repo currently
contains only:

- `frontend/` — an untouched Vite + React + TypeScript starter template (default counter app).
- `backend/` — a single-file Express server (`backend/src/index.ts`) exposing one route, `GET /health`.
- No `k8s/`, `helm/`, `monitoring/`, or `.github/workflows/` directories yet, despite being documented
  in the README as the project layout.
- No database, Redis, metrics, or `/api/v1/*` routes implemented yet.

Treat `README.md` and `docs/Techinical_info.md` as the design/roadmap doc, not a description of
current code. When asked to implement a feature, check whether it already exists before assuming it
does — the docs describe the intended end state.

## Commands

There is no root-level workspace config — `frontend/` and `backend/` are independent npm packages.
Run commands from inside each directory.

### Frontend (`frontend/`)
```bash
npm install
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # oxlint (NOT eslint — config in .oxlintrc.json)
npm run preview   # preview the production build
```
No test script/framework is configured yet.

### Backend (`backend/`)
```bash
npm install
npm run dev       # tsx watch src/index.ts — http://localhost:3000 (PORT env overrides)
npm run build     # tsc -> dist/
npm run start     # node dist/index.js
```
`npm test` is a placeholder that exits with an error — there is no test framework wired up yet. Don't
assume a test runner exists; ask before adding one.

## Architecture notes

- **Backend** is ESM (`"type": "module"`) TypeScript, `module`/`moduleResolution: nodenext`, strict
  mode, targeting es2022. Entry point is `backend/src/index.ts`; everything currently lives in that
  one file. The documented route/module layout (`routes/`, `controllers/`, `services/`,
  `repositories/`, `middleware/`, `metrics/`, `health/`, `config/`) is aspirational, not present.
- **Frontend** is React 19 + Vite 8 + TypeScript, still the generated starter (`App.tsx`, default
  assets). Linting uses `oxlint` (plugins: react, typescript, oxc), not ESLint.
- `backend/.env`, `frontend/.env`, and `model/.env` currently exist but are empty placeholders.
- The docs describe an intended data model (`inference_requests`, `model_versions`,
  `service_events` tables; Redis keys like `inference:queue:depth`) and Prometheus metric names
  (`inference_requests_total`, `inference_request_duration_seconds`, etc.) — useful as a naming
  reference when actually building these, but none of it is implemented.
