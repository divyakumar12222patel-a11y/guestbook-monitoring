import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
import * as path from "path";

interface DashboardConfigMapArgs {
  namespace: string;
  dashboardsDir: string;
  provider?: k8s.Provider;
}

export class DashboardConfigMap extends pulumi.ComponentResource {
  public readonly configMap: k8s.core.v1.ConfigMap;

  constructor(name: string, args: DashboardConfigMapArgs, opts?: pulumi.ComponentResourceOptions) {
    super("guestbook:monitoring:DashboardConfigMap", name, {}, opts);

    const dashboardFiles: Record<string, string> = {};

    try {
      const files = fs.readdirSync(args.dashboardsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const content = fs.readFileSync(path.join(args.dashboardsDir, file), "utf8");
          dashboardFiles[file] = content;
        }
      }
    } catch {
      // dashboards dir may not exist at stack init time
    }

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-dashboards`, {
      metadata: {
        name: "guestbook-dashboards",
        namespace: args.namespace,
        labels: {
          grafana_dashboard: "1",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      data: dashboardFiles,
    }, { parent: this, provider: args.provider });

    this.registerOutputs({ configMap: this.configMap });
  }
}
