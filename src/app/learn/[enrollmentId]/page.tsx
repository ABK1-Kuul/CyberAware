import { getCertificateForEnrollment, getEnrollment } from "@/lib/data"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, Award } from "lucide-react"
import Link from "next/link"

export default async function LearnPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params
  const enrollment = await getEnrollment(enrollmentId)

  if (!enrollment) {
    notFound()
  }
  
  const isCompleted = enrollment.status === 'Completed'
  const certificate = isCompleted ? await getCertificateForEnrollment(enrollment.id) : undefined

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{enrollment.course.title}</CardTitle>
          <CardDescription>{enrollment.course.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4">
            <p className="text-muted-foreground">Simulated SCORM Content Area</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{enrollment.progress}%</span>
            <Progress value={enrollment.progress} className="w-full" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
            {isCompleted ? (
              certificate ? (
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
            ) : (
              <Button>
                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Complete
              </Button>
            )}
        </CardFooter>
      </Card>
    </div>
  )
}
