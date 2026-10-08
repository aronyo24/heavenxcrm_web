import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Clock, GraduationCap, Phone } from "lucide-react"

import { PersonAvatar } from "@/components/crm/PersonAvatar"
import type { PipelineStage, StudentListItem } from "@/lib/crm-types"
import { cn } from "@/lib/utils"

// Same hues as StageBadge so a stage looks the same everywhere.
const STAGE_ACCENT: Record<string, { dot: string; top: string }> = {
  new: { dot: "bg-slate-400", top: "border-t-slate-400" },
  contacted: { dot: "bg-blue-500", top: "border-t-blue-500" },
  counseling: { dot: "bg-indigo-500", top: "border-t-indigo-500" },
  applied: { dot: "bg-purple-500", top: "border-t-purple-500" },
  offer: { dot: "bg-amber-500", top: "border-t-amber-500" },
  visa: { dot: "bg-cyan-500", top: "border-t-cyan-500" },
  enrolled: { dot: "bg-emerald-500", top: "border-t-emerald-500" },
  lost: { dot: "bg-red-500", top: "border-t-red-500" },
}

const PRIORITY_DOT: Record<StudentListItem["priority"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-slate-300 dark:bg-slate-600",
}

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

function StudentCard({ student, onClick, isWon }: { student: StudentListItem; onClick: () => void; isWon: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }
    : undefined

  // Students sitting in one stage too long are the ones who drop out.
  const days = daysSince(student.stage_changed_at || student.updated_at)
  const stale = !isWon && days >= 14
  const aging = !isWon && days >= 7 && !stale

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all hover:-translate-y-px hover:border-emerald-500/40 hover:shadow-md active:cursor-grabbing",
        isDragging && "rotate-1 opacity-70 shadow-xl",
      )}
    >
      <div className="flex items-start gap-2.5">
        <PersonAvatar name={student.full_name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">{student.full_name}</p>
            <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", PRIORITY_DOT[student.priority])} title={`${student.priority} priority`} />
          </div>
          {(student.target_country || student.target_degree) && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <GraduationCap className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{[student.target_country, student.target_degree].filter(Boolean).join(" · ")}</span>
            </p>
          )}
          {student.phone && (
            <p className="mt-0.5 flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {student.phone}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2 text-[11px]">
        <span className="truncate text-muted-foreground">{student.counselor_name ?? "Unassigned"}</span>
        <span
          className={cn(
            "flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-px font-medium tabular-nums",
            stale ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : aging ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "text-muted-foreground",
          )}
          title="Days in this status"
        >
          <Clock className="h-3 w-3" />
          {days === 0 ? "today" : `${days}d`}
        </span>
      </div>
    </div>
  )
}

function StageColumn({
  stage,
  students,
  onCardClick,
}: {
  stage: PipelineStage
  students: StudentListItem[]
  onCardClick: (student: StudentListItem) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })
  const accent = STAGE_ACCENT[stage.key] ?? { dot: "bg-emerald-500", top: "border-t-emerald-500" }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 flex-shrink-0 flex-col rounded-xl border border-t-[3px] bg-muted/40 transition-colors",
        accent.top,
        isOver && "bg-emerald-500/5 ring-2 ring-emerald-500/40",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn("h-2 w-2 rounded-full", accent.dot)} />
          {stage.label}
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground shadow-sm">
          {students.length}
        </span>
      </div>
      <div className="max-h-[calc(100vh-17rem)] min-h-[140px] flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
        {students.map((student) => (
          <StudentCard key={student.id} student={student} isWon={stage.is_won} onClick={() => onCardClick(student)} />
        ))}
        {students.length === 0 && (
          <div className={cn(
            "flex h-24 items-center justify-center rounded-lg border-2 border-dashed text-xs text-muted-foreground/70 transition-colors",
            isOver && "border-emerald-500/50 text-emerald-600",
          )}>
            Drop a student here
          </div>
        )}
      </div>
    </div>
  )
}

export function PipelineKanbanBoard({
  stages,
  studentsByStage,
  onCardClick,
  onDrop,
}: {
  stages: PipelineStage[]
  studentsByStage: Record<string, StudentListItem[]>
  onCardClick: (student: StudentListItem) => void
  onDrop: (studentId: number, stageKey: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const studentId = Number(active.id)
    const stageKey = String(over.id)
    onDrop(studentId, stageKey)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.key}
            stage={stage}
            students={studentsByStage[stage.key] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DndContext>
  )
}
