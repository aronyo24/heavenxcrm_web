import { useCallback, useEffect, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Building2, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/crm/PageHeader"
import { cn } from "@/lib/utils"
import { DataTable } from "@/components/crm/DataTable"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { ApplicationDetailSheet } from "@/components/crm/ApplicationDetailSheet"
import { fetchApplications } from "@/lib/crm-api"
import type { ApplicationListItem, ApplicationStatus } from "@/lib/crm-types"

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "documents_requested", label: "Documents Requested" },
  { value: "offer_received", label: "Offer Received" },
  { value: "enrolled", label: "Enrolled" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
]

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  submitted: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  under_review: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
  documents_requested: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  offer_received: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  enrolled: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-600",
  withdrawn: "border-border bg-muted text-muted-foreground",
}

const columns: ColumnDef<ApplicationListItem, unknown>[] = [
  {
    accessorKey: "student_name",
    header: "Student",
    cell: ({ row }) => (
      <div className="flex min-w-[180px] items-center gap-2.5">
        <PersonAvatar name={row.original.student_name} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">{row.original.student_name}</p>
          <p className="truncate text-xs leading-tight text-muted-foreground">{row.original.student_email}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "course_name",
    header: "Programme & university",
    cell: ({ row }) => (
      <div className="min-w-[220px] max-w-[340px]">
        <p className="truncate text-sm font-medium" title={row.original.course_name}>{row.original.course_name}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground" title={row.original.university_name}>
          <Building2 className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{row.original.university_name}</span>
        </p>
      </div>
    ),
  },
  { accessorKey: "intake_term", header: "Intake", cell: ({ row }) => <span className="whitespace-nowrap text-xs">{row.original.intake_term || "—"}</span> },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className={cn("whitespace-nowrap", STATUS_COLOR[row.original.status])}>
        {STATUS_OPTIONS.find((o) => o.value === row.original.status)?.label ?? row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "counselor_name",
    header: "Counselor",
    cell: ({ row }) => row.original.counselor_name
      ? <span className="whitespace-nowrap text-xs">{row.original.counselor_name}</span>
      : <span className="text-xs text-amber-600 dark:text-amber-400">Unassigned</span>,
  },
  {
    accessorKey: "submitted_at",
    header: "Submitted",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {new Date(row.original.submitted_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
      </span>
    ),
  },
]

export default function ApplicationsList() {
  const [openId, setOpenId] = useState<number | null>(null)
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState<number>()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApplications({
        page,
        search: search || undefined,
        status: statusFilter !== "all" ? (statusFilter as ApplicationStatus) : undefined,
      })
      setApplications(res.data)
      setTotalPages(res.pagination.totalPages)
      setTotal(res.pagination.total)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load applications")
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { void load() }, [load])

  const toolbar = (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-background dark:border-white/10 dark:bg-white/5"
          placeholder="Search by student, programme or university…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
        />
      </div>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => { setPage(1); setStatusFilter(o.value) }}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === o.value
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {statusFilter === o.value && total !== undefined && !loading && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 tabular-nums">{total}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Student applications"
        title="Applications"
        description="Every course application from the student portal. Click a row to review its details and documents."
      />

      <DataTable
        columns={columns}
        data={applications}
        isLoading={loading}
        emptyMessage={search || statusFilter !== "all" ? "No applications match these filters." : "No applications yet. They appear here when students apply through the portal."}
        onRowClick={(application) => setOpenId(application.id)}
        pagination={{ page, totalPages, onPageChange: setPage }}
        toolbar={toolbar}
        totalCount={total}
        itemLabel="applications"
      />

      <ApplicationDetailSheet
        applicationId={openId}
        onOpenChange={(open) => { if (!open) setOpenId(null) }}
        onUpdated={(updated) => setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, status: updated.status, decided_at: updated.decided_at, updated_at: updated.updated_at } : a)))}
      />
    </div>
  )
}
