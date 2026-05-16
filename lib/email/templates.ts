export type ProductEmailTemplate =
  | "workspace_created"
  | "admin_invited"
  | "team_invited"
  | "billing_attention"
  | "integration_connected";

export function productEmailSubject(template: ProductEmailTemplate) {
  switch (template) {
    case "workspace_created":
      return "Your HyperOptimal Metrics account is ready";
    case "admin_invited":
      return "You have been invited to manage HyperOptimal Metrics";
    case "team_invited":
      return "You have been invited to HyperOptimal Metrics";
    case "billing_attention":
      return "HyperOptimal Metrics billing needs attention";
    case "integration_connected":
      return "A HyperOptimal Metrics integration was connected";
  }
}

export function productEmailText(template: ProductEmailTemplate, detail: string) {
  switch (template) {
    case "workspace_created":
      return `Your HyperOptimal Metrics account is ready. ${detail}`;
    case "admin_invited":
      return `You have been invited to help administer HyperOptimal Metrics. ${detail}`;
    case "team_invited":
      return `You have been invited to join a HyperOptimal Metrics team. ${detail}`;
    case "billing_attention":
      return `A billing action is needed for HyperOptimal Metrics. ${detail}`;
    case "integration_connected":
      return `An integration was connected in HyperOptimal Metrics. ${detail}`;
  }
}
