import { safeHref } from "@/lib/utils"
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, Mail, Phone, Sparkles, GraduationCap, Wallet, CheckCircle2, ListChecks,
  MessagesSquare, BadgeCheck, ExternalLink, Award, FileText,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StageBadge } from "@/components/crm/StageBadge"
import { StatusBadge } from "@/components/crm/StatusBadge"
import { TaskFormDialog } from "@/components/crm/TaskFormDialog"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { SendEmailDialog } from "@/components/crm/SendEmailDialog"
import { LogCommunicationDialog } from "@/components/crm/LogCommunicationDialog"
import { ActivityTimeline } from "@/components/crm/ActivityTimeline"
import { MessageThread } from "@/components/MessageThread"
import { MeetingsPanel } from "@/components/crm/MeetingsPanel"
import { CallRequestManager } from "@/components/crm/CallRequestManager"
import { LeadFormCard } from "@/components/crm/LeadFormCard"
import {
  assignStudentCounselor, changeApplicationStatus, changeStudentStage, completeTask,
  fetchCounselors, fetchPipelineStages, fetchStudent, fetchStudentApplications, fetchStudentMessages,
  fetchStudentRecommendations, fetchTasks, sendStudentMessage,
} from "@/lib/crm-api"
import { formatTuition } from "@/lib/format"
import { useAuth } from "@/lib/auth"
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

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
      toast.success("Stage updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stage")
    }
  }

  const handleCounselorChange = async (counselorId: string) => {
    if (!student) return
    try {
      const updated = await assignStudentCounselor(student.id, counselorId === "none" ? null : Number(counselorId))
      setStudent(updated)
      toast.success("Counselor updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign counselor")
    }
  }

  const handleCompleteTask = async (taskId: number) => {
    try {
      await completeTask(taskId)
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t)))
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

  if (loading && !student) {
    return <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted/60" />
      <div className="h-48 rounded-2xl bg-muted/60" />
    </div>
  }

  if (!student) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Student not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/crm/students")}>Back to Students</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/crm/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Students
      </Link>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <PersonAvatar name={student.full_name} size="lg" />
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{student.full_name}</h1>
                <StageBadge stageKey={student.stage_key} label={student.stage_label} />
                {student.is_lost && <Badge variant="destructive">Lost</Badge>}
                {student.user && (
                  <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                    <BadgeCheck className="w-3 h-3" /> Registered Account
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {student.email}</span>
                {student.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {student.phone}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={student.stage_key} onValueChange={(v) => void handleStageChange(v)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Change stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.key} value={stage.key}>{stage.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isFullAdmin ? (
              <Select value={student.counselor ? String(student.counselor) : "none"} onValueChange={(v) => void handleCounselorChange(v)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Assign counselor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {counselors.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="w-full sm:w-44 justify-center py-2">
                {student.counselor_name ?? "Unassigned"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <LeadFormCard leadForm={student.lead_form} />

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" /> Academic Profile
            </h3>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <Info label="Previous Institute" value={student.previous_institute} />
              <Info label="Field of Study" value={student.field_of_study} />
              <Info label="GPA" value={student.gpa != null ? String(student.gpa) : undefined} />
              <Info label="Highest Qualification" value={student.highest_qualification} />
              <Info label="English Test" value={student.english_test} />
              <Info label="English Score" value={student.english_score != null ? String(student.english_score) : undefined} />
            </dl>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Applications
            </h3>
            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No applications submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{app.course_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {app.university_name}{app.intake_term ? ` · ${app.intake_term}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Submitted {new Date(app.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className={APPLICATION_STATUS_COLOR[app.status]}>
                        {APPLICATION_STATUS_OPTIONS.find((o) => o.value === app.status)?.label ?? app.status}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <Select
                        value={app.status}
                        onValueChange={(v) => void handleApplicationStatusChange(app.id, v as ApplicationStatus)}
                        disabled={applicationUpdating === app.id}
                      >
                        <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
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
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Preferences
            </h3>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <Info label="Target Country" value={student.target_country} />
              <Info label="Target Degree" value={student.target_degree} />
              <Info label="Specialization" value={student.target_specialization} />
              <Info
                label="Budget"
                value={
                  student.budget_min || student.budget_max
                    ? `${student.budget_min ?? "?"} - ${student.budget_max ?? "?"} ${student.budget_currency}`
                    : undefined
                }
              />
            </dl>
            {student.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{student.notes}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Smart Match
              </h3>
              <Button variant="outline" size="sm" onClick={() => void loadRecommendations()} disabled={recsLoading}>
                {recsLoading ? "Matching..." : "Refresh"}
              </Button>
            </div>
            {recsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/60 animate-pulse" />)}
              </div>
            ) : recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No matches yet — add target country/specialization/GPA to improve matching.
              </p>
            ) : (
              <div className="space-y-3">
                {recommendations.slice(0, 8).map((rec) => (
                  <div key={rec.course_id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {rec.university_logo ? (
                          <img src={rec.university_logo} alt="" className="w-9 h-9 rounded-lg object-contain border bg-white flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{rec.course_title}</p>
                          <p className="text-xs text-muted-foreground truncate">{rec.university_name}{rec.country ? ` · ${rec.country}` : ""}</p>
                        </div>
                      </div>
                      {rec.course_url && (
                        <a href={safeHref(rec.course_url)} target="_blank" rel="noreferrer" className="flex-shrink-0 text-muted-foreground hover:text-primary">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Match score</span>
                          <span className="font-medium">{Math.round(rec.match_score * 100)}%</span>
                        </div>
                        <Progress value={Math.round(rec.match_score * 100)} className="h-1.5" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Admission chance</span>
                          <span className="font-medium">{Math.round(rec.admission_probability * 100)}%</span>
                        </div>
                        <Progress value={Math.round(rec.admission_probability * 100)} className="h-1.5" />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {rec.tuition_fee != null && (
                        <Badge variant="outline">{formatTuition(rec.tuition_fee, undefined)}</Badge>
                      )}
                      {rec.duration && <Badge variant="outline">{rec.duration}</Badge>}
                      {rec.ielts != null && <Badge variant="outline">IELTS {rec.ielts}+</Badge>}
                      {rec.scholarship_available && (
                        <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600">
                          <Award className="w-3 h-3" /> Scholarship
                        </Badge>
                      )}
                    </div>
                    {rec.entry_requirements && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{rec.entry_requirements}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" /> Tasks
              </h3>
              <TaskFormDialog studentId={student.id} onCreated={load} />
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tasks yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2 rounded-xl border p-3">
                    <button
                      onClick={() => void handleCompleteTask(task.id)}
                      disabled={task.status === "completed"}
                      className="mt-0.5 flex-shrink-0"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 ${task.status === "completed" ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <StatusBadge value={task.status} />
                        <span className="text-xs text-muted-foreground">{new Date(task.due_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MeetingsPanel studentId={student.id} studentName={student.full_name} canMeet={!!student.user} />

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <MessagesSquare className="w-4 h-4 text-primary" /> Direct Chat
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Live chat with {student.full_name} — they see this instantly in their student portal.
        </p>
        <MessageThread
          messages={messages}
          loading={messages === null}
          viewerIsCounselor
          onSend={handleSendMessage}
          placeholder={`Message ${student.full_name.split(" ")[0]}...`}
          emptyLabel="No messages yet. Send a note to start the conversation."
          trailingContent={student.user && <CallRequestManager studentId={student.id} />}
        />
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <MessagesSquare className="w-4 h-4 text-primary" /> Communications
          </h3>
          <div className="flex items-center gap-2">
            <LogCommunicationDialog studentId={student.id} onLogged={refreshActivity} />
            <SendEmailDialog studentId={student.id} studentEmail={student.email} onSent={refreshActivity} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Shared across every counselor this student has ever had — check here before reaching out.
        </p>
        <ActivityTimeline key={activityKey} studentId={student.id} />
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  )
}
