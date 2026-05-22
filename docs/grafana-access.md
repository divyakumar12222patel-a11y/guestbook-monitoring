# Grafana Access Details

## Connection Information

| Property | Value |
|----------|-------|
| URL | http://localhost:30300 |
| Username | admin |
| Password | Run: `PULUMI_CONFIG_PASSPHRASE="" pulumi stack output grafanaPassword --show-secrets` |
| Namespace | monitoring |
| Service | kube-prometheus-stack-grafana |
| NodePort | 30300 |

## Accessing Grafana

### Browser
Open: http://localhost:30300

### CLI
```bash
make open-grafana
```

### API
```bash
PASS=$(PULUMI_CONFIG_PASSPHRASE="" pulumi stack output grafanaPassword --show-secrets)
curl -u "admin:${PASS}" http://localhost:30300/api/dashboards/home
```

## Available Dashboards

| Dashboard | UID | Description |
|-----------|-----|-------------|
| Guestbook Overview | guestbook-overview | Custom: Redis metrics, pod health, CPU/memory |
| Kubernetes / Compute Resources / Cluster | efa86fd1d0c121a26444b636a3f509a8 | Cluster-wide resources |
| Kubernetes / Compute Resources / Namespace (Pods) | 85a562078cdf77779eaa1add43ccec1e | Per-namespace pod resources |
| Node Exporter / Nodes | 7d57716318ee0dddbac5a7f451fb7753 | Node CPU/memory/disk |
| Alertmanager / Overview | alertmanager-overview | Alert status |

## Direct Dashboard Links

- Guestbook Overview: http://localhost:30300/d/guestbook-overview/guestbook-overview
- Cluster Overview: http://localhost:30300/d/efa86fd1d0c121a26444b636a3f509a8

## Prometheus Datasource

Grafana is pre-configured with Prometheus as the default datasource:
- URL: http://kube-prometheus-stack-prometheus:9090
- Type: Prometheus

## Fallback: Port-Forward

If NodePort isn't accessible:
```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
# Access at: http://localhost:3000
```
