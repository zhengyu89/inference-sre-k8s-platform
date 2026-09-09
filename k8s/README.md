# Kubernetes manifests (minimal)

Flat manifests, no Kustomize/Helm yet — enough to deploy the current
frontend ↔ backend ↔ Postgres/Redis connectivity check to a cluster.
Kustomize overlays, Helm charts, Ingress, HPA, NetworkPolicies, and
Prometheus/Grafana are the roadmap described in the root `README.md`, not
implemented here.

There's no container registry or CI wired up yet, so these reference
locally built images (`imagePullPolicy: IfNotPresent`). For a local cluster
(kind/minikube):

```bash
# Build the images (same Dockerfiles docker-compose uses)
docker build -t inference-sre-backend:local -f backend/docker/Dockerfile backend
docker build -t inference-sre-frontend:local -f frontend/docker/Dockerfile frontend

# Load them into the cluster
kind load docker-image inference-sre-backend:local inference-sre-frontend:local
# or: minikube image load inference-sre-backend:local inference-sre-frontend:local

# Apply the manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -n inference-sre -f k8s/postgres.yaml -f k8s/redis.yaml -f k8s/backend.yaml -f k8s/frontend.yaml

# Wait for everything to come up
kubectl -n inference-sre get pods -w
```

Then reach the dashboard at `http://<node-ip>:30080` (with kind:
`http://localhost:30080` if the node port was mapped in the cluster
config, otherwise `kubectl -n inference-sre port-forward svc/frontend 8080:80`).

## Verifying connectivity

```bash
kubectl -n inference-sre port-forward svc/backend 3000:3000 &
curl http://localhost:3000/health/ready
# {"status":"ok","postgres":"ok","redis":"ok"}
```

The frontend polls this same check (proxied through nginx at `/api/health/ready`)
and shows live connection status for the backend, Postgres, and Redis.
