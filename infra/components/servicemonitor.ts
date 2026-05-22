import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

interface ServiceMonitorArgs {
  namespace: string;
  targetNamespace: string;
  provider?: k8s.Provider;
}

export class GuestbookServiceMonitor extends pulumi.ComponentResource {
  constructor(name: string, args: ServiceMonitorArgs, opts?: pulumi.ComponentResourceOptions) {
    super("guestbook:monitoring:GuestbookServiceMonitor", name, {}, opts);

    const commonOpts = { parent: this, provider: args.provider };

    // ServiceMonitor for redis-master
    new k8s.apiextensions.CustomResource(`${name}-redis-master`, {
      apiVersion: "monitoring.coreos.com/v1",
      kind: "ServiceMonitor",
      metadata: {
        name: "redis-master",
        namespace: args.namespace,
        labels: {
          release: "kube-prometheus-stack",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      spec: {
        namespaceSelector: { matchNames: [args.targetNamespace] },
        selector: { matchLabels: { component: "redis-master" } },
        endpoints: [{
          port: "metrics",
          interval: "30s",
          scrapeTimeout: "10s",
        }],
      },
    }, commonOpts);

    // ServiceMonitor for redis-follower
    new k8s.apiextensions.CustomResource(`${name}-redis-follower`, {
      apiVersion: "monitoring.coreos.com/v1",
      kind: "ServiceMonitor",
      metadata: {
        name: "redis-follower",
        namespace: args.namespace,
        labels: {
          release: "kube-prometheus-stack",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      spec: {
        namespaceSelector: { matchNames: [args.targetNamespace] },
        selector: { matchLabels: { component: "redis-follower" } },
        endpoints: [{
          port: "metrics",
          interval: "30s",
          scrapeTimeout: "10s",
        }],
      },
    }, commonOpts);

    this.registerOutputs({});
  }
}
