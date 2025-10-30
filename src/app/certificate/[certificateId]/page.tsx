import { Button } from "@/components/ui/button"
import { CertificateDisplay } from "@/components/app/certificate-display"
import { getCertificateForEnrollment, getEnrollment } from "@/lib/data"
import { Download } from "lucide-react"
import { notFound } from "next/navigation"

// This page simulates finding the certificate by an ID. In a real app, you might use the enrollment ID or a unique certificate UUID.
// For this demo, we'll just grab the first certificate linked to the first completed enrollment.
export default async function CertificatePage({ params }: { params: { certificateId: string } }) {
  const certificate = await getCertificateForEnrollment('enr_1'); // Hardcoded for demo
  if (!certificate) notFound();

  const enrollment = await getEnrollment(certificate.enrollmentId);
  if (!enrollment) notFound();

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
