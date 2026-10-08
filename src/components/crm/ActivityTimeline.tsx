import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Mail, Phone, MessageCircle, FileText, ArrowRightLeft, UserCog, AlertTriangle, Clock, CornerDownLeft,
} from "lucide-react"
import { toast } from "sonner"

import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { StatusBadge } from "@/components/crm/StatusBadge"
import { fetchCommunications, fetchCrmAuditLog, syncInbox } from "@/lib/crm-api"
import { replyPreview } from "@/lib/email-reply"
import type { CommunicationLog, CrmAuditLogEntry } from "@/lib/crm-types"
import { studentPath } from "@/lib/student-url"

interface TimelineEntry {
  id: string
  timestamp: string
  icon: React.ElementType
  title: string
  detail?: string
  actorName: string | null
  studentName?: string
  studentId?: number
  failed?: boolean
  inboundReply?: boolean
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  whatsapp: MessageCircle,
  sms: MessageCircle,
  email: Mail,
  in_person: Clock,
  note: FileText,
}

function commToEntry(log: CommunicationLog): TimelineEntry {
  const icon = CHANNEL_ICONS[log.channel] ?? FileText
  const channelLabel = log.channel.replace(/_/g, " ")
  if (log.channel === "email" && log.direction === "inbound") {
    // Show only the student's new text, not the quoted thread under it.
    return {
      id: `comm-${log.id}`,
      timestamp: log.occurred_at,
      icon: CornerDownLeft,
      title: log.subject || "(no subject)",
      detail: replyPreview(log.summary),
      actorName: log.student_name,
      studentName: log.student_name,
      studentId: log.student,
      inboundReply: true,
    }
  }
  return {
    id: `comm-${log.id}`,
    timestamp: log.occurred_at,
    icon: log.status === "failed" ? AlertTriangle : icon,
    title: log.subject || `${channelLabel.charAt(0).toUpperCase()}${channelLabel.slice(1)}${log.channel === "email" ? " sent" : " logged"}`,
    detail: log.summary,
    actorName: log.logged_by_name,
    studentName: log.student_name,
    studentId: log.student,
    failed: log.status === "failed",
  }
}

function auditToEntry(entry: CrmAuditLogEntry): TimelineEntry {
  const icon = entry.action.includes("counselor") ? UserCog : entry.action.includes("stage") ? ArrowRightLeft : FileText
  return {
    id: `audit-${entry.id}`,
    timestamp: entry.created_at,
    icon,
    title: entry.description,
    actorName: entry.actor_name,
    studentName: entry.student_name ?? undefined,
    studentId: entry.student ?? undefined,
  }
}

export function ActivityTimeline({ studentId, limit = 20 }: { studentId?: number; limit?: number }) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null)

  const load = useCallback(async () => {
    let result: TimelineEntry[] = []
    try {
      const [comms, audit] = await Promise.all([
        fetchCommunications(studentId ? { student: studentId } : {}),
        fetchCrmAuditLog(studentId),
      ])
      result = [...comms.data.map(commToEntry), ...audit.data.map(auditToEntry)]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load activity")
    }
    setEntries(result)
  }, [studentId, limit])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch keyed by studentId/limit, same pattern as CrmDashboard/StudentProfile's `load`
    void load()
  }, [load])

  // Pick up email replies that arrived since the last mailbox check.
  useEffect(() => {
    syncInbox().then(({ logged }) => { if (logged > 0) void load() }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, [])

  if (entries === null) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/60 animate-pulse" />)}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              entry.failed ? "bg-red-500/15 text-red-500"
                : entry.inboundReply ? "bg-emerald-500/15 text-emerald-600"
                : "bg-primary/10 text-primary"
            }`}
          >
            <entry.icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{entry.title}</p>
              {entry.failed && <StatusBadge value="failed" />}
              {entry.inboundReply && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  Student reply
                </span>
              )}
            </div>
            {entry.detail && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.detail}</p>}
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {entry.actorName && (
                <span className="flex items-center gap-1">
                  <PersonAvatar name={entry.actorName} size="sm" className="h-4 w-4 text-[9px]" />
                  {entry.actorName}
                </span>
              )}
              {entry.studentName && entry.studentId && !studentId && (
                <>
                  <span>&middot;</span>
                  <Link to={studentPath(entry.studentId, entry.studentName)} className="text-primary hover:underline">
                    {entry.studentName}
                  </Link>
                </>
              )}
              <span>&middot;</span>
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
