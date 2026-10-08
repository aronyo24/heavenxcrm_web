import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import {
  CalendarClock, Facebook, Globe, Inbox, RefreshCw, Search, Sparkles, UserPlus, X,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/crm/DataTable"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { QuickAddStudentDialog } from "@/components/crm/QuickAddStudentDialog"
import { useAuth } from "@/lib/auth"
import {
  announceLeadsChanged, assignStudentCounselor, bulkAssignLeads, fetchCounselors, fetchLeadSources,
  fetchLeadSummary, fetchPipelineStages, fetchStudents, LEADS_CHANGED_EVENT, type LeadSummary, type StudentFilters,
} from "@/lib/crm-api"
import type { Counselor, LeadSource, PipelineStage, StudentListItem } from "@/lib/crm-types"
import { cn } from "@/lib/utils"
import { studentPath } from "@/lib/student-url"

const PAGE_SIZE = 25
// The list refreshes itself while the tab is visible. New Facebook leads are
// pulled in by CrmLayout, which fires LEADS_CHANGED_EVENT when any arrive.
const REFRESH_MS = 15_000

type LeadView = "all" | "today" | "7d" | "facebook"

function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const ageHours = (iso: string, now: number) => (now - new Date(iso).getTime()) / 3_600_000

// Freshness dot: a lead goes cold fast, so make the old ones stand out.
function ReceivedCell({ iso, now }: { iso: string; now: number }) {
  const hours = ageHours(iso, now)
  const tone = hours < 1 ? "bg-emerald-500" : hours < 24 ? "bg-sky-500" : hours < 72 ? "bg-amber-500" : "bg-red-500"
  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300" title={new Date(iso).toLocaleString()}>
      <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", tone)} />
      {timeAgo(iso, now)}
    </span>
  )
}

function ViewCard({
  label, hint, value, icon: Icon, accent, active, onClick,
}: {
  label: string
  hint: string
  value: number | undefined
  icon: React.ElementType
  accent: { bar: string; icon: string; ring: string }
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-md",
        active && cn("ring-2", accent.ring),
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", accent.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none tabular-nums">{value ?? "–"}</p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", accent.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </button>
  )
}

function SourceChip({ lead }: { lead: StudentListItem }) {
  if (!lead.lead_source_name) return <span className="text-muted-foreground">—</span>
  const isFacebook = lead.lead_source_name.toLowerCase().includes("facebook")
  return (
    <span
      title={lead.campaign ? `Campaign: ${lead.campaign}` : lead.lead_source_name}
      className={cn(
        "inline-flex max-w-[150px] items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        isFacebook
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
          : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
      )}
    >
      {isFacebook ? <Facebook className="h-3 w-3 flex-shrink-0" /> : <Globe className="h-3 w-3 flex-shrink-0" />}
      <span className="truncate">{isFacebook ? "Facebook" : lead.lead_source_name}</span>
    </span>
  )
}

function CounselorPicker({
  counselors, onPick, placeholder = "Assign", className, disabled,
}: {
  counselors: Counselor[]
  disabled?: boolean
  onPick: (counselorId: number) => void
  placeholder?: string
  className?: string
}) {
  return (
    // Stays controlled at "" so the same lead can be picked again if an
    // assignment fails.
    <Select value="" disabled={disabled} onValueChange={(v) => onPick(Number(v))}>
      <SelectTrigger
        className={cn(
          "h-8 w-32 gap-1.5 bg-background text-xs font-medium shadow-none",
          "hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400",
          className,
        )}
      >
        <UserPlus className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[240px]">
        <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Counselor · caseload
        </div>
        {counselors.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No active counselors</div>
        ) : counselors.map((c) => {
          const full = c.active_student_count >= c.max_active_students
          const pct = Math.min(100, Math.round((c.active_student_count / Math.max(1, c.max_active_students)) * 100))
          return (
            <SelectItem key={c.id} value={String(c.id)} disabled={full}>
              <span className="flex w-full items-center gap-3">
                <PersonAvatar name={c.full_name} size="sm" />
                <span className="flex-1">{c.full_name}</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn("block h-full rounded-full", full ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className={cn("w-9 text-right text-[11px] tabular-nums", full ? "text-red-500" : "text-muted-foreground")}>
                    {full ? "Full" : `${c.active_student_count}/${c.max_active_students}`}
                  </span>
                </span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export default function LeadsInbox() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Assigning is full-admin only (enforced server-side too);
  // sub-admins get a read-only view.
  const canManage = user?.role === "admin"

  const [leads, setLeads] = useState<StudentListItem[]>([])
  const [summary, setSummary] = useState<LeadSummary | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState<number>()
  const [view, setView] = useState<LeadView>("all")
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [ordering, setOrdering] = useState<NonNullable<StudentFilters["ordering"]>>("newest")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  const activeCounselors = useMemo(() => counselors.filter((c) => c.is_active), [counselors])
  const facebookSourceId = useMemo(
    () => leadSources.find((s) => s.name.toLowerCase().includes("facebook"))?.id,
    [leadSources],
  )

  const loadLookups = useCallback(async () => {
    try {
      const [stagesRes, counselorsRes, sourcesRes] = await Promise.all([
        fetchPipelineStages(), fetchCounselors(), fetchLeadSources(),
      ])
      setStages(stagesRes)
      setCounselors(counselorsRes)
      setLeadSources(sourcesRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load filters")
    }
  }, [])

  // `quiet` = background refresh: no skeleton, no error toast spam.
  const loadLeads = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    const source = view === "facebook" ? facebookSourceId : sourceFilter !== "all" ? sourceFilter : undefined
    try {
      const [res, summaryRes] = await Promise.all([
        fetchStudents({
          page,
          limit: PAGE_SIZE,
          counselor: "unassigned",
          search: search || undefined,
          lead_source: source,
          received: view === "today" || view === "7d" ? view : undefined,
          ordering,
        }),
        canManage ? fetchLeadSummary() : Promise.resolve(null),
      ])
      // Assigning every lead on the last page would leave it empty; step back.
      const lastPage = Math.max(1, res.pagination.totalPages)
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setLeads(res.data)
      setTotalPages(res.pagination.totalPages)
      setTotalCount(res.pagination.total)
      if (summaryRes) setSummary(summaryRes)
      // Drop selections for leads that were assigned/deleted elsewhere.
      const visible = new Set(res.data.map((l) => l.id))
      setSelected((prev) => {
        const next = new Set([...prev].filter((id) => visible.has(id)))
        return next.size === prev.size ? prev : next
      })
      setLastUpdated(Date.now())
    } catch (err) {
      if (!quiet) {
        toast.error(err instanceof Error ? err.message : "Failed to load leads")
        setLeads([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, search, sourceFilter, view, facebookSourceId, ordering, canManage])

  useEffect(() => { void loadLookups() }, [loadLookups])
  useEffect(() => { void loadLeads() }, [loadLeads])

  // Live updates: re-poll while the tab is visible, and catch up immediately
  // when the user comes back to it.
  const loadLeadsRef = useRef(loadLeads)
  useEffect(() => { loadLeadsRef.current = loadLeads }, [loadLeads])
  useEffect(() => {
    const tick = () => {
      setNow(Date.now())
      if (document.visibilityState === "visible") void loadLeadsRef.current(true)
    }
    const timer = window.setInterval(tick, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === "visible") tick() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  useEffect(() => {
    const onChanged = () => void loadLeadsRef.current(true)
    window.addEventListener(LEADS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(LEADS_CHANGED_EVENT, onChanged)
  }, [])

  const removeFromView = (ids: number[]) => {
    const gone = new Set(ids)
    setLeads((rows) => rows.filter((r) => !gone.has(r.id)))
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))))
    announceLeadsChanged() // also reloads this page via the listener above
    void fetchCounselors().then(setCounselors).catch(() => {})
  }

  const assignOne = useCallback(async (lead: StudentListItem, counselorId: number) => {
    try {
      const updated = await assignStudentCounselor(lead.id, counselorId)
      toast.success(`${lead.full_name} moved to Students`, {
        description: `Assigned to ${updated.counselor_name ?? "counselor"}`,
        action: { label: "Open", onClick: () => navigate(studentPath(lead.id, lead.full_name)) },
      })
      removeFromView([lead.id])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign counselor")
    }
  }, [navigate])

  const assignSelected = async (counselorId: number) => {
    const ids = [...selected]
    setBusy(true)
    try {
      const res = await bulkAssignLeads(ids, counselorId)
      toast.success(`${res.assigned} lead${res.assigned === 1 ? "" : "s"} moved to Students`, {
        description: `Assigned to ${res.counselor_name}`,
      })
      removeFromView(ids)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign leads")
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const allOnPageSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const toggleAll = () => setSelected(allOnPageSelected ? new Set() : new Set(leads.map((l) => l.id)))

  const columns = useMemo<ColumnDef<StudentListItem, unknown>[]>(() => {
    const cols: ColumnDef<StudentListItem, unknown>[] = [
      {
        id: "lead",
        header: "Lead",
        cell: ({ row }) => (
          <div className="flex min-w-[170px] items-center gap-2.5">
            <PersonAvatar name={row.original.full_name} size="sm" />
            <span className="truncate font-medium text-slate-900 dark:text-slate-100">{row.original.full_name}</span>
            {ageHours(row.original.created_at, now) < 24 ? (
              <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                New
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs tabular-nums text-slate-700 dark:text-slate-300">
            {row.original.phone || "—"}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate text-xs text-slate-600 dark:text-slate-400" title={row.original.email}>
            {row.original.email || "—"}
          </span>
        ),
      },
      {
        id: "interest",
        header: "Interest",
        cell: ({ row }) => {
          const parts = [row.original.target_degree, row.original.target_country].filter(Boolean)
          return parts.length ? (
            <span className="whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">{parts.join(" · ")}</span>
          ) : <span className="text-xs text-muted-foreground">—</span>
        },
      },
      { id: "source", header: "Source", cell: ({ row }) => <SourceChip lead={row.original} /> },
      {
        id: "received",
        header: "Received",
        cell: ({ row }) => <ReceivedCell iso={row.original.created_at} now={now} />,
      },
    ]

    if (!canManage) return cols

    return [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            aria-label="Select all leads on this page"
            className="h-4 w-4 cursor-pointer rounded accent-emerald-600"
            checked={allOnPageSelected}
            onChange={toggleAll}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.full_name}`}
            className="h-4 w-4 cursor-pointer rounded accent-emerald-600"
            checked={selected.has(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggle(row.original.id)}
          />
        ),
      },
      ...cols,
      {
        id: "assign",
        header: "Counselor",
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <CounselorPicker counselors={activeCounselors} onPick={(id) => void assignOne(row.original, id)} />
          </div>
        ),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggle/toggleAll derive from selected + leads
  }, [canManage, activeCounselors, assignOne, navigate, now, selected, allOnPageSelected, leads])

  const hasFilters = search !== "" || sourceFilter !== "all"
  const pickView = (next: LeadView) => {
    setPage(1)
    setView((current) => (current === next && next !== "all" ? "all" : next))
  }

  const toolbar = (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-background dark:border-white/10 dark:bg-white/5"
          placeholder="Search name, phone, email or campaign…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {view !== "facebook" ? (
          <Select value={sourceFilter} onValueChange={(v) => { setPage(1); setSourceFilter(v) }}>
            <SelectTrigger className="h-9 w-40 shadow-none">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {leadSources.map((source) => (
                <SelectItem key={source.id} value={String(source.id)}>{source.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={ordering} onValueChange={(v) => { setPage(1); setOrdering(v as typeof ordering) }}>
          <SelectTrigger className="h-9 w-36 shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters || view !== "all" ? (
          <Button
            variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground"
            onClick={() => { setPage(1); setSearch(""); setSourceFilter("all"); setView("all") }}
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Lead management</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Leads inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every new enquiry lands here first. Assign a counselor to move it into Students.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium text-foreground">Live</span>
            {lastUpdated ? <span>· updated {timeAgo(new Date(lastUpdated).toISOString(), now)}</span> : null}
          </div>
          <Button
            variant="outline" size="icon" className="h-9 w-9 shadow-sm" title="Refresh now"
            disabled={refreshing || loading}
            onClick={() => void loadLeads(true)}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          <QuickAddStudentDialog
            stages={stages} counselors={counselors} leadSources={leadSources}
            onCreated={() => { setPage(1); announceLeadsChanged() }}
          />
        </div>
      </div>

      {/* Views - each card filters the table */}
      {canManage ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ViewCard
            label="Waiting" hint="Unassigned leads" value={summary?.total} icon={Inbox}
            accent={{ bar: "bg-amber-500", icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", ring: "ring-amber-500/60" }}
            active={view === "all"} onClick={() => pickView("all")}
          />
          <ViewCard
            label="Today" hint="Received since midnight" value={summary?.today} icon={Sparkles}
            accent={{ bar: "bg-emerald-500", icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", ring: "ring-emerald-500/60" }}
            active={view === "today"} onClick={() => pickView("today")}
          />
          <ViewCard
            label="This week" hint="Last 7 days" value={summary?.last_7_days} icon={CalendarClock}
            accent={{ bar: "bg-indigo-500", icon: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400", ring: "ring-indigo-500/60" }}
            active={view === "7d"} onClick={() => pickView("7d")}
          />
          <ViewCard
            label="Facebook" hint="From ad lead forms" value={summary?.facebook} icon={Facebook}
            accent={{ bar: "bg-blue-600", icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", ring: "ring-blue-600/60" }}
            active={view === "facebook"} onClick={() => pickView("facebook")}
          />
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={leads}
        isLoading={loading}
        toolbar={toolbar}
        totalCount={totalCount}
        itemLabel={totalCount === 1 ? "lead" : "leads"}
        emptyMessage={hasFilters || view !== "all" ? "No leads match this view." : "Inbox zero — every lead has a counselor."}
        onRowClick={(lead) => navigate(studentPath(lead.id, lead.full_name))}
        rowNumberOffset={(page - 1) * PAGE_SIZE}
        isRowHighlighted={(lead) => selected.has(lead.id)}
        pagination={{ page, totalPages, onPageChange: setPage }}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">Received</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Under 1 hour</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />Today</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />1–3 days</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Over 3 days — follow up</span>
      </div>

      {/* Floating bulk-action bar */}
      {canManage && selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-2.5 text-white shadow-2xl ring-1 ring-black/5 dark:border-emerald-500/30 dark:bg-slate-800">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold tabular-nums">
              {selected.size}
            </span>
            <span className="text-sm font-medium">selected</span>
            <span className="h-5 w-px bg-white/15" />
            <CounselorPicker
              counselors={activeCounselors}
              placeholder={busy ? "Assigning…" : "Assign all to…"}
              disabled={busy}
              className="w-44 border-white/15 bg-white/10 text-white hover:border-emerald-400 hover:text-white"
              onPick={(id) => void assignSelected(id)}
            />
            <Button
              size="icon" variant="ghost" title="Clear selection"
              className="h-8 w-8 text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() => setSelected(new Set())}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

    </div>
  )
}
