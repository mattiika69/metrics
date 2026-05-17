import Link from "next/link";

export type SettingsTab =
  | "account"
  | "team"
  | "billing"
  | "integrations"
  | "scheduling"
  | "slack"
  | "telegram"
  | "agent";

const settingsTabs = [
  { id: "account", label: "Account", href: "/settings/account" },
  { id: "team", label: "Team", href: "/settings/team" },
  { id: "billing", label: "Billing", href: "/settings/billing" },
  { id: "integrations", label: "Integrations", href: "/settings/integrations" },
  { id: "scheduling", label: "Scheduling", href: "/settings/scheduling" },
  { id: "slack", label: "Slack", href: "/settings/slack" },
  { id: "telegram", label: "Telegram", href: "/settings/telegram" },
  { id: "agent", label: "AI Agent", href: "/settings/agent" },
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

export function SettingsHeader({ title }: { title: string }) {
  return (
    <header className="settings-page-title">
      <h1>{title}</h1>
      <p>MEMBER SINCE MARCH 2026</p>
    </header>
  );
}
