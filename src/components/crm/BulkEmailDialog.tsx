import { useRef, useState } from "react"
import { AlertTriangle, Mail, Send, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { bulkEmailStudents } from "@/lib/crm-api"
import type { StudentListItem } from "@/lib/crm-types"

const PLACEHOLDERS = [
  { token: "{first_name}", label: "First name" },
  { token: "{name}", label: "Full name" },
]

const TEMPLATES = [
  {
    label: "Intake reminder",
    subject: "{first_name}, the next intake is opening soon",
    message: "Dear {first_name},\n\nApplications for the next intake are now opening. Let's make sure your documents are ready so we can apply early.\n\nReply to this email or book a call with me to get started.",
  },
  {
    label: "Documents needed",
    subject: "Documents needed for your application",
    message: "Dear {first_name},\n\nTo move your application forward, please send us:\n- \n- \n\nYou can reply to this email with the files attached.",
  },
  {
    label: "Follow-up",
    subject: "Checking in, {first_name}",
    message: "Dear {first_name},\n\nI wanted to check in on your study abroad plans. Do you have any questions I can help with?",
  },
]

// Previews what the first selected student will receive.
const personalise = (text: string, student?: StudentListItem) =>
  student ? text.replaceAll("{first_name}", student.full_name.split(" ")[0]).replaceAll("{name}", student.full_name) : text

export function BulkEmailDialog({
  open, onOpenChange, students, onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: StudentListItem[]
  onSent: () => void
}) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  const withEmail = students.filter((s) => s.email)
  const withoutEmail = students.filter((s) => !s.email)
  const canSend = subject.trim().length >= 2 && message.trim().length >= 5 && withEmail.length > 0 && !sending

  const insert = (token: string) => {
    const el = messageRef.current
    if (!el) return setMessage((m) => m + token)
    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    setMessage(message.slice(0, start) + token + message.slice(end))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length) })
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await bulkEmailStudents(withEmail.map((s) => s.id), { subject: subject.trim(), message: message.trim() })
      const problems = res.failed.length + res.no_email.length
      if (res.sent) {
        toast.success(`Email sent to ${res.sent} student${res.sent === 1 ? "" : "s"}`, {
          description: problems ? `${problems} could not be emailed` : "Each student received a separate, personalised email",
        })
      }
      if (res.failed.length) {
        toast.error(`${res.failed.length} email${res.failed.length === 1 ? "" : "s"} failed`, {
          description: res.failed.slice(0, 3).map((f) => f.name).join(", "),
        })
      }
      if (res.sent) {
        setSubject("")
        setMessage("")
        onSent()
        onOpenChange(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send emails")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending) onOpenChange(next) }}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-gradient-to-b from-emerald-50/80 to-transparent px-6 py-5 text-left dark:from-emerald-500/[0.06]">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Mail className="h-4 w-4" />
            </span>
            Email {students.length} student{students.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription className="pt-1">
            Each student gets their own separate email, so nobody sees the other recipients.
            Replies come back to you and the shared inbox, and each email is logged on the student's profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Users className="h-3.5 w-3.5" /> Recipients
            </Label>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {withEmail.map((s) => (
                <span key={s.id} title={s.email} className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-2.5 text-xs">
                  <PersonAvatar name={s.full_name} size="sm" />
                  <span className="max-w-[140px] truncate">{s.full_name}</span>
                </span>
              ))}
            </div>
            {withoutEmail.length ? (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {withoutEmail.length} selected student{withoutEmail.length === 1 ? " has" : "s have"} no email address and will be skipped:{" "}
                  {withoutEmail.map((s) => s.full_name).join(", ")}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Templates:</span>
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => { setSubject(t.subject); setMessage(t.message) }}
                className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10"
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-subject">Subject</Label>
            <Input id="bulk-subject" placeholder="e.g. {first_name}, the next intake is opening soon" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="bulk-message">Message</Label>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Insert:</span>
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => insert(p.token)}
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-white/10 dark:text-slate-200"
                    title={p.label}
                  >
                    {p.token}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              id="bulk-message" ref={messageRef} rows={8}
              placeholder="Dear {first_name}, …"
              value={message} onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {withEmail[0] && (subject || message) ? (
            <div className="rounded-xl border bg-slate-50 p-4 dark:bg-white/[0.03]">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Preview for {withEmail[0].full_name}
              </p>
              <p className="text-sm font-semibold">{personalise(subject, withEmail[0]) || "(no subject)"}</p>
              <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{personalise(message, withEmail[0])}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" disabled={!canSend} onClick={() => void handleSend()}>
            <Send className="h-4 w-4" />
            {sending ? `Sending to ${withEmail.length}…` : `Send to ${withEmail.length} student${withEmail.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
