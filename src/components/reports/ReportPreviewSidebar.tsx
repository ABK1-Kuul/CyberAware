"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function useQueryParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams])

  const updateParam = (key: string, value?: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (!value) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    router.replace(`${pathname}?${next.toString()}`)
  }

  return { params, updateParam }
}

export function ReportPreviewSidebar() {
  const { params, updateParam } = useQueryParams()
  const [costInput, setCostInput] = useState(() => params.get("remediationCost") ?? "")

  const showRoi = params.get("showRoi") !== "false"
  const regulation = params.get("regulation") ?? "DORA"

  return (
    <aside className="fixed left-8 top-20 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl print-hidden">
      <h2 className="text-sm font-semibold text-slate-700">Report Customization</h2>
      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="toggle-roi" className="text-xs text-slate-600">
              Show Financial ROI
            </Label>
          </div>
          <Switch
            id="toggle-roi"
            checked={showRoi}
            onCheckedChange={(checked) => updateParam("showRoi", checked ? "true" : "false")}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-600">Select Regulation</Label>
          <Select
            value={regulation}
            onValueChange={(value) => updateParam("regulation", value)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DORA">DORA</SelectItem>
              <SelectItem value="NIST">NIST</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-600">Adjust Remediation Cost</Label>
          <Input
            value={costInput}
            onChange={(event) => setCostInput(event.target.value)}
            onBlur={() => {
              const value = Number(costInput)
              if (Number.isFinite(value) && value > 0) {
                updateParam("remediationCost", String(Math.round(value)))
              } else {
                updateParam("remediationCost", null)
              }
            }}
            placeholder="e.g. 180"
            className="h-9 text-xs"
          />
          <p className="text-[10px] text-slate-500">Leave empty to use default cost.</p>
        </div>
      </div>
    </aside>
  )
}
