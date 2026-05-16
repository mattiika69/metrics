import { ScalingMetricsTablePage } from "@/components/scaling-metrics-pages";

export const dynamic = "force-dynamic";

export default function CostPerCallPage() {
  return <ScalingMetricsTablePage kind="cost-per-call" />;
}
