"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadCloud } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { UI_MESSAGES } from "@/lib/ui-messages"

type UploadCourseDialogProps = {
  onOptimisticAdd?: (title: string) => void
  onRevert?: () => void
  onSuccess?: (course: { id: string; title: string; version: string }) => void
}

export default function UploadCourseDialog({
  onOptimisticAdd,
  onRevert,
  onSuccess,
}: UploadCourseDialogProps = {}) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    const input = fileInputRef.current
    const file = input?.files?.[0]

    if (!file) {
      setErrorMessage(UI_MESSAGES.upload.noFileDescription)
      toast({
        title: UI_MESSAGES.upload.noFileTitle,
        description: UI_MESSAGES.upload.noFileDescription,
        variant: "destructive",
      })
      return
    }

    const name = file.name.toLowerCase()
    if (!name.endsWith(".zip")) {
      setErrorMessage(UI_MESSAGES.upload.invalidTypeDescription)
      toast({
        title: UI_MESSAGES.upload.invalidTypeTitle,
        description: UI_MESSAGES.upload.invalidTypeDescription,
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    setErrorMessage(null)
    const optimisticTitle = file.name.replace(/\.zip$/i, "") || "Untitled"
    onOptimisticAdd?.(optimisticTitle)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/courses/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onRevert?.()
        const errorText = data.error ?? UI_MESSAGES.upload.uploadFailedFallback
        setErrorMessage(errorText)
        toast({
          title: UI_MESSAGES.upload.uploadFailedTitle,
          description: errorText,
          variant: "destructive",
        })
        return
      }
      onSuccess?.(data.course)
      toast({
        title: UI_MESSAGES.upload.uploadSuccessTitle,
        description: `Course "${data.course?.title ?? UI_MESSAGES.upload.uploadSuccessFallback}" has been created.`,
      })
      setOpen(false)
      input.value = ""
      router.refresh()
    } catch {
      onRevert?.()
      setErrorMessage(UI_MESSAGES.upload.networkError)
      toast({
        title: UI_MESSAGES.upload.uploadFailedTitle,
        description: UI_MESSAGES.upload.networkError,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setErrorMessage(null)
      }}
    >
      <DialogTrigger asChild>
        <Button aria-label={UI_MESSAGES.upload.buttonAriaLabel}>
          <UploadCloud className="mr-2 h-4 w-4" />
          Upload Course
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{UI_MESSAGES.upload.dialogTitle}</DialogTitle>
          <DialogDescription>
            {UI_MESSAGES.upload.dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="scorm-file">{UI_MESSAGES.upload.fileLabel}</Label>
            <Input
              id="scorm-file"
              ref={fileInputRef}
              type="file"
              accept=".zip"
              disabled={uploading}
            />
            {errorMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? UI_MESSAGES.upload.submitLoading : UI_MESSAGES.upload.submitIdle}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
