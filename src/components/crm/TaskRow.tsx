import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { AlarmClock, Check, User } from "lucide-react"

import type { Task } from "@/lib/crm-types"
import { dueBucket, dueLabel, isOpenTask, TASK_TYPE_META } from "@/lib/task-utils"
import { studentPath } from "@/lib/student-url"
import { cn } from "@/lib/utils"

const PRIORITY_BAR: Record<Task["priority"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-slate-300 dark:bg-slate-600",
}

export function TaskRow({
  task, onComplete, showAssignee, compact,
}: {
  task: Task
  onComplete?: (task: Task) => void
  showAssignee?: boolean
  compact?: boolean
}) {
  const meta = TASK_TYPE_META[task.task_type] ?? TASK_TYPE_META.task
  const open = isOpenTask(task)
  const overdue = open && dueBucket(task.due_at) === "overdue"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden border-b px-4 last:border-b-0 transition-colors hover:bg-muted/40",
        compact ? "py-2.5" : "py-3",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", PRIORITY_BAR[task.priority])} title={`${task.priority} priority`} />
      <button
        type="button"
        onClick={() => onComplete?.(task)}
        disabled={!open || !onComplete}
        title={open ? "Mark as done" : "Done"}
        className={cn(
          "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
          open
            ? "border-slate-300 text-transparent hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600 dark:border-slate-600"
            : "border-emerald-500 bg-emerald-500 text-white",
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      <span className={cn("hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg sm:flex", meta.tone)} title={meta.label}>
        <meta.icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", !open && "text-muted-foreground line-through")}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {task.student && (
            <Link
              to={studentPath(task.student, task.student_name)}
              className="flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              <User className="h-3 w-3" />
              {task.student_name}
            </Link>
          )}
          {showAssignee && <span>→ {task.assigned_to_name}</span>}
          {!compact && task.description && <span className="max-w-[320px] truncate">{task.description}</span>}
        </div>
      </div>

      <span
        className={cn(
          "flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium tabular-nums",
          !open ? "text-muted-foreground"
            : overdue ? "bg-red-500/10 text-red-600 dark:text-red-400"
            : "bg-muted text-foreground/80",
        )}
        title={new Date(task.due_at).toLocaleString()}
      >
        <AlarmClock className="h-3 w-3" />
        {open ? dueLabel(task.due_at) : `Done${task.completed_at ? ` ${new Date(task.completed_at).toLocaleDateString([], { day: "numeric", month: "short" })}` : ""}`}
      </span>
    </motion.div>
  )
}
