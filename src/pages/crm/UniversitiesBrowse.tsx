import { safeHref } from "@/lib/utils"
import { useCallback, useEffect, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { ExternalLink, GraduationCap, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { DataTable } from "@/components/crm/DataTable"
import { getCourseFilters, getCoursesPage } from "@/lib/api"
import { formatTuition } from "@/lib/format"
import type { Course } from "@/lib/types"
import { PageHeader } from "@/components/crm/PageHeader"

const columns: ColumnDef<Course, unknown>[] = [
  { accessorKey: "program_name", header: "Program" },
  { accessorKey: "university_name", header: "University" },
  { accessorKey: "country", header: "Country", cell: ({ row }) => row.original.country || "—" },
  { accessorKey: "degree", header: "Degree", cell: ({ row }) => row.original.degree || "—" },
  {
    accessorKey: "tuition_amount",
    header: "Tuition",
    cell: ({ row }) => formatTuition(row.original.tuition_amount, row.original.tuition_currency),
  },
  { accessorKey: "ielts", header: "IELTS", cell: ({ row }) => row.original.ielts ?? "—" },
]

export default function UniversitiesBrowse() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [country, setCountry] = useState("all")
  const [degree, setDegree] = useState("all")
  const [countries, setCountries] = useState<string[]>([])
  const [degrees, setDegrees] = useState<string[]>([])
  const [selected, setSelected] = useState<Course | null>(null)

  useEffect(() => {
    getCourseFilters()
      .then((f) => {
        setCountries(f.countries)
        setDegrees(f.degrees)
      })
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCoursesPage(
        search || undefined,
        undefined,
        country !== "all" ? country : undefined,
        degree !== "all" ? degree : undefined,
        undefined,
        page,
        20
      )
      setCourses(res.data)
      setTotalPages(res.pagination.totalPages)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load universities")
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [search, country, degree, page])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reference"
        title="Universities"
        description="Search programmes to recommend while you counsel a student."
      />

      <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-background dark:border-white/10 dark:bg-white/5"
            placeholder="Search programmes or universities…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          />
        </div>
        <Select value={country} onValueChange={(v) => { setPage(1); setCountry(v) }}>
          <SelectTrigger className="h-9 w-full shadow-none sm:w-48">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={degree} onValueChange={(v) => { setPage(1); setDegree(v) }}>
          <SelectTrigger className="h-9 w-full shadow-none sm:w-48">
            <SelectValue placeholder="All degrees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All degrees</SelectItem>
            {degrees.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={courses}
        isLoading={loading}
        emptyMessage="No programs match these filters."
        onRowClick={(course) => setSelected(course)}
        pagination={{ page, totalPages, onPageChange: setPage }}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary flex-shrink-0" />
                  {selected.program_name}
                </SheetTitle>
                <SheetDescription>{selected.university_name}{selected.country ? ` · ${selected.country}` : ""}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap gap-2">
                  {selected.degree && <Badge variant="secondary">{selected.degree}</Badge>}
                  {selected.scholarship_available && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30" variant="outline">Scholarship available</Badge>}
                  {selected.placement_available && <Badge variant="outline">Placement support</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Detail label="Tuition" value={formatTuition(selected.tuition_amount, selected.tuition_currency)} />
                  <Detail label="Duration" value={selected.duration || "—"} />
                  <Detail label="Intake" value={selected.intake_date || "—"} />
                  <Detail label="IELTS" value={selected.ielts != null ? String(selected.ielts) : "—"} />
                  <Detail label="TOEFL" value={selected.toefl != null ? String(selected.toefl) : "—"} />
                  <Detail label="PTE" value={selected.pte != null ? String(selected.pte) : "—"} />
                </div>

                {selected.entry_requirements && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Entry Requirements</p>
                    <p className="text-sm whitespace-pre-wrap">{selected.entry_requirements}</p>
                  </div>
                )}
                {selected.language_requirements && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Language Requirements</p>
                    <p className="text-sm whitespace-pre-wrap">{selected.language_requirements}</p>
                  </div>
                )}
                {selected.course_scholarships && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Scholarships</p>
                    <p className="text-sm whitespace-pre-wrap">{selected.course_scholarships}</p>
                  </div>
                )}
                {selected.career_prospects && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Career Prospects</p>
                    <p className="text-sm whitespace-pre-wrap">{selected.career_prospects}</p>
                  </div>
                )}

                {selected.website_url && (
                  <Button asChild variant="outline" className="w-full">
                    <a href={safeHref(selected.website_url)} target="_blank" rel="noreferrer">
                      View on university website <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}
