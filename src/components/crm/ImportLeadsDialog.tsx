import { useRef, useState } from "react"
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { downloadLeadImportTemplate, importLeads, type LeadImportResult } from "@/lib/crm-api"

// Bulk-add leads from an .xlsx/.csv file. Imported rows land unassigned in the
// Leads inbox; rows the server rejects come back with a reason per row.
export function ImportLeadsDialog({ onImported }: { onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<LeadImportResult | null>(null)

  const reset = () => {
    setFile(null)
    setResult(null)
    if (fileInput.current) fileInput.current.value = ""
  }

  const handleTemplate = async () => {
    try {
      await downloadLeadImportTemplate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download template")
    }
  }

  const handleImport = async () => {
    if (!file) return
    setUploading(true)
    try {
      const res = await importLeads(file)
      setResult(res)
      if (res.created) {
        toast.success(`Imported ${res.created} lead${res.created === 1 ? "" : "s"}`)
        onImported()
      } else {
        toast.warning("No new leads were imported")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 gap-1.5 shadow-sm">
          <Upload className="h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import leads from Excel</DialogTitle>
          <DialogDescription>
            Upload an .xlsx or .csv file. The first row must be headers with at least a
            <span className="font-medium text-foreground"> Full name</span> column and an
            <span className="font-medium text-foreground"> Email</span> or
            <span className="font-medium text-foreground"> Phone</span> column.
            Leads already in the CRM (same email or phone) are skipped.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
          {file ? (
            <span className="text-sm font-medium">{file.name}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Click to choose a file</span>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
        />

        <button
          type="button"
          onClick={() => void handleTemplate()}
          className="flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Download template
        </button>

        {result ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <p>
              <span className="font-semibold text-emerald-600">{result.created} imported</span>
              {" · "}
              <span className={result.skipped.length ? "font-semibold text-amber-600" : "text-muted-foreground"}>
                {result.skipped.length} skipped
              </span>
              <span className="text-muted-foreground"> of {result.total_rows} rows</span>
            </p>
            {result.skipped.length ? (
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                {result.skipped.map((s) => (
                  <li key={s.row}>Row {s.row}: {s.reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {result ? "Done" : "Cancel"}
          </Button>
          <Button onClick={() => void handleImport()} disabled={!file || uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
