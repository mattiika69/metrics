"use client";

import Link from "next/link";
import { useState } from "react";
import { SidebarNav, type SidebarItem } from "@/components/sidebar-nav";
import type { ActiveRoute } from "@/components/app-shell";

type AppSidebarProps = {
  active: ActiveRoute;
  items: SidebarItem[];
};

export function AppSidebar({ active, items }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

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
          <Link href="/dashboard" prefetch={false} className="side-brand">
            <span className="brand-mark" aria-hidden="true">
              H
            </span>
            <span>ScalingMetrics</span>
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
      </div>

      <nav className="sidebar-sections" aria-label="Primary navigation">
        <SidebarNav active={active} items={items} />
      </nav>
    </aside>
  );
}
