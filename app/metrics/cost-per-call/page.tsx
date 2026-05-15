import { MetricsReportPage } from "@/components/metrics-report-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function CostPerCallPage({ searchParams }: PageProps) {
  return (
    <MetricsReportPage
      active="metrics-cost-per-call"
      title="Cost Per Call"
      description="Acquisition cost efficiency across booked, shown, qualified, offered, and closed calls."
      searchParams={searchParams}
      columns={[
        { label: "Calls Booked", metricId: "calls_booked" },
        { label: "Calls Shown", metricId: "calls_shown" },
        { label: "Qualified Calls", metricId: "qualified_calls" },
        { label: "Offers Sent", metricId: "offers_sent" },
        { label: "Calls Closed", metricId: "calls_closed" },
        { label: "Costs", metricId: "acquisition_costs" },
        { label: "Cost/Booked", metricId: "cost_per_call" },
        { label: "CAC", metricId: "cac" },
      ]}
    />
  );
}
