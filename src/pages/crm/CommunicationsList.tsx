import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  Search, Mail, Phone, MessageCircle, FileText, Clock, ChevronDown, ArrowDownToLine,
  ArrowUpFromLine, AlertTriangle, ArrowUpDown, RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { InboundEmailCard } from "@/components/crm/InboundEmailCard"
import { replyPreview } from "@/lib/email-reply"
import { fetchCommunications, syncInbox, type CommunicationFilters } from "@/lib/crm-api"
import type { CommunicationChannel, CommunicationDirection, CommunicationLog, CommunicationStatus } from "@/lib/crm-types"
import { studentPath } from "@/lib/student-url"
import { PageHeader } from "@/components/crm/PageHeader"

const CHANNEL_META: Record<CommunicationChannel, { label: string; icon: React.ElementType }> = {
  email: { label: "Email", icon: Mail },
  call: { label: "Call", icon: Phone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS", icon: MessageCircle },
  in_person: { label: "In Person", icon: Clock },
  note: { label: "Internal Note", icon: FileText },
}

const STATUS_STYLES: Record<CommunicationStatus, string> = {
  sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  logged: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  failed: "border-red-500/30 bg-red-500/10 text-red-600",
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function EmailToCcLine({ log }: { log: CommunicationLog }) {
  if (!log.to_email && !log.cc_email) return null
  return (
    <div className="mb-2 space-y-0.5">
      {log.to_email && (
        <p className="text-xs text-muted-foreground truncate">
          <span className="font-medium text-foreground/60">To</span> {log.to_email}
        </p>
      )}
      {log.cc_email && (
        <p className="text-xs text-muted-foreground truncate">
          <span className="font-medium text-foreground/60">Cc</span> {log.cc_email}
        </p>
      )}
    </div>
  )
}

function whoLine(log: CommunicationLog): string {
  if (log.direction === "inbound") {
    return log.channel === "email" ? `${log.student_name} replied` : `${log.student_name}`
  }
  const actor = log.logged_by_name ?? "A counselor"
  if (log.channel === "email") return `${actor} emailed ${log.student_name}`
  if (log.channel === "note") return `${actor} noted about ${log.student_name}`
  return `${actor} logged a ${CHANNEL_META[log.channel].label.toLowerCase()} with ${log.student_name}`
}

function CommunicationRow({ log, onChanged }: { log: CommunicationLog; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const meta = CHANNEL_META[log.channel]
  const Icon = log.status === "failed" ? AlertTriangle : meta.icon
  const DirectionIcon = log.direction === "inbound" ? ArrowDownToLine : ArrowUpFromLine
  const hasDetails = Boolean(log.body_html || log.summary)
  const isInboundEmail = log.channel === "email" && log.direction === "inbound"
  const preview = isInboundEmail ? replyPreview(log.summary) : log.summary

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
            log.status === "failed" ? "bg-red-500/15 text-red-500" : log.direction === "inbound" ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <PersonAvatar name={log.direction === "inbound" ? log.student_name : (log.logged_by_name ?? log.student_name)} size="sm" className="h-5 w-5 text-[10px] flex-shrink-0" />
              <span className="text-sm font-medium truncate">{whoLine(log)}</span>
              <DirectionIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{formatDateTime(log.occurred_at)}</span>
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">
              {log.subject || (log.channel === "email" ? "(no subject)" : meta.label)}
            </p>
            <Badge variant="outline" className="text-[10px] font-normal">{meta.label}</Badge>
            {log.status === "failed" && (
              <Badge variant="outline" className={STATUS_STYLES.failed}>Failed</Badge>
            )}
          </div>

          {!expanded && preview && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{preview}</p>
          )}

          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <Link
              to={studentPath(log.student, log.student_name)}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline"
            >
              View student
            </Link>
            <span className="truncate">{log.student_email}</span>
          </div>
        </div>

        {hasDetails && (
          <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-16">
          {log.status === "failed" && log.error_message && (
            <p className="text-xs text-red-600 mb-3">Send failed: {log.error_message}</p>
          )}
          {isInboundEmail ? (
            // Inbound replies only ever populate `summary` as plain text
            // (see poll_inbound_emails._extract_body) - HTML is deliberately
            // stripped rather than trusted and rendered, so this is styled
            // as its own email-card layout instead of dumped as a flat blob.
            <InboundEmailCard log={log} onReplied={onChanged} />
          ) : (
            <div className="rounded-xl border bg-muted/20 p-4">
              {log.channel === "email" && <EmailToCcLine log={log} />}
              {log.channel === "email" && log.body_html ? (
                // Only ever set for real outbound emails we rendered
                // ourselves (services.send_student_email).
                <div
                  className="text-sm leading-relaxed [&_p]:my-2 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{ __html: log.body_html }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{log.summary || "No further details logged."}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CommunicationsList() {
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [channel, setChannel] = useState<string>("all")
  const [direction, setDirection] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [ordering, setOrdering] = useState<CommunicationFilters["ordering"]>("-occurred_at")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchCommunications({
        page,
        search: search || undefined,
        channel: channel !== "all" ? (channel as CommunicationChannel) : undefined,
        direction: direction !== "all" ? (direction as CommunicationDirection) : undefined,
        status: status !== "all" ? (status as CommunicationStatus) : undefined,
        ordering,
      })
      setLogs(res.data)
      setTotalPages(res.pagination.totalPages)
      setTotal(res.pagination.total)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load communications")
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [page, search, channel, direction, status, ordering])

  useEffect(() => { void load() }, [load])

  // Replies are pulled from the mailbox by the backend; do it on page open
  // (in the background - the list above doesn't wait) and on demand.
  const [syncing, setSyncing] = useState(false)
  const checkForReplies = useCallback(async (manual: boolean) => {
    setSyncing(true)
    try {
      const { checked, logged } = await syncInbox()
      if (logged > 0) {
        toast.success(`${logged} new repl${logged === 1 ? "y" : "ies"} received`)
        void load()
      } else if (manual) {
        toast.info(checked ? "No new replies" : "Inbox was checked moments ago - no new replies")
      }
    } catch {
      if (manual) toast.error("Could not reach the mailbox right now")
    } finally {
      setSyncing(false)
    }
  }, [load])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- background mailbox sync, once per page open
    void checkForReplies(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page open, not on every filter change
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conversations"
        title="Communications"
        description="Every email, call and logged touchpoint with your students, including their replies."
        actions={
          <Button variant="outline" size="sm" className="h-9 shadow-sm" onClick={() => void checkForReplies(true)} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Checking inbox…" : "Check for replies"}
          </Button>
        }
      />

      <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-background dark:border-white/10 dark:bg-white/5"
            placeholder="Search by student, email or subject…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          />
        </div>
        <Select value={channel} onValueChange={(v) => { setPage(1); setChannel(v) }}>
          <SelectTrigger className="h-9 w-full lg:w-44 shadow-none"><SelectValue placeholder="All channels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {(Object.keys(CHANNEL_META) as CommunicationChannel[]).map((c) => (
              <SelectItem key={c} value={c}>{CHANNEL_META[c].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={direction} onValueChange={(v) => { setPage(1); setDirection(v) }}>
          <SelectTrigger className="h-9 w-full lg:w-40 shadow-none"><SelectValue placeholder="All directions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Inbound &amp; Outbound</SelectItem>
            <SelectItem value="inbound">Inbound (replies)</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v) }}>
          <SelectTrigger className="h-9 w-full lg:w-36 shadow-none"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="logged">Logged</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordering} onValueChange={(v) => setOrdering(v as CommunicationFilters["ordering"])}>
          <SelectTrigger className="h-9 w-full lg:w-44 gap-1.5 shadow-none">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-occurred_at">Newest first</SelectItem>
            <SelectItem value="occurred_at">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!loading && <p className="text-xs text-muted-foreground">{total} communication{total === 1 ? "" : "s"}</p>}

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted/60 animate-pulse border" />)}
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-2xl text-center">
          <Mail className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="font-semibold text-foreground">No communications match these filters</p>
        </div>
      )}

      <div className="space-y-3">
        {logs.map((log) => <CommunicationRow key={log.id} log={log} onChanged={() => void load()} />)}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/30"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
