# End-to-End Test Report — guestbook-monitoring

**Date:** 2026-05-22  
**Scope:** Full static analysis, unit tests, lint, TypeScript compilation, and infrastructure logic review  
**Cluster required:** No (all checks runnable without a live cluster)

---

## Summary

| Check | Result |
|---|---|
| TypeScript compilation (`tsc --noEmit`) | ✅ Pass (after fix) |
| Unit tests — `jest` (11 tests, 2 suites) | ✅ 11/11 Pass |
| ESLint (`npm run lint`) | ✅ Pass (after fix + config added) |
| Infrastructure logic review | 5 bugs found and fixed |

---

## Bugs Found & Fixed

### 1. 🔴 Critical — Prometheus `kubernetes-service-endpoints` scrape relabel bug

**File:** `infra/components/monitoring.ts` (line 140–145)

The `kubernetes-service-endpoints` scrape job had a broken relabel rule that replaced `__address__` with just the port number from the annotation (e.g. `"9121"`), instead of reconstructing a valid `host:port`. This would cause all service-endpoint scrapes to fail — Prometheus would attempt to reach `http://9121/metrics` which is not a valid address.

**Before:**
```typescript
{
  source_labels: ["__meta_kubernetes_service_annotation_prometheus_io_port"],
  action: "replace",
  regex: "(.+)",
  target_label: "__address__",
  replacement: "${1}",   // ← sets __address__ to "9121", not "host:9121"
},
```

**After (fixed):**
```typescript
{
  source_labels: ["__address__", "__meta_kubernetes_service_annotation_prometheus_io_port"],
  action: "replace",
  regex: "([^:]+)(?::\\d+)?;(\\d+)",
  target_label: "__address__",
  replacement: "$1:$2",   // ← correctly produces "podIP:9121"
},
```

---

### 2. 🟡 Medium — `redisReplicas` config value was dead code

**Files:** `infra/config/index.ts`, `infra/components/redis.ts`, `infra/stacks/dev.ts`

`config.ts` exported `redisReplicas` and `Pulumi.dev.yaml` set it to `"2"`, but `RedisStack` hard-coded `replicas: 2` for the follower deployment and `dev.ts` never passed the config value through. The value in `Pulumi.dev.yaml` was silently ignored.

**Fix:** Added `followerReplicas?: number` to `RedisArgs`, wired it into the follower `Deployment`, and passed `cfg.redisReplicas` from `dev.ts`.

---

### 3. 🟡 Medium — No ESLint configuration file

**File:** (missing) `.eslintrc.js`

`npm run lint` / `make lint` would fail immediately with `ESLint couldn't find a configuration file`, despite `package.json` listing `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` as dev dependencies.

**Fix:** Created `.eslintrc.js` with the `@typescript-eslint/recommended` ruleset.

---

### 4. 🟡 Medium — 4 unused-variable errors (revealed by ESLint)

**File:** `infra/stacks/dev.ts`

Once ESLint was working, it caught:
- `import * as k8s` — imported but never used
- `frontend`, `dashboards`, `serviceMonitors` — assigned but never referenced (Pulumi registers them as side-effects of construction; the variable binding serves no purpose)

**Fix:** Removed the `k8s` import; prefixed the three side-effect variables with `_` and updated the ESLint rule to allow `varsIgnorePattern: "^_"`.

---

### 5. 🟡 Medium — `Makefile` `cluster-create` target has broken heredoc

**File:** `Makefile` (`cluster-create` target)

The target used a single-line string with literal `\n` sequences passed to `kind create cluster --config -`. Make does not expand `\n` as newlines in recipe lines, so kind would receive malformed YAML and fail to create the cluster. (The `bootstrap.sh` script uses a proper shell heredoc and is unaffected.)

**Fix:** Replaced the broken heredoc with a `printf` pipeline that produces actual newlines:
```make
@printf 'kind: Cluster\napiVersion: ...\n' | kind create cluster --name $(CLUSTER) --config -
```

---

### 6. ℹ️ Advisory — Frontend Prometheus scrape annotations will produce 404s

**File:** `infra/components/frontend.ts`

The frontend pod template has:
```yaml
prometheus.io/scrape: "true"
prometheus.io/port:   "80"
prometheus.io/path:   "/metrics"
```

However `gcr.io/google-samples/gb-frontend:v5` is a standard PHP/Apache Guestbook image with no Prometheus metrics endpoint. Prometheus will scrape `http://podIP:80/metrics` and receive a 404 on every scrape interval, which will show up as scrape errors in the Prometheus UI.

**Recommendation:** Either remove those annotations from the frontend template, or add a metrics-capable sidecar (e.g. `nginx-prometheus-exporter`) if you want HTTP-level metrics.  
**Not fixed automatically** as the correct resolution depends on whether you want frontend-level metrics.

---

## Test Suite Details

### Unit Tests (`npm test`)

```
PASS tests/config.test.ts
PASS tests/dashboard.test.ts

Test Suites: 2 passed, 2 total
Tests:       11 passed, 11 total
```

**config.test.ts** — validates namespace defaults and NodePort ranges.  
**dashboard.test.ts** — validates `dashboards/guestbook-overview.json` exists, is valid JSON, has required fields (`title`, `uid`, `panels`, `templating`), the correct uid (`guestbook-overview`), at least one panel, and a `datasource` template variable of type `prometheus`. All pass.

---

## Runtime Validation (`scripts/validate.sh`)

The validation script (`make validate`) requires a live kind cluster named `guestbook-monitoring` with the full stack deployed. It checks:

- Cluster reachability
- Frontend, Redis master, and Redis follower pods running
- Prometheus and Grafana pods running
- HTTP accessibility of all three services (ports 30080, 30090, 30300)
- Prometheus targets (expects ≥ 5 up)
- Redis metrics being scraped
- Grafana dashboards provisioned (expects ≥ 10 — kube-prometheus-stack ships ~20 defaults + the custom one)
- Custom "Guestbook Overview" dashboard present
- ServiceMonitors configured

**To run full runtime validation:**
```bash
bash scripts/bootstrap.sh   # one-shot cluster + deploy
make validate
```

---

## Files Changed

| File | Change |
|---|---|
| `infra/components/monitoring.ts` | Fixed `kubernetes-service-endpoints` relabel rule |
| `infra/components/redis.ts` | Added `followerReplicas` arg; wired into follower Deployment |
| `infra/stacks/dev.ts` | Pass `cfg.redisReplicas` to RedisStack; remove unused import & prefix unused vars with `_` |
| `tsconfig.json` | Added `index.ts` to `include` array |
| `.eslintrc.js` | Created (new file) |
| `Makefile` | Fixed `cluster-create` heredoc |
