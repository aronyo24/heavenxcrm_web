import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { ArrowRight, Facebook, Inbox, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/crm/DataTable"
import { PageHeader } from "@/components/crm/PageHeader"
import { StageBadge } from "@/components/crm/StageBadge"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { QuickAddStudentDialog } from "@/components/crm/QuickAddStudentDialog"
import { SendEmailDialog } from "@/components/crm/SendEmailDialog"
import { QuickChatDialog } from "@/components/crm/QuickChatDialog"
import { useAuth } from "@/lib/auth"
import { formatScheduledTime } from "@/lib/call-reminder"
import {
  announceLeadsChanged, assignStudentCounselor, fetchCounselors, fetchLeadSources, fetchLeadSummary, fetchPipelineStages,
  fetchStudents, LEADS_CHANGED_EVENT, type StudentFilters,
} from "@/lib/crm-api"
import type { Counselor, LeadSource, PipelineStage, StudentListItem } from "@/lib/crm-types"
import { studentPath } from "@/lib/student-url"

function CallRequestCell({ request }: { request: StudentListItem["open_call_request"] }) {
  if (!request) return <span className="text-muted-foreground">—</span>
  if (request.status === "accepted") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
        Scheduled{request.proposed_at ? `: ${formatScheduledTime(request.proposed_at)}` : ""}
      </Badge>
    )
  }
  if (request.status === "proposed") {
    return (
      <Badge className="bg-primary/15 text-primary border-primary/20">
        Proposed{request.proposed_at ? `: ${formatScheduledTime(request.proposed_at)}` : ""}
      </Badge>
    )
  }
  return <Badge variant="secondary">Requested</Badge>
}

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
        <SelectTrigger className="h-8 w-40">
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

const buildColumns = (
  counselors: Counselor[],
  canAssign: boolean,
  onAssign: (student: StudentListItem, counselorId: number | null) => void,
): ColumnDef<StudentListItem, unknown>[] => [
  {
    accessorKey: "full_name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={row.original.full_name} size="sm" />
        <span className="font-medium">{row.original.full_name}</span>
      </div>
    ),
  },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "phone", header: "Phone" },
  {
    accessorKey: "stage_label",
    header: "Status",
    cell: ({ row }) => <StageBadge stageKey={row.original.stage_key} label={row.original.stage_label} />,
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
  { accessorKey: "target_country", header: "Target Country", cell: ({ row }) => row.original.target_country || "—" },
  {
    id: "open_call_request",
    header: "Call",
    cell: ({ row }) => <CallRequestCell request={row.original.open_call_request} />,
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      // Stop the click from bubbling to the row's onRowClick (which opens
      // the full profile) so these are true one-click shortcuts instead of
      // a detour through the profile page every time.
      <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-2">
        <QuickChatDialog studentId={row.original.id} studentName={row.original.full_name} />
        <SendEmailDialog studentId={row.original.id} studentEmail={row.original.email} onSent={() => {}} />
      </div>
    ),
  },
]

const PAGE_SIZE = 25

export default function StudentsList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isCounselor = user?.role === "counselor"
  // Only full admins may (re)assign a counselor - enforced server-side in
  // StudentViewSet.assign_counselor too.
  const isFullAdmin = user?.role === "admin"
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
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
        limit: PAGE_SIZE,
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
  }, [page, search, stageFilter, effectiveCounselorFilter, sourceFilter, ordering])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  // "N leads waiting" pointer for admins; the Facebook pull itself runs in
  // CrmLayout and fires LEADS_CHANGED_EVENT.
  useEffect(() => {
    if (!isFullAdmin) return
    const refresh = () => { fetchLeadSummary().then((r) => setWaitingLeads(r.total)).catch(() => {}) }
    refresh()
    window.addEventListener(LEADS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(LEADS_CHANGED_EVENT, refresh)
  }, [isFullAdmin])

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

  const columns = useMemo(
    () => buildColumns(counselors, isFullAdmin, (student, id) => void handleAssign(student, id)),
    [counselors, isFullAdmin, handleAssign]
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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Caseload"
        title="Students"
        description="Students with an assigned counselor. New enquiries start in Leads."
        actions={<QuickAddStudentDialog stages={stages} counselors={counselors} leadSources={leadSources} onCreated={handleCreated} />}
      />

      {isFullAdmin && waitingLeads ? (
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
        rowNumberOffset={(page - 1) * PAGE_SIZE}
        pagination={{ page, totalPages, onPageChange: setPage }}
      />
    </div>
  )
}
