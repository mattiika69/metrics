import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CostPerCallPage() {
  redirect("/marketing/cost-per-call");
}
