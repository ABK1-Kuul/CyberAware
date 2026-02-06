"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function ReportPreviewActions({ reportId }: { reportId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")

  const handleFinalize = async () => {
    setStatus("loading")
    try {
      const response = await fetch(`/api/admin/reports/finalize/${reportId}`, {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error("Finalize failed")
      }
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div className="fixed bottom-8 right-8 flex items-center gap-3 print-hidden">
      <Button variant="outline" onClick={() => window.print()}>
        Print to PDF
      </Button>
      <Button onClick={handleFinalize} disabled={status === "loading"}>
        Finalize &amp; Lock Report
      </Button>
      {status === "success" ? (
        <span className="text-xs text-emerald-600">Locked</span>
      ) : null}
      {status === "error" ? (
        <span className="text-xs text-rose-600">Failed</span>
      ) : null}
    </div>
  )
}
