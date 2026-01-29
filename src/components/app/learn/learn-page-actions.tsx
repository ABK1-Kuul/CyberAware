"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle, Award } from "lucide-react"
import type { Enrollment, Certificate } from "@/lib/types"

export function LearnPageActions({
  enrollment,
  certificate,
}: {
  enrollment: Enrollment
  certificate: Certificate | undefined
}) {
  const router = useRouter()
  const [completing, setCompleting] = useState(false)
  const isCompleted = enrollment.status === "Completed"

  const handleMarkComplete = async () => {
    setCompleting(true)
    try {
      const res = await fetch(`/api/enrollments/${enrollment.id}/complete`, {
        method: "PATCH",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to mark complete")
      }
      router.refresh()
    } catch (e) {
      console.error("Mark complete error:", e)
      router.refresh()
    } finally {
      setCompleting(false)
    }
  }

  if (isCompleted) {
    return certificate ? (
      <Link href={`/certificate/${certificate.id}`}>
        <Button>
          <Award className="mr-2 h-4 w-4" /> View Certificate
        </Button>
      </Link>
    ) : (
      <Button disabled>
        <Award className="mr-2 h-4 w-4" /> Certificate Pending
      </Button>
    )
  }

  return (
    <Button onClick={handleMarkComplete} disabled={completing}>
      <CheckCircle className="mr-2 h-4 w-4" />
      {completing ? "Marking…" : "Mark as Complete"}
    </Button>
  )
}
