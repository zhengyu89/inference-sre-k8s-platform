# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state (read this first)

`README.md` and `docs/Techinical_info.md` describe a full target platform (React dashboard, Node.js
inference API, Redis, PostgreSQL/Supabase, Kubernetes with Kustomize overlays, Helm, Argo CD,
Prometheus/Grafana, GitHub Actions). **Almost none of that exists yet.** The actual repo currently
contains only:

- `frontend/` — an untouched Vite + React + TypeScript starter template (default counter app).
- `backend/` — a single-file Express server (`backend/src/index.ts`) exposing one route, `GET /health`.
- `k8s/` and `.github/workflows/ci.yml` **do exist** (see "Kubernetes" below). There is still no
  top-level `helm/` or `monitoring/` directory — monitoring lives in `k8s/monitoring/`.
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

## Kubernetes (`k8s/`)

Target is a **kubeadm** cluster (3 nodes) with Argo CD; Docker Desktop is also used locally. Run
`kubectl` from the repo root. Full VM walkthrough: `docs/argocd-vm-deployment.md`; running notes:
`docs/k8s-progress.md`; post-mortems: `incidents/` (copy `000-incident-template*.md`).

### Layout
| Path | What it is |
|------|------------|
| `k8s/storage/` | Rancher local-path-provisioner v0.0.37 as a remote base (`github.com/rancher/local-path-provisioner/deploy?ref=v0.0.37`; needs github.com access when rendering) plus `storageclass.yaml` = StorageClass `standard` (same provisioner; Prometheus hard-codes this name). A patch marks `standard` as the **default**; upstream `local-path` stays non-default. `WaitForFirstConsumer`, reclaim `Delete`, data node-local under `/opt/local-path-provisioner`. **Deliberately NOT in base**: it has its own Argo CD Application (`k8s/argocd/application-storage.yaml`) so it syncs independently of the app — inside the app it would sync after the PreSync Postgres hook and deadlock on an unbound PVC. Apply that Application first. INC-001: `incidents/001-missing-pv.md`. |
| `k8s/base/` | Shared app manifests. `kustomization.yaml` includes `backend/ redis/ inference-worker/ frontend/ api-gateway/ networking/`. **`postgres/` is deliberately NOT in base** — overlays opt in. |
| `k8s/base/backend/` | `deployment.yaml` (`ivantan67/inference-sre-api:v2`, port 3000, `envFrom` ConfigMap `backend-config` + Secret `backend-db-secret`, readiness `/health/ready`, liveness+startup `/health`), `service.yaml` (ClusterIP 3000), `configmap.yaml` (PORT, REDIS_URL `redis://redis:6379`, WORKER_URL `http://inference-worker:8000`), `migrate-job.yaml` (runs `dist/db/migrate.js` with the same image; PreSync hook, wave -1, delete policy `BeforeHookCreation`, has a wait-for-postgres init container). |
| `k8s/base/frontend/` | Deployment (`ivantan67/inference-sre-frontend:v2`, port 80 named `http`, env `BACKEND_HOST=backend`, `BACKEND_PORT=3000`, `enableServiceLinks: false`) + ClusterIP Service :80. |
| `k8s/base/inference-worker/` | Deployment (`ivantan67/inference-sre-worker:v1`, port 8000 `http`, env `MODEL_NAME/MODEL_VERSION/WORKER_ID`, probes `/health/ready` and `/health/live`) + ClusterIP Service `http`:8000. |
| `k8s/base/redis/` | `redis:7-alpine` Deployment (`Recreate`, exec `redis-cli ping` probes, **no persistence/PVC**) + ClusterIP Service :6379. |
| `k8s/base/api-gateway/` | **Service only** (`api-gateway` :8000) whose selector is `app: frontend` — there is no api-gateway Deployment. |
| `k8s/base/networking/` | `backend-network-policy.yaml`: ingress to `app=backend` on TCP 3000 only from `app=frontend` pods. |
| `k8s/base/postgres/` | StatefulSet (`volumeClaimTemplate postgres-data`, 1Gi RWO, **no storageClassName** → needs a default StorageClass), headless Service, Secret `postgres-credentials`, Secret `backend-db-secret` (`DATABASE_URL`). Dev-only plaintext creds (`postgres/postgres`). |
| `k8s/components/monitoring/` | Kustomize `Component` with the `inference-worker` ServiceMonitor (`/metrics`, 15s). Needs the Prometheus Operator CRDs from `k8s/monitoring` first. (`k8s/components/kustomization.yaml` is an empty file.) |
| `k8s/overlays/dev`, `stag` | `../../base` + `../../base/postgres` + `components/monitoring`. Identical today. |
| `k8s/overlays/prod` | `../../base` + `sealed-secrets/` + `components/monitoring`; **no in-cluster Postgres** (external DB, e.g. Supabase). `sealed-secrets/` inflates the Bitnami sealed-secrets Helm chart 2.19.3 into `kube-system`; the real `backend-db-secret` must be a SealedSecret (see `backend-db-secret.example.yaml`). Needs `--enable-helm`. |
| `k8s/monitoring/` | Separate unit (own Argo CD Application): `namespace.yaml` + `kube-prometheus-stack` 90.0.0 via kustomize `helmCharts`. Control-plane scrapers and Alertmanager disabled, admission webhooks/TLS disabled, node-exporter + kube-state-metrics on, Prometheus 24h retention with a **5Gi PVC on StorageClass `standard`**, Grafana (`admin`/`admin123`, dev only, no persistence, startupProbe for slow boot). All `*SelectorNilUsesHelmValues: false` so hand-written ServiceMonitors are picked up. |
| `k8s/argocd/` | `application-storage.yaml` (name `storage`, path `k8s/storage`, namespace `local-path-storage`, automated prune+selfHeal), `application-dev.yaml` (name `inference-sre-platform-dev`, path `k8s/overlays/dev`, namespace `inference-sre-platform`, automated prune+selfHeal) and `application-monitoring.yaml` (path `k8s/monitoring`, namespace `monitoring`, `ServerSideApply=true`, ignores CRD `/status` + `/spec/preserveUnknownFields`). Both use repoURL `https://github.com/zhengyu89/inference-sre-k8s-platform.git`, `HEAD`. There is no Application for stag/prod. |

### Sync ordering (Argo CD)
Postgres resources are **PreSync hooks** so they exist before the migrate Job: Secrets, Service and
`backend-config` ConfigMap at wave **-3**, Postgres StatefulSet at **-2**, `backend-migrate` Job at **-1**.
Everything else syncs in the normal Sync phase after the Job succeeds.

### Commands
```bash
kubectl kustomize k8s/overlays/dev                                # render (add --enable-helm for prod/monitoring)
kubectl kustomize --enable-helm k8s/monitoring | kubectl apply --server-side -f -   # manual monitoring install
kubectl apply -f k8s/argocd/application-storage.yaml              # first: provisioner + default StorageClass
kubectl apply -f k8s/argocd/application-monitoring.yaml           # second
kubectl apply -f k8s/argocd/application-dev.yaml                  # last
```
Argo CD must allow the Helm inflator once per cluster: set `kustomize.buildOptions: --enable-helm`
in `argocd-cm` and restart `argocd-repo-server`.

### CI (`.github/workflows/ci.yml`)
Job `k8s-manifests` renders each target with `kubectl kustomize --enable-helm` and validates with
kubeconform (`-strict`, k8s 1.31.0, CRD catalog, missing schemas ignored). Matrix targets:
`overlays/dev`, `overlays/stag`, `overlays/prod`, `monitoring`, `storage`. A new Kustomize unit under
`k8s/` needs adding to that matrix.

### Gotchas
- Argo CD `--enable-helm` is a per-cluster prerequisite that is not in Git; PVCs stuck `Pending` mean
  no provisioner/StorageClass yet (see `k8s/storage/`).
- Images are pulled from Docker Hub (`ivantan67/...`, `imagePullPolicy: Always`); repos must be public.
- Plaintext dev credentials (Postgres, Grafana) are committed; do not reuse for anything reachable.

## Self-Maintenance Rule
After every major change (new model, new page, new controller, route changes, migration changes, new test files, architectural shifts), update this CLAUDE.md file to reflect the current state.