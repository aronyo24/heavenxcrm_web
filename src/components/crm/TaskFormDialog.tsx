import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateTimePicker } from "@/components/crm/DateTimePicker"
import { announceTasksChanged, createTask } from "@/lib/crm-api"
import type { TaskType } from "@/lib/crm-types"

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "reminder", label: "Reminder" },
  { value: "appointment", label: "Appointment" },
  { value: "call", label: "Call" },
  { value: "follow_up", label: "Follow-up" },
]

const taskSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  task_type: z.enum(["task", "reminder", "appointment", "call", "follow_up"]),
  due_at: z.date(),
  priority: z.enum(["low", "medium", "high"]),
})

type TaskFormValues = z.infer<typeof taskSchema>

// One-click due dates for the follow-ups counselors set all day long.
const at = (daysAhead: number, hour: number) => {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(hour, 0, 0, 0)
  return d
}
const DUE_PRESETS: { label: string; value: () => Date }[] = [
  { label: "In 1 hour", value: () => { const d = new Date(Date.now() + 3_600_000); d.setSeconds(0, 0); return d } },
  { label: "This evening", value: () => at(0, 17) },
  { label: "Tomorrow 10 AM", value: () => at(1, 10) },
  { label: "In 3 days", value: () => at(3, 10) },
  { label: "Next week", value: () => at(7, 10) },
]

export function TaskFormDialog({
  studentId,
  onCreated,
  trigger,
}: {
  studentId?: number
  onCreated: () => void
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", task_type: "task", priority: "medium" },
  })

  const onSubmit = async (values: TaskFormValues) => {
    try {
      await createTask({
        title: values.title,
        description: values.description,
        task_type: values.task_type,
        due_at: values.due_at.toISOString(),
        priority: values.priority,
        student: studentId ?? null,
      })
      toast.success("Task created")
      announceTasksChanged()
      form.reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" /> New task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Call about IELTS score" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="task_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="due_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due</FormLabel>
                  <FormControl>
                    <DateTimePicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {DUE_PRESETS.filter((p) => p.label !== "This evening" || new Date().getHours() < 16).map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => field.onChange(p.value())}
                        className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
