# Inference SRE K8s Platform

A cloud-native inference reliability and observability platform built to showcase Kubernetes, GitOps, SRE, and AI platform engineering practices.

The project simulates an AI inference service running on Kubernetes and provides a React-based dashboard for monitoring service health, throughput, latency, error rate, queue depth, replica count, and model version.

The application uses synthetic inference workloads and does not contain proprietary infrastructure, internal operational data, customer information, or confidential information from any employer.

## Project Goal

The main purpose of this project is to demonstrate production-style Kubernetes and platform engineering practices around an AI inference workload.

The AI workload itself is intentionally lightweight and CPU-based so that the focus remains on:

* Kubernetes deployment and networking
* Service reliability
* Autoscaling
* GitOps
* CI/CD
* Observability
* Persistent storage
* Environment management
* Application and infrastructure metrics

## Application Overview

Users can generate synthetic inference requests and observe how the platform behaves under different levels of traffic.

The dashboard displays:

* Requests per second
* P50 / P95 / P99 inference latency
* Successful requests
* Failed requests
* Error rate
* Queue depth
* Active backend replicas
* CPU and memory utilization
* Current model version
* Service health
* Recent inference activity

The application can also generate artificial load so Kubernetes autoscaling behavior can be demonstrated.

## High-Level Architecture

```text
User
 │
 ▼
React Frontend
Deployment
 │
ClusterIP Service
 │
 ▼
Node.js Inference API
Deployment
 │
 ├── Redis
 │    ├── request queue simulation
 │    ├── counters
 │    └── short-lived cache
 │
 └── PostgreSQL
      ├── inference history
      ├── model versions
      └── service events
```

Development and staging environments use PostgreSQL deployed as a Kubernetes StatefulSet with persistent storage.

Production uses an external Supabase PostgreSQL database.

## Kubernetes Architecture

```text
                    NodePort / Ingress
                           │
                           ▼
                    React Frontend
                      Deployment
                           │
                     ClusterIP
                           │
                           ▼
                    Node.js Backend
                      Deployment
                       │       │
                       │       │
                       ▼       ▼
                    Redis   PostgreSQL
                            StatefulSet
                              │
                              ▼
                             PVC
                              │
                              ▼
                              PV
```

Production replaces the internal PostgreSQL workload with Supabase.

## Technology Stack

### Frontend

* React
* TypeScript
* Vite

### Backend

* Node.js
* Express
* TypeScript

### Data

* PostgreSQL
* Supabase PostgreSQL for production
* Redis

### Platform

* Docker
* Kubernetes
* Kustomize
* Helm
* Argo CD
* GitHub Actions

### Observability

* Prometheus
* Grafana

## Kubernetes Features Demonstrated

This project is designed to showcase:

* React frontend and Node.js backend deployed as separate workloads
* ClusterIP Services for internal application communication
* NodePort exposure for local or development environments
* Kustomize base and overlays for:

  * development
  * staging
  * production
* ConfigMaps for environment configuration
* Secrets for credentials and sensitive configuration
* Redis deployment
* PostgreSQL StatefulSet
* PersistentVolume and PersistentVolumeClaim
* External Supabase database for production
* Ingress and egress NetworkPolicies
* Readiness probes
* Liveness probes
* Resource requests and limits
* Horizontal Pod Autoscaler
* Rolling updates
* Workload recovery and self-healing
* Helm-based dependency deployment
* GitHub Actions continuous integration
* Argo CD GitOps deployment
* Prometheus metrics collection
* Grafana dashboards

## Environment Strategy

### Development

```text
Frontend:     1 replica
Backend:      1 replica
Exposure:     NodePort
Database:     PostgreSQL StatefulSet
Redis:        Local Kubernetes deployment
Monitoring:   Optional / lightweight
```

### Staging

```text
Frontend:     2 replicas
Backend:      2 replicas
Database:     PostgreSQL StatefulSet + PV/PVC
Redis:        Enabled
Prometheus:   Enabled
Grafana:      Enabled
NetworkPolicy Enabled
```

### Production

```text
Frontend:     Multiple replicas
Backend:      Multiple replicas
Backend HPA:  Enabled
Database:     Supabase PostgreSQL
Redis:        Enabled
Prometheus:   Enabled
Grafana:      Enabled
NetworkPolicy Strict
GitOps:       Argo CD
```

## Simulated Inference API

The backend simulates AI inference requests without requiring a GPU or heavyweight model.

Example request:

```json
{
  "model": "classifier-v1",
  "input": "example inference payload"
}
```

Example response:

```json
{
  "requestId": "req-10428",
  "model": "classifier-v1",
  "latencyMs": 42,
  "status": "success"
}
```

The backend can intentionally introduce configurable latency or failures so reliability scenarios can be demonstrated.

## SRE Metrics

The application exposes metrics such as:

```text
inference_requests_total
inference_success_total
inference_errors_total
inference_request_duration_seconds
inference_queue_depth
model_version_info
redis_cache_hits_total
redis_cache_misses_total
```

Prometheus collects these metrics and Grafana visualizes them.

This allows the project to demonstrate both application-level and infrastructure-level observability.

## Example SRE Scenarios

The platform can be used to demonstrate:

### Traffic Spike

```text
Normal Traffic
      ↓
Traffic Generator
      ↓
CPU Usage Increases
      ↓
HPA Triggered
      ↓
2 Pods → 5 Pods
      ↓
Traffic Stabilizes
```

### Backend Failure

```text
Backend Pod Deleted
      ↓
Kubernetes Detects Failure
      ↓
Replacement Pod Created
      ↓
Service Recovers
```

### Deployment

```text
Git Commit
    ↓
GitHub Actions
    ↓
Docker Image Build
    ↓
Container Registry
    ↓
GitOps Repository
    ↓
Argo CD
    ↓
Kubernetes Rolling Update
```

## CI/CD and GitOps

```text
Developer
   │
   ▼
GitHub
   │
   ▼
GitHub Actions
   │
   ├── Test
   ├── Lint
   ├── Build
   └── Push Docker Image
               │
               ▼
        Container Registry

GitOps Repository
       │
       ▼
     Argo CD
       │
       ▼
    Kustomize
       │
 ┌─────┼─────┐
 ▼     ▼     ▼
Dev  Staging Prod
       │
       ▼
   Kubernetes
```

## Repository Structure

```text
inference-sre-k8s-platform/
│
├── frontend/
│
├── backend/
│
├── k8s/
│   ├── base/
│   └── overlays/
│       ├── dev/
│       ├── staging/
│       └── prod/
│
├── helm/
│
├── monitoring/
│   ├── prometheus/
│   └── grafana/
│
├── .github/
│   └── workflows/
│
└── README.md
```

## Why This Project Exists

This project is not intended to provide a production AI model or replicate any proprietary AI infrastructure.

The inference workload is intentionally synthetic and CPU-based.

Its purpose is to provide a realistic workload for demonstrating how AI services can be deployed, scaled, secured, monitored, and operated using Kubernetes and modern platform engineering practices.

The main engineering focus is:

**Kubernetes, SRE, GitOps, CI/CD, observability, networking, scalability, reliability, and AI platform operations.**
