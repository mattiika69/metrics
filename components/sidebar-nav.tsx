"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveSidebarOrderAction } from "@/lib/navigation/sidebar-actions";
import type { ActiveRoute } from "@/components/app-shell";

export type SidebarChildItem = {
  id: string;
  label: string;
  href?: string;
  activeRoutes?: ActiveRoute[];
  action?: "logout";
  danger?: boolean;
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
  logoutAction,
}: {
  active: ActiveRoute;
  items: SidebarItem[];
  logoutAction?: () => void | Promise<void>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [orderedItems, setOrderedItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const itemIds = useMemo(() => orderedItems.map((item) => item.id), [orderedItems]);
  const activeParentId = useMemo(() => {
    return (
      items.find((item) => {
        if (!item.children?.length) return false;
        return item.children.some((child) => child.activeRoutes?.includes(active));
      })?.id ?? null
    );
  }, [active, items]);
  const initialExpandedParentId = useMemo(
    () => activeParentId ?? items.find((item) => item.children?.length)?.id ?? null,
    [activeParentId, items],
  );
  const [expandedParentId, setExpandedParentId] = useState<ActiveRoute | null>(initialExpandedParentId);

  function persist(nextItems: SidebarItem[]) {
    startTransition(() => {
      void saveSidebarOrderAction(nextItems.map((item) => item.id));
    });
  }

  function isChildActive(child: SidebarChildItem) {
    if (child.href) {
      const [hrefPathname, hrefSearch = ""] = child.href.split("?");
      if (pathname === hrefPathname && hrefSearch === searchParams.toString()) return true;
    }
    return child.activeRoutes?.includes(active) ?? false;
  }

  function isItemActive(item: SidebarItem) {
    if (item.children?.some(isChildActive)) return true;
    return active === item.id || (item.id === "settings" && active.startsWith("settings"));
  }

  function toggleParent(itemId: ActiveRoute) {
    setExpandedParentId((current) => (current === itemId ? null : itemId));
  }

  return (
    <div className="sidebar-grouped-nav" aria-label="Draggable sidebar navigation">
      <section className="sidebar-group with-accent">
        <div className="sidebar-subnav">
          {orderedItems.map((item, index) => {
            const itemActive = isItemActive(item);
            const itemExpanded = expandedParentId === item.id;
            const isFirstSettingsItem =
              item.section === "settings" && orderedItems[index - 1]?.section !== "settings";

            return (
              <div
                key={item.id}
                draggable
                data-item-id={item.id}
                className={[
                  isFirstSettingsItem ? "with-divider" : "",
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
                      <button
                        type="button"
                        aria-label={item.label}
                        className={[
                          "sidebar-parent-trigger",
                          itemExpanded ? "expanded" : "",
                        ].filter(Boolean).join(" ")}
                        aria-expanded={itemExpanded}
                        onClick={() => toggleParent(item.id)}
                      >
                        <svg
                          className={[
                            "sidebar-parent-chevron",
                            itemExpanded ? "expanded" : "",
                          ].filter(Boolean).join(" ")}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span>{item.label}</span>
                      </button>
                      <span className="sidebar-drag-handle" aria-hidden="true">⋮⋮</span>
                    </div>
                    {itemExpanded ? (
                      <div className="sidebar-child-nav">
                        {item.children.map((child) => {
                          if (child.action === "logout") {
                            return logoutAction ? (
                              <form action={logoutAction} key={child.id}>
                                <button
                                  type="submit"
                                  className={[
                                    "sidebar-sub-link",
                                    "sidebar-action-link",
                                    child.danger ? "danger" : "",
                                  ].filter(Boolean).join(" ")}
                                >
                                  {child.label}
                                </button>
                              </form>
                            ) : null;
                          }

                          if (!child.href) return null;

                          return (
                            <Link
                              href={child.href}
                              prefetch={false}
                              aria-label={child.label}
                              aria-current={isChildActive(child) ? "page" : undefined}
                              className={[
                                "sidebar-sub-link",
                                isChildActive(child) ? "active" : "",
                              ].filter(Boolean).join(" ")}
                              key={child.id}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Link
                      href={item.href}
                      prefetch={false}
                      aria-label={item.label}
                      aria-current={itemActive ? "page" : undefined}
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
      </section>
    </div>
  );
}
