import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

interface RedisArgs {
  namespace: string;
  followerReplicas?: number;
  provider?: k8s.Provider;
}

export class RedisStack extends pulumi.ComponentResource {
  public readonly masterService: k8s.core.v1.Service;
  public readonly followerService: k8s.core.v1.Service;

  constructor(name: string, args: RedisArgs, opts?: pulumi.ComponentResourceOptions) {
    super("guestbook:monitoring:RedisStack", name, {}, opts);

    const commonOpts = { parent: this, provider: args.provider };
    const labels = { "app.kubernetes.io/managed-by": "pulumi" };

    // Redis master deployment
    const masterDeployment = new k8s.apps.v1.Deployment(`${name}-master`, {
      metadata: {
        name: "redis-master",
        namespace: args.namespace,
        labels: { ...labels, component: "redis-master" },
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: "redis", role: "master" } },
        template: {
          metadata: {
            labels: {
              app: "redis",
              role: "master",
              "app.kubernetes.io/component": "redis-master",
            },
            annotations: {
              "prometheus.io/scrape": "true",
              "prometheus.io/port": "9121",
            },
          },
          spec: {
            containers: [
              {
                name: "redis",
                image: "redis:7.2-alpine",
                ports: [{ containerPort: 6379 }],
                resources: {
                  requests: { cpu: "100m", memory: "128Mi" },
                  limits: { cpu: "500m", memory: "256Mi" },
                },
                readinessProbe: {
                  exec: { command: ["redis-cli", "ping"] },
                  initialDelaySeconds: 5,
                  periodSeconds: 10,
                },
                livenessProbe: {
                  exec: { command: ["redis-cli", "ping"] },
                  initialDelaySeconds: 15,
                  periodSeconds: 20,
                },
              },
              {
                name: "redis-exporter",
                image: "oliver006/redis_exporter:v1.58.0",
                ports: [{ containerPort: 9121, name: "metrics" }],
                resources: {
                  requests: { cpu: "50m", memory: "32Mi" },
                  limits: { cpu: "100m", memory: "64Mi" },
                },
              },
            ],
          },
        },
      },
    }, commonOpts);

    this.masterService = new k8s.core.v1.Service(`${name}-master-svc`, {
      metadata: {
        name: "redis-master",
        namespace: args.namespace,
        labels: { ...labels, component: "redis-master" },
        annotations: { "prometheus.io/scrape": "true", "prometheus.io/port": "9121" },
      },
      spec: {
        selector: { app: "redis", role: "master" },
        ports: [
          { name: "redis", port: 6379, targetPort: 6379 },
          { name: "metrics", port: 9121, targetPort: 9121 },
        ],
      },
    }, { ...commonOpts, dependsOn: [masterDeployment] });

    // Redis follower deployment
    const followerDeployment = new k8s.apps.v1.Deployment(`${name}-follower`, {
      metadata: {
        name: "redis-follower",
        namespace: args.namespace,
        labels: { ...labels, component: "redis-follower" },
      },
      spec: {
        replicas: args.followerReplicas ?? 2,
        selector: { matchLabels: { app: "redis", role: "follower" } },
        template: {
          metadata: {
            labels: {
              app: "redis",
              role: "follower",
              "app.kubernetes.io/component": "redis-follower",
            },
            annotations: {
              "prometheus.io/scrape": "true",
              "prometheus.io/port": "9121",
            },
          },
          spec: {
            containers: [
              {
                name: "redis",
                image: "redis:7.2-alpine",
                command: ["redis-server", "--replicaof", "redis-master", "6379"],
                ports: [{ containerPort: 6379 }],
                resources: {
                  requests: { cpu: "100m", memory: "128Mi" },
                  limits: { cpu: "300m", memory: "256Mi" },
                },
                readinessProbe: {
                  exec: { command: ["redis-cli", "ping"] },
                  initialDelaySeconds: 5,
                  periodSeconds: 10,
                },
                livenessProbe: {
                  exec: { command: ["redis-cli", "ping"] },
                  initialDelaySeconds: 15,
                  periodSeconds: 20,
                },
              },
              {
                name: "redis-exporter",
                image: "oliver006/redis_exporter:v1.58.0",
                ports: [{ containerPort: 9121, name: "metrics" }],
                resources: {
                  requests: { cpu: "50m", memory: "32Mi" },
                  limits: { cpu: "100m", memory: "64Mi" },
                },
              },
            ],
          },
        },
      },
    }, commonOpts);

    this.followerService = new k8s.core.v1.Service(`${name}-follower-svc`, {
      metadata: {
        name: "redis-follower",
        namespace: args.namespace,
        labels: { ...labels, component: "redis-follower" },
        annotations: { "prometheus.io/scrape": "true", "prometheus.io/port": "9121" },
      },
      spec: {
        selector: { app: "redis", role: "follower" },
        ports: [
          { name: "redis", port: 6379, targetPort: 6379 },
          { name: "metrics", port: 9121, targetPort: 9121 },
        ],
      },
    }, { ...commonOpts, dependsOn: [followerDeployment] });

    this.registerOutputs({
      masterService: this.masterService,
      followerService: this.followerService,
    });
  }
}
