import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

export const guestbookNamespace = config.get("guestbookNamespace") ?? "guestbook";
export const monitoringNamespace = config.get("monitoringNamespace") ?? "monitoring";
export const grafanaAdminPassword = config.getSecret("grafanaAdminPassword") ?? pulumi.secret("admin123");
export const grafanaNodePort = config.getNumber("grafanaNodePort") ?? 30300;
export const prometheusNodePort = config.getNumber("prometheusNodePort") ?? 30090;
export const guestbookNodePort = config.getNumber("guestbookNodePort") ?? 30080;
export const redisReplicas = config.getNumber("redisReplicas") ?? 2;
export const frontendReplicas = config.getNumber("frontendReplicas") ?? 2;
