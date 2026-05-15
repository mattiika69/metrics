import { MetricsReportPage } from "@/components/metrics-report-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function InputsPage({ searchParams }: PageProps) {
  return (
    <MetricsReportPage
      active="metrics-inputs"
      title="Inputs Overview"
      description="Source inputs that feed the metric model."
      searchParams={searchParams}
      columns={[
        { label: "Paid Ads", metricId: "acquisition_costs" },
        { label: "Cash In", metricId: "cash_in" },
        { label: "Cash Out", metricId: "cash_out" },
        { label: "New Clients", metricId: "new_clients" },
        { label: "Calls Booked", metricId: "calls_booked" },
        { label: "Calls Shown", metricId: "calls_shown" },
        { label: "Qualified", metricId: "qualified_calls" },
      ]}
    />
  );
}
