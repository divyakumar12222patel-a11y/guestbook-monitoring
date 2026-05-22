import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

interface FrontendArgs {
  namespace: string;
  replicas?: number;
  nodePort?: number;
  provider?: k8s.Provider;
}

export class FrontendStack extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;
  public readonly deployment: k8s.apps.v1.Deployment;

  constructor(name: string, args: FrontendArgs, opts?: pulumi.ComponentResourceOptions) {
    super("guestbook:monitoring:FrontendStack", name, {}, opts);

    const commonOpts = { parent: this, provider: args.provider };
    const replicas = args.replicas ?? 2;

    this.deployment = new k8s.apps.v1.Deployment(`${name}-frontend`, {
      metadata: {
        name: "frontend",
        namespace: args.namespace,
        labels: {
          app: "guestbook",
          component: "frontend",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      spec: {
        replicas,
        selector: { matchLabels: { app: "guestbook", tier: "frontend" } },
        template: {
          metadata: {
            labels: {
              app: "guestbook",
              tier: "frontend",
              "app.kubernetes.io/component": "frontend",
            },
            // No /metrics endpoint on gb-frontend:v5 (PHP app).
            // Frontend HTTP metrics are collected via blackbox-exporter Probe CRD instead.
          },
          spec: {
            containers: [
              {
                name: "php-redis",
                image: "gcr.io/google-samples/gb-frontend:v5",
                env: [
                  { name: "GET_HOSTS_FROM", value: "dns" },
                  { name: "REDIS_MASTER_SERVICE_HOST", value: "redis-master" },
                  { name: "REDIS_SLAVE_SERVICE_HOST", value: "redis-follower" },
                ],
                ports: [{ containerPort: 80 }],
                resources: {
                  requests: { cpu: "100m", memory: "100Mi" },
                  limits: { cpu: "500m", memory: "256Mi" },
                },
                readinessProbe: {
                  httpGet: { path: "/", port: 80 },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  failureThreshold: 3,
                },
                livenessProbe: {
                  httpGet: { path: "/", port: 80 },
                  initialDelaySeconds: 30,
                  periodSeconds: 30,
                },
              },
            ],
          },
        },
      },
    }, commonOpts);

    this.service = new k8s.core.v1.Service(`${name}-frontend-svc`, {
      metadata: {
        name: "frontend",
        namespace: args.namespace,
        labels: {
          app: "guestbook",
          component: "frontend",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      spec: {
        type: "NodePort",
        selector: { app: "guestbook", tier: "frontend" },
        ports: [{
          name: "http",
          port: 80,
          targetPort: 80,
          nodePort: args.nodePort ?? 30080,
        }],
      },
    }, { ...commonOpts, dependsOn: [this.deployment] });

    this.registerOutputs({
      service: this.service,
      deployment: this.deployment,
    });
  }
}
