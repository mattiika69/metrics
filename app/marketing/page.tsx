import { DepartmentMetricPage } from "@/components/launch-metric-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function MarketingPage({ searchParams }: PageProps) {
  return <DepartmentMetricPage viewKey="marketing" searchParams={searchParams} />;
}
