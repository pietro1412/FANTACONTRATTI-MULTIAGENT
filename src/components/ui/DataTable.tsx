import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from 'react'

// --- Types ---

export interface ColumnDef<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortable?: boolean
  sortFn?: (a: T, b: T) => number
  className?: string
  headerClassName?: string
  /** Width class for desktop/tablet (e.g. 'w-32', 'min-w-[120px]') */
  width?: string
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  /** Column keys visible on mobile card header (max 3-4) */
  mobileColumns?: string[]
  /** Column keys visible on tablet (subset) */
  tabletColumns?: string[]
  /** Column keys visible on desktop (all by default) */
  desktopColumns?: string[]
  /** Custom mobile card renderer — overrides default card */
  renderMobileCard?: (row: T, expanded: boolean) => ReactNode
  /** Sortable columns (global toggle) */
  sortable?: boolean
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  /** Expandable rows on desktop/tablet */
  expandable?: boolean
  renderExpandedRow?: (row: T) => ReactNode
  /** Items per page — 0 means no pagination */
  pageSize?: number
  /** Unique key extractor */
  getRowKey: (row: T) => string
  /** Optional className for the wrapper */
  className?: string
  /** Optional empty state */
  emptyState?: ReactNode
  /** Optional row click */
  onRowClick?: (row: T) => void
}

// --- Sorting hook ---

type SortDir = 'asc' | 'desc'

function useSorting<T>(
  data: T[],
  columns: ColumnDef<T>[],
  defaultSort?: { key: string; dir: SortDir }
) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null)
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? 'asc')

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortFn) return data
    const dir = sortDir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => dir * col.sortFn!(a, b))
  }, [data, sortKey, sortDir, columns])

  const toggleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
    },
    [sortKey]
  )

  return { sorted, sortKey, sortDir, toggleSort }
}

// --- Pagination hook ---

function usePagination<T>(data: T[], pageSize: number) {
  const [page, setPage] = useState(0)
  const totalPages = pageSize > 0 ? Math.ceil(data.length / pageSize) : 1

  // Reset to page 0 when data length changes
  useEffect(() => {
    setPage(0)
  }, [data.length])

  const paged = useMemo(() => {
    if (pageSize <= 0) return data
    return data.slice(page * pageSize, (page + 1) * pageSize)
  }, [data, page, pageSize])

  return { paged, page, totalPages, setPage }
}

// --- Scroll shadow hook ---

function useScrollShadow(ref: React.RefObject<HTMLDivElement | null>) {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [ref])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [ref, update])

  return { canScrollLeft, canScrollRight }
}

// --- Sort icon ---

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="w-3.5 h-3.5 text-gray-400 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    )
  }
  return (
    <svg className="w-3.5 h-3.5 text-primary-400 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {dir === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      )}
    </svg>
  )
}

// --- Pagination controls ---

function PaginationControls({
  page,
  totalPages,
  setPage,
}: {
  page: number
  totalPages: number
  setPage: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 py-3 border-t border-surface-50/20">
      <button
        onClick={() => { setPage(Math.max(0, page - 1)); }}
        disabled={page === 0}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-300 text-gray-300 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Pagina precedente"
      >
        &laquo; Prec
      </button>
      <span className="text-xs text-gray-400">
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => { setPage(Math.min(totalPages - 1, page + 1)); }}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-300 text-gray-300 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Pagina successiva"
      >
        Succ &raquo;
      </button>
    </div>
  )
}

// --- Main DataTable ---

export function DataTable<T>({
  data,
  columns,
  mobileColumns,
  tabletColumns,
  desktopColumns,
  renderMobileCard,
  sortable = false,
  defaultSort,
  expandable = false,
  renderExpandedRow,
  pageSize = 0,
  getRowKey,
  className = '',
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  const { sorted, sortKey, sortDir, toggleSort } = useSorting(data, columns, defaultSort)
  const { paged, page, totalPages, setPage } = usePagination(sorted, pageSize)

  const scrollRef = useRef<HTMLDivElement>(null)
  const { canScrollLeft, canScrollRight } = useScrollShadow(scrollRef)

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Reset expanded on data change
  useEffect(() => {
    setExpandedRows(new Set())
  }, [data.length])

  const toggleExpand = useCallback(
    (key: string) => {
      setExpandedRows((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return next
      })
    },
    []
  )

  // Column subsets
  const mobileKeys = useMemo(() => new Set(mobileColumns ?? columns.slice(0, 3).map((c) => c.key)), [mobileColumns, columns])
  const tabletKeys = useMemo(() => new Set(tabletColumns ?? columns.slice(0, 6).map((c) => c.key)), [tabletColumns, columns])
  const desktopKeys = useMemo(() => new Set(desktopColumns ?? columns.map((c) => c.key)), [desktopColumns, columns])

  const tabletCols = useMemo(() => columns.filter((c) => tabletKeys.has(c.key)), [columns, tabletKeys])
  const desktopCols = useMemo(() => columns.filter((c) => desktopKeys.has(c.key)), [columns, desktopKeys])
  const mobilePrimaryCols = useMemo(() => columns.filter((c) => mobileKeys.has(c.key)), [columns, mobileKeys])
  const mobileDetailCols = useMemo(
    () => columns.filter((c) => !mobileKeys.has(c.key)),
    [columns, mobileKeys]
  )

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className={`bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden ${className}`}>
      {/* ====== DESKTOP TABLE (lg+) ====== */}
      <div className="hidden lg:block">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="bg-surface-300 border-b border-surface-50/20">
              {expandable && <th className="w-8 px-2" />}
              {desktopCols.map((col) => {
                const isSortable = sortable && col.sortable !== false && !!col.sortFn
                const isActive = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide ${isSortable ? 'cursor-pointer hover:text-gray-300 select-none' : ''} ${col.headerClassName ?? ''} ${col.width ?? ''}`}
                    onClick={isSortable ? () => { toggleSort(col.key); } : undefined}
                  >
                    <span className="inline-flex items-center">
                      {col.header}
                      {isSortable && <SortIcon active={isActive} dir={sortDir} />}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-50/10">
            {paged.map((row) => {
              const key = getRowKey(row)
              const isExp = expandedRows.has(key)
              return (
                <DesktopRow
                  key={key}
                  row={row}
                  columns={desktopCols}
                  expandable={expandable}
                  isExpanded={isExp}
                  onToggleExpand={() => { toggleExpand(key); }}
                  renderExpandedRow={renderExpandedRow}
                  onRowClick={onRowClick}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ====== TABLET TABLE (md to lg) ====== */}
      <div className="hidden md:block lg:hidden relative">
        {/* Left shadow */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-surface-200 to-transparent z-10 pointer-events-none" />
        )}
        {/* Right shadow */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-surface-200 to-transparent z-10 pointer-events-none" />
        )}
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]" role="table">
            <thead>
              <tr className="bg-surface-300 border-b border-surface-50/20">
                {expandable && <th className="w-8 px-2" />}
                {tabletCols.map((col) => {
                  const isSortable = sortable && col.sortable !== false && !!col.sortFn
                  const isActive = sortKey === col.key
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap ${isSortable ? 'cursor-pointer hover:text-gray-300 select-none' : ''} ${col.headerClassName ?? ''} ${col.width ?? ''}`}
                      onClick={isSortable ? () => { toggleSort(col.key); } : undefined}
                    >
                      <span className="inline-flex items-center">
                        {col.header}
                        {isSortable && <SortIcon active={isActive} dir={sortDir} />}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50/10">
              {paged.map((row) => {
                const key = getRowKey(row)
                const isExp = expandedRows.has(key)
                return (
                  <DesktopRow
                    key={key}
                    row={row}
                    columns={tabletCols}
                    expandable={expandable}
                    isExpanded={isExp}
                    onToggleExpand={() => { toggleExpand(key); }}
                    renderExpandedRow={renderExpandedRow}
                    onRowClick={onRowClick}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====== MOBILE CARD VIEW (<md) ====== */}
      <div className="md:hidden divide-y divide-surface-50/10">
        {paged.map((row) => {
          const key = getRowKey(row)
          const isExp = expandedRows.has(key)

          if (renderMobileCard) {
            return (
              <div
                key={key}
                onClick={() => { toggleExpand(key); }}
                className="cursor-pointer"
              >
                {renderMobileCard(row, isExp)}
              </div>
            )
          }

          return (
            <MobileCard
              key={key}
              row={row}
              primaryCols={mobilePrimaryCols}
              detailCols={mobileDetailCols}
              isExpanded={isExp}
              onToggle={() => { toggleExpand(key); }}
              renderExpandedRow={renderExpandedRow}
              onRowClick={onRowClick}
            />
          )
        })}
      </div>

      {/* ====== PAGINATION ====== */}
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </div>
  )
}

// --- Desktop/Tablet row ---

function DesktopRow<T>({
  row,
  columns,
  expandable,
  isExpanded,
  onToggleExpand,
  renderExpandedRow,
  onRowClick,
}: {
  row: T
  columns: ColumnDef<T>[]
  expandable: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  renderExpandedRow?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
}) {
  const handleClick = () => {
    if (onRowClick) onRowClick(row)
    if (expandable) onToggleExpand()
  }

  return (
    <>
      <tr
        className={`hover:bg-surface-300/30 transition-colors ${expandable || onRowClick ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-surface-300/50' : ''}`}
        onClick={handleClick}
      >
        {expandable && (
          <td className="w-8 px-2 text-center">
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </td>
        )}
        {columns.map((col) => (
          <td key={col.key} className={`px-4 py-2.5 ${col.className ?? ''} ${col.width ?? ''}`}>
            {col.render(row)}
          </td>
        ))}
      </tr>
      {expandable && isExpanded && renderExpandedRow && (
        <tr>
          <td colSpan={columns.length + 1} className="px-4 py-3 bg-surface-300/30 border-t border-surface-50/10">
            {renderExpandedRow(row)}
          </td>
        </tr>
      )}
    </>
  )
}

// --- Mobile card ---

function MobileCard<T>({
  row,
  primaryCols,
  detailCols,
  isExpanded,
  onToggle,
  renderExpandedRow,
  onRowClick,
}: {
  row: T
  primaryCols: ColumnDef<T>[]
  detailCols: ColumnDef<T>[]
  isExpanded: boolean
  onToggle: () => void
  renderExpandedRow?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
}) {
  return (
    <div
      className={`px-4 py-3 transition-colors ${isExpanded ? 'bg-surface-300/30' : ''}`}
      onClick={() => {
        if (onRowClick) onRowClick(row)
        onToggle()
      }}
    >
      {/* Primary info row */}
      <div className="flex items-center justify-between cursor-pointer">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {primaryCols.map((col) => (
            <div key={col.key} className={col.className ?? ''}>
              {col.render(row)}
            </div>
          ))}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 flex-shrink-0 ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-surface-50/10 space-y-2">
          {detailCols.map((col) => (
            <div key={col.key} className="flex justify-between items-center text-sm">
              <span className="text-gray-500 text-xs">{col.header}</span>
              <span className={col.className ?? ''}>{col.render(row)}</span>
            </div>
          ))}
          {renderExpandedRow && (
            <div className="mt-2 pt-2 border-t border-surface-50/10">
              {renderExpandedRow(row)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DataTable
