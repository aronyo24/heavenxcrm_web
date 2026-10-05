import { Facebook } from "lucide-react"

import type { LeadForm } from "@/lib/crm-types"

// The Facebook/Instagram lead form a student submitted, shown exactly as
// they answered it - original questions, in form order. Renders nothing for
// leads that didn't come from an ad form (Student.lead_form is {}).
export function LeadFormCard({ leadForm: form }: { leadForm: LeadForm | Record<string, never> }) {
  if (!Array.isArray((form as Partial<LeadForm>).answers)) return null
  const leadForm = form as LeadForm
  const submitted = leadForm.submitted_at ? new Date(leadForm.submitted_at) : null

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Facebook className="h-4 w-4 text-blue-600" /> Facebook Lead Form
        </h3>
        {submitted ? (
          <span className="text-xs text-muted-foreground">
            Submitted {submitted.toLocaleDateString()} at{" "}
            {submitted.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
      </div>

      {leadForm.form_name || leadForm.campaign || leadForm.ad_name ? (
        <dl className="mb-4 grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-3">
          <Meta label="Form" value={leadForm.form_name} />
          <Meta label="Campaign" value={leadForm.campaign} />
          <Meta label="Ad" value={leadForm.ad_name} />
        </dl>
      ) : null}

      {leadForm.answers.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No answers recorded.</p>
      ) : (
        <dl className="divide-y text-sm">
          {leadForm.answers.map(({ question, answer }, i) => (
            <div key={`${question}-${i}`} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
              <dt className="text-muted-foreground">{question}</dt>
              <dd className="break-words font-medium">{answer}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium" title={value || undefined}>{value || "—"}</dd>
    </div>
  )
}
