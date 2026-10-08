import type { LucideIcon } from "lucide-react"
import { StatTile, type StatTone } from "@/components/crm/StatTile"

interface Card {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
}

// Same KPI tile as the CRM and the admin dashboard, toned in a fixed order.
const TONES: StatTone[] = ["sky", "violet", "emerald", "amber"]

export function SummaryCards({ cards }: { cards: Card[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <StatTile
          key={card.label}
          label={card.label}
          value={typeof card.value === "number" ? card.value.toLocaleString() : card.value}
          hint={card.hint}
          icon={card.icon}
          tone={TONES[i % TONES.length]}
        />
      ))}
    </div>
  )
}
