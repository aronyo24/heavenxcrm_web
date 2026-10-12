import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Award, ClipboardCheck, FileClock, GraduationCap, Paperclip, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/crm/PageHeader"
import { StatTile } from "@/components/crm/StatTile"
import { DataTable } from "@/components/crm/DataTable"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { UniversityLogo } from "@/components/crm/UniversityLogo"
import { ApplicationDetailSheet } from "@/components/crm/ApplicationDetailSheet"
import { fetchApplications, fetchApplicationSummary, type ApplicationFilters } from "@/lib/crm-api"
import type { ApplicationListItem, ApplicationStatus, ApplicationSummary } from "@/lib/crm-types"
import {
  APPLICATION_STATUS_COLOR, APPLICATION_STATUS_DOT, APPLICATION_STATUSES, APPLICATION_STEPS, OPEN_APPLICATION_STATUSES,
  applicationStatusLabel, applicationStepIndex, daysSince, isClosedApplication,
} from "@/lib/application-status"
import { cn } from "@/lib/utils"

// Open applications untouched for this long get flagged in the list.
const STALE_DAYS = 7

function StatusPill({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold", APPLICATION_STATUS_COLOR[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", APPLICATION_STATUS_DOT[status])} />
      {applicationStatusLabel(status)}
    </span>
  )
}

// Four small segments: Submitted → In review → Offer → Enrolled.
function ProgressBar({ status }: { status: ApplicationStatus }) {
  const closed = isClosedApplication(status)
  const index = applicationStepIndex(status)
  return (
    <div className="flex items-center gap-2" title={closed ? applicationStatusLabel(status) : APPLICATION_STEPS[index]?.label}>
      <div className="flex gap-0.5">
        {APPLICATION_STEPS.map((step, i) => (
          <span
            key={step.key}
            className={cn(
              "h-1.5 w-5 rounded-full",
              closed ? "bg-slate-200 dark:bg-white/10" : i <= index ? (index === APPLICATION_STEPS.length - 1 ? "bg-emerald-600" : "bg-emerald-500") : "bg-slate-200 dark:bg-white/10",
            )}
          />
        ))}
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {closed ? "Closed" : `${index + 1}/${APPLICATION_STEPS.length}`}
      </span>
    </div>
  )
}

function SubmittedCell({ app }: { app: ApplicationListItem }) {
  const waiting = daysSince(app.updated_at)
  const stale = OPEN_APPLICATION_STATUSES.includes(app.status) && waiting >= STALE_DAYS
  return (
    <div className="leading-tight">
      <p className="text-xs tabular-nums text-slate-700 dark:text-slate-300">
        {new Date(app.submitted_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
      </p>
      {stale ? (
        <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">No update for {waiting}d</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {daysSince(app.submitted_at) === 0 ? "Today" : `${daysSince(app.submitted_at)}d ago`}
        </p>
      )}
    </div>
  )
}

export default function ApplicationsList() {
  const [openId, setOpenId] = useState<number | null>(null)
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [summary, setSummary] = useState<ApplicationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState<number>()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all")
  const [ordering, setOrdering] = useState<NonNullable<ApplicationFilters["ordering"]>>("newest")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, summaryRes] = await Promise.all([
        fetchApplications({
          page,
          limit: pageSize,
          search: search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          ordering,
        }),
        fetchApplicationSummary({ search: search || undefined }),
      ])
      setApplications(res.data)
      setTotalPages(res.pagination.totalPages)
      setTotal(res.pagination.total)
      setSummary(summaryRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load applications")
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter, ordering])

  useEffect(() => { void load() }, [load])

  const pickStatus = (next: ApplicationStatus | "all") => {
    setPage(1)
    setStatusFilter((current) => (current === next ? "all" : next))
  }

  const columns = useMemo<ColumnDef<ApplicationListItem, unknown>[]>(() => [
    {
      accessorKey: "student_name",
      header: "Student",
      cell: ({ row }) => (
        <div className="flex min-w-[180px] items-center gap-2.5">
          <PersonAvatar name={row.original.student_name} size="sm" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate font-medium leading-tight">
              {row.original.student_name}
              {row.original.has_resume ? <Paperclip className="h-3 w-3 flex-shrink-0 text-sky-600" aria-label="Resume attached" /> : null}
            </p>
            <p className="truncate text-xs leading-tight text-muted-foreground">{row.original.student_email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "course_name",
      header: "Programme & university",
      cell: ({ row }) => {
        const a = row.original
        const meta = [a.university_name, a.university_country, a.intake_term].filter(Boolean).join(" · ")
        return (
          <div className="flex min-w-[220px] max-w-[320px] items-center gap-2.5">
            <UniversityLogo src={a.university_logo} name={a.university_name} className="h-8 w-8" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight" title={a.course_name}>{a.course_name}</p>
              <p className="truncate text-xs leading-tight text-muted-foreground" title={meta}>{meta}</p>
            </div>
          </div>
        )
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill status={row.original.status} /> },
    { id: "progress", header: "Progress", cell: ({ row }) => <ProgressBar status={row.original.status} /> },
    {
      accessorKey: "counselor_name",
      header: "Counselor",
      cell: ({ row }) => row.original.counselor_name
        ? <span className="whitespace-nowrap text-xs">{row.original.counselor_name}</span>
        : <span className="text-xs text-amber-600 dark:text-amber-400">Unassigned</span>,
    },
    { accessorKey: "submitted_at", header: "Submitted", cell: ({ row }) => <SubmittedCell app={row.original} /> },
  ], [])

  const counts = summary?.by_status
  const hasFilters = search !== "" || statusFilter !== "all"

  const toolbar = (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-background dark:border-white/10 dark:bg-white/5"
            placeholder="Search by student, programme or university…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={ordering} onValueChange={(v) => { setPage(1); setOrdering(v as typeof ordering) }}>
            <SelectTrigger className="h-9 w-44 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="updated">Recently updated</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button
              variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground"
              onClick={() => { setPage(1); setSearch(""); setStatusFilter("all") }}
            >
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
          ) : null}
        </div>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {([{ value: "all", label: "All" }, ...APPLICATION_STATUSES] as { value: ApplicationStatus | "all"; label: string }[]).map((o) => {
          const active = statusFilter === o.value
          const count = o.value === "all" ? summary?.total : counts?.[o.value]
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => o.value === "all" ? (setPage(1), setStatusFilter("all")) : pickStatus(o.value)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "bg-background text-muted-foreground hover:border-slate-300 hover:text-foreground",
              )}
            >
              {o.value !== "all" ? <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : APPLICATION_STATUS_DOT[o.value])} /> : null}
              {o.label}
              {count !== undefined ? (
                <span className={cn("rounded-full px-1.5 tabular-nums", active ? "bg-white/20" : "bg-slate-100 dark:bg-white/10")}>{count}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admissions"
        title="Applications"
        description={
          summary
            ? `${summary.total} application${summary.total === 1 ? "" : "s"} from the student portal · ${summary.this_week} new this week`
            : "Every course application from the student portal."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="To review" value={counts?.submitted ?? "–"} hint="New, not started yet" icon={ClipboardCheck} tone="sky"
          active={statusFilter === "submitted"} onClick={() => pickStatus("submitted")}
        />
        <StatTile
          label="Waiting on documents" value={counts?.documents_requested ?? "–"} hint="Student needs to send files" icon={FileClock} tone="amber"
          active={statusFilter === "documents_requested"} onClick={() => pickStatus("documents_requested")}
        />
        <StatTile
          label="Offers" value={counts?.offer_received ?? "–"} hint="Offer received from university" icon={Award} tone="emerald"
          active={statusFilter === "offer_received"} onClick={() => pickStatus("offer_received")}
        />
        <StatTile
          label="Enrolled" value={counts?.enrolled ?? "–"} hint="Successfully placed" icon={GraduationCap} tone="violet"
          active={statusFilter === "enrolled"} onClick={() => pickStatus("enrolled")}
        />
      </div>

      <DataTable
        columns={columns}
        data={applications}
        isLoading={loading}
        emptyMessage={hasFilters ? "No applications match these filters." : "No applications yet. They appear here when students apply through the portal."}
        onRowClick={(application) => setOpenId(application.id)}
        rowNumberOffset={(page - 1) * pageSize}
        pagination={{
          page, totalPages, onPageChange: setPage,
          pageSize, onPageSizeChange: (size) => { setPage(1); setPageSize(size) },
        }}
        toolbar={toolbar}
        totalCount={total}
        itemLabel="applications"
      />

      <ApplicationDetailSheet
        applicationId={openId}
        onOpenChange={(open) => { if (!open) setOpenId(null) }}
        onUpdated={() => void load()}
      />
    </div>
  )
}
