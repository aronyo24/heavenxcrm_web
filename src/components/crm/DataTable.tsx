import { useState } from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildPaginationItems } from "@/lib/pagination"
import { cn } from "@/lib/utils"

interface DataTablePagination {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  // Pass both to show a "Rows per page" picker in the footer.
  pageSize?: number
  onPageSizeChange?: (size: number) => void
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  isLoading?: boolean
  emptyMessage?: string
  pagination?: DataTablePagination
  onRowClick?: (row: TData) => void
  // When set, a "#" column shows each row's position in the whole list
  // (offset = rows on earlier pages), instead of exposing database ids.
  rowNumberOffset?: number
  // Highlight rows (e.g. selected for a bulk action).
  isRowHighlighted?: (row: TData) => boolean
  // Rendered inside the card above the table (search, tabs, filters).
  toolbar?: React.ReactNode
  // Total rows across all pages - shows "Showing 1–25 of 80" in the footer.
  totalCount?: number
  itemLabel?: string
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  emptyMessage = "No results.",
  pagination,
  onRowClick,
  rowNumberOffset,
  isRowHighlighted,
  toolbar,
  totalCount,
  itemLabel = "results",
}: DataTableProps<TData>) {
  const showRowNumbers = rowNumberOffset !== undefined
  const colSpan = columns.length + (showRowNumbers ? 1 : 0)
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {toolbar ? <div className="border-b px-4 py-3">{toolbar}</div> : null}
      <Table>
        <TableHeader className="bg-slate-50 dark:bg-white/[0.03]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {showRowNumbers && (
                <TableHead className="h-10 w-12 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</TableHead>
              )}
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sortDir = header.column.getIsSorted()
                return (
                  <TableHead key={header.id} className="h-10 px-2.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-slate-500">
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 uppercase tracking-wider hover:text-foreground transition-colors"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDir === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : sortDir === "desc" ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={colSpan} className="py-2.5">
                  <div className="h-4 rounded bg-muted/60 animate-pulse" />
                </TableCell>
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row, index) => (
              <TableRow
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  // Zebra stripes so long lists are easy to follow across.
                  "h-11 border-b-border/60 bg-card even:bg-slate-100/80 dark:even:bg-white/[0.04] hover:bg-emerald-50 dark:hover:bg-emerald-500/10",
                  isRowHighlighted?.(row.original) && "bg-emerald-50 even:bg-emerald-50 dark:bg-emerald-500/10 dark:even:bg-emerald-500/10",
                  onRowClick && "cursor-pointer",
                )}
              >
                {showRowNumbers && (
                  <TableCell className="py-1 w-12 text-center text-xs tabular-nums text-slate-400">
                    {rowNumberOffset + index + 1}
                  </TableCell>
                )}
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="whitespace-nowrap px-2.5 py-1">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination && (totalCount !== undefined ? totalCount > 0 : pagination.totalPages > 1) ? (
        <DataTablePager
          pagination={pagination}
          totalCount={totalCount}
          rowCount={data.length}
          offset={pagination.pageSize ? (pagination.page - 1) * pagination.pageSize : rowNumberOffset}
          itemLabel={itemLabel}
        />
      ) : null}
    </div>
  )
}

function DataTablePager({
  pagination, totalCount, rowCount, offset, itemLabel,
}: {
  pagination: DataTablePagination
  totalCount: number | undefined
  rowCount: number
  offset: number | undefined
  itemLabel: string
}) {
  const { page, totalPages, onPageChange, pageSize, onPageSizeChange } = pagination
  const pages = Math.max(1, totalPages)
  const go = (next: number) => onPageChange(Math.min(pages, Math.max(1, next)))
  const navButton = "h-8 w-8 p-0 shadow-none"

  return (
    <div className="flex flex-col gap-3 border-t bg-slate-50 px-4 py-2.5 text-xs text-muted-foreground dark:bg-white/[0.03] md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {totalCount !== undefined ? <span>
          {offset !== undefined && rowCount > 0 ? (
            <>
              Showing <span className="font-medium text-foreground tabular-nums">{offset + 1}–{offset + rowCount}</span> of{" "}
            </>
          ) : "Total "}
          <span className="font-medium text-foreground tabular-nums">{totalCount}</span> {itemLabel}
        </span> : null}
        {pageSize && onPageSizeChange ? (
          <span className="flex items-center gap-2">
            Rows per page
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-[70px] bg-background text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden whitespace-nowrap sm:inline">
          Page <span className="font-medium text-foreground tabular-nums">{page}</span> of{" "}
          <span className="font-medium text-foreground tabular-nums">{pages}</span>
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className={navButton} title="First page" disabled={page <= 1} onClick={() => go(1)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className={navButton} title="Previous page" disabled={page <= 1} onClick={() => go(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {buildPaginationItems(page, pages).map((item, i) =>
            item === "ellipsis" ? (
              <span key={`e-${i}`} className="w-6 text-center">…</span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === page ? "page" : undefined}
                onClick={() => go(item)}
                className={cn(
                  "h-8 min-w-8 rounded-md border px-2 text-xs font-medium tabular-nums transition-colors",
                  item === page
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-transparent text-foreground hover:border-border hover:bg-background",
                )}
              >
                {item}
              </button>
            ),
          )}
          <Button variant="outline" size="sm" className={navButton} title="Next page" disabled={page >= pages} onClick={() => go(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className={navButton} title="Last page" disabled={page >= pages} onClick={() => go(pages)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
