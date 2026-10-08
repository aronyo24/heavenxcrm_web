import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AlertTriangle, RefreshCw, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/crm/PageHeader"
import { PipelineKanbanBoard } from "@/components/crm/PipelineKanbanBoard"
import { QuickAddStudentDialog } from "@/components/crm/QuickAddStudentDialog"
import { fetchCounselors, fetchLeadSources, fetchPipelineStages, fetchStudents, changeStudentStage } from "@/lib/crm-api"
import type { Counselor, LeadSource, PipelineStage, StudentListItem } from "@/lib/crm-types"
import { studentPath } from "@/lib/student-url"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

export default function PipelineKanban() {
  const navigate = useNavigate()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [counselorFilter, setCounselorFilter] = useState("all")
  const [staleOnly, setStaleOnly] = useState(false)
  const { user } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stagesRes, studentsRes, counselorsRes, sourcesRes] = await Promise.all([
        fetchPipelineStages(),
        fetchStudents({ is_lost: false, limit: 200 }),
        fetchCounselors(),
        fetchLeadSources(),
      ])
      setStages(stagesRes)
      setStudents(studentsRes.data)
      setCounselors(counselorsRes)
      setLeadSources(sourcesRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pipeline")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const wonStages = useMemo(() => new Set(stages.filter((s) => s.is_won).map((s) => s.key)), [stages])
  const isStale = useCallback(
    (s: StudentListItem) =>
      !wonStages.has(s.stage_key) && Date.now() - new Date(s.stage_changed_at || s.updated_at).getTime() >= 14 * 86_400_000,
    [wonStages],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      if (counselorFilter === "none" ? s.counselor !== null : counselorFilter !== "all" && String(s.counselor) !== counselorFilter) return false
      if (staleOnly && !isStale(s)) return false
      if (q && !`${s.full_name} ${s.email} ${s.phone} ${s.target_country}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [counselorFilter, isStale, search, staleOnly, students])

  const staleCount = useMemo(() => students.filter(isStale).length, [isStale, students])

  const studentsByStage = useMemo(() => {
    const map: Record<string, StudentListItem[]> = {}
    for (const student of visible) {
      map[student.stage_key] = map[student.stage_key] ?? []
      map[student.stage_key].push(student)
    }
    return map
  }, [visible])

  const handleDrop = async (studentId: number, stageKey: string) => {
    const student = students.find((s) => s.id === studentId)
    if (!student || student.stage_key === stageKey) return

    // Optimistic update
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, stage_key: stageKey, stage_changed_at: new Date().toISOString() } : s))
    )

    try {
      await changeStudentStage(studentId, stageKey)
      toast.success(`${student.full_name} moved to ${stages.find((st) => st.key === stageKey)?.label ?? stageKey}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move lead")
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? student : s))
      )
    }
  }

  const filtersActive = !!search || counselorFilter !== "all" || staleOnly

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admission journey"
        title="Pipeline"
        description="Drag a student card to another column to change their status."
        actions={
          <>
            <Button variant="outline" size="icon" className="h-9 w-9 shadow-sm" onClick={() => void load()} disabled={loading} title="Refresh">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <QuickAddStudentDialog stages={stages} counselors={counselors} leadSources={leadSources} onCreated={load} />
          </>
        }
      />

      <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-background dark:border-white/10 dark:bg-white/5"
            placeholder="Filter cards by name, phone, email or country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user?.is_admin && counselors.length > 0 && (
            <Select value={counselorFilter} onValueChange={setCounselorFilter}>
              <SelectTrigger className="h-9 w-48 shadow-none">
                <SelectValue placeholder="All counselors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All counselors</SelectItem>
                <SelectItem value="none">Unassigned</SelectItem>
                {counselors.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button
            type="button"
            onClick={() => setStaleOnly((v) => !v)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
              staleOnly ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400" : "text-muted-foreground hover:text-foreground",
            )}
            title="Students who haven't changed status in 14+ days"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Needs attention
            <span className="rounded-full bg-muted px-1.5 tabular-nums">{staleCount}</span>
          </button>
          {filtersActive && (
            <Button
              variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground"
              onClick={() => { setSearch(""); setCounselorFilter("all"); setStaleOnly(false) }}
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">
            {visible.length} of {students.length} students
          </span>
        </div>
      </div>

      {loading && students.length === 0 ? (
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-96 w-72 flex-shrink-0 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : (
        <PipelineKanbanBoard
          stages={stages}
          studentsByStage={studentsByStage}
          onCardClick={(student) => navigate(studentPath(student.id, student.full_name))}
          onDrop={(studentId, stageKey) => void handleDrop(studentId, stageKey)}
        />
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">Card dot = priority</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />High</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Medium</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" />Low</span>
        <span className="ml-2 font-medium uppercase tracking-wider">Clock = days in this status</span>
        <span className="text-amber-700 dark:text-amber-400">7d+ amber</span>
        <span className="text-red-600 dark:text-red-400">14d+ red</span>
      </p>
    </div>
  )
}
