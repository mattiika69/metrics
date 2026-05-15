import { MetricsReportPage } from "@/components/metrics-report-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function SalesPage({ searchParams }: PageProps) {
  return (
    <MetricsReportPage
      active="metrics-sales"
      title="Sales Overview"
      description="Booked calls, show rate, qualification, offers, close rate, and revenue per call."
      searchParams={searchParams}
      columns={[
        { label: "Booked", metricId: "calls_booked" },
        { label: "Shown", metricId: "calls_shown" },
        { label: "Qualified", metricId: "qualified_calls" },
        { label: "Offers", metricId: "offers_sent" },
        { label: "Closed", metricId: "calls_closed" },
        { label: "Revenue", metricId: "revenue" },
        { label: "Show %", metricId: "call_show_rate" },
        { label: "Offer %", metricId: "call_offer_rate" },
        { label: "Close %", metricId: "call_close_rate" },
      ]}
    />
  );
}
