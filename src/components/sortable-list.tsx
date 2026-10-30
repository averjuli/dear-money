"use client";

import { useRef, useState } from "react";
import { moveItem } from "@/domain/priority";
import { cn } from "@/lib/utils";
import { HandleIcon } from "./icons";

interface Drag {
  from: number;
  to: number;
  startY: number;
  dy: number;
  /** Middle Y of every row at drag start, in client coordinates. */
  middles: number[];
  height: number;
}

/**
 * Reorders rows by dragging the handle, with a finger or a mouse.
 * The handle also reacts to arrow keys for keyboard users.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderRow,
  rowClassName,
  handleLabel,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderRow: (item: T, index: number) => React.ReactNode;
  rowClassName?: (item: T, index: number) => string | undefined;
  handleLabel: (item: T) => string;
}) {
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);

  function targetIndex(state: Drag, clientY: number): number {
    const centre = state.middles[state.from] + (clientY - state.startY);
    let index = 0;
    for (let i = 0; i < state.middles.length; i++) {
      if (i === state.from) continue;
      if (centre > state.middles[i]) index++;
    }
    return index;
  }

  function onPointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const middles = rows.current.map((row) => {
      const rect = row?.getBoundingClientRect();
      return rect ? rect.top + rect.height / 2 : 0;
    });
    const height = rows.current[index]?.getBoundingClientRect().height ?? 56;
    setDrag({
      from: index,
      to: index,
      startY: e.clientY,
      dy: 0,
      middles,
      height,
    });
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    setDrag({
      ...drag,
      dy: e.clientY - drag.startY,
      to: targetIndex(drag, e.clientY),
    });
  }

  function onPointerUp() {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    if (from !== to) onReorder(moveItem(items, from, to));
  }

  function offsetFor(index: number): number {
    if (!drag) return 0;
    if (index === drag.from) return drag.dy;
    if (drag.from < drag.to && index > drag.from && index <= drag.to)
      return -drag.height;
    if (drag.from > drag.to && index >= drag.to && index < drag.from)
      return drag.height;
    return 0;
  }

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((item, index) => {
        const dragging = drag?.from === index;
        return (
          <li
            key={item.id}
            ref={(el) => {
              rows.current[index] = el;
            }}
            className={cn(
              "relative flex items-center gap-2.5 border-b border-line last:border-b-0",
              dragging
                ? "z-10 bg-surface shadow-[0_6px_20px_rgba(20,33,27,0.15)]"
                : "",
              rowClassName?.(item, index),
            )}
            style={{
              transform: `translateY(${offsetFor(index)}px)`,
              transition: dragging ? "none" : "transform 150ms ease",
            }}
          >
            {renderRow(item, index)}
            <button
              type="button"
              aria-label={handleLabel(item)}
              className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center bg-transparent text-dash active:cursor-grabbing"
              onPointerDown={(e) => onPointerDown(e, index)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" && index > 0) {
                  e.preventDefault();
                  onReorder(moveItem(items, index, index - 1));
                }
                if (e.key === "ArrowDown" && index < items.length - 1) {
                  e.preventDefault();
                  onReorder(moveItem(items, index, index + 1));
                }
              }}
            >
              <HandleIcon />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
