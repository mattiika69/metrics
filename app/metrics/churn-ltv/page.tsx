import { MetricsReportPage } from "@/components/metrics-report-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ChurnLtvPage({ searchParams }: PageProps) {
  return (
    <MetricsReportPage
      active="metrics-churn-ltv"
      title="Churn and LTV Overview"
      description="Client retention, churn, and lifetime value across the selected periods."
      searchParams={searchParams}
      columns={[
        { label: "Revenue", metricId: "revenue" },
        { label: "Active", metricId: "active_clients" },
        { label: "New", metricId: "new_clients" },
        { label: "Churned", metricId: "churned_clients" },
        { label: "Churn %", metricId: "churn" },
        { label: "Revenue LTV", metricId: "revenue_ltv" },
        { label: "Gross LTV:CAC", metricId: "gross_ltv_cac" },
        { label: "Net LTV:CAC", metricId: "net_ltv_cac" },
      ]}
    />
  );
}
