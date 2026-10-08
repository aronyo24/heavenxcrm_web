import { safeHref } from "@/lib/utils"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  Activity, Award, BadgeCheck, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, Clock, Copy,
  ExternalLink, FileText, Flag, GraduationCap, Hourglass, ListChecks, Mail, MessageCircle, MessagesSquare,
  Pencil, Phone, Sparkles, Tag, Target, Video, Wallet, XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StageBadge } from "@/components/crm/StageBadge"
import { StatusBadge } from "@/components/crm/StatusBadge"
import { TaskFormDialog } from "@/components/crm/TaskFormDialog"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { SendEmailDialog } from "@/components/crm/SendEmailDialog"
import { LogCommunicationDialog } from "@/components/crm/LogCommunicationDialog"
import { ActivityTimeline } from "@/components/crm/ActivityTimeline"
import { MessageThread, type QuickReply } from "@/components/MessageThread"
import { MeetingsPanel } from "@/components/crm/MeetingsPanel"
import { CallRequestManager } from "@/components/crm/CallRequestManager"
import { LeadFormCard } from "@/components/crm/LeadFormCard"
import { StudentEditSheet } from "@/components/crm/StudentEditSheet"
import { ApplicationDetailSheet } from "@/components/crm/ApplicationDetailSheet"
import {
  assignStudentCounselor, changeApplicationStatus, changeStudentStage, completeTask,
  fetchCounselors, fetchPipelineStages, fetchStudent, fetchStudentApplications, fetchStudentMessages,
  fetchStudentRecommendations, fetchTasks, sendStudentMessage,
} from "@/lib/crm-api"
import { formatTuition } from "@/lib/format"
import { useAuth } from "@/lib/auth"
import { studentIdFromSlug, studentPath, studentSlug } from "@/lib/student-url"
import { cn } from "@/lib/utils"
import type {
  ApplicationListItem, ApplicationStatus, Counselor, CrmMessage, PipelineStage, Student,
  StudentRecommendation, Task,
} from "@/lib/crm-types"

const APPLICATION_STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "documents_requested", label: "Documents Requested" },
  { value: "offer_received", label: "Offer Received" },
  { value: "enrolled", label: "Enrolled" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
]

const APPLICATION_STATUS_COLOR: Record<ApplicationStatus, string> = {
  submitted: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  under_review: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
  documents_requested: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  offer_received: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  enrolled: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-600",
  withdrawn: "border-border bg-muted text-muted-foreground",
}

const PRIORITY_STYLE: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
  low: "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
}

// What a complete profile needs for good university matching - drives the
// completeness meter and the "missing" chips that open the editor.
const PROFILE_FIELDS: { key: keyof Student; label: string }[] = [
  { key: "phone", label: "Phone" },
  { key: "highest_qualification", label: "Qualification" },
  { key: "previous_institute", label: "Institute" },
  { key: "field_of_study", label: "Field of study" },
  { key: "gpa", label: "GPA" },
  { key: "english_test", label: "English test" },
  { key: "english_score", label: "English score" },
  { key: "target_country", label: "Target country" },
  { key: "target_degree", label: "Target degree" },
  { key: "target_specialization", label: "Specialization" },
  { key: "budget_max", label: "Budget" },
]

const TABS = ["overview", "chat", "applications", "match", "meetings", "activity"] as const
type TabKey = (typeof TABS)[number]

const daysSince = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0

const whatsappHref = (number: string) => `https://wa.me/${number.replace(/[^\d]/g, "")}`

function quickRepliesFor(student: Student, counselorName: string): QuickReply[] {
  const first = student.full_name.split(" ")[0]
  const me = counselorName.split(" ")[0] || "your counselor"
  const country = student.target_country || "your chosen country"
  return [
    { label: "👋 Greeting", text: `Hi ${first}, this is ${me} from UniAdmissionHelp. Thanks for reaching out! I'll be guiding you through your study abroad journey. When is a good time for a quick call?` },
    { label: "📄 Documents", text: `Hi ${first}, to move forward please share your academic transcripts, passport copy and English test result (if you have one). You can attach them right here in the chat.` },
    { label: "📅 Book a call", text: `Hi ${first}, let's schedule a short call to discuss your options in ${country}. Which day and time works best for you this week?` },
    { label: "🎓 Shortlist ready", text: `Great news ${first}! I've prepared a shortlist of universities in ${country} that match your profile. Shall we go through it together?` },
    { label: "✅ Application sent", text: `Hi ${first}, your application has been submitted successfully. I'll keep you updated as soon as we hear back from the university.` },
    { label: "⏰ Follow up", text: `Hi ${first}, just checking in — do you have any questions I can help with? I'm here whenever you're ready to take the next step.` },
  ]
}

function CopyChip({ icon: Icon, value, href }: { icon: React.ElementType; value: string; href?: string }) {
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => toast.success("Copied to clipboard"))
  }
  return (
    <span className="group inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      {href ? <a href={href} className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">{value}</a> : value}
      <button type="button" title="Copy" onClick={copy} className="text-slate-300 transition-colors hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300">
        <Copy className="h-3 w-3" />
      </button>
    </span>
  )
}

function StatTile({
  icon: Icon, label, value, hint, tone,
}: { icon: React.ElementType; label: string; value: React.ReactNode; hint?: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-lg font-bold leading-tight tabular-nums">{value}</p>
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
}

function CompletenessRing({ pct }: { pct: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  const tone = pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-red-500"
  return (
    <div className="relative h-10 w-10 flex-shrink-0">
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-slate-200 dark:stroke-white/10" />
        <circle
          cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          className={cn("stroke-current transition-all", tone)}
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">{pct}%</span>
    </div>
  )
}

/** Clickable pipeline stepper - the student's journey at a glance. */
function PipelineStepper({
  stages, currentKey, onMove,
}: { stages: PipelineStage[]; currentKey: string; onMove: (key: string) => void }) {
  const steps = stages.filter((s) => !s.is_lost).sort((a, b) => a.sort_order - b.sort_order)
  const lostStage = stages.find((s) => s.is_lost)
  const currentIndex = steps.findIndex((s) => s.key === currentKey)
  const isLost = lostStage?.key === currentKey

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</p>
        {lostStage && !isLost ? (
          <button
            type="button"
            onClick={() => onMove(lostStage.key)}
            className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-red-600"
          >
            <XCircle className="h-3.5 w-3.5" /> Mark as lost
          </button>
        ) : null}
      </div>
      {isLost ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <span className="flex items-center gap-2"><XCircle className="h-4 w-4" /> Marked as lost</span>
          {steps[0] ? (
            <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => onMove(steps[0].key)}>Reopen</Button>
          ) : null}
        </div>
      ) : (
        <ol className="flex items-center overflow-x-auto pb-1">
          {steps.map((stage, i) => {
            const done = i < currentIndex
            const current = i === currentIndex
            return (
              <li key={stage.key} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  onClick={() => !current && onMove(stage.key)}
                  title={current ? "Current status" : `Move to ${stage.label}`}
                  className="group flex min-w-max flex-col items-center gap-1.5 px-1"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                      done && "border-emerald-500 bg-emerald-500 text-white",
                      current && "border-emerald-600 bg-white text-emerald-700 ring-4 ring-emerald-500/20 dark:bg-card dark:text-emerald-400",
                      !done && !current && "border-slate-200 bg-white text-slate-400 group-hover:border-emerald-400 group-hover:text-emerald-600 dark:border-white/15 dark:bg-card",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={cn(
                    "text-[11px] font-medium",
                    current ? "text-emerald-700 dark:text-emerald-400" : done ? "text-slate-700 dark:text-slate-300" : "text-slate-400",
                  )}>
                    {stage.label}
                  </span>
                </button>
                {i < steps.length - 1 ? (
                  <span className={cn("mx-1 mb-5 h-0.5 min-w-4 flex-1 rounded-full", i < currentIndex ? "bg-emerald-500" : "bg-slate-200 dark:bg-white/10")} />
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function Card({
  icon: Icon, title, action, children, className,
}: { icon?: React.ElementType; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {Icon ? <Icon className="h-4 w-4 text-emerald-600" /> : null}
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm font-medium", !value && "font-normal text-slate-400")}>{value || "Not added"}</dd>
    </div>
  )
}

export default function StudentProfile() {
  const { slug } = useParams<{ slug: string }>()
  const id = studentIdFromSlug(slug)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  // Reassigning a student's counselor is the boundary that puts them inside
  // or outside a counselor's own scoped view, so only a full admin may do
  // it (enforced server-side in StudentViewSet.assign_counselor too).
  const isFullAdmin = user?.role === "admin"
  const [student, setStudent] = useState<Student | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [recommendations, setRecommendations] = useState<StudentRecommendation[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activityKey, setActivityKey] = useState(0)
  const refreshActivity = () => setActivityKey((k) => k + 1)
  const [messages, setMessages] = useState<CrmMessage[] | null>(null)
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [applicationUpdating, setApplicationUpdating] = useState<number | null>(null)
  const [openApplicationId, setOpenApplicationId] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  // "Overdue" is judged against when the page was opened.
  const [now] = useState(() => Date.now())

  const tabParam = searchParams.get("tab")
  const tab: TabKey = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as TabKey) : "overview"
  const setTab = (next: string) => setSearchParams(next === "overview" ? {} : { tab: next }, { replace: true })

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [studentRes, stagesRes, counselorsRes, tasksRes, applicationsRes] = await Promise.all([
        fetchStudent(id),
        fetchPipelineStages(),
        fetchCounselors(),
        fetchTasks({ student: id }),
        fetchStudentApplications(id),
      ])
      setStudent(studentRes)
      setStages(stagesRes)
      setCounselors(counselorsRes)
      setTasks(tasksRes.data)
      setApplications(applicationsRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load student")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Keep the address bar on the readable name-number URL (old /students/42
  // links and renamed students land on the current one).
  useEffect(() => {
    if (!student) return
    const canonical = studentSlug(student.id, student.full_name)
    if (slug !== canonical) {
      navigate({ pathname: studentPath(student.id, student.full_name), search: window.location.search }, { replace: true })
    }
  }, [student, slug, navigate])

  const loadRecommendations = useCallback(async () => {
    if (!id) return
    setRecsLoading(true)
    try {
      const res = await fetchStudentRecommendations(id)
      setRecommendations(res.recommendations)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load recommendations")
    } finally {
      setRecsLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (student) void loadRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id])

  const loadMessages = useCallback(async () => {
    if (!id) return
    try {
      setMessages(await fetchStudentMessages(id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load messages")
    }
  }, [id])

  useEffect(() => {
    void loadMessages()
    // Poll for new messages the student sends from their portal while this
    // profile is open, so a counselor sees replies without refreshing.
    const interval = setInterval(() => void loadMessages(), 10000)
    return () => clearInterval(interval)
  }, [loadMessages])

  const handleSendMessage = async (body: string, attachment?: File) => {
    if (!id) return
    try {
      const sent = await sendStudentMessage(id, body, attachment)
      setMessages((prev) => (prev ? [...prev, sent] : [sent]))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    }
  }

  const handleStageChange = async (stageKey: string) => {
    if (!student) return
    try {
      const updated = await changeStudentStage(student.id, stageKey)
      setStudent(updated)
      toast.success(`Status changed to ${updated.stage_label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    }
  }

  const handleCounselorChange = async (counselorId: string) => {
    if (!student) return
    try {
      const updated = await assignStudentCounselor(student.id, counselorId === "none" ? null : Number(counselorId))
      setStudent(updated)
      toast.success(updated.counselor_name ? `Assigned to ${updated.counselor_name}` : "Moved back to Leads")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign counselor")
    }
  }

  const handleCompleteTask = async (taskId: number) => {
    try {
      await completeTask(taskId)
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t)))
      toast.success("Task completed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete task")
    }
  }

  const handleApplicationStatusChange = async (applicationId: number, status: ApplicationStatus) => {
    setApplicationUpdating(applicationId)
    try {
      const updated = await changeApplicationStatus(applicationId, status)
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, ...updated } : a)))
      toast.success("Application status updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update application status")
    } finally {
      setApplicationUpdating(null)
    }
  }

  const completeness = useMemo(() => {
    if (!student) return { pct: 0, missing: [] as string[] }
    const missing = PROFILE_FIELDS.filter(({ key }) => {
      const v = student[key]
      return v === null || v === undefined || v === ""
    }).map((f) => f.label)
    return { pct: Math.round(((PROFILE_FIELDS.length - missing.length) / PROFILE_FIELDS.length) * 100), missing }
  }, [student])

  const unread = messages?.filter((m) => !m.is_from_counselor && !m.is_read && !m.call_log_type).length ?? 0
  const openTasks = tasks.filter((t) => t.status !== "completed")
  const overdueTasks = openTasks.filter((t) => new Date(t.due_at).getTime() < now)
  const quickReplies = useMemo(
    () => (student ? quickRepliesFor(student, user?.full_name || "") : []),
    [student, user?.full_name],
  )

  if (loading && !student) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted/60" />
        <div className="h-44 rounded-2xl bg-muted/60" />
        <div className="h-24 rounded-2xl bg-muted/60" />
        <div className="grid grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/60" />)}</div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Student not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/crm/students")}>Back to Students</Button>
      </div>
    )
  }

  const backTo = student.counselor ? { to: "/crm/students", label: "Students" } : { to: "/crm/leads", label: "Leads" }
  const whatsapp = student.whatsapp_number || student.phone
  const firstName = student.full_name.split(" ")[0]
  const budget = student.budget_min || student.budget_max
    ? `${student.budget_min ?? "?"} – ${student.budget_max ?? "?"} ${student.budget_currency}`
    : undefined

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to={backTo.to} className="hover:text-foreground">{backTo.label}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate font-medium text-foreground">{student.full_name}</span>
      </nav>

      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="relative h-20 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>
        <div className="px-6 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-4">
              <div className="-mt-10 flex-shrink-0 rounded-full bg-card p-1 shadow-md">
                <PersonAvatar name={student.full_name} size="xl" className="h-20 w-20 text-2xl" />
              </div>
              <div className="min-w-0 pb-1 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{student.full_name}</h1>
                  {student.user ? (
                    <span title="Has a student portal account" className="text-sky-500"><BadgeCheck className="h-5 w-5" /></span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StageBadge stageKey={student.stage_key} label={student.stage_label} />
                  <Badge variant="outline" className={cn("gap-1 capitalize", PRIORITY_STYLE[student.priority] ?? PRIORITY_STYLE.medium)}>
                    <Flag className="h-3 w-3" /> {student.priority} priority
                  </Badge>
                  {student.lead_source_name ? (
                    <Badge variant="outline" className="font-normal text-slate-600 dark:text-slate-300">via {student.lead_source_name}</Badge>
                  ) : null}
                  {student.is_lost ? <Badge variant="destructive">Lost</Badge> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTab("chat")}>
                <MessageCircle className="h-4 w-4 text-emerald-600" /> Message
                {unread > 0 ? <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unread}</span> : null}
              </Button>
              {student.phone ? (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`tel:${student.phone}`}><Phone className="h-4 w-4 text-sky-600" /> Call</a>
                </Button>
              ) : null}
              {whatsapp ? (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={whatsappHref(whatsapp)} target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#25D366]" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z" /></svg>
                    WhatsApp
                  </a>
                </Button>
              ) : null}
              <SendEmailDialog studentId={student.id} studentEmail={student.email} onSent={refreshActivity} />
              <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {student.email ? <CopyChip icon={Mail} value={student.email} href={`mailto:${student.email}`} /> : null}
              {student.phone ? <CopyChip icon={Phone} value={student.phone} href={`tel:${student.phone}`} /> : null}
              {student.target_country || student.target_degree ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300">
                  <Target className="h-3.5 w-3.5 text-slate-400" />
                  {[student.target_degree, student.target_country].filter(Boolean).join(" in ")}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Counselor</span>
              {isFullAdmin ? (
                <Select value={student.counselor ? String(student.counselor) : "none"} onValueChange={(v) => void handleCounselorChange(v)}>
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue placeholder="Assign counselor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned (Leads)</SelectItem>
                    {counselors.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="flex items-center gap-2 text-sm font-medium">
                  {student.counselor_name ? <PersonAvatar name={student.counselor_name} size="sm" /> : null}
                  {student.counselor_name ?? "Unassigned"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <PipelineStepper stages={stages} currentKey={student.stage_key} onMove={(k) => void handleStageChange(k)} />

      {/* At-a-glance numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" onClick={() => setEditing(true)} className="text-left">
          <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
            <CompletenessRing pct={completeness.pct} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Profile</p>
              <p className="text-sm font-bold">{completeness.pct === 100 ? "Complete" : `${completeness.missing.length} missing`}</p>
              <p className="truncate text-[11px] text-muted-foreground">{completeness.pct === 100 ? "Ready for matching" : "Click to complete"}</p>
            </div>
          </div>
        </button>
        <StatTile
          icon={Hourglass} label="In this status" tone="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15"
          value={`${daysSince(student.stage_changed_at)} days`}
          hint={`Student for ${daysSince(student.created_at)} days`}
        />
        <StatTile
          icon={FileText} label="Applications" tone="bg-sky-100 text-sky-600 dark:bg-sky-500/15"
          value={applications.length}
          hint={applications.some((a) => a.status === "offer_received") ? "Offer received 🎉" : applications.length ? "In progress" : "None yet"}
        />
        <StatTile
          icon={ListChecks} label="Open tasks"
          tone={overdueTasks.length ? "bg-red-100 text-red-600 dark:bg-red-500/15" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"}
          value={openTasks.length}
          hint={overdueTasks.length ? `${overdueTasks.length} overdue` : "All on track"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main workspace */}
        <div className="min-w-0 lg:col-span-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
              {([
                ["overview", "Overview", BookOpen, null],
                ["chat", "Chat", MessagesSquare, unread || null],
                ["applications", "Applications", FileText, applications.length || null],
                ["match", "Smart Match", Sparkles, null],
                ["meetings", "Meetings", Video, null],
                ["activity", "Activity", Activity, null],
              ] as const).map(([key, label, Icon, count]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="gap-1.5 rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {count ? (
                    <span className={cn(
                      "rounded-full px-1.5 text-[10px] font-bold",
                      key === "chat" ? "bg-red-500 text-white" : "bg-slate-200 text-slate-700 dark:bg-white/15 dark:text-white",
                    )}>{count}</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-5">
              {completeness.missing.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Complete the profile for better university matches:</span>
                  {completeness.missing.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setEditing(true)}
                      className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-xs text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-transparent dark:text-amber-300"
                    >
                      + {label}
                    </button>
                  ))}
                </div>
              ) : null}

              <LeadFormCard leadForm={student.lead_form} />

              <div className="grid gap-5 md:grid-cols-2">
                <Card
                  icon={GraduationCap} title="Academic background"
                  action={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /> Edit</Button>}
                >
                  <dl className="grid grid-cols-2 gap-4">
                    <Info label="Qualification" value={student.highest_qualification} />
                    <Info label="GPA" value={student.gpa != null ? String(student.gpa) : undefined} />
                    <div className="col-span-2"><Info label="Institute" value={student.previous_institute} /></div>
                    <div className="col-span-2"><Info label="Field of study" value={student.field_of_study} /></div>
                    <Info label="English test" value={student.english_test} />
                    <Info label="Score" value={student.english_score != null ? String(student.english_score) : undefined} />
                  </dl>
                </Card>
                <Card
                  icon={Wallet} title="Study plan"
                  action={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /> Edit</Button>}
                >
                  <dl className="grid grid-cols-2 gap-4">
                    <Info label="Country" value={student.target_country} />
                    <Info label="Degree" value={student.target_degree} />
                    <div className="col-span-2"><Info label="Specialization" value={student.target_specialization} /></div>
                    <div className="col-span-2"><Info label="Budget" value={budget} /></div>
                  </dl>
                </Card>
              </div>

              <Card
                icon={Pencil} title="Counselor notes"
                action={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /> Edit</Button>}
              >
                {student.notes ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{student.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet. Add context so anyone picking up {firstName}'s file knows the story.</p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="chat" className="mt-0">
              <MessageThread
                messages={messages}
                loading={messages === null}
                viewerIsCounselor
                onSend={handleSendMessage}
                heightClass="h-[460px]"
                quickReplies={quickReplies}
                placeholder={`Message ${firstName}…`}
                emptyLabel={`No messages yet. Say hello to ${firstName} — they'll see it instantly in their student portal.`}
                trailingContent={student.user && <CallRequestManager studentId={student.id} />}
                header={
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <PersonAvatar name={student.full_name} />
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                        student.user ? "bg-emerald-500" : "bg-slate-300",
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{student.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.user ? "Student portal connected · messages arrive instantly" : "No portal account yet · they'll see messages once they sign up"}
                      </p>
                    </div>
                    {student.phone ? (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" title="Call" asChild>
                        <a href={`tel:${student.phone}`}><Phone className="h-4 w-4" /></a>
                      </Button>
                    ) : null}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" title="Meetings" onClick={() => setTab("meetings")}>
                      <Video className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            </TabsContent>

            <TabsContent value="applications" className="mt-0">
              <Card icon={FileText} title="Applications">
                {applications.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm text-muted-foreground">No applications yet. Use Smart Match to find the right courses.</p>
                    <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setTab("match")}>
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Open Smart Match
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => (
                      <div key={app.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{app.course_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {app.university_name}{app.intake_term ? ` · ${app.intake_term}` : ""}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" /> Submitted {new Date(app.submitted_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setOpenApplicationId(app.id)}>
                            <FileText className="h-3.5 w-3.5" /> Details
                          </Button>
                          <Badge variant="outline" className={APPLICATION_STATUS_COLOR[app.status]}>
                            {APPLICATION_STATUS_OPTIONS.find((o) => o.value === app.status)?.label ?? app.status}
                          </Badge>
                          <Select
                            value={app.status}
                            onValueChange={(v) => void handleApplicationStatusChange(app.id, v as ApplicationStatus)}
                            disabled={applicationUpdating === app.id}
                          >
                            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {APPLICATION_STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="match" className="mt-0">
              <Card
                icon={Sparkles} title="Smart Match"
                action={
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void loadRecommendations()} disabled={recsLoading}>
                    {recsLoading ? "Matching…" : "Refresh"}
                  </Button>
                }
              >
                {recsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />)}
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="py-8 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-amber-300" />
                    <p className="mt-2 text-sm text-muted-foreground">No matches yet — add target country, specialization and GPA to improve matching.</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setEditing(true)}>Complete profile</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendations.slice(0, 8).map((rec) => (
                      <div key={rec.course_id} className="rounded-xl border p-4 transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            {rec.university_logo ? (
                              <img src={rec.university_logo} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg border bg-white object-contain" />
                            ) : (
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{rec.course_title}</p>
                              <p className="truncate text-xs text-muted-foreground">{rec.university_name}{rec.country ? ` · ${rec.country}` : ""}</p>
                            </div>
                          </div>
                          {rec.course_url && (
                            <a href={safeHref(rec.course_url)} target="_blank" rel="noreferrer" className="flex-shrink-0 text-muted-foreground hover:text-primary">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Match score</span>
                              <span className="font-medium">{Math.round(rec.match_score * 100)}%</span>
                            </div>
                            <Progress value={Math.round(rec.match_score * 100)} className="h-1.5" />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Admission chance</span>
                              <span className="font-medium">{Math.round(rec.admission_probability * 100)}%</span>
                            </div>
                            <Progress value={Math.round(rec.admission_probability * 100)} className="h-1.5" />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {rec.tuition_fee != null && <Badge variant="outline">{formatTuition(rec.tuition_fee, undefined)}</Badge>}
                          {rec.duration && <Badge variant="outline">{rec.duration}</Badge>}
                          {rec.ielts != null && <Badge variant="outline">IELTS {rec.ielts}+</Badge>}
                          {rec.scholarship_available && (
                            <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600">
                              <Award className="h-3 w-3" /> Scholarship
                            </Badge>
                          )}
                        </div>
                        {rec.entry_requirements && (
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{rec.entry_requirements}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="meetings" className="mt-0">
              <MeetingsPanel studentId={student.id} studentName={student.full_name} canMeet={!!student.user} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <Card
                icon={Activity} title="Communication history"
                action={
                  <div className="flex items-center gap-2">
                    <LogCommunicationDialog studentId={student.id} onLogged={refreshActivity} />
                  </div>
                }
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Shared across every counselor this student has ever had — check here before reaching out.
                </p>
                <ActivityTimeline key={activityKey} studentId={student.id} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <Card
            icon={ListChecks} title="Next steps"
            action={<TaskFormDialog studentId={student.id} onCreated={load} />}
          >
            {tasks.length === 0 ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-sm text-muted-foreground">No tasks yet. Add a follow-up so nothing slips.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {[...openTasks, ...tasks.filter((t) => t.status === "completed")].map((task) => {
                  const done = task.status === "completed"
                  const overdue = !done && new Date(task.due_at).getTime() < now
                  return (
                    <li key={task.id} className={cn("flex items-start gap-2.5 rounded-xl border p-3", overdue && "border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/5")}>
                      <button
                        onClick={() => void handleCompleteTask(task.id)}
                        disabled={done}
                        title={done ? "Completed" : "Mark complete"}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {done
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : <Circle className="h-4 w-4 text-slate-300 transition-colors hover:text-emerald-500" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through")}>{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge value={task.status} />
                          <span className={cn("flex items-center gap-1 text-[11px]", overdue ? "font-medium text-red-600" : "text-muted-foreground")}>
                            <Clock className="h-3 w-3" />
                            {overdue ? "Overdue · " : ""}{new Date(task.due_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card icon={Tag} title="Lead details">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="text-right font-medium">{student.lead_source_name ?? "—"}</dd>
              </div>
              {student.campaign ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Campaign</dt>
                  <dd className="truncate text-right font-medium" title={student.campaign}>{student.campaign}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Added</dt>
                <dd className="text-right font-medium">{new Date(student.created_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="text-right font-medium">{new Date(student.updated_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Portal account</dt>
                <dd className={cn("text-right font-medium", student.user ? "text-emerald-600" : "text-slate-400")}>{student.user ? "Active" : "Not registered"}</dd>
              </div>
              {student.tags?.length ? (
                <div className="flex flex-wrap gap-1.5 border-t pt-3">
                  {student.tags.map((t) => (
                    <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-300">#{t}</span>
                  ))}
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      </div>

      <StudentEditSheet student={student} open={editing} onOpenChange={setEditing} onSaved={setStudent} />
      <ApplicationDetailSheet
        applicationId={openApplicationId}
        onOpenChange={(open) => { if (!open) setOpenApplicationId(null) }}
        onUpdated={(updated) => setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, status: updated.status, decided_at: updated.decided_at, updated_at: updated.updated_at } : a)))}
        showStudentLink={false}
      />
    </div>
  )
}
