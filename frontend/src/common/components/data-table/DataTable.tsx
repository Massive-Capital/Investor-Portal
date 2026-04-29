import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { DataTablePagination } from "../DataTablePagination/DataTablePagination";
import "./data-table.css";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  sortValue?: (row: T) => string | number;
  /** `rowIndex` is the index in the current page (sorted + paginated slice). */
  cell: (row: T, rowIndex?: number) => ReactNode;
  align?: "left" | "right" | "center";
  thClassName?: string;
  tdClassName?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, rowIndex: number) => string;
  emptyLabel: string;
  /** `role` on the empty-state message when `visualVariant` is `members` (e.g. `status` while loading). */
  emptyStateRole?: "status" | "presentation";
  /**
   * Members variant: show a single body row with a centered spinner (table headers still visible).
   * Use instead of a separate loading block above the table.
   */
  isLoading?: boolean;
  /** Use Members page table chrome (`.um_table`, sort headers, wrap). */
  visualVariant?: "default" | "members";
  /** Extra classes on `<table>` when `visualVariant` is `members` (e.g. `um_table_members`). */
  membersTableClassName?: string;
  /**
   * When `visualVariant` is `members`: `plain` matches the main Members page — a single
   * `.um_table_wrap` with no inner `.data_table_shell` / scroll region. Default keeps the
   * tab/shell layout used elsewhere (e.g. company Deals list).
   */
  membersShell?: "default" | "plain";
  /** Client-side pagination after sort. `totalItems` should match `rows.length`. */
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (nextPage: number) => void;
    onPageSizeChange?: (nextSize: number) => void;
    ariaLabel?: string;
  };
  /** Optional extra `class` on each body row (e.g. suspended state). */
  getRowClassName?: (row: T) => string | undefined;
  /** Default sort when the table first mounts (members-style sortable tables). */
  initialSort?: { columnId: string; direction: "asc" | "desc" };
  /**
   * Row click (e.g. draft “continue editing”). Ignored when the event target is inside
   * a link, button, or menu item so actions stay usable.
   */
  onBodyRowClick?: (row: T, rowIndex: number) => void;
  /**
   * When `visualVariant` is `members`: keep the first column visible during horizontal
   * scroll (`position: sticky; left: 0`). Defaults to `true` for members-style tables.
   */
  stickyFirstColumn?: boolean;
};

function sortHeaderLabel(header: ReactNode, columnId: string): string {
  if (typeof header === "string" || typeof header === "number") {
    return String(header);
  }
  return columnId;
}

/** Members variant: omit inline text-align when `align` is unset so `.um_td_numeric` etc. apply. */
function membersThTdTextAlign(
  visualVariant: "default" | "members",
  col: { align?: "left" | "right" | "center" },
): "left" | "right" | "center" | undefined {
  if (visualVariant === "members" && col.align === undefined) {
    return undefined;
  }
  if (col.align === "right") return "right";
  if (col.align === "center") return "center";
  return "left";
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyLabel,
  emptyStateRole,
  visualVariant = "default",
  membersTableClassName = "",
  membersShell = "default",
  pagination,
  getRowClassName,
  initialSort,
  onBodyRowClick,
  stickyFirstColumn: stickyFirstColumnProp,
  isLoading = false,
}: DataTableProps<T>) {
  const stickyFirstColumn =
    stickyFirstColumnProp ?? visualVariant === "members";
  /** Match Investors tab: same table classes when callers omit `membersTableClassName`. */
  const membersTableClassResolved =
    visualVariant === "members" &&
    !String(membersTableClassName ?? "").trim()
      ? "um_table_members deal_inv_table"
      : (membersTableClassName ?? "");
  const [sortCol, setSortCol] = useState<string | null>(
    () => initialSort?.columnId ?? null,
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    () => initialSort?.direction ?? "asc",
  );

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

  if (rows.length === 0 && visualVariant !== "members") {
    return (
      <div className="data_table_empty" role="status">
        {emptyLabel}
      </div>
    );
  }

  const wrapClass =
    visualVariant === "members"
      ? membersShell === "plain"
        ? "um_table_wrap"
        : "um_table_wrap data_table_shell"
      : "data_table_scroll";
  const tableClass =
    visualVariant === "members"
      ? [
          "um_table",
          "um_table_sortable",
          membersTableClassResolved,
          stickyFirstColumn ? "data_table_sticky_first" : "",
        ]
          .filter(Boolean)
          .join(" ")
      : stickyFirstColumn
        ? "data_table data_table_sticky_first"
        : "data_table";

  const tableEl = (
    <table className={tableClass}>
        <thead>
          <tr>
            {columns.map((col, colIndex) => {
              const textAlign = membersThTdTextAlign(visualVariant, col);
              const thStyle =
                textAlign !== undefined ? { textAlign } : undefined;
              const active = sortCol === col.id;
              const ariaSort = col.sortValue
                ? active
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
                : undefined;

              const stickyFirst = stickyFirstColumn && colIndex === 0;
              const thClass = [
                col.thClassName,
                visualVariant === "default" && active ? "data_table_th_sorted" : "",
                stickyFirst ? "data_table_col_sticky" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const labelForSort = sortHeaderLabel(col.header, col.id);

              if (visualVariant === "members" && col.sortValue) {
                const btnClass = [
                  "um_sort_header_ctl",
                  col.align === "right"
                    ? "um_sort_header_ctl_align_end"
                    : col.align === "center"
                      ? "um_sort_header_ctl_align_center"
                      : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={thClass || undefined}
                    style={thStyle}
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
                    style={thStyle}
                  >
                    {col.header}
                  </th>
                );
              }

              return (
                <th
                  key={col.id}
                  className={thClass || undefined}
                  style={thStyle}
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
          {isLoading && visualVariant === "members" ? (
            <tr>
              <td
                colSpan={columns.length}
                className="data_table_empty_members_cell data_table_members_loading_cell"
                role="status"
                aria-label="Loading"
              >
                <div
                  className="data_table_loader_spinner"
                  aria-hidden
                />
              </td>
            </tr>
          ) : rows.length === 0 && visualVariant === "members" ? (
            <tr>
              <td
                colSpan={columns.length}
                className="data_table_empty_members_cell"
              >
                <p
                  className="um_hint"
                  role={emptyStateRole ?? "status"}
                >
                  {emptyLabel}
                </p>
              </td>
            </tr>
          ) : (
            displayRows.map((row, i) => {
              const rowClass = getRowClassName?.(row);
              function handleRowClick(e: MouseEvent<HTMLTableRowElement>) {
                if (!onBodyRowClick) return;
                const t = e.target as HTMLElement | null;
                if (!t) return;
                if (t.closest("a[href], button, [role='menuitem'], input, label"))
                  return;
                onBodyRowClick(row, i);
              }
              return (
              <tr
                key={getRowKey(row, i)}
                className={rowClass || undefined}
                onClick={onBodyRowClick ? handleRowClick : undefined}
              >
                {columns.map((col, colIndex) => {
                  const textAlign = membersThTdTextAlign(visualVariant, col);
                  const tdStyle =
                    textAlign !== undefined ? { textAlign } : undefined;
                  const stickyFirst = stickyFirstColumn && colIndex === 0;
                  const tdClass = [
                    col.tdClassName,
                    stickyFirst ? "data_table_col_sticky" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <td
                      key={col.id}
                      className={tdClass || undefined}
                      style={tdStyle}
                    >
                      {col.cell(row, i)}
                    </td>
                  );
                })}
              </tr>
            );
            })
          )}
        </tbody>
    </table>
  );

  const scrollRegionClass = [
    "data_table_scroll_region",
    stickyFirstColumn ? "data_table_scroll_region_sticky_first" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (visualVariant === "members") {
    const tableBlock =
      membersShell === "plain" ? (
        stickyFirstColumn ? (
          <div className={scrollRegionClass}>{tableEl}</div>
        ) : (
          tableEl
        )
      ) : (
        <div className={scrollRegionClass}>{tableEl}</div>
      );
    return (
      <div className={wrapClass}>
        {tableBlock}
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
      {stickyFirstColumn ? (
        <div className={scrollRegionClass}>{tableEl}</div>
      ) : (
        tableEl
      )}
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
