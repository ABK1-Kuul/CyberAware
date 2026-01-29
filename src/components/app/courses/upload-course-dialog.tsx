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

export default function UploadCourseDialog() {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    const input = fileInputRef.current
    const file = input?.files?.[0]

    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a SCORM package (.zip) to upload.",
        variant: "destructive",
      })
      return
    }

    const name = file.name.toLowerCase()
    if (!name.endsWith(".zip")) {
      toast({
        title: "Invalid file type",
        description: "Only .zip SCORM packages are accepted.",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/courses/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Upload failed",
          description: data.error ?? "Could not process the upload.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Upload successful",
        description: `Course "${data.course?.title ?? "SCORM package"}" has been created.`,
      })
      setOpen(false)
      input.value = ""
      router.refresh()
    } catch {
      toast({
        title: "Upload failed",
        description: "A network error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UploadCloud className="mr-2 h-4 w-4" />
          Upload Course
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Upload SCORM Package</DialogTitle>
          <DialogDescription>
            Select a SCORM (.zip) file to upload. The system will validate and create a new course.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="scorm-file">SCORM Package (.zip)</Label>
            <Input
              id="scorm-file"
              ref={fileInputRef}
              type="file"
              accept=".zip"
              disabled={uploading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload and Process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
