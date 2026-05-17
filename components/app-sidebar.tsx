"use client";

import Link from "next/link";
import { useState } from "react";
import { SidebarNav, type SidebarItem } from "@/components/sidebar-nav";
import type { ActiveRoute } from "@/components/app-shell";

type AppSidebarProps = {
  active: ActiveRoute;
  items: SidebarItem[];
  tenantName?: string | null;
  logoutAction?: () => void | Promise<void>;
};

export function AppSidebar({ active, items, tenantName, logoutAction }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const displayTenantName = tenantName || "HyperOptimal Team";

  if (collapsed) {
    return (
      <aside className="side-nav is-collapsed" aria-label="Collapsed primary navigation">
        <button
          type="button"
          className="sidebar-expand-button"
          aria-label="Expand navigation"
          onClick={() => setCollapsed(false)}
        >
          ›
        </button>
      </aside>
    );
  }

  return (
    <aside className="side-nav">
      <div className="side-shell-header">
        <div className="side-brand-row">
          <Link href="/dashboard" className="side-brand">
            <span className="brand-mark" aria-hidden="true">
              H
            </span>
            <span>HyperOptimal</span>
          </Link>
          <button
            type="button"
            className="collapse-dot"
            aria-label="Collapse navigation"
            onClick={() => setCollapsed(true)}
          >
            ‹
          </button>
        </div>

        <div className="sidebar-org-switcher">
          <span>Org:</span>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={orgOpen}
            onClick={() => setOrgOpen((current) => !current)}
          >
            <span>{displayTenantName}</span>
            <span aria-hidden="true">⌄</span>
          </button>
          {orgOpen ? (
            <div className="sidebar-org-menu" role="menu">
              <div role="menuitem">{displayTenantName}</div>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="sidebar-sections" aria-label="Primary navigation">
        <SidebarNav active={active} items={items} logoutAction={logoutAction} />
      </nav>
    </aside>
  );
}
