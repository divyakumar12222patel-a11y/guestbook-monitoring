import * as k8s from "@pulumi/kubernetes";

export function createNamespace(name: string, provider?: k8s.Provider): k8s.core.v1.Namespace {
  return new k8s.core.v1.Namespace(name, {
    metadata: {
      name,
      labels: {
        "app.kubernetes.io/managed-by": "pulumi",
        "monitoring": "enabled",
      },
    },
  }, { provider });
}
