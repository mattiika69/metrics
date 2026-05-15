import { DepartmentMetricPage } from "@/components/launch-metric-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function FinancePage({ searchParams }: PageProps) {
  return <DepartmentMetricPage viewKey="finance" searchParams={searchParams} />;
}
