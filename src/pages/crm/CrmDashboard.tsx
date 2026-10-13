import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Activity, AlertTriangle, ArrowRight, CalendarCheck, KanbanSquare, ListChecks, PartyPopper, Plus, RefreshCw,
  TrendingUp, UserPlus, Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ActivityTimeline } from "@/components/crm/ActivityTimeline"
import { PageHeader } from "@/components/crm/PageHeader"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { StageBadge } from "@/components/crm/StageBadge"
import { StatTile } from "@/components/crm/StatTile"
import { TaskFormDialog } from "@/components/crm/TaskFormDialog"
import { TaskRow } from "@/components/crm/TaskRow"
import { dueBucket, isOpenTask } from "@/lib/task-utils"
import {
  announceTasksChanged, completeTask, fetchCrmDashboard, fetchStudents, fetchTasks, updateTask,
} from "@/lib/crm-api"
import type { CrmDashboardStats, StudentListItem, Task } from "@/lib/crm-types"
import { useAuth } from "@/lib/auth"
import { studentPath } from "@/lib/student-url"
import { cn } from "@/lib/utils"

function greeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

// Same palette as StageBadge so the funnel matches the rest of the CRM.
const STAGE_BAR: Record<string, string> = {
  new: "bg-slate-400",
  contacted: "bg-blue-500",
  counseling: "bg-indigo-500",
  applied: "bg-purple-500",
  offer: "bg-amber-500",
  visa: "bg-cyan-500",
  enrolled: "bg-emerald-500",
}

function Panel({
  title, icon: Icon, action, children, className,
}: {
  title: string
  icon: React.ElementType
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

const ViewAll = ({ to, label = "View all" }: { to: string; label?: string }) => (
  <Link to={to} className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
    {label} <ArrowRight className="h-3 w-3" />
  </Link>
)

export default function CrmDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<CrmDashboardStats | null>(null)
  const [agenda, setAgenda] = useState<Task[]>([])
  const [recent, setRecent] = useState<StudentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const canSeeStudents = !!user?.is_crm_manager || !!user?.permissions?.crm_view_own_students

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stats, pending, inProgress, students] = await Promise.all([
        fetchCrmDashboard(),
        fetchTasks({ assigned_to: "me", status: "pending", limit: 100 }),
        fetchTasks({ assigned_to: "me", status: "in_progress", limit: 100 }),
        canSeeStudents
          ? fetchStudents({ ordering: "newest", limit: 6 }).then((r) => r.data).catch(() => [])
          : Promise.resolve([]),
      ])
      setData(stats)
      setAgenda([...pending.data, ...inProgress.data].sort((a, b) => a.due_at.localeCompare(b.due_at)))
      setRecent(students)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [canSeeStudents])

  useEffect(() => { void load() }, [load])

  const handleComplete = async (task: Task) => {
    setAgenda((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "completed" } : t)))
    try {
      await completeTask(task.id)
      announceTasksChanged()
      toast.success("Task done", {
        description: task.title,
        action: {
          label: "Undo",
          onClick: () => {
            void updateTask(task.id, { status: task.status })
              .then(() => { announceTasksChanged(); void load() })
          },
        },
      })
      // Let the tick animate, then drop it from the agenda.
      window.setTimeout(() => setAgenda((prev) => prev.filter((t) => t.id !== task.id)), 700)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete the task")
      void load()
    }
  }

  const now = new Date()
  const { todayTasks, overdueCount, upcoming } = useMemo(() => {
    const due = agenda.filter((t) => !isOpenTask(t) || ["overdue", "today"].includes(dueBucket(t.due_at)))
    return {
      todayTasks: due,
      overdueCount: agenda.filter((t) => isOpenTask(t) && dueBucket(t.due_at) === "overdue").length,
      upcoming: agenda.filter((t) => isOpenTask(t) && !["overdue", "today"].includes(dueBucket(t.due_at))).slice(0, 3),
    }
  }, [agenda])

  if (loading && !data) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-16 w-1/2 rounded-xl bg-muted/60" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted/60" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-80 rounded-xl bg-muted/60 lg:col-span-2" />
          <div className="h-80 rounded-xl bg-muted/60" />
        </div>
      </div>
    )
  }

  if (failed || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="font-medium">We couldn't load your dashboard.</p>
        <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button onClick={() => void load()} className="mt-4" size="sm">Try again</Button>
      </div>
    )
  }

  const firstName = user?.full_name?.split(" ")[0] || "there"
  const openToday = data.tasks_due_today
  const focus = data.tasks_overdue > 0
    ? `${data.tasks_overdue} overdue task${data.tasks_overdue > 1 ? "s" : ""} need${data.tasks_overdue > 1 ? "" : "s"} attention, plus ${openToday} due today.`
    : openToday > 0
      ? `You have ${openToday} task${openToday > 1 ? "s" : ""} due today. Nothing is overdue.`
      : "Nothing due today. A good time to follow up with new students."

  const stages = data.by_stage.filter((s) => !s.is_lost)
  const maxStage = Math.max(1, ...stages.map((s) => s.student_count))
  const inPipeline = stages.reduce((sum, s) => sum + s.student_count, 0)
  const won = stages.filter((s) => s.is_won).reduce((sum, s) => sum + s.student_count, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
        title={`${greeting(now.getHours())}, ${firstName}`}
        description={focus}
        actions={
          <>
            <Button variant="outline" size="icon" className="h-9 w-9 shadow-sm" onClick={() => void load()} disabled={loading} title="Refresh">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <TaskFormDialog
              onCreated={load}
              trigger={<Button variant="outline" size="sm" className="h-9 gap-1.5 shadow-sm"><Plus className="h-4 w-4" /> New task</Button>}
            />
            {canSeeStudents && (
              <Button size="sm" className="h-9 gap-1.5 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" onClick={() => navigate("/crm/pipeline")}>
                <KanbanSquare className="h-4 w-4" /> Open pipeline
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Active students" value={data.active_students} icon={Users} tone="emerald"
          hint={`${data.total_students} total · ${data.lost_students} lost`}
          onClick={canSeeStudents ? () => navigate("/crm/students") : undefined}
        />
        <StatTile
          label="New this week" value={data.new_leads_this_week} icon={TrendingUp} tone="sky"
          hint={`${data.new_leads_this_month} in the last 30 days`}
          onClick={canSeeStudents ? () => navigate(user?.is_crm_manager ? "/crm/leads" : "/crm/students") : undefined}
        />
        <StatTile
          label="Due today" value={data.tasks_due_today} icon={CalendarCheck} tone="amber"
          hint="Open tasks for today" onClick={() => navigate("/crm/tasks")}
        />
        <StatTile
          label="Overdue" value={data.tasks_overdue} icon={AlertTriangle} tone={data.tasks_overdue ? "red" : "slate"}
          hint={data.tasks_overdue ? "Past their due time" : "You're on top of it"} onClick={() => navigate("/crm/tasks?view=overdue")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Today's agenda"
          icon={ListChecks}
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-3">
              {overdueCount > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                  {overdueCount} overdue
                </span>
              )}
              <ViewAll to="/crm/tasks" />
            </div>
          }
        >
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <PartyPopper className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </span>
              <p className="font-medium">All caught up</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                No tasks due today. {upcoming.length ? "Here's what's coming next." : "Create a follow-up so no student goes cold."}
              </p>
              {upcoming.length > 0 && (
                <div className="mt-4 w-full overflow-hidden rounded-lg border text-left">
                  {upcoming.map((t) => <TaskRow key={t.id} task={t} onComplete={handleComplete} compact />)}
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <AnimatePresence initial={false}>
                {todayTasks.map((t) => <TaskRow key={t.id} task={t} onComplete={handleComplete} compact />)}
              </AnimatePresence>
            </div>
          )}
        </Panel>

        <Panel title="Pipeline" icon={KanbanSquare} action={canSeeStudents ? <ViewAll to="/crm/pipeline" label="Open board" /> : undefined}>
          <div className="space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="text-xl font-bold tabular-nums text-foreground">{inPipeline}</span> students in progress
              </p>
              {inPipeline > 0 && won > 0 && (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {Math.round((won / inPipeline) * 100)}% enrolled
                </span>
              )}
            </div>
            {stages.map((s) => (
              <div key={s.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground/85">{s.label}</span>
                  <span className="tabular-nums text-muted-foreground">{s.student_count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", STAGE_BAR[s.key] ?? "bg-emerald-500")}
                    style={{ width: `${Math.max(s.student_count ? 4 : 0, (s.student_count / maxStage) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {canSeeStudents && (
          <Panel title="Recently added" icon={UserPlus} action={<ViewAll to="/crm/students" />}>
            {recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No students yet.</p>
            ) : (
              <ul>
                {recent.map((s) => (
                  <li key={s.id} className="border-b last:border-b-0">
                    <Link to={studentPath(s.id, s.full_name)} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                      <PersonAvatar name={s.full_name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.full_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[s.target_country, s.target_degree].filter(Boolean).join(" · ") || s.counselor_name || "No details yet"}
                        </span>
                      </span>
                      <StageBadge stageKey={s.stage_key} label={s.stage_label} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="Recent activity" icon={Activity} className={canSeeStudents ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="max-h-[360px] overflow-y-auto p-4">
            <ActivityTimeline limit={10} />
          </div>
        </Panel>
      </div>
    </div>
  )
}
