import { EmailComposerDialog } from "@/components/crm/EmailComposer"
import type { StudentListItem } from "@/lib/crm-types"

export function BulkEmailDialog({
  open, onOpenChange, students, onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: StudentListItem[]
  onSent: () => void
}) {
  return (
    <EmailComposerDialog
      open={open}
      onOpenChange={onOpenChange}
      recipients={students.map((s) => ({ id: s.id, full_name: s.full_name, email: s.email }))}
      onSent={onSent}
    />
  )
}
