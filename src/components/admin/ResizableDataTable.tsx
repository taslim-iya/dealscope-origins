import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface ColumnDef<T> {
  id: string;
  label: string;
  minWidth?: number;
  defaultWidth?: number;
  render: (item: T) => React.ReactNode;
  headerRender?: () => React.ReactNode;
  className?: string;
  cellClassName?: string;
  sortKey?: (item: T) => string | number | null | undefined;
}

interface ResizableDataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  rowClassName?: string;
  emptyState?: React.ReactNode;
}

export function ResizableDataTable<T>({
  columns: initialColumns,
  data,
  rowKey,
  onRowClick,
  rowClassName,
  emptyState,
}: ResizableDataTableProps<T>) {
  const [columnOrder, setColumnOrder] = useState<string[]>(initialColumns.map((c) => c.id));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    initialColumns.forEach((col) => {
      widths[col.id] = col.defaultWidth || 150;
    });
    return widths;
  });

  // Sort state
  const [sortColId, setSortColId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Keep column order in sync when columns change
  useEffect(() => {
    setColumnOrder((prev) => {
      const newIds = initialColumns.map((c) => c.id);
      const existing = prev.filter((id) => newIds.includes(id));
      const added = newIds.filter((id) => !prev.includes(id));
      return [...existing, ...added];
    });
  }, [initialColumns]);

  const orderedColumns = columnOrder
    .map((id) => initialColumns.find((c) => c.id === id))
    .filter(Boolean) as ColumnDef<T>[];

  // --- Sort logic ---
  const handleSort = (colId: string) => {
    const col = initialColumns.find((c) => c.id === colId);
    if (!col?.sortKey) return;
    if (sortColId === colId) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColId(colId);
      setSortDir("asc");
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortColId) return data;
    const col = initialColumns.find((c) => c.id === sortColId);
    if (!col?.sortKey) return data;
    const getter = col.sortKey;
    return [...data].sort((a, b) => {
      const aVal = getter(a);
      const bVal = getter(b);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortColId, sortDir, initialColumns]);

  // --- Resize logic ---
  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (colId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = { colId, startX: e.clientX, startWidth: columnWidths[colId] };

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const diff = ev.clientX - resizingRef.current.startX;
        const col = initialColumns.find((c) => c.id === resizingRef.current!.colId);
        const min = col?.minWidth || 40;
        const newWidth = Math.max(min, resizingRef.current.startWidth + diff);
        setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.colId]: newWidth }));
      };

      const onMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [columnWidths, initialColumns]
  );

  // --- Drag reorder logic ---
  const dragColRef = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (colId: string, e: React.DragEvent) => {
    dragColRef.current = colId;
    e.dataTransfer.effectAllowed = "move";
    const el = document.createElement("div");
    el.style.opacity = "0";
    document.body.appendChild(el);
    e.dataTransfer.setDragImage(el, 0, 0);
    setTimeout(() => document.body.removeChild(el), 0);
  };

  const handleDragOver = (colId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (dragColRef.current && dragColRef.current !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDrop = (targetColId: string) => {
    if (!dragColRef.current || dragColRef.current === targetColId) {
      setDragOverCol(null);
      dragColRef.current = null;
      return;
    }
    setColumnOrder((prev) => {
      const fromIdx = prev.indexOf(dragColRef.current!);
      const toIdx = prev.indexOf(targetColId);
      const next = [...prev];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragColRef.current!);
      return next;
    });
    setDragOverCol(null);
    dragColRef.current = null;
  };

  const handleDragEnd = () => {
    setDragOverCol(null);
    dragColRef.current = null;
  };

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const SortIcon = ({ colId }: { colId: string }) => {
    const col = initialColumns.find((c) => c.id === colId);
    if (!col?.sortKey) return null;
    if (sortColId !== colId) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 shrink-0" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 shrink-0" />
      : <ArrowDown className="h-3 w-3 ml-1 shrink-0" />;
  };

  return (
    <div className="overflow-x-auto border border-border rounded-md">
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {orderedColumns.map((col) => (
              <th
                key={col.id}
                style={{ width: columnWidths[col.id], minWidth: col.minWidth || 40, position: "relative" }}
                className={cn(
                  "h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground select-none",
                  dragOverCol === col.id && "bg-accent/40",
                  col.sortKey && "cursor-pointer hover:text-foreground",
                  col.className
                )}
                draggable
                onDragStart={(e) => handleDragStart(col.id, e)}
                onDragOver={(e) => handleDragOver(col.id, e)}
                onDrop={() => handleDrop(col.id)}
                onDragEnd={handleDragEnd}
                onClick={() => handleSort(col.id)}
              >
                <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  {col.headerRender ? col.headerRender() : (
                    <span className="truncate inline-flex items-center">
                      {col.label}
                      <SortIcon colId={col.id} />
                    </span>
                  )}
                </div>
                {/* Resize handle */}
                <div
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10"
                  onMouseDown={(e) => handleResizeStart(col.id, e)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => (
            <tr
              key={rowKey(item)}
              className={cn(
                "border-b border-border transition-colors hover:bg-muted/50",
                onRowClick && "cursor-pointer",
                rowClassName
              )}
              onClick={() => onRowClick?.(item)}
            >
              {orderedColumns.map((col) => (
                <td
                  key={col.id}
                  style={{ width: columnWidths[col.id], maxWidth: columnWidths[col.id] }}
                  className={cn("px-3 py-2 align-middle text-sm overflow-hidden", col.cellClassName)}
                >
                  <div className="truncate">{col.render(item)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
