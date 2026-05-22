import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

interface BlackboxArgs {
  namespace: string;          // monitoring namespace
  targetNamespace: string;    // guestbook namespace
  provider?: k8s.Provider;
}

export class BlackboxStack extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;

  constructor(name: string, args: BlackboxArgs, opts?: pulumi.ComponentResourceOptions) {
    super("guestbook:monitoring:BlackboxStack", name, {}, opts);

    const commonOpts = { parent: this, provider: args.provider };
    const labels = {
      app: "blackbox-exporter",
      "app.kubernetes.io/managed-by": "pulumi",
    };

    // ConfigMap with HTTP probe module
    const configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: "blackbox-exporter-config",
        namespace: args.namespace,
        labels,
      },
      data: {
        "config.yml": [
          "modules:",
          "  http_2xx:",
          "    prober: http",
          "    timeout: 5s",
          "    http:",
          "      valid_http_versions: [\"HTTP/1.1\", \"HTTP/2.0\"]",
          "      valid_status_codes: []",
          "      method: GET",
          "      preferred_ip_protocol: \"ip4\"",
          "      no_follow_redirects: false",
        ].join("\n"),
      },
    }, commonOpts);

    // Blackbox-exporter Deployment
    const deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: "blackbox-exporter",
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "blackbox-exporter" } },
        template: {
          metadata: {
            labels,
            annotations: {
              "prometheus.io/scrape": "false", // scraped via ServiceMonitor, not annotation
            },
          },
          spec: {
            containers: [{
              name: "blackbox-exporter",
              image: "prom/blackbox-exporter:v0.25.0",
              args: ["--config.file=/etc/blackbox-exporter/config.yml"],
              ports: [{ containerPort: 9115, name: "http" }],
              volumeMounts: [{
                name: "config",
                mountPath: "/etc/blackbox-exporter",
              }],
              resources: {
                requests: { cpu: "10m", memory: "32Mi" },
                limits: { cpu: "100m", memory: "64Mi" },
              },
              readinessProbe: {
                httpGet: { path: "/health", port: 9115 },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            }],
            volumes: [{
              name: "config",
              configMap: { name: "blackbox-exporter-config" },
            }],
          },
        },
      },
    }, { ...commonOpts, dependsOn: [configMap] });

    // Service so Prometheus Operator can reach the exporter
    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: "blackbox-exporter",
        namespace: args.namespace,
        labels,
      },
      spec: {
        selector: { app: "blackbox-exporter" },
        ports: [{ name: "http", port: 9115, targetPort: 9115 }],
      },
    }, { ...commonOpts, dependsOn: [deployment] });

    // Probe CRD — probes the frontend service HTTP endpoint
    // Prometheus Operator uses this to instruct Prometheus to call
    // blackbox-exporter?target=<frontend-url> and scrape the result.
    new k8s.apiextensions.CustomResource(`${name}-frontend-probe`, {
      apiVersion: "monitoring.coreos.com/v1",
      kind: "Probe",
      metadata: {
        name: "frontend-http-probe",
        namespace: args.namespace,
        labels: {
          release: "kube-prometheus-stack",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      spec: {
        interval: "30s",
        scrapeTimeout: "10s",
        module: "http_2xx",
        prober: {
          url: `blackbox-exporter.${args.namespace}.svc.cluster.local:9115`,
          scheme: "http",
          path: "/probe",
        },
        targets: {
          staticConfig: {
            static: [
              `http://frontend.${args.targetNamespace}.svc.cluster.local:80/`,
            ],
            labels: {
              app: "guestbook",
              component: "frontend",
              namespace: args.targetNamespace,
            },
          },
        },
      },
    }, { ...commonOpts, dependsOn: [this.service] });

    this.registerOutputs({ service: this.service });
  }
}
