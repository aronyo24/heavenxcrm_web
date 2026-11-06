import { useState } from "react"
import { Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmailComposerDialog } from "@/components/crm/EmailComposer"

export function SendEmailDialog({
  studentId,
  studentEmail,
  studentName = "",
  onSent,
  replySubject,
  trigger,
}: {
  studentId: number
  studentEmail: string
  studentName?: string
  onSent: () => void
  /** When replying to a student's email: pre-fills "Re: <subject>". */
  replySubject?: string
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <Button size="sm">
            <Mail className="w-4 h-4 mr-2" /> Send Email
          </Button>
        )}
      </span>
      <EmailComposerDialog
        open={open}
        onOpenChange={setOpen}
        recipients={[{ id: studentId, full_name: studentName, email: studentEmail }]}
        replySubject={replySubject}
        onSent={onSent}
      />
    </>
  )
}
