// Badge colours per pipeline stage key (StageBadge, Students status picker).
export const STAGE_COLORS: Record<string, string> = {
  new: "bg-slate-500/15 text-slate-500 border-slate-500/30",
  contacted: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  counseling: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30",
  applied: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  offer: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  visa: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
  enrolled: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  lost: "bg-red-500/15 text-red-500 border-red-500/30",
}

// Solid dot colour per stage key (status picker, legends).
export const STAGE_DOTS: Record<string, string> = {
  new: "bg-slate-400",
  contacted: "bg-blue-500",
  counseling: "bg-indigo-500",
  applied: "bg-purple-500",
  offer: "bg-amber-500",
  visa: "bg-cyan-500",
  enrolled: "bg-emerald-500",
  lost: "bg-red-500",
}
