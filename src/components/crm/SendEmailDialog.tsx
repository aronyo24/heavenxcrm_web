import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { sendStudentEmail } from "@/lib/crm-api"

const emailSchema = z.object({
  subject: z.string().min(2, "Subject is required"),
  message: z.string().min(5, "Message is required"),
})

type EmailFormValues = z.infer<typeof emailSchema>

export function SendEmailDialog({
  studentId,
  studentEmail,
  onSent,
  replySubject,
  trigger,
}: {
  studentId: number
  studentEmail: string
  onSent: () => void
  /** When replying to a student's email: pre-fills "Re: <subject>". */
  replySubject?: string
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const isReply = replySubject !== undefined
  const defaultSubject = isReply && replySubject
    ? (/^re:/i.test(replySubject.trim()) ? replySubject.trim() : `Re: ${replySubject.trim()}`)
    : ""

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { subject: defaultSubject, message: "" },
  })

  const handleOpenChange = (next: boolean) => {
    if (next) form.reset({ subject: defaultSubject, message: "" })
    setOpen(next)
  }

  const onSubmit = async (values: EmailFormValues) => {
    try {
      await sendStudentEmail(studentId, values)
      toast.success(`Email sent to ${studentEmail}`)
      form.reset()
      setOpen(false)
      onSent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Mail className="w-4 h-4 mr-2" /> Send Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isReply ? "Reply to Student" : "Send Email"}</DialogTitle>
          <DialogDescription>
            This sends a real email to <span className="font-medium text-foreground">{studentEmail}</span> and is
            recorded in this student's shared communication history. info@heavenxcrm.com and you are
            CC'd, and the student's replies go to both of you and show up in the CRM.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Your application update" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea rows={6} placeholder="Write your message..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Sending..." : "Send Email"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
