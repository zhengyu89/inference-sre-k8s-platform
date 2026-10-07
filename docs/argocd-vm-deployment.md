# Hosting the platform on a VM cluster with Argo CD

Step-by-step guide to deploy this project onto an existing kubeadm Kubernetes cluster running on VMs, with
Argo CD deploying the app and the monitoring stack from this Git repo.

> This guide was written from the manifests in `k8s/`. The commands have not been run end-to-end on your
> cluster yet, so treat the first run as a shakedown and fix anything that differs.

## What you end up with

```text
GitHub repo (source of truth)
      │  Argo CD polls every ~3 min
      ▼
┌────────────────────── Kubernetes cluster (kubeadm) ───────────────────┐
│  argocd ns        Argo CD                                             │
│  monitoring ns    kube-prometheus-stack  (Prometheus, Grafana, ...)   │
│  inference-sre-platform ns                                            │
│      frontend ─► backend ─► inference-worker                          │
│                    ├─► redis                                          │
│                    └─► postgres (StatefulSet + PVC)                   │
└───────────────────────────────────────────────────────────────────────┘
```

Three Argo CD Applications drive it, both defined in [`k8s/argocd/`](../k8s/argocd/):

| Application | Path in repo | Namespace |
| --- | --- | --- |
| `storage` | `k8s/storage` | `local-path-storage` |
| `monitoring` | `k8s/monitoring` | `monitoring` |
| `inference-sre-platform-dev` | `k8s/overlays/dev` | `inference-sre-platform` |

There is no Application for `stag` or `prod` yet (see [Prod](#prod-is-not-ready-for-this-path)).

## 0. Before you start

### How many nodes

| Layout | Nodes | Per-node size | When to use |
| --- | --- | --- | --- |
| **Recommended** | **3** = 1 control plane + 2 workers | control plane 2 vCPU / 4 GB; each worker 2 vCPU / 4 GB | Full demo: HPA scale-out, deleting a pod and watching it reschedule, rolling updates visible across nodes |
| **Minimum** | **2** = 1 control plane + 1 worker | control plane 2 vCPU / 4 GB; worker **4 vCPU / 8 GB** | App + monitoring fit, but there is nowhere for replicas to spread |
| Single node | 1 | 4 vCPU / 8 GB | Only if you remove the control-plane taint so workloads can schedule on it. Not recommended. |

Why the sizes: the monitoring stack is the heavy part (Prometheus alone requests 512 Mi and
is limited to 1 Gi, plus Grafana, node-exporter, kube-state-metrics and the operator), on top of Postgres,
Redis, backend, frontend and the worker.

Storage note: Postgres and Prometheus use node-local volumes, so each one is tied to the node it first
landed on. If that node is lost, its data goes with it. That is acceptable for this demo.

### Cluster checklist

Run these from the machine where `kubectl` is configured (usually the control-plane node):

```bash
kubectl get nodes -o wide              # every node Ready
kubectl -n kube-system get pods        # CoreDNS and the CNI pods Running
kubectl get storageclass
```

- [ ] **All nodes `Ready`**, with a working CNI. Pods on different nodes must be able to reach each other.
- [ ] **A default StorageClass.** The Postgres `volumeClaimTemplate` sets no `storageClassName`, so without
      a default its PVC stays `Pending` forever.
- [ ] **A StorageClass named exactly `standard`.** [`k8s/monitoring/kustomization.yaml`](../k8s/monitoring/kustomization.yaml)
      hard-codes `storageClassName: standard` for Prometheus's 5 Gi volume. kubeadm clusters do not create
      one (minikube and kind do). If yours is named differently, either create a `standard` class or change
      that line and push. One class can be both default and `standard`.
      Don't have either? The `storage` Application ([`k8s/storage/`](../k8s/storage/kustomization.yaml)) installs
      the local-path provisioner with a default `standard` class. You deploy it first in step 5.
- [ ] **Outbound internet from the nodes** to github.com, Docker Hub, `quay.io`, `ghcr.io` and
      `prometheus-community.github.io`.
- [ ] **Repo pushed to GitHub** with the `k8s/` directory committed and CI green (see
      [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)). Argo CD deploys what is in Git, not what is
      on your laptop.
- [ ] **Repo URL is yours.** All Application files point at
      `https://github.com/zhengyu89/inference-sre-k8s-platform.git`. If your repo lives somewhere else,
      change `repoURL` in [`application-dev.yaml`](../k8s/argocd/application-dev.yaml) and
      [`application-monitoring.yaml`](../k8s/argocd/application-monitoring.yaml) (and
      [`application-storage.yaml`](../k8s/argocd/application-storage.yaml)) and push **before** step 5.
- [ ] **Images are pullable.** The manifests pull `ivantan67/inference-sre-api:v2`,
      `inference-sre-frontend:v2` and `inference-sre-worker:v1` from Docker Hub. The repos must be public, or
      you must add an `imagePullSecret`.
- [ ] If the GitHub repo is **private**, Argo CD needs credentials (see step 4).

Optional for later: `metrics-server`, which the Horizontal Pod Autoscaler needs. Nothing in this guide
depends on it.

## 1. Install Argo CD

`--server-side` matters: some Argo CD CRDs are too large for client-side `kubectl apply`.

```bash
kubectl create namespace argocd
kubectl apply -n argocd --server-side --force-conflicts \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

kubectl -n argocd rollout status deploy/argocd-server
kubectl -n argocd get pods             # all Running
```

## 2. Allow Helm through Kustomize (once per cluster)

`k8s/monitoring/` inflates a Helm chart through Kustomize's `helmCharts:`. Argo CD refuses that unless it is
told to pass `--enable-helm`. Without this step the `monitoring` Application fails with
`must specify --enable-helm`.

```bash
kubectl -n argocd patch cm argocd-cm --type merge \
  -p '{"data":{"kustomize.buildOptions":"--enable-helm"}}'
kubectl -n argocd rollout restart deploy/argocd-repo-server
kubectl -n argocd rollout status deploy/argocd-repo-server
```

## 3. Open the Argo CD UI and log in

Keep Argo CD off the public internet and reach it through an SSH tunnel.

On the machine with `kubectl`:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

On your laptop, in a second terminal:

```bash
ssh -L 8080:localhost:8080 <user>@<control-plane-ip>
```

Open <https://localhost:8080>, accept the self-signed certificate, log in as `admin` with the password above,
then change it (**User Info → Update Password**).

## 4. Private repo only: give Argo CD read access

*Settings → Repositories → Connect Repo*, choose HTTPS, and use a GitHub fine-grained token with read-only
**Contents** access to this one repository. Skip this step for a public repo.

## 5. Deploy storage, then monitoring

Storage goes first. It is its own Application rather than part of the app, because the app's Postgres
PreSync hook needs a bound PVC before Argo CD will continue — a provisioner inside the same Application
would sync too late and deadlock.

```bash
git clone <your-repo-url> && cd inference-sre-k8s-platform
kubectl apply -f k8s/argocd/application-storage.yaml
kubectl get sc                          # `standard` (default) and `local-path` appear
```

Then monitoring. Monitoring must sync **before** the app. It owns the `ServiceMonitor` CRD that the app overlay's
`components/monitoring` depends on.

```bash
kubectl apply -f k8s/argocd/application-monitoring.yaml
```

Then watch it:

```bash
kubectl -n argocd get applications -w
kubectl -n monitoring get pods -w
kubectl -n monitoring get pvc          # Prometheus volume must become Bound
```

Wait for `monitoring` to show **Synced / Healthy**. The first sync pulls about 15 MB of CRDs plus several
images, so allow 5–10 minutes. Grafana is slow to boot; the repo already gives it a `startupProbe` with a
300 s budget (the change in `k8s/monitoring/kustomization.yaml`, which must be committed and pushed).

## 6. Deploy the app

```bash
kubectl apply -f k8s/argocd/application-dev.yaml
kubectl -n argocd get applications -w
```

What Argo CD does, in order (PreSync hooks, by sync-wave):

1. **wave -3:** `postgres-credentials`, `backend-db-secret`, `backend-config`, plus the Postgres Service.
2. **wave -2:** the Postgres StatefulSet (its PVC comes from your default StorageClass).
3. **wave -1:** the `backend-migrate` Job waits for Postgres, then runs the SQL migration.
4. **Sync phase:** backend, frontend, inference-worker, Redis, api-gateway, NetworkPolicy, ServiceMonitor.

If the migration Job fails, nothing after it is applied. That is by design.

## 7. Verify

```bash
kubectl -n inference-sre-platform get pods -o wide   # note which nodes they landed on
kubectl -n inference-sre-platform get pvc            # postgres-data-postgres-0  Bound
kubectl -n inference-sre-platform logs job/backend-migrate
kubectl -n argocd get applications                   # both Synced / Healthy
```

All pods should reach `Running` / `1/1`.

## 8. Reach the app, Grafana and Prometheus

Every Service here is `ClusterIP`, so use port-forwards over the SSH tunnel.

```bash
# on the machine with kubectl (each in its own terminal, or use tmux)
kubectl -n inference-sre-platform port-forward svc/api-gateway 8000:8000
kubectl -n monitoring port-forward svc/monitoring-grafana 3000:80
kubectl -n monitoring port-forward svc/monitoring-kube-prometheus-prometheus 9090:9090
```

```bash
# on your laptop
ssh -L 8000:localhost:8000 -L 3000:localhost:3000 -L 9090:localhost:9090 <user>@<control-plane-ip>
```

| What | URL | Notes |
| --- | --- | --- |
| App | <http://localhost:8000> | `api-gateway` → frontend nginx → `/api/` → backend → worker |
| Grafana | <http://localhost:3000> | `admin` / `admin123` (dev-only value in the repo) |
| Prometheus | <http://localhost:9090> | **Status → Targets**: the `inference-worker` target should be UP |

Smoke test: open the app, submit an inference request, confirm it appears in the request history, then look at
the worker metrics in Grafana.

### Serving it to the public internet (later)

The repo has no Ingress and the Services are `ClusterIP`. If you want a public URL, add an Ingress controller
and an Ingress **in Git**, not with `kubectl`. Argo CD has `selfHeal: true` and will revert any manual change,
such as patching the Service to `NodePort`, within minutes.

## 9. Day-2: how changes flow

- **Manifest change:** edit under `k8s/`, let CI pass, merge to `main`. Argo CD detects it on its next poll
  (about 3 min) and syncs. `prune: true` deletes resources you removed from Git.
- **Manual `kubectl edit`:** reverted by `selfHeal`. That is the point.
- **New application image:** the manifests use mutable tags (`:v2`) with `imagePullPolicy: Always`. If you
  re-push the same tag, **Argo CD sees no Git change and does nothing**. Either bump the tag in the manifest
  (preferred, and it shows in Git history) or force a restart:
  ```bash
  kubectl -n inference-sre-platform rollout restart deploy/backend
  ```
- **Rollback:** revert the commit in Git, or use *History and Rollback* in the Argo CD UI (auto-sync must be
  paused for the UI rollback to stick).

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `monitoring` fails with `must specify --enable-helm` | Step 2 not done, or `argocd-repo-server` not restarted afterwards. |
| `monitoring` stuck OutOfSync on CRDs | Missing `ServerSideApply=true`. It is set in the Application; confirm you applied the file from this repo. |
| `prometheus-monitoring-...-0` Pending, PVC Pending | No StorageClass named `standard` (see the cluster checklist). `kubectl get sc`, then create it or change `storageClassName` in `k8s/monitoring/kustomization.yaml`. |
| `postgres-0` Pending | No **default** StorageClass, or the node disk is full. `kubectl describe pvc postgres-data-postgres-0`. |
| App is `OutOfSync` / `SyncFailed` on `ServiceMonitor` | `monitoring` has not finished syncing, so the CRD is missing. Wait for it to be Healthy, then re-sync the app. |
| Sync hangs at PreSync | `kubectl -n inference-sre-platform get job,pod`; check `logs job/backend-migrate` and that `postgres-0` is Running. |
| `ImagePullBackOff` | Docker Hub repo is private or the tag does not exist. |
| Grafana in CrashLoopBackOff | Slow boot killed by the liveness probe. Make sure the `startupProbe` change is committed and pushed. |
| Pods `Pending`, `Insufficient cpu/memory` | Nodes too small. See the sizing table, or lower Prometheus/Grafana requests in `k8s/monitoring/kustomization.yaml`. |
| Pods on different nodes cannot talk to each other | CNI problem, not an app problem. Check the CNI pods in `kube-system` and that the pod CIDR matches what the cluster was initialised with. |
| Application shows `ComparisonError` | Open it in the UI and read the message; it is usually an invalid manifest. CI (`kubeconform`) is meant to catch these first. |
| `repository not found` | `repoURL` is wrong, or the repo is private and no credentials were added (step 4). |

Useful commands:

```bash
kubectl -n argocd get applications
kubectl -n argocd describe application inference-sre-platform-dev
kubectl -n argocd logs deploy/argocd-repo-server --tail=100     # render/Helm errors
kubectl -n inference-sre-platform get events --sort-by=.lastTimestamp | tail -20
```

## Security notes

- The committed dev credentials (`postgres/postgres`, Grafana `admin/admin123`) are for a throwaway cluster
  only. Change the Argo CD admin password immediately, and do not reuse any of these anywhere real.
- Keep Argo CD, Grafana and Prometheus off the public internet. Use the SSH tunnel above.
- Do not commit real secrets. For anything beyond a demo, use Sealed Secrets (see below).

## Prod is not ready for this path

`k8s/overlays/prod` expects an external Supabase Postgres and a `SealedSecret` for `backend-db-secret`. Only
[`backend-db-secret.example.yaml`](../k8s/overlays/prod/backend-db-secret.example.yaml) exists, so a prod
Application would deploy a backend with no database URL. To get there:

1. Deploy the prod overlay once so the Sealed Secrets controller is running (it renders from
   `overlays/prod/sealed-secrets/`).
2. Seal your Supabase connection string with `kubeseal` following the example file, and commit the
   `SealedSecret` into the prod overlay.
3. Add `k8s/argocd/application-prod.yaml`, modelled on `application-dev.yaml` with `path: k8s/overlays/prod`.

Staging works the same way as dev: copy `application-dev.yaml`, set `path: k8s/overlays/stag` and a different
destination namespace.

## Clean up

```bash
# The Application manifests have no `resources-finalizer.argocd.argoproj.io` finalizer, so a plain
# `kubectl delete` removes only the Application and leaves its workloads running. Delete the
# workloads' namespaces too, or add the finalizer to the Applications first.
kubectl delete -f k8s/argocd/application-dev.yaml
kubectl delete -f k8s/argocd/application-monitoring.yaml
kubectl delete -f k8s/argocd/application-storage.yaml   # only once no PVCs use it
kubectl delete namespace inference-sre-platform monitoring
```

Deleting a namespace deletes its PVCs, which wipes the Postgres and Prometheus data if the StorageClass reclaim policy is `Delete` (the usual default).
