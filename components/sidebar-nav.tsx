"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveSidebarOrderAction } from "@/lib/navigation/sidebar-actions";
import type { ActiveRoute } from "@/components/app-shell";

export type SidebarItem = {
  id: ActiveRoute;
  label: string;
  href: string;
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
  const [orderedItems, setOrderedItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const itemIds = useMemo(() => orderedItems.map((item) => item.id), [orderedItems]);

  function persist(nextItems: SidebarItem[]) {
    startTransition(() => {
      void saveSidebarOrderAction(nextItems.map((item) => item.id));
    });
  }

  return (
    <div className="sidebar-flat-nav" aria-label="Draggable sidebar navigation">
      {orderedItems.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          prefetch
          draggable
          data-item-id={item.id}
          aria-label={`${item.label}. Drag to reorder.`}
          className={[
            "sidebar-parent-link",
            active === item.id ? "active" : "",
            draggedId === item.id ? "dragging" : "",
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
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
