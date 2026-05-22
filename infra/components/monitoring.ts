import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

interface MonitoringStackArgs {
  namespace: string;
  grafanaAdminPassword: pulumi.Input<string>;
  grafanaNodePort?: number;
  prometheusNodePort?: number;
  provider?: k8s.Provider;
}

export class MonitoringStack extends pulumi.ComponentResource {
  public readonly prometheusRelease: k8s.helm.v3.Release;
  public readonly grafanaNodePort: number;
  public readonly prometheusNodePort: number;

  constructor(name: string, args: MonitoringStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super("guestbook:monitoring:MonitoringStack", name, {}, opts);

    const commonOpts = { parent: this, provider: args.provider };
    this.grafanaNodePort = args.grafanaNodePort ?? 30300;
    this.prometheusNodePort = args.prometheusNodePort ?? 30090;

    // Add prometheus-community helm repo via chart
    this.prometheusRelease = new k8s.helm.v3.Release(`${name}-kube-prometheus`, {
      name: "kube-prometheus-stack",
      chart: "kube-prometheus-stack",
      version: "65.3.1",
      repositoryOpts: {
        repo: "https://prometheus-community.github.io/helm-charts",
      },
      namespace: args.namespace,
      createNamespace: true,
      timeout: 600,
      waitForJobs: true,
      values: {
        // Grafana configuration
        grafana: {
          enabled: true,
          adminPassword: args.grafanaAdminPassword,
          service: {
            type: "NodePort",
            nodePort: this.grafanaNodePort,
          },
          resources: {
            requests: { cpu: "100m", memory: "128Mi" },
            limits: { cpu: "500m", memory: "512Mi" },
          },
          persistence: {
            enabled: false,
          },
          "grafana.ini": {
            server: {
              root_url: `http://localhost:${this.grafanaNodePort}`,
            },
            security: {
              allow_embedding: true,
            },
          },
          sidecar: {
            dashboards: {
              enabled: true,
              searchNamespace: "ALL",
              label: "grafana_dashboard",
              labelValue: "1",
            },
            datasources: {
              enabled: true,
              searchNamespace: "ALL",
            },
          },
          defaultDashboardsTimezone: "browser",
          defaultDashboardsEditable: true,
        },

        // Prometheus configuration
        prometheus: {
          service: {
            type: "NodePort",
            nodePort: this.prometheusNodePort,
          },
          prometheusSpec: {
            scrapeInterval: "30s",
            evaluationInterval: "30s",
            retention: "7d",
            resources: {
              requests: { cpu: "200m", memory: "400Mi" },
              limits: { cpu: "1000m", memory: "1Gi" },
            },
            // Enable scraping of pods with prometheus annotations
            additionalScrapeConfigs: [
              {
                job_name: "kubernetes-pods",
                kubernetes_sd_configs: [{ role: "pod" }],
                relabel_configs: [
                  {
                    source_labels: ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"],
                    action: "keep",
                    regex: "true",
                  },
                  {
                    source_labels: ["__meta_kubernetes_pod_annotation_prometheus_io_path"],
                    action: "replace",
                    target_label: "__metrics_path__",
                    regex: "(.+)",
                  },
                  {
                    source_labels: ["__address__", "__meta_kubernetes_pod_annotation_prometheus_io_port"],
                    action: "replace",
                    regex: "([^:]+)(?::\\d+)?;(\\d+)",
                    replacement: "$1:$2",
                    target_label: "__address__",
                  },
                  {
                    action: "labelmap",
                    regex: "__meta_kubernetes_pod_label_(.+)",
                  },
                  {
                    source_labels: ["__meta_kubernetes_namespace"],
                    action: "replace",
                    target_label: "kubernetes_namespace",
                  },
                  {
                    source_labels: ["__meta_kubernetes_pod_name"],
                    action: "replace",
                    target_label: "kubernetes_pod_name",
                  },
                ],
              },
              {
                job_name: "kubernetes-service-endpoints",
                kubernetes_sd_configs: [{ role: "endpoints" }],
                relabel_configs: [
                  {
                    source_labels: ["__meta_kubernetes_service_annotation_prometheus_io_scrape"],
                    action: "keep",
                    regex: "true",
                  },
                  {
                    source_labels: ["__address__", "__meta_kubernetes_service_annotation_prometheus_io_port"],
                    action: "replace",
                    regex: "([^:]+)(?::\\d+)?;(\\d+)",
                    target_label: "__address__",
                    replacement: "$1:$2",
                  },
                  {
                    action: "labelmap",
                    regex: "__meta_kubernetes_service_label_(.+)",
                  },
                  {
                    source_labels: ["__meta_kubernetes_namespace"],
                    action: "replace",
                    target_label: "kubernetes_namespace",
                  },
                  {
                    source_labels: ["__meta_kubernetes_service_name"],
                    action: "replace",
                    target_label: "kubernetes_name",
                  },
                ],
              },
            ],
            serviceMonitorSelectorNilUsesHelmValues: false,
            serviceMonitorSelector: {},
            serviceMonitorNamespaceSelector: {},
            podMonitorSelectorNilUsesHelmValues: false,
            podMonitorSelector: {},
            podMonitorNamespaceSelector: {},
          },
        },

        // Alertmanager
        alertmanager: {
          enabled: true,
          alertmanagerSpec: {
            resources: {
              requests: { cpu: "50m", memory: "64Mi" },
              limits: { cpu: "200m", memory: "128Mi" },
            },
          },
        },

        // Node exporter
        "prometheus-node-exporter": {
          enabled: true,
          resources: {
            requests: { cpu: "50m", memory: "30Mi" },
            limits: { cpu: "200m", memory: "50Mi" },
          },
          tolerations: [
            { key: "node-role.kubernetes.io/control-plane", operator: "Exists", effect: "NoSchedule" },
          ],
        },

        // kube-state-metrics
        "kube-state-metrics": {
          enabled: true,
          resources: {
            requests: { cpu: "10m", memory: "32Mi" },
            limits: { cpu: "100m", memory: "64Mi" },
          },
        },

        // Disable components not needed in kind
        kubeControllerManager: { enabled: false },
        kubeScheduler: { enabled: false },
        kubeEtcd: { enabled: false },
        kubeProxy: { enabled: false },
      },
    }, commonOpts);

    this.registerOutputs({
      prometheusRelease: this.prometheusRelease,
    });
  }
}
