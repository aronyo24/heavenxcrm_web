import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select"
import type { LeadStatus, StudentListItem } from "@/lib/crm-types"
import { LEAD_STATUS_COLOR, LEAD_STATUS_DOT, LEAD_STATUSES, leadStatusLabel } from "@/lib/lead-status"
import { cn } from "@/lib/utils"

// Inline lead-status picker for table rows (Students, Leads inbox).
export function LeadStatusCell({
  student, onChange,
}: {
  student: StudentListItem
  onChange: (student: StudentListItem, leadStatus: LeadStatus) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const pick = async (value: LeadStatus) => {
    if (value === student.lead_status) return
    setSaving(true)
    try { await onChange(student, value) } finally { setSaving(false) }
  }

  return (
    // Stop the click from opening the profile (onRowClick) while picking.
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={student.lead_status} disabled={saving} onValueChange={(v) => void pick(v as LeadStatus)}>
        <SelectTrigger
          aria-label={`Change lead status for ${student.full_name}`}
          className={cn(
            "h-8 w-[136px] gap-2 rounded-lg border px-2.5 text-xs font-semibold shadow-none transition-all",
            "hover:shadow-sm data-[state=open]:ring-2 data-[state=open]:ring-current/20 disabled:cursor-wait disabled:opacity-100",
            LEAD_STATUS_COLOR[student.lead_status] ?? "bg-muted text-muted-foreground",
          )}
        >
          {/* A div, not a span: the trigger line-clamps direct span children. */}
          <div className="flex min-w-0 items-center gap-2">
            {saving ? (
              <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
            ) : (
              <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", LEAD_STATUS_DOT[student.lead_status] ?? "bg-slate-400")} />
            )}
            <span className="truncate">{leadStatusLabel(student.lead_status)}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="min-w-[220px]">
          <SelectGroup>
            <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lead status
            </SelectLabel>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="py-1.5">
                <span className="flex items-center gap-2.5">
                  <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", LEAD_STATUS_DOT[s.value])} />
                  <span>
                    {s.label}
                    <span className="block text-[11px] font-normal text-muted-foreground">{s.hint}</span>
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
