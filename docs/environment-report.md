# Environment Report

Generated: 2026-05-22

## System

| Property | Value |
|----------|-------|
| OS | macOS Darwin 25.4.0 (ARM64 - Apple Silicon) |
| Shell | /bin/zsh |
| Architecture | arm64 |

## Installed Tools

| Tool | Version | Status |
|------|---------|--------|
| Node.js | v20.17.0 | ✓ |
| npm | 11.4.0 | ✓ |
| Docker | 29.1.3 | ✓ |
| kubectl | v1.34.1 (client) | ✓ |
| Pulumi | v3.242.0 | ✓ (installed during bootstrap) |
| Helm | v4.2.0 | ✓ (installed during bootstrap) |
| kind | v0.31.0 | ✓ (installed during bootstrap) |
| Git | 2.50.0 | ✓ |
| GitHub CLI | 2.92.0 | ✓ (installed during bootstrap) |
| Python | 3.12.0 | ✓ |
| Homebrew | 5.0.10 | ✓ |

## Tools Installed During Bootstrap

The following tools were NOT present initially and were installed via Homebrew:
- **Pulumi** v3.242.0
- **Helm** v4.2.0
- **kind** v0.31.0
- **GitHub CLI** v2.92.0

## Kubernetes Cluster

| Property | Value |
|----------|-------|
| Tool | kind v0.31.0 |
| Cluster Name | guestbook-monitoring |
| Context | kind-guestbook-monitoring |
| Kubernetes Version | v1.35.0 |
| Nodes | 1 (control-plane) |
| Status | Ready |

## Port Allocations

| Port | Service |
|------|---------|
| 30080 | Guestbook Frontend |
| 30090 | Prometheus |
| 30300 | Grafana |

## Pulumi Configuration

| Property | Value |
|----------|-------|
| Backend | Local (~/.pulumi) |
| Stack | dev |
| Runtime | TypeScript (Node.js) |
| Config Passphrase | Not set (empty string) |
