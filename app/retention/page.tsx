import { DepartmentMetricPage } from "@/components/launch-metric-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function RetentionPage({ searchParams }: PageProps) {
  return <DepartmentMetricPage viewKey="retention" searchParams={searchParams} />;
}
