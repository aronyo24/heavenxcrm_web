import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowRight, CornerDownLeft, Loader2, Search } from "lucide-react"

import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { StageBadge } from "@/components/crm/StageBadge"
import { searchStudents } from "@/lib/crm-api"
import type { StudentListItem } from "@/lib/crm-types"
import type { NavItem } from "@/lib/crm-nav"

type PageLink = Pick<NavItem, "to" | "label" | "description" | "icon">
import { studentPath } from "@/lib/student-url"
import { cn } from "@/lib/utils"

type Result =
  | { kind: "student"; id: string; student: StudentListItem }
  | { kind: "page"; id: string; item: PageLink }

// Global quick search (Ctrl/Cmd+K): jump straight to a student or a page
// without clicking through lists. Student search needs 2+ characters;
// pass searchStudents={false} for users who cannot read CRM students.
export function CommandPalette({
  open, onOpenChange, pages, searchStudents: withStudents = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pages: PageLink[]
  searchStudents?: boolean
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        {/* Content unmounts on close, so the search starts fresh each time. */}
        <PaletteBody pages={pages} withStudents={withStudents} close={() => onOpenChange(false)} />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PaletteBody({ pages, withStudents, close }: { pages: PageLink[]; withStudents: boolean; close: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  // Results are tagged with the query they answer, so stale ones never show.
  const [found, setFound] = useState<{ q: string; rows: StudentListItem[] }>({ q: "", rows: [] })
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const q = query.trim()
  const canSearch = withStudents && q.length >= 2
  const searching = canSearch && found.q !== q

  useEffect(() => {
    if (!canSearch) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      searchStudents(q)
        .then((rows) => { if (!cancelled) setFound({ q, rows: rows.slice(0, 8) }) })
        .catch(() => { if (!cancelled) setFound({ q, rows: [] }) })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [canSearch, q])

  const results = useMemo<Result[]>(() => {
    const needle = q.toLowerCase()
    const pageHits = pages
      .filter((p) => !needle || p.label.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle))
      .map((item) => ({ kind: "page" as const, id: `page-${item.to}`, item }))
    const students = canSearch && found.q === q ? found.rows : []
    const studentHits = students.map((student) => ({ kind: "student" as const, id: `student-${student.id}`, student }))
    return [...studentHits, ...pageHits]
  }, [canSearch, found, pages, q])
  const current = Math.min(active, Math.max(results.length - 1, 0))

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" })
  }, [current])

  const choose = (r: Result | undefined) => {
    if (!r) return
    close()
    navigate(r.kind === "student" ? studentPath(r.student.id, r.student.full_name) : r.item.to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive(Math.min(current + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive(Math.max(current - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      choose(results[current])
    }
  }

  const studentRows = results.filter((r) => r.kind === "student")
  const pageRows = results.filter((r) => r.kind === "page")

  const renderRow = (r: Result) => {
    const index = results.indexOf(r)
    const selected = index === current
    return (
      <button
        key={r.id}
        type="button"
        data-index={index}
        onMouseMove={() => setActive(index)}
        onClick={() => choose(r)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
          selected ? "bg-emerald-500/10 text-foreground" : "text-foreground/90",
        )}
      >
        {r.kind === "student" ? (
          <>
            <PersonAvatar name={r.student.full_name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.student.full_name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[r.student.phone, r.student.email].filter(Boolean).join(" · ")}
              </span>
            </span>
            <StageBadge stageKey={r.student.stage_key} label={r.student.stage_label} />
          </>
        ) : (
          <>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border bg-background">
              <r.item.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{r.item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.item.description}</span>
            </span>
            <ArrowRight className={cn("h-3.5 w-3.5 text-muted-foreground", !selected && "opacity-0")} />
          </>
        )}
      </button>
    )
  }

  return (
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Quick search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search students or jump to a page</DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b px-4">
            {searching ? (
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              placeholder={withStudents ? "Search students by name, phone or email, or jump to a page…" : "Jump to a page…"}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">ESC</kbd>
          </div>

          <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
            {studentRows.length > 0 && (
              <div className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Students</p>
                {studentRows.map(renderRow)}
              </div>
            )}
            {canSearch && !searching && studentRows.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted-foreground">No students match “{q}”.</p>
            )}
            {pageRows.length > 0 && (
              <div>
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Go to</p>
                {pageRows.map(renderRow)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="rounded border bg-background px-1">↑</kbd><kbd className="rounded border bg-background px-1">↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded border bg-background px-1"><CornerDownLeft className="h-2.5 w-2.5" /></kbd> open</span>
          </div>
        </DialogPrimitive.Content>
  )
}
