import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { ArrowRight, Facebook, Inbox, Loader2, Mail, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/crm/DataTable"
import { PageHeader } from "@/components/crm/PageHeader"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { QuickAddStudentDialog } from "@/components/crm/QuickAddStudentDialog"
import { SendEmailDialog } from "@/components/crm/SendEmailDialog"
import { QuickChatDialog } from "@/components/crm/QuickChatDialog"
import { BulkEmailDialog } from "@/components/crm/BulkEmailDialog"
import { useAuth } from "@/lib/auth"
import {
  announceLeadsChanged, assignStudentCounselor, changeStudentStage, fetchCounselors, fetchLeadSources, fetchLeadSummary, fetchPipelineStages,
  fetchStudents, LEADS_CHANGED_EVENT, type StudentFilters,
} from "@/lib/crm-api"
import type { Counselor, LeadSource, PipelineStage, StudentListItem } from "@/lib/crm-types"
import { STAGE_COLORS, STAGE_DOTS } from "@/lib/stage-colors"
import { studentPath } from "@/lib/student-url"
import { cn } from "@/lib/utils"

function SourceCell({ student }: { student: StudentListItem }) {
  if (!student.lead_source_name) return <span className="text-muted-foreground">—</span>
  const isFacebook = student.lead_source_name.toLowerCase().includes("facebook")
  return (
    <div title={student.campaign ? `Campaign: ${student.campaign}` : undefined}>
      {isFacebook ? (
        <Badge className="w-fit gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20">
          <Facebook className="h-3 w-3" />
          Facebook
        </Badge>
      ) : (
        <Badge variant="secondary" className="w-fit">{student.lead_source_name}</Badge>
      )}
    </div>
  )
}

function CounselorCell({
  student, counselors, canAssign, onAssign,
}: {
  student: StudentListItem
  counselors: Counselor[]
  canAssign: boolean
  onAssign: (student: StudentListItem, counselorId: number | null) => void
}) {
  if (!canAssign) return <>{student.counselor_name ?? "—"}</>
  return (
    // Stop the click from opening the profile (onRowClick) while picking.
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={student.counselor ? String(student.counselor) : "none"}
        onValueChange={(v) => onAssign(student, v === "none" ? null : Number(v))}
      >
        <SelectTrigger className="h-8 w-[124px] text-xs shadow-none">
          <SelectValue placeholder="Assign" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassign (back to Leads)</SelectItem>
          {counselors.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function daysSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`
}

function StatusCell({
  student, stages, onChange,
}: {
  student: StudentListItem
  stages: PipelineStage[]
  onChange: (student: StudentListItem, stageKey: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const steps = stages.filter((s) => !s.is_lost).sort((a, b) => a.sort_order - b.sort_order)
  const lostStages = stages.filter((s) => s.is_lost)
  const pick = async (key: string) => {
    if (key === student.stage_key) return
    setSaving(true)
    try { await onChange(student, key) } finally { setSaving(false) }
  }
  const option = (stage: PipelineStage) => (
    <SelectItem key={stage.key} value={stage.key} className="py-1.5">
      <span className="flex items-center gap-2.5">
        <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", STAGE_DOTS[stage.key] ?? "bg-slate-400")} />
        {stage.label}
      </span>
    </SelectItem>
  )

  return (
    // Stop the click from opening the profile (onRowClick) while picking.
    <div onClick={(e) => e.stopPropagation()} title={`${student.stage_label} for ${daysSince(student.stage_changed_at)} - click to change`}>
      <Select value={student.stage_key} disabled={saving} onValueChange={(v) => void pick(v)}>
        <SelectTrigger
          aria-label={`Change status for ${student.full_name}`}
          className={cn(
            "h-8 w-[130px] gap-2 rounded-lg border px-2.5 text-xs font-semibold shadow-none transition-all",
            "hover:shadow-sm hover:ring-2 hover:ring-offset-0 hover:ring-current/15 data-[state=open]:ring-2 data-[state=open]:ring-current/20",
            "disabled:cursor-wait disabled:opacity-100",
            STAGE_COLORS[student.stage_key] ?? "bg-muted text-muted-foreground",
          )}
        >
          {/* A div, not a span: the trigger line-clamps direct span children. */}
          <div className="flex min-w-0 items-center gap-2">
            {saving ? (
              <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
            ) : (
              <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", STAGE_DOTS[student.stage_key] ?? "bg-slate-400")} />
            )}
            <span className="truncate">{student.stage_label}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="min-w-[200px]">
          <SelectGroup>
            <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Move {student.full_name.split(" ")[0]} to
            </SelectLabel>
            {steps.map(option)}
          </SelectGroup>
          {lostStages.length ? (
            <>
              <SelectSeparator />
              {lostStages.map((stage) => option(stage))}
            </>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  )
}

// "12 Oct" this year, "12 Oct 2025" otherwise - keeps the column narrow.
function shortDate(iso: string) {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString([], { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })
}

// Most students that can be emailed in one go (matches StudentViewSet.MAX_BULK_EMAIL).
const MAX_BULK_EMAIL = 50

interface Selection {
  isSelected: (id: number) => boolean
  toggle: (student: StudentListItem) => void
  allOnPage: boolean
  someOnPage: boolean
  toggleAll: () => void
}

const buildColumns = (
  counselors: Counselor[],
  canAssign: boolean,
  onAssign: (student: StudentListItem, counselorId: number | null) => void,
  stages: PipelineStage[],
  onStageChange: (student: StudentListItem, stageKey: string) => Promise<void>,
  selection: Selection,
): ColumnDef<StudentListItem, unknown>[] => [
  {
    id: "select",
    header: () => (
      <input
        type="checkbox"
        aria-label="Select all students on this page"
        className="h-4 w-4 cursor-pointer rounded accent-emerald-600"
        checked={selection.allOnPage}
        ref={(el) => { if (el) el.indeterminate = selection.someOnPage && !selection.allOnPage }}
        onChange={selection.toggleAll}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label={`Select ${row.original.full_name}`}
        className="h-4 w-4 cursor-pointer rounded accent-emerald-600"
        checked={selection.isSelected(row.original.id)}
        onClick={(e) => e.stopPropagation()}
        onChange={() => selection.toggle(row.original)}
      />
    ),
  },
  {
    accessorKey: "full_name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex w-[180px] items-center gap-2.5">
        <PersonAvatar name={row.original.full_name} size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-medium" title={row.original.full_name}>{row.original.full_name}</p>
          <p className="truncate text-[11px] tabular-nums text-muted-foreground">{row.original.phone || "No phone"}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email ? (
      <span className="block max-w-[160px] truncate text-xs text-slate-600 dark:text-slate-300" title={row.original.email}>
        {row.original.email}
      </span>
    ) : <span className="text-xs text-muted-foreground">—</span>,
  },
  {
    accessorKey: "stage_label",
    header: "Status",
    cell: ({ row }) => <StatusCell student={row.original} stages={stages} onChange={onStageChange} />,
  },
  {
    id: "lead_source",
    header: "Source",
    cell: ({ row }) => <SourceCell student={row.original} />,
  },
  {
    accessorKey: "counselor_name",
    header: "Counselor",
    cell: ({ row }) => (
      <CounselorCell student={row.original} counselors={counselors} canAssign={canAssign} onAssign={onAssign} />
    ),
  },
  {
    accessorKey: "target_country",
    header: "Country",
    cell: ({ row }) => (
      <span className="block max-w-[90px] truncate text-xs" title={row.original.target_country}>
        {row.original.target_country || "—"}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {shortDate(row.original.created_at)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      // Stop the click from bubbling to the row's onRowClick (which opens
      // the full profile) so these are true one-click shortcuts instead of
      // a detour through the profile page every time.
      <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-1.5">
        <QuickChatDialog studentId={row.original.id} studentName={row.original.full_name} />
        {row.original.email ? (
          <SendEmailDialog
            studentId={row.original.id}
            studentEmail={row.original.email}
            onSent={() => {}}
            trigger={
              <Button variant="outline" size="icon" className="h-8 w-8" title={`Email ${row.original.full_name}`}>
                <Mail className="h-4 w-4" />
              </Button>
            }
          />
        ) : null}
      </div>
    ),
  },
]

export default function StudentsList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isCounselor = user?.role === "counselor"
  // Only admins and managers may (re)assign a counselor - enforced
  // server-side in StudentViewSet.assign_counselor too.
  const isManager = !!user?.is_crm_manager
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState<number>()
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [counselorFilter, setCounselorFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [ordering, setOrdering] = useState<NonNullable<StudentFilters["ordering"]>>("newest")
  // Counselors land on "my students" by default (the server already scopes
  // them down if they lack crm_view_all_students - this just makes the
  // default view match that instead of confusingly showing "All" and
  // silently filtering server-side).
  const [myStudentsOnly, setMyStudentsOnly] = useState(true)
  const [waitingLeads, setWaitingLeads] = useState<number>()
  // Kept across pages and filters, so students can be picked from several pages.
  const [selected, setSelected] = useState<Map<number, StudentListItem>>(new Map())
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)

  const myCounselorId = useMemo(
    () => counselors.find((c) => c.user_id === Number(user?.id))?.id,
    [counselors, user]
  )
  const effectiveCounselorFilter = isCounselor && myStudentsOnly
    ? (myCounselorId ? String(myCounselorId) : "all")
    : counselorFilter

  const loadLookups = useCallback(async () => {
    try {
      const [stagesRes, counselorsRes, sourcesRes] = await Promise.all([
        fetchPipelineStages(),
        fetchCounselors(),
        fetchLeadSources(),
      ])
      setStages(stagesRes)
      setCounselors(counselorsRes)
      setLeadSources(sourcesRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load filters")
    }
  }, [])

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchStudents({
        page,
        limit: pageSize,
        search: search || undefined,
        stage: stageFilter !== "all" ? stageFilter : undefined,
        // Unassigned students are leads - they live on the Leads page until
        // an admin gives them a counselor.
        counselor: effectiveCounselorFilter !== "all" ? effectiveCounselorFilter : "assigned",
        lead_source: sourceFilter !== "all" ? sourceFilter : undefined,
        ordering,
      })
      setStudents(res.data)
      setTotalPages(res.pagination.totalPages)
      setTotal(res.pagination.total)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load students")
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, stageFilter, effectiveCounselorFilter, sourceFilter, ordering])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  // "N leads waiting" pointer for admins; the Facebook pull itself runs in
  // CrmLayout and fires LEADS_CHANGED_EVENT.
  useEffect(() => {
    if (!isManager) return
    const refresh = () => { fetchLeadSummary().then((r) => setWaitingLeads(r.total)).catch(() => {}) }
    refresh()
    window.addEventListener(LEADS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(LEADS_CHANGED_EVENT, refresh)
  }, [isManager])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  const handleCreated = () => {
    setPage(1)
    void loadStudents()
  }

  const stageOptions = useMemo(() => stages, [stages])

  const handleAssign = useCallback(async (student: StudentListItem, counselorId: number | null) => {
    try {
      const updated = await assignStudentCounselor(student.id, counselorId)
      if (updated.counselor) {
        setStudents((rows) => rows.map((r) => (
          r.id === student.id ? { ...r, counselor: updated.counselor, counselor_name: updated.counselor_name } : r
        )))
        toast.success(`Assigned to ${updated.counselor_name}`)
      } else {
        setStudents((rows) => rows.filter((r) => r.id !== student.id))
        toast.success(`${student.full_name} moved back to Leads`)
      }
      announceLeadsChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign counselor")
    }
  }, [])

  const handleStageChange = useCallback(async function apply(student: StudentListItem, stageKey: string, isUndo = false): Promise<void> {
    const previous = { stage: student.stage, stage_key: student.stage_key, stage_label: student.stage_label, is_lost: student.is_lost }
    const target = stages.find((s) => s.key === stageKey)
    const patch = (values: Partial<StudentListItem>) =>
      setStudents((rows) => rows.map((r) => (r.id === student.id ? { ...r, ...values } : r)))
    // Optimistic: the badge flips straight away, and rolls back on failure.
    if (target) patch({ stage: target.id, stage_key: target.key, stage_label: target.label, is_lost: target.is_lost })
    try {
      const updated = await changeStudentStage(student.id, stageKey)
      patch({
        stage: updated.stage, stage_key: updated.stage_key, stage_label: updated.stage_label,
        is_lost: updated.is_lost, stage_changed_at: updated.stage_changed_at,
      })
      if (isUndo) {
        toast.success(`${student.full_name} is back to ${updated.stage_label}`)
      } else {
        toast.success(`${student.full_name} → ${updated.stage_label}`, {
          description: `Was ${previous.stage_label}`,
          action: { label: "Undo", onClick: () => void apply({ ...student, ...updated }, previous.stage_key, true) },
        })
      }
    } catch (err) {
      patch(previous)
      toast.error(err instanceof Error ? err.message : "Failed to change status")
    }
  }, [stages])

  const selection = useMemo<Selection>(() => {
    const onPage = students.filter((s) => selected.has(s.id)).length
    const capReached = () => toast.error(`You can email up to ${MAX_BULK_EMAIL} students at once`)
    return {
      isSelected: (id) => selected.has(id),
      allOnPage: students.length > 0 && onPage === students.length,
      someOnPage: onPage > 0,
      toggle: (student) => {
        if (!selected.has(student.id) && selected.size >= MAX_BULK_EMAIL) return capReached()
        setSelected((prev) => {
          const next = new Map(prev)
          if (next.has(student.id)) next.delete(student.id)
          else next.set(student.id, student)
          return next
        })
      },
      toggleAll: () => {
        if (students.length > 0 && onPage === students.length) {
          setSelected((prev) => {
            const next = new Map(prev)
            students.forEach((s) => next.delete(s.id))
            return next
          })
          return
        }
        const next = new Map(selected)
        for (const s of students) {
          if (next.size >= MAX_BULK_EMAIL) { capReached(); break }
          next.set(s.id, s)
        }
        setSelected(next)
      },
    }
  }, [students, selected])

  const columns = useMemo(
    () => buildColumns(
      counselors, isManager, (student, id) => void handleAssign(student, id),
      stages, (student, key) => handleStageChange(student, key), selection,
    ),
    [counselors, isManager, handleAssign, stages, handleStageChange, selection]
  )

  const toolbar = (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-background dark:border-white/10 dark:bg-white/5"
          placeholder="Search by name, email, phone or campaign…"
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={stageFilter} onValueChange={(v) => { setPage(1); setStageFilter(v) }}>
          <SelectTrigger className="h-9 w-48 shadow-none">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {stageOptions.map((stage) => (
              <SelectItem key={stage.key} value={stage.key}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setPage(1); setSourceFilter(v) }}>
          <SelectTrigger className="h-9 w-44 shadow-none">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {leadSources.map((source) => (
              <SelectItem key={source.id} value={String(source.id)}>
                {source.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isCounselor ? (
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={myStudentsOnly ? "default" : "ghost"}
              className="h-7 rounded-md"
              onClick={() => { setPage(1); setMyStudentsOnly(true) }}
            >
              My students
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!myStudentsOnly ? "default" : "ghost"}
              className="h-7 rounded-md"
              onClick={() => { setPage(1); setMyStudentsOnly(false) }}
            >
              All
            </Button>
          </div>
        ) : (
          <Select value={counselorFilter} onValueChange={(v) => { setPage(1); setCounselorFilter(v) }}>
            <SelectTrigger className="h-9 w-48 shadow-none">
              <SelectValue placeholder="All counselors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counselors</SelectItem>
              {counselors.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={ordering} onValueChange={(v) => { setPage(1); setOrdering(v as typeof ordering) }}>
          <SelectTrigger className="h-9 w-36 shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="stage">By status</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 pb-20">
      <PageHeader
        eyebrow="Caseload"
        title="Students"
        description="Students with an assigned counselor. New enquiries start in Leads."
        actions={<QuickAddStudentDialog stages={stages} counselors={counselors} leadSources={leadSources} onCreated={handleCreated} />}
      />

      {isManager && waitingLeads ? (
        <Link
          to="/crm/leads"
          className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-2.5 text-sm transition-colors hover:bg-amber-500/[0.12]"
        >
          <Inbox className="h-4 w-4 text-amber-600" />
          <span>
            <span className="font-semibold">{waitingLeads} new lead{waitingLeads === 1 ? "" : "s"}</span>
            <span className="text-muted-foreground"> waiting for a counselor</span>
          </span>
          <span className="ml-auto flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
            Open Leads <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      ) : null}

      <DataTable
        columns={columns}
        data={students}
        isLoading={loading}
        emptyMessage={search || stageFilter !== "all" || sourceFilter !== "all" ? "No students match these filters." : "No students yet. Assign a lead to a counselor or add a student."}
        toolbar={toolbar}
        totalCount={total}
        itemLabel="students"
        onRowClick={(student) => navigate(studentPath(student.id, student.full_name))}
        isRowHighlighted={(student) => selected.has(student.id)}
        rowNumberOffset={(page - 1) * pageSize}
        pagination={{
          page, totalPages, onPageChange: setPage,
          pageSize, onPageSizeChange: (size) => { setPage(1); setPageSize(size) },
        }}
      />

      {/* Floating bulk-action bar (same look as the Leads inbox). */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-2.5 text-white shadow-2xl ring-1 ring-black/5 dark:border-emerald-500/30 dark:bg-slate-800">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold tabular-nums">
              {selected.size}
            </span>
            <span className="text-sm font-medium">selected</span>
            <span className="h-5 w-px bg-white/15" />
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={() => setBulkEmailOpen(true)}
            >
              <Mail className="h-3.5 w-3.5" /> Send email
            </Button>
            <Button
              size="icon" variant="ghost" title="Clear selection"
              className="h-8 w-8 text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() => setSelected(new Map())}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <BulkEmailDialog
        open={bulkEmailOpen}
        onOpenChange={setBulkEmailOpen}
        students={[...selected.values()]}
        onSent={() => setSelected(new Map())}
      />
    </div>
  )
}
