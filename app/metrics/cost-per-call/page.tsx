import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CostPerCallPage() {
  redirect("/inputs?tab=cost-per-call");
}
