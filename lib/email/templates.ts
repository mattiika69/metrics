export type ProductEmailTemplate =
  | "workspace_created"
  | "admin_invited"
  | "billing_attention"
  | "integration_connected";

export function productEmailSubject(template: ProductEmailTemplate) {
  switch (template) {
    case "workspace_created":
      return "Your HyperOptimal Metrics workspace is ready";
    case "admin_invited":
      return "You have been invited to manage HyperOptimal Metrics";
    case "billing_attention":
      return "HyperOptimal Metrics billing needs attention";
    case "integration_connected":
      return "A HyperOptimal Metrics integration was connected";
  }
}

export function productEmailText(template: ProductEmailTemplate, detail: string) {
  switch (template) {
    case "workspace_created":
      return `Your HyperOptimal Metrics workspace is ready. ${detail}`;
    case "admin_invited":
      return `You have been invited to help administer HyperOptimal Metrics. ${detail}`;
    case "billing_attention":
      return `A billing action is needed for HyperOptimal Metrics. ${detail}`;
    case "integration_connected":
      return `A workspace integration was connected in HyperOptimal Metrics. ${detail}`;
  }
}
