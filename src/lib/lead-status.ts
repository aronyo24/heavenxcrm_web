import type { LeadStatus } from "@/lib/crm-types"

// Shared labels/colours for a lead's status (Students, Leads inbox, profile).
export const LEAD_STATUSES: { value: LeadStatus; label: string; hint: string }[] = [
  { value: "new", label: "New", hint: "Not contacted yet" },
  { value: "in_progress", label: "In Progress", hint: "In conversation with the student" },
  { value: "no_response", label: "No Response", hint: "Contacted, but no reply yet" },
  { value: "unreachable", label: "Unreachable", hint: "Phone/email not getting through" },
  { value: "not_interested", label: "Not Interested", hint: "Student declined" },
  { value: "future", label: "Future", hint: "Interested in a later intake" },
  { value: "bad_timing", label: "Bad Timing", hint: "Follow up again later" },
]

export const leadStatusLabel = (status: LeadStatus) =>
  LEAD_STATUSES.find((s) => s.value === status)?.label ?? status

export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  new: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  in_progress: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  no_response: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  unreachable: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  not_interested: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  future: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  bad_timing: "border-slate-400/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
}

export const LEAD_STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-sky-500",
  in_progress: "bg-indigo-500",
  no_response: "bg-amber-500",
  unreachable: "bg-orange-500",
  not_interested: "bg-red-500",
  future: "bg-teal-500",
  bad_timing: "bg-slate-400",
}
