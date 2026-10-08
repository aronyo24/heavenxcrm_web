import { useState } from "react"
import { Link } from "react-router-dom"
import { CornerDownLeft, MoreHorizontal, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { SendEmailDialog } from "@/components/crm/SendEmailDialog"
import { parseEmailReply, type QuoteAttribution } from "@/lib/email-reply"
import type { CommunicationLog } from "@/lib/crm-types"
import { studentPath } from "@/lib/student-url"

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g

// Inbound bodies are untrusted plain text, so links are rendered as React
// elements (never as HTML) and only http(s) URLs become clickable.
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  const days = Math.floor(diff / 86400)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  return ""
}

function AttributionLine({ attribution }: { attribution: QuoteAttribution }) {
  if (!attribution.sender) {
    return <p className="text-xs text-muted-foreground mb-1.5">{attribution.raw}</p>
  }
  return (
    <p className="text-xs text-muted-foreground mb-1.5">
      On {attribution.date},{" "}
      <span className="font-medium text-foreground/80">{attribution.sender}</span>
      {attribution.senderEmail && attribution.senderEmail !== attribution.sender && (
        <> &lt;{attribution.senderEmail}&gt;</>
      )}{" "}
      wrote:
    </p>
  )
}

// Renders a quoted thread, recursing for each older "On ... wrote:" level so
// a long back-and-forth reads as nested messages rather than ">>>" noise.
function QuotedThread({ body, attribution, depth = 0 }: { body: string; attribution: QuoteAttribution | null; depth?: number }) {
  const inner = depth < 4 ? parseEmailReply(body) : { reply: body, quoted: null }
  return (
    <div className="border-l-2 border-border pl-3">
      {attribution && <AttributionLine attribution={attribution} />}
      {inner.reply && (
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
          <Linkified text={inner.reply} />
        </p>
      )}
      {inner.quoted && (
        <div className="mt-3">
          <QuotedThread body={inner.quoted.body} attribution={inner.quoted.attribution} depth={depth + 1} />
        </div>
      )}
    </div>
  )
}

export function InboundEmailCard({
  log,
  onReplied,
  showStudentLink = false,
}: {
  log: CommunicationLog
  onReplied?: () => void
  showStudentLink?: boolean
}) {
  const { reply, quoted } = parseEmailReply(log.summary || "")
  // A reply with no new text (e.g. forwarded as-is) would otherwise look empty.
  const [showQuoted, setShowQuoted] = useState(!reply)
  const ago = relativeTime(log.occurred_at)
  const recipients = [log.to_email, log.cc_email].filter(Boolean).join(", ")

  return (
    <article className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header: sender, recipients, date - like an inbox message header */}
      <header className="flex items-start gap-3 px-5 pt-4 pb-3">
        <PersonAvatar name={log.student_name} className="h-10 w-10 text-sm flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{log.student_name}</span>
                <span className="text-xs text-muted-foreground truncate">&lt;{log.student_email}&gt;</span>
              </div>
              {recipients && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  to {log.to_email || "—"}
                  {log.cc_email && <>, cc {log.cc_email}</>}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(log.occurred_at).toString()}>
                {formatFullDate(log.occurred_at)}
              </p>
              {ago && <p className="text-[11px] text-muted-foreground/70 whitespace-nowrap">{ago}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <h3 className="text-base font-semibold text-foreground leading-snug">{log.subject || "(no subject)"}</h3>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
            Student reply
          </Badge>
        </div>

        {reply ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
            <Linkified text={reply} />
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No new text - the student replied with the quoted message only.</p>
        )}

        {quoted && (
          <div className="mt-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowQuoted((v) => !v) }}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
              aria-expanded={showQuoted}
              title={showQuoted ? "Hide earlier message" : "Show earlier message"}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              {showQuoted ? "Hide earlier message" : "Show earlier message"}
            </button>
            {showQuoted && (
              <div className="mt-3">
                <QuotedThread body={quoted.body} attribution={quoted.attribution} />
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 flex-wrap border-t bg-muted/20 px-5 py-2.5">
        <SendEmailDialog
          studentId={log.student}
          studentEmail={log.student_email}
          onSent={() => onReplied?.()}
          replySubject={log.subject}
          trigger={
            <Button size="sm" variant="outline" className="h-8">
              <CornerDownLeft className="w-3.5 h-3.5 mr-1.5" /> Reply
            </Button>
          }
        />
        {showStudentLink && (
          <Button size="sm" variant="ghost" className="h-8" asChild>
            <Link to={studentPath(log.student, log.student_name)}>
              <UserRound className="w-3.5 h-3.5 mr-1.5" /> View student
            </Link>
          </Button>
        )}
      </footer>
    </article>
  )
}
