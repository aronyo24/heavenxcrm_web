import type { ApplicationStatus } from "@/lib/crm-types"

// Shared labels/colours for application statuses (Applications list, review sheet).
export const APPLICATION_STATUSES: { value: ApplicationStatus; label: string; hint: string }[] = [
  { value: "submitted", label: "Submitted", hint: "Waiting for a counselor to start the review" },
  { value: "under_review", label: "Under review", hint: "Counselor is checking the application" },
  { value: "documents_requested", label: "Documents requested", hint: "Waiting for the student to send documents" },
  { value: "offer_received", label: "Offer received", hint: "The university made an offer" },
  { value: "enrolled", label: "Enrolled", hint: "Student accepted and enrolled" },
  { value: "rejected", label: "Rejected", hint: "The university declined" },
  { value: "withdrawn", label: "Withdrawn", hint: "Student withdrew the application" },
]

export const applicationStatusLabel = (status: ApplicationStatus) =>
  APPLICATION_STATUSES.find((s) => s.value === status)?.label ?? status

export const APPLICATION_STATUS_COLOR: Record<ApplicationStatus, string> = {
  submitted: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  under_review: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  documents_requested: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  offer_received: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  enrolled: "border-emerald-600/40 bg-emerald-600/15 text-emerald-800 dark:text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  withdrawn: "border-slate-400/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
}

export const APPLICATION_STATUS_DOT: Record<ApplicationStatus, string> = {
  submitted: "bg-sky-500",
  under_review: "bg-indigo-500",
  documents_requested: "bg-amber-500",
  offer_received: "bg-emerald-500",
  enrolled: "bg-emerald-700",
  rejected: "bg-red-500",
  withdrawn: "bg-slate-400",
}

// The happy path, in order. Documents requested sits inside the review step.
export const APPLICATION_STEPS: { key: string; label: string; statuses: ApplicationStatus[] }[] = [
  { key: "submitted", label: "Submitted", statuses: ["submitted"] },
  { key: "review", label: "In review", statuses: ["under_review", "documents_requested"] },
  { key: "offer", label: "Offer", statuses: ["offer_received"] },
  { key: "enrolled", label: "Enrolled", statuses: ["enrolled"] },
]

export const isClosedApplication = (status: ApplicationStatus) => status === "rejected" || status === "withdrawn"

export function applicationStepIndex(status: ApplicationStatus): number {
  return APPLICATION_STEPS.findIndex((step) => step.statuses.includes(status))
}

// "Open" = still needs work from us or the student.
export const OPEN_APPLICATION_STATUSES: ApplicationStatus[] = ["submitted", "under_review", "documents_requested"]

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}
