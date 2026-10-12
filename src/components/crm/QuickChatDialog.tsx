import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageThread } from "@/components/MessageThread"
import { fetchStudentMessages, sendStudentMessage } from "@/lib/crm-api"
import type { CrmMessage } from "@/lib/crm-types"

/**
 * A "chat right from the list" shortcut - same idea as SendEmailDialog, but
 * for the live message thread, so a counselor doesn't have to leave
 * StudentsList and open the full profile just to send a quick message.
 * Only fetches the thread when actually opened (not on every list render).
 */
export function QuickChatDialog({ studentId, studentName }: { studentId: number; studentName: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<CrmMessage[] | null>(null)

  const load = async () => {
    try {
      setMessages(await fetchStudentMessages(studentId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load messages")
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setMessages(null)
      void load()
    }
  }

  const handleSend = async (body: string, attachment?: File) => {
    try {
      const sent = await sendStudentMessage(studentId, body, attachment)
      setMessages((prev) => (prev ? [...prev, sent] : [sent]))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" title={`Message ${studentName}`}>
          <MessageCircle className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chat with {studentName}</DialogTitle>
        </DialogHeader>
        <MessageThread
          messages={messages}
          loading={messages === null}
          viewerIsCounselor
          onSend={handleSend}
          placeholder={`Message ${studentName.split(" ")[0]}...`}
          emptyLabel="No messages yet. Send a note to start the conversation."
        />
      </DialogContent>
    </Dialog>
  )
}
