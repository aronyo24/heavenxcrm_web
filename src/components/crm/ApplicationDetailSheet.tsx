import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  BookOpen, Building2, Contact, Download, ExternalLink, FileText, GraduationCap, NotebookPen, Paperclip,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { changeApplicationStatus, fetchApplication } from "@/lib/crm-api"
import type { Application, ApplicationStatus } from "@/lib/crm-types"
import { studentPath } from "@/lib/student-url"
import { cn, safeHref } from "@/lib/utils"

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "documents_requested", label: "Documents Requested" },
  { value: "offer_received", label: "Offer Received" },
  { value: "enrolled", label: "Enrolled" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
]

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  submitted: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  under_review: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
  documents_requested: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  offer_received: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  enrolled: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-600",
  withdrawn: "border-border bg-muted text-muted-foreground",
}

function fileName(url: string) {
  try {
    return decodeURIComponent(new URL(url, window.location.origin).pathname.split("/").pop() || "file")
  } catch {
    return "file"
  }
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "—"
  return new Date(value).toLocaleString([], {
    day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5 text-emerald-600" />
        {title}
      </h3>
      {children}
    </section>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium">{value || "—"}</p>
    </div>
  )
}

function DocumentRow({ label, hint, url }: { label: string; hint: string; url: string }) {
  const href = safeHref(url)
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-500/15">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={fileName(url)}>{label}</p>
        <p className="truncate text-xs text-muted-foreground">{hint} · {fileName(url)}</p>
      </div>
      {href && (
        <div className="flex flex-shrink-0 gap-1.5">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <a href={href} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> View</a>
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Download">
            <a href={href} download><Download className="h-3.5 w-3.5" /></a>
          </Button>
        </div>
      )}
    </div>
  )
}

interface ApplicationDetailSheetProps {
  applicationId: number | null
  onOpenChange: (open: boolean) => void
  /** Called after a status/notes save so the caller can refresh its row. */
  onUpdated?: (application: Application) => void
  /** Hide the "Open student profile" link when already on that profile. */
  showStudentLink?: boolean
}

export function ApplicationDetailSheet({
  applicationId, onOpenChange, onUpdated, showStudentLink = true,
}: ApplicationDetailSheetProps) {
  const [application, setApplication] = useState<Application | null>(null)
  const [status, setStatus] = useState<ApplicationStatus>("submitted")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (applicationId == null) return
    let cancelled = false
    fetchApplication(applicationId)
      .then((data) => {
        if (cancelled) return
        setApplication(data)
        setStatus(data.status)
        setNotes(data.review_notes ?? "")
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load application")
      })
    return () => { cancelled = true }
  }, [applicationId])

  // Still loading until the fetched record matches the one asked for.
  const loading = applicationId != null && application?.id !== applicationId
  const dirty = application != null && (status !== application.status || notes !== (application.review_notes ?? ""))

  const handleSave = async () => {
    if (!application) return
    setSaving(true)
    try {
      const updated = await changeApplicationStatus(application.id, status, notes)
      setApplication(updated)
      onUpdated?.(updated)
      toast.success("Application updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update application")
    } finally {
      setSaving(false)
    }
  }

  const app = application
  const hasDocuments = Boolean(app?.resume || app?.profile_resume)

  return (
    <Sheet open={applicationId != null} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle className="pr-6">{app?.course_name ?? "Application"}</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{app?.university_name ?? (loading ? "Loading…" : "")}</span>
          </SheetDescription>
          {app && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline" className={STATUS_COLOR[app.status]}>
                {STATUS_OPTIONS.find((o) => o.value === app.status)?.label ?? app.status}
              </Badge>
              <span className="text-xs text-muted-foreground">Submitted {formatDate(app.submitted_at, true)}</span>
            </div>
          )}
        </SheetHeader>

        {loading || !app ? (
          <div className="flex-1 space-y-3 px-6 py-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />)}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
              <Section icon={Paperclip} title="Documents">
                {hasDocuments ? (
                  <div className="space-y-2">
                    {app.resume && <DocumentRow label="Resume / CV" hint="Attached to this application" url={app.resume} />}
                    {app.profile_resume && <DocumentRow label="Profile CV" hint="From the student's account" url={app.profile_resume} />}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No resume or documents were submitted with this application.
                  </div>
                )}
              </Section>

              <Section icon={Contact} title="Applicant">
                <div className="grid grid-cols-2 gap-4">
                  <Info label="Full name" value={app.full_name} />
                  <Info label="Email" value={app.email} />
                  <Info label="Phone" value={app.phone} />
                  <Info label="Nationality" value={app.nationality} />
                  <Info label="Date of birth" value={app.date_of_birth ? formatDate(app.date_of_birth) : ""} />
                  <Info label="Intake" value={app.intake_term} />
                </div>
              </Section>

              <Section icon={GraduationCap} title="Academic background">
                <div className="grid grid-cols-2 gap-4">
                  <Info label="Highest qualification" value={app.highest_qualification} />
                  <Info label="Institution" value={app.institution_name} />
                  <Info label="GPA" value={app.gpa ?? ""} />
                  <Info
                    label="English test"
                    value={app.english_test ? `${app.english_test}${app.english_score != null ? ` · ${app.english_score}` : ""}` : ""}
                  />
                </div>
              </Section>

              <Section icon={BookOpen} title="Personal statement">
                {app.personal_statement ? (
                  <p className="whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">{app.personal_statement}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No personal statement provided.</p>
                )}
              </Section>

              <Section icon={NotebookPen} title="Review">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as ApplicationStatus)} disabled={saving}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Internal review notes</Label>
                    <Textarea
                      rows={4}
                      placeholder="Only staff can see these notes."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  {app.reviewed_by_name && (
                    <p className="text-xs text-muted-foreground">
                      Last reviewed by {app.reviewed_by_name}{app.decided_at ? ` · decided ${formatDate(app.decided_at)}` : ""}
                    </p>
                  )}
                </div>
              </Section>
            </div>

            <div className={cn("flex items-center gap-2 border-t px-6 py-4", showStudentLink ? "justify-between" : "justify-end")}>
              {showStudentLink && (
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <Link to={studentPath(app.student, app.full_name)}>Open student profile</Link>
                </Button>
              )}
              <Button size="sm" onClick={() => void handleSave()} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save review"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
