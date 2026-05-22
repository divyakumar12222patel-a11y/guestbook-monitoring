import * as pulumi from "@pulumi/pulumi";
import * as path from "path";

import { createNamespace } from "../components/namespace";
import { RedisStack } from "../components/redis";
import { FrontendStack } from "../components/frontend";
import { MonitoringStack } from "../components/monitoring";
import { GuestbookServiceMonitor } from "../components/servicemonitor";
import { DashboardConfigMap } from "../components/dashboard-configmap";
import { BlackboxStack } from "../components/blackbox";
import * as cfg from "../config";

export function createDevStack() {
  // Create namespaces
  const guestbookNs = createNamespace(cfg.guestbookNamespace);
  const monitoringNs = createNamespace(cfg.monitoringNamespace);

  // Deploy monitoring stack first (so CRDs are available)
  const monitoring = new MonitoringStack("monitoring", {
    namespace: cfg.monitoringNamespace,
    grafanaAdminPassword: cfg.grafanaAdminPassword,
    grafanaNodePort: cfg.grafanaNodePort,
    prometheusNodePort: cfg.prometheusNodePort,
  }, { dependsOn: [monitoringNs] });

  // Deploy guestbook (redis + frontend)
  const redis = new RedisStack("redis", {
    namespace: cfg.guestbookNamespace,
    followerReplicas: cfg.redisReplicas,
  }, { dependsOn: [guestbookNs] });

  const _frontend = new FrontendStack("frontend", {
    namespace: cfg.guestbookNamespace,
    replicas: cfg.frontendReplicas,
    nodePort: cfg.guestbookNodePort,
  }, { dependsOn: [redis] });

  // Deploy dashboard configmap (auto-provisioned by Grafana sidecar)
  const dashboardsDir = path.resolve(__dirname, "../../dashboards");
  const _dashboards = new DashboardConfigMap("dashboards", {
    namespace: cfg.monitoringNamespace,
    dashboardsDir,
  }, { dependsOn: [monitoring] });

  // Deploy ServiceMonitors after monitoring CRDs exist
  const _serviceMonitors = new GuestbookServiceMonitor("guestbook-monitors", {
    namespace: cfg.monitoringNamespace,
    targetNamespace: cfg.guestbookNamespace,
  }, { dependsOn: [monitoring, redis] });

  // Deploy blackbox-exporter + Probe CRD for frontend HTTP metrics
  const _blackbox = new BlackboxStack("blackbox", {
    namespace: cfg.monitoringNamespace,
    targetNamespace: cfg.guestbookNamespace,
  }, { dependsOn: [monitoring, _frontend] });

  return {
    guestbookUrl: pulumi.interpolate`http://localhost:${cfg.guestbookNodePort}`,
    grafanaUrl: pulumi.interpolate`http://localhost:${cfg.grafanaNodePort}`,
    prometheusUrl: pulumi.interpolate`http://localhost:${cfg.prometheusNodePort}`,
    grafanaUsername: "admin",
    grafanaPassword: cfg.grafanaAdminPassword,
    guestbookNamespace: cfg.guestbookNamespace,
    monitoringNamespace: cfg.monitoringNamespace,
    clusterName: "kind-guestbook-monitoring",
    instructions: pulumi.output(`
=======================================================
GUESTBOOK MONITORING STACK - DEPLOYMENT COMPLETE
=======================================================
Guestbook App:     http://localhost:${cfg.guestbookNodePort}
Grafana:           http://localhost:${cfg.grafanaNodePort}
Prometheus:        http://localhost:${cfg.prometheusNodePort}

Grafana Login:     admin / (see grafanaPassword output)
=======================================================
`),
  };
}
