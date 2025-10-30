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
import { useState } from "react"

export default function UploadCourseDialog() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false);

  const handleUpload = () => {
    // Simulate upload
    toast({
      title: "Upload Successful!",
      description: "The SCORM package has been processed and is now available.",
    })
    setOpen(false);
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
            Select a SCORM (.zip) file to upload. The system will validate the manifest and create a new course.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="scorm-file">SCORM Package (.zip)</Label>
            <Input id="scorm-file" type="file" accept=".zip" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleUpload}>Upload and Process</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
