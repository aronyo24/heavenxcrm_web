import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { AlertTriangle, CalendarCheck, CalendarClock, CheckCircle2, ListChecks, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/crm/PageHeader"
import { StatTile } from "@/components/crm/StatTile"
import { TaskFormDialog } from "@/components/crm/TaskFormDialog"
import { TaskRow } from "@/components/crm/TaskRow"
import { dueBucket, isOpenTask, TASK_TYPE_META, type DueBucket } from "@/lib/task-utils"
import { announceTasksChanged, completeTask, fetchTasks, updateTask } from "@/lib/crm-api"
import type { Task, TaskType } from "@/lib/crm-types"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

type View = "open" | "overdue" | "today" | "upcoming" | "done"
const VIEWS: View[] = ["open", "overdue", "today", "upcoming", "done"]

const BUCKETS: { key: DueBucket; label: string; tone: string }[] = [
  { key: "overdue", label: "Overdue", tone: "text-red-600 dark:text-red-400" },
  { key: "today", label: "Today", tone: "text-amber-600 dark:text-amber-400" },
  { key: "tomorrow", label: "Tomorrow", tone: "text-foreground" },
  { key: "week", label: "This week", tone: "text-foreground" },
  { key: "later", label: "Later", tone: "text-muted-foreground" },
]

export default function TasksBoard() {
  const { user } = useAuth()
  // Counselors only ever see their own tasks (server-side), so "All" is for admins.
  const canSeeAll = user?.role === "admin" || user?.role === "sub_admin"
  const [params, setParams] = useSearchParams()
  const view: View = VIEWS.includes(params.get("view") as View) ? (params.get("view") as View) : "open"
  const setView = (v: View) => setParams((p) => { if (v === "open") p.delete("view"); else p.set("view", v); return p }, { replace: true })

  const [scope, setScope] = useState<"me" | "all">("me")
  const [open, setOpen] = useState<Task[]>([])
  const [done, setDone] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all")

  const load = useCallback(async () => {
    setLoading(true)
    const base = scope === "me" ? { assigned_to: "me" as const } : {}
    try {
      const [pending, inProgress, completed] = await Promise.all([
        fetchTasks({ ...base, status: "pending", limit: 100 }),
        fetchTasks({ ...base, status: "in_progress", limit: 100 }),
        fetchTasks({ ...base, status: "completed", limit: 50 }),
      ])
      setOpen([...pending.data, ...inProgress.data].sort((a, b) => a.due_at.localeCompare(b.due_at)))
      setDone(completed.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks")
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => { void load() }, [load])

  const handleComplete = async (task: Task) => {
    setOpen((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "completed" } : t)))
    try {
      const saved = await completeTask(task.id)
      announceTasksChanged()
      toast.success("Task done", {
        description: task.title,
        action: {
          label: "Undo",
          onClick: () => {
            void updateTask(task.id, { status: task.status }).then(() => { announceTasksChanged(); void load() })
          },
        },
      })
      window.setTimeout(() => {
        setOpen((prev) => prev.filter((t) => t.id !== task.id))
        setDone((prev) => [saved, ...prev])
      }, 700)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete the task")
      void load()
    }
  }

  const counts = useMemo(() => {
    const c = { overdue: 0, today: 0, upcoming: 0 }
    for (const t of open) {
      const b = dueBucket(t.due_at)
      if (b === "overdue") c.overdue++
      else if (b === "today") c.today++
      else c.upcoming++
    }
    return c
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const source = view === "done" ? done : open
    return source.filter((t) => {
      if (typeFilter !== "all" && t.task_type !== typeFilter) return false
      if (q && !`${t.title} ${t.description} ${t.student_name ?? ""}`.toLowerCase().includes(q)) return false
      if (view === "done" || view === "open") return true
      const b = dueBucket(t.due_at)
      if (view === "overdue") return b === "overdue" || !isOpenTask(t)
      if (view === "today") return b === "today" || !isOpenTask(t)
      return b !== "overdue" && b !== "today"
    })
  }, [done, open, search, typeFilter, view])

  const grouped = useMemo(() => {
    if (view === "done") return [{ key: "done", label: "Recently completed", tone: "text-muted-foreground", tasks: filtered }]
    return BUCKETS
      .map((b) => ({ ...b, tasks: filtered.filter((t) => dueBucket(t.due_at) === b.key) }))
      .filter((g) => g.tasks.length > 0)
  }, [filtered, view])

  const filtersActive = !!search || typeFilter !== "all"

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Your workload"
        title="Tasks"
        description="Follow-ups, calls, reminders and appointments, sorted by when they're due."
        actions={
          <>
            {canSeeAll && (
              <div className="flex rounded-lg border bg-card p-0.5 shadow-sm">
                {(["me", "all"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      scope === s ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s === "me" ? "My tasks" : "Everyone"}
                  </button>
                ))}
              </div>
            )}
            <TaskFormDialog onCreated={load} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Overdue" value={loading ? "–" : counts.overdue} icon={AlertTriangle} tone={counts.overdue ? "red" : "slate"}
          hint={counts.overdue ? "Do these first" : "Nothing late"} active={view === "overdue"}
          onClick={() => setView(view === "overdue" ? "open" : "overdue")}
        />
        <StatTile
          label="Due today" value={loading ? "–" : counts.today} icon={CalendarCheck} tone="amber"
          hint="Before end of day" active={view === "today"}
          onClick={() => setView(view === "today" ? "open" : "today")}
        />
        <StatTile
          label="Upcoming" value={loading ? "–" : counts.upcoming} icon={CalendarClock} tone="sky"
          hint="Tomorrow and later" active={view === "upcoming"}
          onClick={() => setView(view === "upcoming" ? "open" : "upcoming")}
        />
        <StatTile
          label="Completed" value={loading ? "–" : done.length} icon={CheckCircle2} tone="emerald"
          hint="Recently finished" active={view === "done"}
          onClick={() => setView(view === "done" ? "open" : "done")}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-2.5 border-b p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-background dark:border-white/10 dark:bg-white/5"
              placeholder="Search tasks or student names…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", ...Object.keys(TASK_TYPE_META)] as (TaskType | "all")[]).map((t) => {
              const meta = t === "all" ? null : TASK_TYPE_META[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    typeFilter === t
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {meta && <meta.icon className="h-3 w-3" />}
                  {meta?.label ?? "All types"}
                </button>
              )
            })}
            {filtersActive && (
              <Button
                variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground"
                onClick={() => { setSearch(""); setTypeFilter("all") }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[...Array(6)].map((_, i) => <div key={i} className="h-14 animate-pulse bg-muted/40" />)}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <ListChecks className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </span>
            <p className="font-medium">
              {filtersActive ? "No tasks match these filters" : view === "done" ? "No completed tasks yet" : "You're all caught up"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filtersActive ? "Try a different search or type." : "Add a follow-up so every student hears back from you on time."}
            </p>
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.key}>
              <div className="sticky top-14 z-10 flex items-center justify-between border-b bg-muted/60 px-4 py-1.5 backdrop-blur">
                <span className={cn("text-[11px] font-semibold uppercase tracking-wider", g.tone)}>{g.label}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{g.tasks.length}</span>
              </div>
              <AnimatePresence initial={false}>
                {g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onComplete={handleComplete} showAssignee={scope === "all"} />
                ))}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
