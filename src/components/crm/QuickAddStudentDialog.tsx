import { useEffect, useState } from "react"
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { assignStudentCounselor, createStudent } from "@/lib/crm-api"
import { useAuth } from "@/lib/auth"
import type { Counselor, LeadSource, PipelineStage } from "@/lib/crm-types"

const studentSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  stage: z.number(),
  counselor: z.string().optional(),
  lead_source: z.string().optional(),
  target_country: z.string().optional(),
  target_specialization: z.string().optional(),
  notes: z.string().optional(),
})

type StudentFormValues = z.infer<typeof studentSchema>

export function QuickAddStudentDialog({
  stages,
  counselors,
  leadSources,
  onCreated,
}: {
  stages: PipelineStage[]
  counselors: Counselor[]
  leadSources: LeadSource[]
  onCreated: () => void
}) {
  const { user } = useAuth()
  // Only a full admin may put a student onto a counselor's caseload (see
  // StudentViewSet.assign_counselor) - the Student.counselor field itself is
  // read-only on create/update now, so a non-admin's selection here would
  // otherwise be silently dropped by the server.
  const isFullAdmin = user?.role === "admin"
  const [open, setOpen] = useState(false)
  const defaultStage = stages.find((s) => s.key === "new") ?? stages[0]

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      stage: defaultStage?.id,
      counselor: "",
      lead_source: "",
      target_country: "",
      target_specialization: "",
      notes: "",
    },
  })

  // useForm's defaultValues are captured once at mount, before the async
  // stages/counselors/lead-sources fetches in the parent resolve - reset
  // with the freshest defaultStage every time the dialog opens instead.
  useEffect(() => {
    if (open) {
      form.reset({
        full_name: "",
        email: "",
        phone: "",
        stage: defaultStage?.id,
        counselor: "",
        lead_source: "",
        target_country: "",
        target_specialization: "",
        notes: "",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = async (values: StudentFormValues) => {
    try {
      const created = await createStudent({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        stage: values.stage,
        lead_source: values.lead_source ? Number(values.lead_source) : null,
        target_country: values.target_country,
        target_specialization: values.target_specialization,
        notes: values.notes,
      })
      if (isFullAdmin && values.counselor) {
        await assignStudentCounselor(created.id, Number(values.counselor))
      }
      toast.success("Lead added")
      form.reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add lead")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="jane@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555 000 0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value != null ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={String(stage.id)}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {isFullAdmin && (
                <FormField
                  control={form.control}
                  name="counselor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Counselor</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {counselors.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="lead_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead source</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unknown" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadSources.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="target_country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target country</FormLabel>
                    <FormControl>
                      <Input placeholder="UK, Canada, ..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target_specialization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialization</FormLabel>
                    <FormControl>
                      <Input placeholder="Computer Science" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding..." : "Add Lead"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
