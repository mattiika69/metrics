import {
  ScalingInputsAccountsPage,
  ScalingInputsChannelPage,
  ScalingMetricsTablePage,
  type InputsChannelPageKind,
} from "@/components/scaling-metrics-pages";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function InputsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = param(params, "tab");

  if (tab === "cost-per-call") return <ScalingMetricsTablePage kind="cost-per-call" />;
  if (tab === "accounts") return <ScalingInputsAccountsPage />;
  if (tab === "paid-ads" || tab === "cold-email" || tab === "newsletter") {
    return <ScalingInputsChannelPage kind={tab as InputsChannelPageKind} />;
  }

  return <ScalingMetricsTablePage kind="inputs" />;
}
