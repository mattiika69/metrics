import { MetricsReportPage } from "@/components/metrics-report-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ReverseEngineeringPage({ searchParams }: PageProps) {
  return (
    <MetricsReportPage
      active="metrics-reverse-engineering"
      title="Reverse Engineering"
      description="Revenue, margin, client, and LTV targets for planning growth."
      searchParams={searchParams}
      summarySections={[
        {
          title: "Major Goal",
          rows: [
            { label: "Net Profit Goal", metricId: "net_profit", editable: true },
            { label: "Net Margin", metricId: "net_margin" },
            { label: "Revenue Required", metricId: "revenue" },
          ],
        },
        {
          title: "LTV",
          rows: [
            { label: "Revenue LTV", metricId: "revenue_ltv" },
            { label: "Median Payment", metricId: "median_payment" },
            { label: "Average Client Relationship", metricId: "avg_relationship" },
            { label: "Clients Required", metricId: "active_clients" },
          ],
        },
        {
          title: "Clients",
          rows: [
            { label: "Active Clients", metricId: "active_clients" },
            { label: "Close Rate", metricId: "call_close_rate" },
            { label: "Calls Required", metricId: "calls_booked" },
            { label: "Cost Per Call", metricId: "cost_per_call" },
          ],
        },
      ]}
      columns={[
        { label: "Revenue", metricId: "revenue" },
        { label: "Net Profit", metricId: "net_profit" },
        { label: "Net Margin", metricId: "net_margin" },
        { label: "MRR", metricId: "mrr" },
        { label: "Active Clients", metricId: "active_clients" },
        { label: "Revenue LTV", metricId: "revenue_ltv" },
        { label: "LTV:CAC", metricId: "ltv_cac" },
      ]}
    />
  );
}
