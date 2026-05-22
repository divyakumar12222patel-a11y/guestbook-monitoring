#!/usr/bin/env bash
set -uo pipefail

GUESTBOOK_NS="${GUESTBOOK_NS:-guestbook}"
MONITORING_NS="${MONITORING_NS:-monitoring}"
GUESTBOOK_PORT="${GUESTBOOK_PORT:-30080}"
GRAFANA_PORT="${GRAFANA_PORT:-30300}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-30090}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "${YELLOW}⚠ WARN${NC}: $1"; }
section() { echo -e "\n${YELLOW}=== $1 ===${NC}"; }

section "Cluster Health"
if kubectl cluster-info --context kind-guestbook-monitoring &>/dev/null; then
  pass "Cluster is reachable"
else
  fail "Cluster not reachable"
fi

section "Guestbook Pods"
FRONTEND_RUNNING=$(kubectl get pods -n "$GUESTBOOK_NS" -l app=guestbook,tier=frontend --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
if [[ "$FRONTEND_RUNNING" -ge 1 ]]; then
  pass "Frontend pods running ($FRONTEND_RUNNING)"
else
  fail "No frontend pods running"
fi

REDIS_MASTER=$(kubectl get pods -n "$GUESTBOOK_NS" -l app=redis,role=master --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
if [[ "$REDIS_MASTER" -ge 1 ]]; then
  pass "Redis master running"
else
  fail "Redis master not running"
fi

REDIS_FOLLOWER=$(kubectl get pods -n "$GUESTBOOK_NS" -l app=redis,role=follower --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
if [[ "$REDIS_FOLLOWER" -ge 1 ]]; then
  pass "Redis followers running ($REDIS_FOLLOWER)"
else
  fail "Redis followers not running"
fi

section "Monitoring Pods"
PROMETHEUS=$(kubectl get pods -n "$MONITORING_NS" -l app.kubernetes.io/name=prometheus --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
if [[ "$PROMETHEUS" -ge 1 ]]; then
  pass "Prometheus running"
else
  fail "Prometheus not running"
fi

GRAFANA=$(kubectl get pods -n "$MONITORING_NS" -l app.kubernetes.io/name=grafana --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
if [[ "$GRAFANA" -ge 1 ]]; then
  pass "Grafana running"
else
  fail "Grafana not running"
fi

section "Service Endpoints"
if curl -sf "http://localhost:${GUESTBOOK_PORT}/" -o /dev/null --max-time 10; then
  pass "Guestbook frontend accessible at http://localhost:${GUESTBOOK_PORT}"
else
  fail "Guestbook frontend not accessible at http://localhost:${GUESTBOOK_PORT}"
fi

if curl -sf "http://localhost:${PROMETHEUS_PORT}/-/healthy" -o /dev/null --max-time 10; then
  pass "Prometheus healthy at http://localhost:${PROMETHEUS_PORT}"
else
  fail "Prometheus not accessible at http://localhost:${PROMETHEUS_PORT}"
fi

if curl -sf "http://localhost:${GRAFANA_PORT}/api/health" -o /dev/null --max-time 10; then
  pass "Grafana healthy at http://localhost:${GRAFANA_PORT}"
else
  fail "Grafana not accessible at http://localhost:${GRAFANA_PORT}"
fi

section "Prometheus Targets"
UP_COUNT=$(curl -sf "http://localhost:${PROMETHEUS_PORT}/api/v1/query?query=up%3D%3D1" --max-time 10 | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['data']['result']))" 2>/dev/null || echo "0")
if [[ "$UP_COUNT" -ge 5 ]]; then
  pass "Prometheus targets up: $UP_COUNT"
else
  fail "Too few Prometheus targets up: $UP_COUNT (expected >= 5)"
fi

REDIS_METRICS=$(curl -sf "http://localhost:${PROMETHEUS_PORT}/api/v1/query?query=redis_connected_clients" --max-time 10 | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['data']['result']))" 2>/dev/null || echo "0")
if [[ "$REDIS_METRICS" -ge 1 ]]; then
  pass "Redis metrics being scraped ($REDIS_METRICS series)"
else
  warn "Redis metrics not yet visible (may need more time)"
fi

section "Grafana Dashboards"
GRAFANA_PASS=$(PULUMI_CONFIG_PASSPHRASE="" pulumi stack output grafanaPassword --show-secrets 2>/dev/null || echo "admin123")
DASHBOARD_COUNT=$(curl -sf -u "admin:${GRAFANA_PASS}" "http://localhost:${GRAFANA_PORT}/api/search?type=dash-db" --max-time 10 | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [[ "$DASHBOARD_COUNT" -ge 10 ]]; then
  pass "Grafana dashboards provisioned: $DASHBOARD_COUNT"
else
  fail "Too few Grafana dashboards: $DASHBOARD_COUNT (expected >= 10)"
fi

GUESTBOOK_DASH=$(curl -sf -u "admin:${GRAFANA_PASS}" "http://localhost:${GRAFANA_PORT}/api/search?type=dash-db&query=Guestbook" --max-time 10 | python3 -c "import sys,json; d=json.load(sys.stdin); print('found' if len(d)>0 else 'missing')" 2>/dev/null || echo "missing")
if [[ "$GUESTBOOK_DASH" == "found" ]]; then
  pass "Custom Guestbook Overview dashboard is provisioned"
else
  fail "Custom Guestbook Overview dashboard not found"
fi

section "ServiceMonitors"
SM_COUNT=$(kubectl get servicemonitors -n "$MONITORING_NS" --no-headers 2>/dev/null | wc -l | tr -d ' ')
if [[ "$SM_COUNT" -ge 1 ]]; then
  pass "ServiceMonitors configured: $SM_COUNT"
else
  fail "No ServiceMonitors found"
fi

section "Summary"
echo -e "\nTotal: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}VALIDATION FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}ALL VALIDATIONS PASSED${NC}"
  exit 0
fi
