SHELL := /bin/bash
.DEFAULT_GOAL := help

STACK       ?= dev
CLUSTER     ?= guestbook-monitoring
GRAFANA_PORT ?= 30300
PROMETHEUS_PORT ?= 30090
GUESTBOOK_PORT  ?= 30080

export PULUMI_CONFIG_PASSPHRASE ?=

.PHONY: help
help: ## Show this help message
	@echo "Guestbook Monitoring - Make targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

.PHONY: bootstrap
bootstrap: ## One-shot setup: create cluster, install deps, deploy everything
	bash scripts/bootstrap.sh

.PHONY: install
install: ## Install npm dependencies
	npm install

.PHONY: build
build: ## TypeScript compile check
	npx tsc --noEmit

.PHONY: lint
lint: ## Run ESLint on TypeScript files
	npx eslint 'infra/**/*.ts' --ext .ts --fix-dry-run || true

.PHONY: format
format: ## Format TypeScript files with Prettier
	npx prettier --write 'infra/**/*.ts' 'index.ts'

.PHONY: cluster-create
cluster-create: ## Create kind cluster
	@printf 'kind: Cluster\napiVersion: kind.x-k8s.io/v1alpha4\nnodes:\n- role: control-plane\n  extraPortMappings:\n  - containerPort: 30080\n    hostPort: 30080\n  - containerPort: 30090\n    hostPort: 30090\n  - containerPort: 30300\n    hostPort: 30300\n' \
		| kind create cluster --name $(CLUSTER) --config -
	kubectl wait --for=condition=Ready node --all --timeout=120s

.PHONY: cluster-delete
cluster-delete: ## Delete kind cluster
	kind delete cluster --name $(CLUSTER)

.PHONY: cluster-info
cluster-info: ## Show cluster info
	kubectl cluster-info --context kind-$(CLUSTER)
	kubectl get nodes

.PHONY: preview
preview: build ## Preview Pulumi changes without applying
	pulumi preview --stack $(STACK)

.PHONY: deploy
deploy: build ## Deploy the full stack
	pulumi up --yes --stack $(STACK)

.PHONY: destroy
destroy: ## Destroy the Pulumi stack (keeps cluster)
	pulumi destroy --yes --stack $(STACK)

.PHONY: refresh
refresh: ## Refresh Pulumi state from cluster
	pulumi refresh --yes --stack $(STACK)

.PHONY: outputs
outputs: ## Show Pulumi stack outputs
	pulumi stack output --stack $(STACK)
	@echo ""
	@echo "Grafana password:"
	pulumi stack output grafanaPassword --show-secrets --stack $(STACK)

.PHONY: validate
validate: ## Run full validation suite
	bash scripts/validate.sh

.PHONY: test
test: ## Run unit tests
	npx jest --passWithNoTests

.PHONY: status
status: ## Show all pods and services
	@echo "=== Guestbook Namespace ==="
	kubectl get pods,svc -n guestbook
	@echo ""
	@echo "=== Monitoring Namespace ==="
	kubectl get pods,svc -n monitoring

.PHONY: logs-frontend
logs-frontend: ## Stream frontend pod logs
	kubectl logs -n guestbook -l app=guestbook,tier=frontend -f --tail=50

.PHONY: logs-prometheus
logs-prometheus: ## Stream Prometheus logs
	kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus -f --tail=50

.PHONY: logs-grafana
logs-grafana: ## Stream Grafana logs
	kubectl logs -n monitoring -l app.kubernetes.io/name=grafana -f --tail=50

.PHONY: port-forward-grafana
port-forward-grafana: ## Port-forward Grafana (fallback if NodePort fails)
	kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana $(GRAFANA_PORT):80

.PHONY: port-forward-prometheus
port-forward-prometheus: ## Port-forward Prometheus (fallback if NodePort fails)
	kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus $(PROMETHEUS_PORT):9090

.PHONY: open-grafana
open-grafana: ## Open Grafana in browser
	open http://localhost:$(GRAFANA_PORT)

.PHONY: open-prometheus
open-prometheus: ## Open Prometheus in browser
	open http://localhost:$(PROMETHEUS_PORT)

.PHONY: open-guestbook
open-guestbook: ## Open Guestbook app in browser
	open http://localhost:$(GUESTBOOK_PORT)

.PHONY: dashboard
dashboard: ## Open Grafana Guestbook Overview dashboard
	open "http://localhost:$(GRAFANA_PORT)/d/guestbook-overview/guestbook-overview"

.PHONY: prometheus-query
prometheus-query: ## Query Prometheus (usage: make prometheus-query QUERY='up')
	curl -s "http://localhost:$(PROMETHEUS_PORT)/api/v1/query?query=$(QUERY)" | python3 -m json.tool

.PHONY: targets
targets: ## Show Prometheus target status
	@curl -s "http://localhost:$(PROMETHEUS_PORT)/api/v1/targets" | python3 -c "\
import sys,json; d=json.load(sys.stdin); \
[print(f\"  {'UP' if t['health']=='up' else 'DOWN':4} {t['labels'].get('job','?'):40} {t['scrapeUrl'][:60]}\") \
for t in d['data']['activeTargets']]"

.PHONY: clean
clean: ## Clean build artifacts
	rm -rf bin/ coverage/ node_modules/.cache/

.PHONY: clean-all
clean-all: destroy cluster-delete clean ## Destroy everything including cluster
	@echo "Complete cleanup done"
