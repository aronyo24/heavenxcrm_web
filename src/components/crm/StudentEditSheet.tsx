import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BookOpen, Contact, Flag, NotebookPen, Target } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { updateStudent } from "@/lib/crm-api"
import type { Student } from "@/lib/crm-types"
import { cn } from "@/lib/utils"

// Text fields edited as-is; numeric ones are converted (blank -> null).
const TEXT_FIELDS = [
  "full_name", "email", "phone", "whatsapp_number", "alt_phone", "priority",
  "highest_qualification", "previous_institute", "field_of_study", "english_test",
  "target_country", "target_degree", "target_specialization", "budget_currency", "notes",
] as const
const NUMBER_FIELDS = ["gpa", "english_score", "budget_min", "budget_max"] as const

type TextField = (typeof TEXT_FIELDS)[number]
type NumberField = (typeof NUMBER_FIELDS)[number]
type FormState = Record<TextField | NumberField, string> & { tags: string }

const ENGLISH_TESTS = ["IELTS", "TOEFL", "PTE", "Duolingo", "MOI", "None"]
const DEGREES = ["Foundation", "Diploma", "Bachelors", "Masters", "MBA", "PhD"]
const CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD", "BDT"]

function toForm(s: Student): FormState {
  const form = {} as FormState
  for (const f of TEXT_FIELDS) form[f] = (s[f] as string | null) ?? ""
  for (const f of NUMBER_FIELDS) form[f] = s[f] != null ? String(s[f]) : ""
  form.tags = (s.tags ?? []).join(", ")
  return form
}

function Section({
  icon: Icon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5 text-emerald-600" />
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({
  label, children, wide,
}: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
      <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</Label>
      {children}
    </div>
  )
}

/** Side-panel editor for a student's profile. Only changed fields are sent. */
export function StudentEditSheet({
  student, open, onOpenChange, onSaved,
}: {
  student: Student
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (student: Student) => void
}) {
  const initial = useMemo(() => toForm(student), [student])
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)

  // Start from the latest saved record every time the panel opens.
  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const set = (field: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [field]: value }))
  const bind = (field: keyof FormState) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field)(e.target.value),
  })

  const changes = useMemo(() => {
    const patch: Partial<Student> = {}
    for (const f of TEXT_FIELDS) {
      if (form[f] !== initial[f]) (patch as Record<string, unknown>)[f] = form[f].trim()
    }
    for (const f of NUMBER_FIELDS) {
      if (form[f] !== initial[f]) (patch as Record<string, unknown>)[f] = form[f].trim() === "" ? null : Number(form[f])
    }
    if (form.tags !== initial.tags) {
      patch.tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean)
    }
    return patch
  }, [form, initial])
  const dirty = Object.keys(changes).length > 0

  const save = async () => {
    if (!form.full_name.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    try {
      const updated = await updateStudent(student.id, changes)
      onSaved(updated)
      toast.success("Profile updated")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>Keep {student.full_name.split(" ")[0]}'s details current so matching and follow-ups stay accurate.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <Section icon={Contact} title="Contact">
            <Field label="Full name" wide><Input {...bind("full_name")} /></Field>
            <Field label="Email"><Input type="email" {...bind("email")} /></Field>
            <Field label="Phone"><Input type="tel" {...bind("phone")} /></Field>
            <Field label="WhatsApp"><Input type="tel" placeholder="Same as phone if blank" {...bind("whatsapp_number")} /></Field>
            <Field label="Alternate phone"><Input type="tel" {...bind("alt_phone")} /></Field>
          </Section>

          <Section icon={Flag} title="Lead">
            <Field label="Priority">
              <Select value={form.priority || "medium"} onValueChange={set("priority")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tags (comma separated)"><Input placeholder="scholarship, sept-intake" {...bind("tags")} /></Field>
          </Section>

          <Section icon={BookOpen} title="Academic background">
            <Field label="Highest qualification"><Input placeholder="e.g. HSC, BSc" {...bind("highest_qualification")} /></Field>
            <Field label="Previous institute"><Input {...bind("previous_institute")} /></Field>
            <Field label="Field of study"><Input {...bind("field_of_study")} /></Field>
            <Field label="GPA / CGPA"><Input type="number" step="0.01" min="0" {...bind("gpa")} /></Field>
            <Field label="English test">
              <Select value={form.english_test || "none-set"} onValueChange={(v) => set("english_test")(v === "none-set" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select test" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none-set">Not set</SelectItem>
                  {[...new Set([...ENGLISH_TESTS, form.english_test].filter(Boolean))].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="English score"><Input type="number" step="0.5" min="0" {...bind("english_score")} /></Field>
          </Section>

          <Section icon={Target} title="Study plan">
            <Field label="Target country"><Input placeholder="e.g. UK" {...bind("target_country")} /></Field>
            <Field label="Target degree">
              <Select value={form.target_degree || "none-set"} onValueChange={(v) => set("target_degree")(v === "none-set" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select degree" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none-set">Not set</SelectItem>
                  {[...new Set([...DEGREES, form.target_degree].filter(Boolean))].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Specialization" wide><Input placeholder="e.g. Computer Science" {...bind("target_specialization")} /></Field>
            <Field label="Budget from"><Input type="number" min="0" {...bind("budget_min")} /></Field>
            <Field label="Budget to">
              <div className="flex gap-2">
                <Input type="number" min="0" className="flex-1" {...bind("budget_max")} />
                <Select value={form.budget_currency || "USD"} onValueChange={set("budget_currency")}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...new Set([...CURRENCIES, form.budget_currency].filter(Boolean))].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Field>
          </Section>

          <Section icon={NotebookPen} title="Counselor notes">
            <Field label="Notes" wide>
              <Textarea rows={5} placeholder="Anything the next person should know…" {...bind("notes")} />
            </Field>
          </Section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-slate-50 px-6 py-3 dark:bg-white/[0.03]">
          <span className="text-xs text-muted-foreground">
            {dirty ? `${Object.keys(changes).length} unsaved change${Object.keys(changes).length === 1 ? "" : "s"}` : "No changes yet"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
