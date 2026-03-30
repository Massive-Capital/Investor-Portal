import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { DataTablePagination } from "../DataTablePagination/DataTablePagination";
import "./data-table.css";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  sortValue?: (row: T) => string | number;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  thClassName?: string;
  tdClassName?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, rowIndex: number) => string;
  emptyLabel: string;
  /** Use Members page table chrome (`.um_table`, sort headers, wrap). */
  visualVariant?: "default" | "members";
  /** Extra classes on `<table>` when `visualVariant` is `members` (e.g. `um_table_members`). */
  membersTableClassName?: string;
  /** Client-side pagination after sort. `totalItems` should match `rows.length`. */
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (nextPage: number) => void;
    onPageSizeChange?: (nextSize: number) => void;
    ariaLabel?: string;
  };
};

function sortHeaderLabel(header: ReactNode, columnId: string): string {
  if (typeof header === "string" || typeof header === "number") {
    return String(header);
  }
  return columnId;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyLabel,
  visualVariant = "default",
  membersTableClassName = "",
  pagination,
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function onSortColumn(id: string) {
    const col = columns.find((c) => c.id === id);
    if (!col?.sortValue) return;
    if (sortCol === id) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(id);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    const col = columns.find((c) => c.id === sortCol);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, columns, sortCol, sortDir]);

  const displayRows = useMemo(() => {
    if (!pagination) return sortedRows;
    const start = (pagination.page - 1) * pagination.pageSize;
    return sortedRows.slice(start, start + pagination.pageSize);
  }, [sortedRows, pagination]);

  if (rows.length === 0) {
    if (visualVariant === "members") {
      return (
        <div className="um_table_wrap">
          <p className="um_hint" role="status">
            {emptyLabel}
          </p>
        </div>
      );
    }
    return (
      <div className="data_table_empty" role="status">
        {emptyLabel}
      </div>
    );
  }

  const wrapClass =
    visualVariant === "members"
      ? "um_table_wrap data_table_shell"
      : "data_table_scroll";
  const tableClass =
    visualVariant === "members"
      ? ["um_table", "um_table_sortable", membersTableClassName].filter(Boolean).join(" ")
      : "data_table";

  const tableEl = (
    <table className={tableClass}>
        <thead>
          <tr>
            {columns.map((col) => {
              const align =
                col.align === "right"
                  ? "right"
                  : col.align === "center"
                    ? "center"
                    : "left";
              const active = sortCol === col.id;
              const ariaSort = col.sortValue
                ? active
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
                : undefined;

              const thClass = [
                col.thClassName,
                visualVariant === "default" && active ? "data_table_th_sorted" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const labelForSort = sortHeaderLabel(col.header, col.id);

              if (visualVariant === "members" && col.sortValue) {
                const btnClass = [
                  "um_sort_header_ctl",
                  col.align === "right" ? "um_sort_header_ctl_align_end" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={thClass || undefined}
                    style={{ textAlign: align }}
                    aria-sort={ariaSort}
                  >
                    <button
                      type="button"
                      className={btnClass || undefined}
                      onClick={() => onSortColumn(col.id)}
                      aria-label={
                        active
                          ? `${labelForSort}, sorted ${sortDir === "asc" ? "ascending" : "descending"}. Click to reverse.`
                          : `Sort by ${labelForSort}`
                      }
                    >
                      <span className="um_sort_header_label">{col.header}</span>
                      {active ? (
                        sortDir === "asc" ? (
                          <ArrowUp
                            size={14}
                            className="um_sort_header_icon"
                            aria-hidden
                          />
                        ) : (
                          <ArrowDown
                            size={14}
                            className="um_sort_header_icon"
                            aria-hidden
                          />
                        )
                      ) : (
                        <ArrowUpDown
                          size={14}
                          className="um_sort_header_icon um_sort_header_icon_idle"
                          aria-hidden
                        />
                      )}
                    </button>
                  </th>
                );
              }

              if (visualVariant === "members") {
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={thClass || undefined}
                    style={{ textAlign: align }}
                  >
                    {col.header}
                  </th>
                );
              }

              return (
                <th
                  key={col.id}
                  className={thClass || undefined}
                  style={{ textAlign: align }}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      className="data_table_sort_btn"
                      onClick={() => onSortColumn(col.id)}
                    >
                      {col.header}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={getRowKey(row, i)}>
              {columns.map((col) => {
                const align =
                  col.align === "right"
                    ? "right"
                    : col.align === "center"
                      ? "center"
                      : "left";
                const tdClass = col.tdClassName;
                return (
                  <td
                    key={col.id}
                    className={tdClass || undefined}
                    style={{ textAlign: align }}
                  >
                    {col.cell(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
    </table>
  );

  if (visualVariant === "members") {
    return (
      <div className={wrapClass}>
        <div className="data_table_scroll_region">{tableEl}</div>
        {pagination && pagination.totalItems > 0 ? (
          <DataTablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
            ariaLabel={pagination.ariaLabel}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      {tableEl}
      {pagination && pagination.totalItems > 0 ? (
        <DataTablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
          ariaLabel={pagination.ariaLabel}
        />
      ) : null}
    </div>
  );
}
