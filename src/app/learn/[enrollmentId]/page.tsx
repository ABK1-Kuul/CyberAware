import { getCertificateForEnrollment, getEnrollment } from "@/lib/data"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { LearnPageActions } from "@/components/app/learn/learn-page-actions"
import { ScormPlayer } from "@/components/app/learn/scorm-player"

export default async function LearnPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params
  const enrollment = await getEnrollment(enrollmentId)

  if (!enrollment) {
    notFound()
  }

  const isCompleted = enrollment.status === "Completed"
  const certificate = isCompleted ? await getCertificateForEnrollment(enrollment.id) : undefined

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{enrollment.course.title}</CardTitle>
          <CardDescription>{enrollment.course.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            {enrollment.course.scormPath ? (
              <ScormPlayer
                enrollmentId={enrollment.id}
                scormPath={enrollment.course.scormPath}
              />
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">SCORM content is not available for this course.</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{enrollment.progress}%</span>
            <Progress value={enrollment.progress} className="w-full" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <LearnPageActions enrollment={enrollment} certificate={certificate} />
        </CardFooter>
      </Card>
    </div>
  )
}
