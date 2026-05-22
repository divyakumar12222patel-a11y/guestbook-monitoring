import { createDevStack } from "./infra/stacks/dev";

const stack = createDevStack();

export const guestbookUrl = stack.guestbookUrl;
export const grafanaUrl = stack.grafanaUrl;
export const prometheusUrl = stack.prometheusUrl;
export const grafanaUsername = stack.grafanaUsername;
export const grafanaPassword = stack.grafanaPassword;
export const guestbookNamespace = stack.guestbookNamespace;
export const monitoringNamespace = stack.monitoringNamespace;
export const clusterName = stack.clusterName;
export const instructions = stack.instructions;
