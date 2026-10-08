import { Bell, CalendarDays, CheckSquare, Phone, RotateCcw } from "lucide-react"

import type { Task, TaskType } from "@/lib/crm-types"

export const TASK_TYPE_META: Record<TaskType, { label: string; icon: React.ElementType; tone: string }> = {
  task: { label: "Task", icon: CheckSquare, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  reminder: { label: "Reminder", icon: Bell, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  appointment: { label: "Appointment", icon: CalendarDays, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  call: { label: "Call", icon: Phone, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  follow_up: { label: "Follow-up", icon: RotateCcw, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
}

export const isOpenTask = (t: Task) => t.status === "pending" || t.status === "in_progress"

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export type DueBucket = "overdue" | "today" | "tomorrow" | "week" | "later"

export function dueBucket(iso: string, now = new Date()): DueBucket {
  const due = new Date(iso)
  if (due < now) return "overdue"
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "tomorrow"
  if (days < 7) return "week"
  return "later"
}

// "Overdue 2d", "Today 3:30 PM", "Tomorrow 10:00 AM", "Thu 9:00 AM", "12 Nov"
export function dueLabel(iso: string, now = new Date()): string {
  const due = new Date(iso)
  const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  const bucket = dueBucket(iso, now)
  if (bucket === "overdue") {
    const hours = (now.getTime() - due.getTime()) / 3_600_000
    if (hours < 1) return "Overdue · just now"
    if (hours < 24) return `Overdue · ${Math.round(hours)}h`
    return `Overdue · ${Math.round(hours / 24)}d`
  }
  if (bucket === "today") return `Today ${time}`
  if (bucket === "tomorrow") return `Tomorrow ${time}`
  if (bucket === "week") return `${due.toLocaleDateString([], { weekday: "short" })} ${time}`
  return due.toLocaleDateString([], { day: "numeric", month: "short", year: due.getFullYear() === now.getFullYear() ? undefined : "numeric" })
}
