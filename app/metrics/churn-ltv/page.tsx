import { ScalingMetricsTablePage } from "@/components/scaling-metrics-pages";

export const dynamic = "force-dynamic";

export default function ChurnLtvPage() {
  return <ScalingMetricsTablePage kind="churn-ltv" />;
}
