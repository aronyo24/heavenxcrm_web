import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Facebook, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/crm/DataTable"
import { StageBadge } from "@/components/crm/StageBadge"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { QuickAddStudentDialog } from "@/components/crm/QuickAddStudentDialog"
import { SendEmailDialog } from "@/components/crm/SendEmailDialog"
import { QuickChatDialog } from "@/components/crm/QuickChatDialog"
import { useAuth } from "@/lib/auth"
import { formatScheduledTime } from "@/lib/call-reminder"
import {
  assignStudentCounselor, fetchCounselors, fetchLeadSources, fetchPipelineStages, fetchStudents, syncFacebookLeads,
  type StudentFilters,
} from "@/lib/crm-api"
import type { Counselor, LeadSource, PipelineStage, StudentListItem } from "@/lib/crm-types"

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
    <div className="flex flex-col gap-0.5">
      {isFacebook ? (
        <Badge className="w-fit gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20">
          <Facebook className="h-3 w-3" />
          Facebook
        </Badge>
      ) : (
        <Badge variant="secondary" className="w-fit">{student.lead_source_name}</Badge>
      )}
      {student.campaign ? (
        <span className="max-w-[180px] truncate text-xs text-muted-foreground" title={student.campaign}>
          {student.campaign}
        </span>
      ) : null}
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
        <SelectTrigger className={`h-8 w-40 ${student.counselor ? "" : "border-amber-500/50 text-amber-700 dark:text-amber-400"}`}>
          <SelectValue placeholder="Assign" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
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
    header: "Stage",
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
        search: search || undefined,
        stage: stageFilter !== "all" ? stageFilter : undefined,
        counselor: effectiveCounselorFilter !== "all" ? effectiveCounselorFilter : undefined,
        lead_source: sourceFilter !== "all" ? sourceFilter : undefined,
        ordering,
      })
      setStudents(res.data)
      setTotalPages(res.pagination.totalPages)
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

  // Leads from Facebook ad forms arrive by webhook; this catches any the
  // webhook missed. Reload only if something new actually came in.
  useEffect(() => {
    syncFacebookLeads()
      .then(({ created }) => {
        if (created > 0) {
          toast.success(`${created} new Facebook lead${created > 1 ? "s" : ""} added`)
          void loadStudents()
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit, not per filter change
  }, [])

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
      setStudents((rows) => rows.map((r) => (
        r.id === student.id ? { ...r, counselor: updated.counselor, counselor_name: updated.counselor_name } : r
      )))
      toast.success(updated.counselor_name ? `Assigned to ${updated.counselor_name}` : "Counselor removed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign counselor")
    }
  }, [])

  const columns = useMemo(
    () => buildColumns(counselors, isFullAdmin, (student, id) => void handleAssign(student, id)),
    [counselors, isFullAdmin, handleAssign]
  )

  const facebookSource = leadSources.find((s) => s.name.toLowerCase().includes("facebook"))
  const showFacebookUnassigned = () => {
    if (!facebookSource) return
    setPage(1)
    setSourceFilter(String(facebookSource.id))
    if (!isCounselor) setCounselorFilter("unassigned")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted-foreground">All leads and students in the pipeline.</p>
        </div>
        <QuickAddStudentDialog stages={stages} counselors={counselors} leadSources={leadSources} onCreated={handleCreated} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, phone, or campaign..."
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
          />
        </div>
        <Select value={stageFilter} onValueChange={(v) => { setPage(1); setStageFilter(v) }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stageOptions.map((stage) => (
              <SelectItem key={stage.key} value={stage.key}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setPage(1); setSourceFilter(v) }}>
          <SelectTrigger className="w-full sm:w-44">
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
          <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
            <Button
              type="button"
              size="sm"
              variant={myStudentsOnly ? "default" : "ghost"}
              className="rounded-md h-8"
              onClick={() => { setPage(1); setMyStudentsOnly(true) }}
            >
              My Students
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!myStudentsOnly ? "default" : "ghost"}
              className="rounded-md h-8"
              onClick={() => { setPage(1); setMyStudentsOnly(false) }}
            >
              All
            </Button>
          </div>
        ) : (
          <Select value={counselorFilter} onValueChange={(v) => { setPage(1); setCounselorFilter(v) }}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All counselors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counselors</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {counselors.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={ordering} onValueChange={(v) => { setPage(1); setOrdering(v as typeof ordering) }}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="stage">By stage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {facebookSource && !isCounselor ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={showFacebookUnassigned}>
            <Facebook className="h-3.5 w-3.5 text-blue-600" />
            New Facebook leads to assign
          </Button>
          {sourceFilter !== "all" || counselorFilter !== "all" || stageFilter !== "all" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setPage(1); setSourceFilter("all"); setCounselorFilter("all"); setStageFilter("all") }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={students}
        isLoading={loading}
        emptyMessage="No students match these filters."
        onRowClick={(student) => navigate(`/crm/students/${student.id}`)}
        pagination={{ page, totalPages, onPageChange: setPage }}
      />
    </div>
  )
}
