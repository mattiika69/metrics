"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveSidebarOrderAction } from "@/lib/navigation/sidebar-actions";
import type { ActiveRoute } from "@/components/app-shell";

export type SidebarChildItem = {
  id: string;
  label: string;
  href: string;
  activeRoutes?: ActiveRoute[];
};

export type SidebarItem = {
  id: ActiveRoute;
  label: string;
  href: string;
  section: "metrics" | "settings";
  children?: SidebarChildItem[];
};

function moveItem(items: SidebarItem[], draggedId: string, targetId: string) {
  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const toIndex = items.findIndex((item) => item.id === targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function SidebarNav({
  active,
  items,
}: {
  active: ActiveRoute;
  items: SidebarItem[];
}) {
  const pathname = usePathname();
  const [orderedItems, setOrderedItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const itemIds = useMemo(() => orderedItems.map((item) => item.id), [orderedItems]);
  const metricsItems = orderedItems.filter((item) => item.section === "metrics");
  const settingsItems = orderedItems.filter((item) => item.section === "settings");
  const groups = [
    {
      id: "metrics",
      label: "Metrics",
      items: metricsItems,
      expanded: true,
      accent: true,
    },
    {
      id: "settings",
      label: "Settings",
      items: settingsItems,
      expanded: true,
      dividerBefore: true,
    },
  ];

  function persist(nextItems: SidebarItem[]) {
    startTransition(() => {
      void saveSidebarOrderAction(nextItems.map((item) => item.id));
    });
  }

  function isChildActive(child: SidebarChildItem) {
    if (pathname === child.href) return true;
    return child.activeRoutes?.includes(active) ?? false;
  }

  function isItemActive(item: SidebarItem) {
    if (item.children?.some(isChildActive)) return true;
    return active === item.id || (item.id === "settings" && active.startsWith("settings"));
  }

  return (
    <div className="sidebar-grouped-nav" aria-label="Draggable sidebar navigation">
      {groups.map((group) => (
        <section
          className={[
            "sidebar-group",
            group.dividerBefore ? "with-divider" : "",
            group.accent ? "with-accent" : "",
          ].filter(Boolean).join(" ")}
          key={group.id}
        >
          <div className="sidebar-label-row">
            <button type="button" className="sidebar-label-button" aria-expanded={group.expanded}>
              <svg
                className={[
                  "sidebar-label-chevron",
                  group.expanded ? "expanded" : "",
                ].filter(Boolean).join(" ")}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>{group.label}</span>
            </button>
          </div>
          {group.expanded ? (
            <div className="sidebar-subnav">
              {group.items.map((item) => {
                const itemActive = isItemActive(item);

                return (
                  <div
                    key={item.id}
                    draggable
                    data-item-id={item.id}
                    className={[
                      item.children?.length ? "sidebar-parent-block" : "sidebar-menu-row",
                      draggedId === item.id ? "dragging" : "",
                      itemActive ? "parent-active" : "",
                    ].filter(Boolean).join(" ")}
                    onDragStart={(event) => {
                      setDraggedId(item.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const droppedId = event.dataTransfer.getData("text/plain") || draggedId;
                      if (!droppedId || !itemIds.includes(droppedId as ActiveRoute)) return;
                      const nextItems = moveItem(orderedItems, droppedId, item.id);
                      setOrderedItems(nextItems);
                      setDraggedId(null);
                      persist(nextItems);
                    }}
                    onDragEnd={() => setDraggedId(null)}
                  >
                    {item.children?.length ? (
                      <>
                        <div className="sidebar-parent-row">
                          <span className="sidebar-parent-label">{item.label}</span>
                          <span className="sidebar-drag-handle" aria-hidden="true">⋮⋮</span>
                        </div>
                        <div className="sidebar-child-nav">
                          {item.children.map((child) => (
                            <Link
                              href={child.href}
                              prefetch
                              aria-label={child.label}
                              className={[
                                "sidebar-sub-link",
                                isChildActive(child) ? "active" : "",
                              ].filter(Boolean).join(" ")}
                              key={child.id}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <Link
                          href={item.href}
                          prefetch
                          aria-label={item.label}
                          className={[
                            "sidebar-sub-link",
                            itemActive ? "active" : "",
                          ].filter(Boolean).join(" ")}
                        >
                          {item.label}
                        </Link>
                        <span className="sidebar-drag-handle" aria-hidden="true">⋮⋮</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
