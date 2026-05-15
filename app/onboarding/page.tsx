import { redirect } from "next/navigation";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";

export default function OnboardingPage() {
  if (isAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  redirect("/get-started");
}
