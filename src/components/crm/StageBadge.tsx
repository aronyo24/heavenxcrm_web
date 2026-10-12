import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { STAGE_COLORS } from "@/lib/stage-colors"

export function StageBadge({ stageKey, label }: { stageKey: string; label: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STAGE_COLORS[stageKey] ?? "bg-muted text-muted-foreground")}>
      {label}
    </Badge>
  )
}
