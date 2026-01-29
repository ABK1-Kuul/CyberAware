import { Button } from "@/components/ui/button"
import { CertificateDisplay } from "@/components/app/certificate-display"
import { getCertificateById, getEnrollment } from "@/lib/data"
import { Download } from "lucide-react"
import { notFound } from "next/navigation"

export default async function CertificatePage({ params }: { params: Promise<{ certificateId: string }> }) {
  const { certificateId } = await params
  const certificate = await getCertificateById(certificateId)
  if (!certificate) notFound()

  const enrollment = await getEnrollment(certificate.enrollmentId)
  if (!enrollment) notFound()

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex justify-end mb-4">
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
        <CertificateDisplay enrollment={enrollment} certificate={certificate} />
      </div>
    </div>
  )
}
