#!/usr/bin/env bash
# bootstrap.sh - One-shot setup for guestbook-monitoring from scratch
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
die()     { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Guestbook Monitoring - Bootstrap${NC}"
echo -e "${BLUE}========================================${NC}"

# --- Prerequisites check ---
info "Checking prerequisites..."

require_cmd() {
  local cmd=$1 install_hint=$2
  if ! command -v "$cmd" &>/dev/null; then
    die "$cmd not found. $install_hint"
  fi
  success "$cmd found: $(${cmd} --version 2>&1 | head -1)"
}

require_cmd docker  "Install Docker Desktop from https://www.docker.com/products/docker-desktop"
require_cmd kubectl "brew install kubectl"
require_cmd pulumi  "brew install pulumi"
require_cmd helm    "brew install helm"
require_cmd kind    "brew install kind"
require_cmd node    "brew install node"
require_cmd npm     "Comes with Node"

# --- Docker check ---
if ! docker info &>/dev/null; then
  die "Docker daemon not running. Start Docker Desktop first."
fi
success "Docker daemon is running"

# --- Cluster setup ---
CLUSTER_NAME="guestbook-monitoring"
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  warn "Cluster '${CLUSTER_NAME}' already exists. Skipping creation."
else
  info "Creating kind cluster '${CLUSTER_NAME}'..."
  kind create cluster --name "$CLUSTER_NAME" --config - <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 30080
    hostPort: 30080
    protocol: TCP
  - containerPort: 30090
    hostPort: 30090
    protocol: TCP
  - containerPort: 30300
    hostPort: 30300
    protocol: TCP
EOF
  info "Waiting for cluster to be Ready..."
  kubectl wait --for=condition=Ready node --all --timeout=120s
  success "Cluster ready"
fi

# --- npm install ---
info "Installing npm dependencies..."
npm install --silent
success "Dependencies installed"

# --- Pulumi setup ---
info "Configuring Pulumi local backend..."
pulumi login --local &>/dev/null || true

STACK_NAME="dev"
if PULUMI_CONFIG_PASSPHRASE="" pulumi stack ls 2>/dev/null | grep -q "^${STACK_NAME}"; then
  info "Stack '${STACK_NAME}' already exists."
else
  info "Creating Pulumi stack '${STACK_NAME}'..."
  PULUMI_CONFIG_PASSPHRASE="" pulumi stack init "$STACK_NAME"
  PULUMI_CONFIG_PASSPHRASE="" pulumi config set grafanaAdminPassword "Gr4fan4@Admin123!" --secret
  PULUMI_CONFIG_PASSPHRASE="" pulumi config set grafanaNodePort 30300
  PULUMI_CONFIG_PASSPHRASE="" pulumi config set prometheusNodePort 30090
  PULUMI_CONFIG_PASSPHRASE="" pulumi config set guestbookNodePort 30080
  PULUMI_CONFIG_PASSPHRASE="" pulumi config set frontendReplicas 2
fi

# --- Deploy ---
info "Deploying stack (this takes ~5 minutes)..."
PULUMI_CONFIG_PASSPHRASE="" pulumi up --yes

success "Deployment complete!"

# --- Outputs ---
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ACCESS DETAILS${NC}"
echo -e "${GREEN}========================================${NC}"
PULUMI_CONFIG_PASSPHRASE="" pulumi stack output
echo ""
echo -e "${BLUE}Grafana password:${NC}"
PULUMI_CONFIG_PASSPHRASE="" pulumi stack output grafanaPassword --show-secrets
echo ""
echo -e "${GREEN}Run 'make validate' to verify everything is working.${NC}"
