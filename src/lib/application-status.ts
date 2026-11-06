import type { ApplicationStatus } from "@/lib/crm-types"

// Shared labels/colours for application statuses (Applications list, review sheet).
export const APPLICATION_STATUSES: { value: ApplicationStatus; label: string; hint: string }[] = [
  { value: "submitted", label: "Application Submitted", hint: "Sent to the university" },
  { value: "pending_documents", label: "Pending Documents", hint: "Waiting for the student to send documents" },
  { value: "awaiting_results", label: "Waiting for Interview / English Test Results", hint: "Interview or English test done, result pending" },
  { value: "test_passed", label: "Interview / English Test Passed", hint: "Passed the interview or English test" },
  { value: "test_failed", label: "Interview / English Test Failed", hint: "Did not pass the interview or English test" },
  { value: "unconditional", label: "Unconditional", hint: "Unconditional offer received" },
  { value: "rejected", label: "Rejected", hint: "The university declined" },
  { value: "cancelled", label: "Cancelled", hint: "Application cancelled or withdrawn" },
]

export const applicationStatusLabel = (status: ApplicationStatus) =>
  APPLICATION_STATUSES.find((s) => s.value === status)?.label ?? status

export const APPLICATION_STATUS_COLOR: Record<ApplicationStatus, string> = {
  submitted: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  pending_documents: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  awaiting_results: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  test_passed: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  test_failed: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  unconditional: "border-emerald-600/40 bg-emerald-600/15 text-emerald-800 dark:text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  cancelled: "border-slate-400/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
}

export const APPLICATION_STATUS_DOT: Record<ApplicationStatus, string> = {
  submitted: "bg-sky-500",
  pending_documents: "bg-amber-500",
  awaiting_results: "bg-indigo-500",
  test_passed: "bg-teal-500",
  test_failed: "bg-orange-500",
  unconditional: "bg-emerald-600",
  rejected: "bg-red-500",
  cancelled: "bg-slate-400",
}

// The happy path, in order. Pending documents sits inside the submitted step.
export const APPLICATION_STEPS: { key: string; label: string; statuses: ApplicationStatus[] }[] = [
  { key: "submitted", label: "Submitted", statuses: ["submitted", "pending_documents"] },
  { key: "test", label: "Interview / Test", statuses: ["awaiting_results"] },
  { key: "passed", label: "Passed", statuses: ["test_passed"] },
  { key: "unconditional", label: "Unconditional", statuses: ["unconditional"] },
]

export const isClosedApplication = (status: ApplicationStatus) =>
  status === "rejected" || status === "cancelled" || status === "test_failed"

export function applicationStepIndex(status: ApplicationStatus): number {
  return APPLICATION_STEPS.findIndex((step) => step.statuses.includes(status))
}

// "Open" = still needs work from us or the student.
export const OPEN_APPLICATION_STATUSES: ApplicationStatus[] = ["submitted", "pending_documents", "awaiting_results", "test_passed"]

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}
