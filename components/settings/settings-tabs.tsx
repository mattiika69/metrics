import Link from "next/link";

export type SettingsTab = "team" | "billing" | "integrations" | "slack" | "telegram";

const settingsTabs = [
  { id: "team", label: "Team", href: "/settings/team" },
  { id: "billing", label: "Billing", href: "/settings/billing" },
  { id: "integrations", label: "Integrations", href: "/settings/integrations" },
  { id: "slack", label: "Slack", href: "/settings/slack" },
  { id: "telegram", label: "Telegram", href: "/settings/telegram" },
] as const;

export function SettingsTabs({ active }: { active: SettingsTab }) {
  return (
    <nav className="settings-tabs" aria-label="Settings">
      {settingsTabs.map((tab) => (
        <Link href={tab.href} className={active === tab.id ? "active" : ""} key={tab.id}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
