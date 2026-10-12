import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowRight, Award, BookOpen, CalendarDays, Check, ClipboardCheck, Copy, Download, ExternalLink, FileClock, FileText,
  GraduationCap, Languages, Lock, Mail, MessageSquareText, Phone, RotateCcw, Send, School, UserRound, XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UniversityLogo } from "@/components/crm/UniversityLogo"
import { changeApplicationStatus, fetchApplication } from "@/lib/crm-api"
import type { Application, ApplicationStatus } from "@/lib/crm-types"
import {
  APPLICATION_STATUS_COLOR, APPLICATION_STATUS_DOT, APPLICATION_STATUSES, APPLICATION_STEPS,
  applicationStatusLabel, applicationStepIndex, daysSince, isClosedApplication,
} from "@/lib/application-status"
import { studentPath } from "@/lib/student-url"
import { cn, safeHref } from "@/lib/utils"

type NextStep = { status: ApplicationStatus; label: string; icon: React.ElementType; tone: string }

// Tone = icon colour only; the picked step is the one filled in green.
const TONE = {
  primary: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  neutral: "text-slate-500",
}

// The sensible next moves from each status, so counselors rarely need the full list.
const NEXT_STEPS: Record<ApplicationStatus, NextStep[]> = {
  submitted: [
    { status: "under_review", label: "Start review", icon: ClipboardCheck, tone: TONE.primary },
    { status: "documents_requested", label: "Request documents", icon: FileClock, tone: TONE.amber },
  ],
  under_review: [
    { status: "offer_received", label: "Offer received", icon: Award, tone: TONE.primary },
    { status: "documents_requested", label: "Request documents", icon: FileClock, tone: TONE.amber },
    { status: "rejected", label: "Rejected", icon: XCircle, tone: TONE.red },
  ],
  documents_requested: [
    { status: "under_review", label: "Documents received", icon: Check, tone: TONE.primary },
    { status: "offer_received", label: "Offer received", icon: Award, tone: TONE.neutral },
    { status: "rejected", label: "Rejected", icon: XCircle, tone: TONE.red },
  ],
  offer_received: [
    { status: "enrolled", label: "Mark enrolled", icon: GraduationCap, tone: TONE.primary },
    { status: "withdrawn", label: "Student withdrew", icon: XCircle, tone: TONE.red },
  ],
  enrolled: [{ status: "under_review", label: "Reopen", icon: RotateCcw, tone: TONE.neutral }],
  rejected: [{ status: "under_review", label: "Reopen", icon: RotateCcw, tone: TONE.neutral }],
  withdrawn: [{ status: "under_review", label: "Reopen", icon: RotateCcw, tone: TONE.neutral }],
}

// Starting text for the student message, per target status.
const MESSAGE_TEMPLATES: Partial<Record<ApplicationStatus, (first: string) => string>> = {
  under_review: (n) => `Hi ${n}, we've started reviewing your application and will update you soon.`,
  documents_requested: (n) => `Hi ${n}, to continue your application please upload:\n- \n- `,
  offer_received: (n) => `Congratulations ${n}! You've received an offer. Your counselor will contact you about the next steps.`,
  enrolled: (n) => `Congratulations ${n}, your enrolment is confirmed!`,
  rejected: (n) => `Hi ${n}, unfortunately this application was not successful. Your counselor will help you with other options.`,
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

function ago(iso: string) {
  const d = daysSince(iso)
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold", APPLICATION_STATUS_COLOR[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", APPLICATION_STATUS_DOT[status])} />
      {applicationStatusLabel(status)}
    </span>
  )
}

function ProgressTracker({ app }: { app: Application }) {
  if (isClosedApplication(app.status)) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
        app.status === "rejected" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" : "bg-muted/50 text-muted-foreground",
      )}>
        <XCircle className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">{applicationStatusLabel(app.status)}</span>
        {app.decided_at ? <span className="text-xs opacity-80">· {formatDate(app.decided_at)}</span> : null}
      </div>
    )
  }
  const index = applicationStepIndex(app.status)
  return (
    <ol className="flex items-center">
      {APPLICATION_STEPS.map((step, i) => {
        const done = i < index || (i === index && i === APPLICATION_STEPS.length - 1)
        const current = i === index && !done
        return (
          <li key={step.key} className={cn("flex items-center", i < APPLICATION_STEPS.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <span className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                done && "border-emerald-600 bg-emerald-600 text-white",
                current && "border-emerald-600 bg-background text-emerald-700 ring-4 ring-emerald-500/15",
                !done && !current && "border-slate-200 bg-background text-slate-400 dark:border-white/15",
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("whitespace-nowrap text-[11px]", current || done ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {current && app.status === "documents_requested" ? "Docs requested" : step.label}
              </span>
            </div>
            {i < APPLICATION_STEPS.length - 1 ? (
              <span className={cn("mx-1.5 mb-5 h-0.5 flex-1 rounded-full", i < index ? "bg-emerald-500" : "bg-slate-200 dark:bg-white/10")} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => { void navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`)) }}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  )
}

function ContactRow({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/5">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {value ? (
          href ? <a href={href} className="block truncate text-sm font-medium hover:text-emerald-700 hover:underline">{value}</a>
            : <p className="truncate text-sm font-medium">{value}</p>
        ) : <p className="text-sm text-slate-400">Not provided</p>}
      </div>
      {value ? <CopyButton value={value} label={label} /> : null}
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={cn("mt-1 truncate text-sm font-semibold", !value && "font-normal text-slate-400")}>{value || "Not provided"}</p>
    </div>
  )
}

function DocumentRow({ label, hint, url }: { label: string; hint: string; url: string }) {
  const href = safeHref(url)
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-500/15">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground" title={fileName(url)}>{hint} · {fileName(url)}</p>
      </div>
      {href && (
        <div className="flex flex-shrink-0 gap-1.5">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <a href={href} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Download">
            <a href={href} download><Download className="h-3.5 w-3.5" /></a>
          </Button>
        </div>
      )}
    </div>
  )
}

function HistoryItem({ title, detail, done }: { title: string; detail: string; done: boolean }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span className={cn("relative z-10 mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full", done ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/20")} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
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
  const [studentMessage, setStudentMessage] = useState("")
  const [tab, setTab] = useState("overview")
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
        setStudentMessage("")
        setTab("overview")
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load application")
      })
    return () => { cancelled = true }
  }, [applicationId])

  // Still loading until the fetched record matches the one asked for.
  const loading = applicationId != null && application?.id !== applicationId
  const statusChanged = application != null && status !== application.status
  const dirty = application != null && (statusChanged || notes !== (application.review_notes ?? "") || studentMessage.trim() !== "")

  const firstName = application?.full_name.split(" ")[0] ?? ""
  const pickStatus = (next: ApplicationStatus) => {
    setStatus(next)
    const template = MESSAGE_TEMPLATES[next]
    // Only prefill when the counselor hasn't written anything of their own.
    const isTemplate = !studentMessage.trim() || Object.values(MESSAGE_TEMPLATES).some((t) => t?.(firstName) === studentMessage)
    if (isTemplate) setStudentMessage(template && next !== application?.status ? template(firstName) : "")
  }

  const handleSave = async () => {
    if (!application) return
    setSaving(true)
    try {
      const updated = await changeApplicationStatus(application.id, status, notes, studentMessage.trim())
      setApplication(updated)
      setStatus(updated.status)
      setNotes(updated.review_notes ?? "")
      setStudentMessage("")
      onUpdated?.(updated)
      toast.success(statusChanged ? `Moved to ${applicationStatusLabel(updated.status)}` : "Application updated", {
        description: studentMessage.trim() || statusChanged ? `${firstName} was notified in their portal` : undefined,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update application")
    } finally {
      setSaving(false)
    }
  }

  const app = application
  const documentCount = (app?.resume ? 1 : 0) + (app?.profile_resume ? 1 : 0)
  const courseHref = safeHref(app?.course_url)

  return (
    <Sheet open={applicationId != null} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="space-y-4 border-b bg-gradient-to-b from-emerald-50/80 to-transparent px-6 pb-5 pt-5 text-left dark:from-emerald-500/[0.06]">
          <div className="flex items-start gap-3.5 pr-6">
            <UniversityLogo src={app?.university_logo} name={app?.university_name ?? ""} className="h-12 w-12 rounded-xl" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg leading-snug">{app?.course_name ?? "Application"}</SheetTitle>
              <SheetDescription className="mt-0.5 truncate">
                {app ? [app.course_degree, app.university_name, app.university_country].filter(Boolean).join(" · ") : loading ? "Loading…" : ""}
              </SheetDescription>
              {app && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <StatusPill status={app.status} />
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> Submitted {formatDate(app.submitted_at)} ({ago(app.submitted_at)})
                  </span>
                  {courseHref ? (
                    <a href={courseHref} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                      Course page <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {app ? <ProgressTracker app={app} /> : null}
        </SheetHeader>

        {loading || !app ? (
          <div className="flex-1 space-y-3 px-6 py-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />)}
          </div>
        ) : (
          <>
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-6 mt-4 grid h-auto grid-cols-4 rounded-xl bg-muted/60 p-1">
                {([
                  ["overview", "Overview"],
                  ["documents", `Documents${documentCount ? ` (${documentCount})` : ""}`],
                  ["statement", "Statement"],
                  ["review", "Review"],
                ] as const).map(([value, label]) => (
                  <TabsTrigger key={value} value={value} className="rounded-lg py-1.5 text-xs data-[state=active]:shadow-sm">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <TabsContent value="overview" className="mt-0 space-y-5">
                  <section>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Applicant</h3>
                    <div className="divide-y rounded-xl border bg-card px-3">
                      <ContactRow icon={UserRound} label="Full name" value={app.full_name} />
                      <ContactRow icon={Mail} label="Email" value={app.email} href={app.email ? `mailto:${app.email}` : undefined} />
                      <ContactRow icon={Phone} label="Phone" value={app.phone} href={app.phone ? `tel:${app.phone}` : undefined} />
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Profile</h3>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      <Metric icon={School} label="Qualification" value={app.highest_qualification} />
                      <Metric icon={BookOpen} label="Institution" value={app.institution_name} />
                      <Metric icon={Award} label="GPA" value={app.gpa ?? ""} />
                      <Metric
                        icon={Languages} label="English"
                        value={app.english_test ? `${app.english_test}${app.english_score != null ? ` · ${app.english_score}` : ""}` : ""}
                      />
                      <Metric icon={CalendarDays} label="Intake" value={app.intake_term} />
                      <Metric icon={UserRound} label="Nationality" value={app.nationality} />
                    </div>
                  </section>
                  <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-4 py-3 text-sm dark:bg-white/[0.03]">
                    <span className="text-muted-foreground">Counselor</span>
                    <span className={cn("font-medium", !app.counselor_name && "text-amber-600")}>{app.counselor_name ?? "Unassigned"}</span>
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="mt-0 space-y-2.5">
                  {documentCount ? (
                    <>
                      {app.resume && <DocumentRow label="Resume / CV" hint="Attached to this application" url={app.resume} />}
                      {app.profile_resume && <DocumentRow label="Profile CV" hint="From the student's account" url={app.profile_resume} />}
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed p-8 text-center">
                      <FileText className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-medium">No documents yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">Ask {firstName} for the files you need.</p>
                      <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => { pickStatus("documents_requested"); setTab("review") }}>
                        <FileClock className="h-3.5 w-3.5" /> Request documents
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="statement" className="mt-0">
                  {app.personal_statement ? (
                    <div className="rounded-xl border bg-card">
                      <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                        <span>Personal statement</span>
                        <span className="tabular-nums">{app.personal_statement.trim().split(/\s+/).length} words</span>
                      </div>
                      <p className="whitespace-pre-wrap p-4 text-sm leading-relaxed">{app.personal_statement}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No personal statement was provided.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="review" className="mt-0 space-y-5">
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next step</h3>
                    <div className="flex flex-wrap gap-2">
                      {NEXT_STEPS[app.status].map((step) => (
                        <button
                          key={step.status}
                          type="button"
                          disabled={saving}
                          onClick={() => pickStatus(step.status)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-all",
                            status === step.status
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "bg-background hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10",
                          )}
                        >
                          <step.icon className={cn("h-4 w-4", status === step.status ? "text-white" : step.tone)} /> {step.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>or set any status</span>
                      <Select value={status} onValueChange={(v) => pickStatus(v as ApplicationStatus)} disabled={saving}>
                        <SelectTrigger className="h-8 w-52 text-xs shadow-none"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {APPLICATION_STATUSES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <span className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", APPLICATION_STATUS_DOT[o.value])} /> {o.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {statusChanged ? (
                      <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {applicationStatusLabel(app.status)} <ArrowRight className="h-3.5 w-3.5" />
                        <span className="font-semibold">{applicationStatusLabel(status)}</span>
                        <span className="ml-auto text-xs opacity-80">{APPLICATION_STATUSES.find((s) => s.value === status)?.hint}</span>
                      </p>
                    ) : null}
                  </section>

                  <section className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <MessageSquareText className="h-3.5 w-3.5 text-emerald-600" /> Message to {firstName}
                      <span className="font-normal text-muted-foreground">(optional, shown in their portal)</span>
                    </Label>
                    <Textarea
                      rows={4}
                      placeholder={`Explain the update to ${firstName}, e.g. which documents to upload.`}
                      value={studentMessage}
                      maxLength={1000}
                      onChange={(e) => setStudentMessage(e.target.value)}
                      disabled={saving}
                    />
                  </section>

                  <section className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Lock className="h-3.5 w-3.5 text-slate-500" /> Internal notes
                      <span className="font-normal text-muted-foreground">(staff only)</span>
                    </Label>
                    <Textarea
                      rows={3}
                      placeholder="Notes for the team. The student never sees these."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={saving}
                      className="bg-amber-50/40 dark:bg-amber-500/[0.04]"
                    />
                  </section>

                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">History</h3>
                    <ol className="relative before:absolute before:bottom-2 before:left-[4.5px] before:top-2 before:w-px before:bg-border">
                      <HistoryItem title="Application submitted" detail={formatDate(app.submitted_at, true)} done />
                      {app.reviewed_by_name ? (
                        <HistoryItem title={`Reviewed by ${app.reviewed_by_name}`} detail={`Last update ${formatDate(app.updated_at, true)}`} done />
                      ) : (
                        <HistoryItem title="Last updated" detail={formatDate(app.updated_at, true)} done={app.status !== "submitted"} />
                      )}
                      {app.decided_at ? (
                        <HistoryItem title={`Decision: ${applicationStatusLabel(app.status)}`} detail={formatDate(app.decided_at, true)} done />
                      ) : null}
                    </ol>
                  </section>
                </TabsContent>
              </div>
            </Tabs>

            <div className={cn("flex items-center gap-2 border-t bg-card px-6 py-3.5", showStudentLink ? "justify-between" : "justify-end")}>
              {showStudentLink && (
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <Link to={studentPath(app.student, app.full_name)}><UserRound className="h-4 w-4" /> Student profile</Link>
                </Button>
              )}
              {tab === "review" ? (
                <Button
                  size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => void handleSave()} disabled={!dirty || saving}
                >
                  {statusChanged || studentMessage.trim() ? <Send className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  {saving ? "Saving…" : statusChanged || studentMessage.trim() ? `Update & notify ${firstName}` : "Save notes"}
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setTab("review")}>
                  <ClipboardCheck className="h-3.5 w-3.5" /> Update status
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
