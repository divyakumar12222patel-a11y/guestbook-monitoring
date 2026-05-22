# Guestbook Monitoring Stack

Production-quality Kubernetes Guestbook application with full Prometheus + Grafana observability, deployed via Pulumi TypeScript on a local kind cluster.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        kind Cluster                                  │
│                                                                     │
│  Namespace: guestbook                 Namespace: monitoring          │
│  ┌────────────────────────┐          ┌───────────────────────────┐  │
│  │  Frontend (2 replicas) │          │  kube-prometheus-stack    │  │
│  │  NodePort: 30080       │          │  ┌─────────────────────┐  │  │
│  │                        │          │  │  Prometheus          │  │  │
│  │  Redis Master (1)      │          │  │  NodePort: 30090    │  │  │
│  │  + redis-exporter      │──────────│  └─────────────────────┘  │  │
│  │                        │  scrape  │  ┌─────────────────────┐  │  │
│  │  Redis Follower (2)    │          │  │  Grafana            │  │  │
│  │  + redis-exporter      │          │  │  NodePort: 30300    │  │  │
│  └────────────────────────┘          │  └─────────────────────┘  │  │
│                                      │  ┌─────────────────────┐  │  │
│                                      │  │  Alertmanager       │  │  │
│                                      │  │  node-exporter      │  │  │
│                                      │  │  kube-state-metrics │  │  │
│                                      │  └─────────────────────┘  │  │
│                                      └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

Host Machine:
  http://localhost:30080  →  Guestbook App
  http://localhost:30090  →  Prometheus
  http://localhost:30300  →  Grafana
```

## Prerequisites

| Tool       | Version   | Install                              |
|------------|-----------|--------------------------------------|
| Docker     | >= 20.x   | [Docker Desktop](https://docker.com) |
| kubectl    | >= 1.28   | `brew install kubectl`               |
| Pulumi     | >= 3.x    | `brew install pulumi`                |
| Helm       | >= 3.x    | `brew install helm`                  |
| kind       | >= 0.20   | `brew install kind`                  |
| Node.js    | >= 20.x   | `brew install node`                  |
| Git        | >= 2.x    | `brew install git`                   |

## Quick Start (One Command)

```bash
git clone https://github.com/divyakumar12222patel-a11y/guestbook-monitoring.git
cd guestbook-monitoring
make bootstrap
```

This single command will:
1. Verify all prerequisites
2. Create a kind Kubernetes cluster
3. Install npm dependencies
4. Initialize Pulumi stack
5. Deploy the full stack (~5 minutes)
6. Print access URLs and credentials

## Step-by-Step Setup

### 1. Clone Repository

```bash
git clone https://github.com/divyakumar12222patel-a11y/guestbook-monitoring.git
cd guestbook-monitoring
```

### 2. Start Docker Desktop

Make sure Docker Desktop is running:
```bash
docker info  # should succeed
```

### 3. Create Kubernetes Cluster

```bash
kind create cluster --name guestbook-monitoring --config - <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30080
    hostPort: 30080
  - containerPort: 30090
    hostPort: 30090
  - containerPort: 30300
    hostPort: 30300
EOF

kubectl wait --for=condition=Ready node --all --timeout=120s
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Initialize Pulumi Stack

```bash
pulumi login --local
PULUMI_CONFIG_PASSPHRASE="" pulumi stack init dev
PULUMI_CONFIG_PASSPHRASE="" pulumi config set grafanaAdminPassword "YourSecurePassword" --secret
PULUMI_CONFIG_PASSPHRASE="" pulumi config set grafanaNodePort 30300
PULUMI_CONFIG_PASSPHRASE="" pulumi config set prometheusNodePort 30090
PULUMI_CONFIG_PASSPHRASE="" pulumi config set guestbookNodePort 30080
PULUMI_CONFIG_PASSPHRASE="" pulumi config set frontendReplicas 2
```

### 6. Deploy

```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes
```

Expected deployment time: ~5 minutes.

### 7. Validate

```bash
make validate
```

## Access Details

| Service    | URL                        | Credentials          |
|------------|----------------------------|----------------------|
| Guestbook  | http://localhost:30080     | None                 |
| Prometheus | http://localhost:30090     | None                 |
| Grafana    | http://localhost:30300     | admin / (see below)  |

To retrieve the Grafana password:
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi stack output grafanaPassword --show-secrets
```

## Grafana Dashboards

The following dashboards are automatically provisioned:

- **Guestbook Overview** — Custom dashboard showing Redis metrics, pod health, CPU/memory usage, and frontend HTTP probe metrics (availability, response time, status code)
- **Kubernetes / Compute Resources** — Full cluster resource dashboards
- **Node Exporter / Nodes** — Node-level metrics
- **Alertmanager / Overview** — Alert status

Open the Guestbook dashboard directly:
```bash
make dashboard
# Opens: http://localhost:30300/d/guestbook-overview/guestbook-overview
```

## Prometheus Metrics

Metrics scraped from:

| Target                        | Port  | Metrics                                              |
|-------------------------------|-------|------------------------------------------------------|
| **Frontend** (blackbox probe) | 9115  | probe_success, probe_duration_seconds, probe_http_status_code, probe_http_duration_seconds |
| Redis Master                  | 9121  | redis_connected_clients, redis_commands_processed_total, etc. |
| Redis Followers (2x)          | 9121  | Same as master                                       |
| Node Exporter                 | 9100  | CPU, memory, disk, network                           |
| kube-state-metrics            | 8080  | Pod/deployment/service state                         |
| cAdvisor (kubelet)            | 10250 | Container CPU/memory/network                         |
| Grafana                       | 3000  | Grafana internal metrics                             |
| Alertmanager                  | 9093  | Alert counts                                         |
| Prometheus itself             | 9090  | Prometheus internals                                 |

> **Frontend metrics:** Since `gb-frontend:v5` is a vanilla PHP/Apache image with no native `/metrics` endpoint, HTTP-level metrics are collected via a [blackbox-exporter](https://github.com/prometheus/blackbox_exporter) sidecar (`infra/components/blackbox.ts`). Prometheus probes the frontend service every 30s and records response time, availability, and HTTP status code. These appear in the **Frontend HTTP Metrics** row of the Guestbook Overview dashboard.

## Make Targets

```bash
make help           # Show all available targets
make bootstrap      # One-shot: cluster + deploy + validate
make deploy         # Deploy / update stack
make destroy        # Tear down Pulumi resources
make validate       # Run full validation suite
make status         # Show pod/service status
make logs-frontend  # Stream frontend logs
make logs-grafana   # Stream Grafana logs
make targets        # Show Prometheus scrape targets
make dashboard      # Open Guestbook dashboard in browser
make open-grafana   # Open Grafana in browser
make open-prometheus # Open Prometheus in browser
make clean-all      # Destroy everything including cluster
```

## Project Structure

```
guestbook-monitoring/
├── index.ts                    # Pulumi entrypoint
├── Pulumi.yaml                 # Pulumi project config
├── Pulumi.dev.yaml             # Stack config (dev)
├── package.json
├── tsconfig.json
├── Makefile
├── infra/
│   ├── components/
│   │   ├── namespace.ts        # Namespace creation helper
│   │   ├── redis.ts            # Redis master + followers + exporters
│   │   ├── frontend.ts         # Guestbook PHP frontend
│   │   ├── monitoring.ts       # kube-prometheus-stack Helm release
│   │   ├── servicemonitor.ts   # ServiceMonitor CRDs for Redis
│   │   ├── blackbox.ts         # Blackbox-exporter + Probe CRD for frontend HTTP metrics
│   │   └── dashboard-configmap.ts  # Grafana dashboard provisioning
│   ├── stacks/
│   │   └── dev.ts              # Dev stack composition
│   └── config/
│       └── index.ts            # Typed config with defaults
├── dashboards/
│   └── guestbook-overview.json # Custom Grafana dashboard
├── scripts/
│   ├── bootstrap.sh            # One-shot setup script
│   └── validate.sh             # Full validation suite
├── tests/                      # Unit tests
├── docs/
│   ├── environment-report.md
│   └── grafana-access.md
└── .github/
    └── workflows/
        ├── ci.yml              # Lint + type-check + preview
        └── deploy.yml          # Manual deploy workflow
```

## Troubleshooting

### Cluster not reachable
```bash
kubectl config use-context kind-guestbook-monitoring
kubectl cluster-info
```

### Pods stuck in Pending
```bash
kubectl describe pod <pod-name> -n guestbook
# Check for resource constraints or image pull issues
```

### Prometheus targets down
```bash
make targets  # or
kubectl get servicemonitors -n monitoring
```

### Grafana not accessible on port 30300
Use port-forward as fallback:
```bash
make port-forward-grafana
# Then access http://localhost:30300
```

### Pulumi state issues
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi refresh --yes
```

### Out of memory on kind node
Reduce replicas:
```bash
PULUMI_CONFIG_PASSPHRASE="" pulumi config set frontendReplicas 1
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes
```

## Cleanup

```bash
# Remove Pulumi resources (keeps cluster)
make destroy

# Remove everything including cluster
make clean-all
```

## Known Limitations

1. **No persistent storage** — Grafana/Prometheus data is lost on pod restart. Acceptable for local dev.
2. **Single node cluster** — kind runs one control-plane node. Not for production load testing.
3. **NodePort approach** — Uses NodePort services for simplicity. Cloud deployments should use LoadBalancer or Ingress.
4. **No TLS** — Endpoints are HTTP only. Production requires TLS termination.
5. **Frontend metrics** — Collected via blackbox-exporter HTTP probe. Gives availability and latency metrics; byte-level or per-request application metrics would require a custom frontend image.

## Future Improvements

- [ ] Add Loki for log aggregation
- [ ] Custom alerting rules (Alertmanager)
- [ ] Persistent volumes for Prometheus/Grafana
- [ ] Ingress controller with TLS
- [ ] Multi-environment stack (staging, prod)
- [ ] Cloud deployment (EKS/GKE/AKS)
- [ ] Frontend metrics sidecar with prometheus-client
- [ ] HPA (Horizontal Pod Autoscaler) for frontend
- [ ] Network policies for namespace isolation

## License

MIT
