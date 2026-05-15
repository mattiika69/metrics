import { MetricsReportPage } from "@/components/metrics-report-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function FinancialPage({ searchParams }: PageProps) {
  return (
    <MetricsReportPage
      active="metrics-financial"
      title="Financial Overview"
      description="Revenue, cash flow, margin, and cost performance by period."
      searchParams={searchParams}
      columns={[
        { label: "Revenue", metricId: "revenue" },
        { label: "Cash Out", metricId: "cash_out" },
        { label: "Net Cash Flow", metricId: "net_cash_flow" },
        { label: "Gross Margin %", metricId: "gross_margin" },
        { label: "Net Margin %", metricId: "net_margin" },
        { label: "Fixed Costs", metricId: "fixed_costs" },
        { label: "Variable Costs", metricId: "variable_costs" },
        { label: "CAC", metricId: "cac" },
        { label: "Fulfillment", metricId: "fulfillment_costs" },
      ]}
    />
  );
}
