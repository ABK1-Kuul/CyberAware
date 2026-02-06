import { AuditReportTemplate } from "@/components/reports/AuditReportTemplate"
import { ReportPreviewActions } from "@/components/reports/ReportPreviewActions"
import { ReportPreviewSidebar } from "@/components/reports/ReportPreviewSidebar"
import { getAuditReportData } from "@/services/compliance-report"

type PreviewSearchParams = {
  showRoi?: string
  regulation?: string
  remediationCost?: string
}

export default async function ReportPreviewPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: PreviewSearchParams
}) {
  const data = await getAuditReportData(params.id)
  const showFinancialRoi = searchParams?.showRoi !== "false"
  const regulation = searchParams?.regulation === "NIST" ? "NIST" : "DORA"
  const remediationCost = Number(searchParams?.remediationCost)
  const adjustedCost =
    Number.isFinite(remediationCost) && remediationCost > 0
      ? remediationCost
      : data.averageRemediationCost

  const adjustedData = {
    ...data,
    complianceStatus: regulation,
    averageRemediationCost: adjustedCost,
    avoidedBreachCost: adjustedCost * data.totalSuccessfulReports,
  }

  return (
    <div className="bg-gray-100 min-h-screen py-10 print:p-0 print:bg-white">
      <div className="mx-auto max-w-[210mm] bg-white shadow-2xl print:shadow-none">
        <AuditReportTemplate data={adjustedData} options={{ showFinancialRoi }} />
      </div>
      <ReportPreviewSidebar />
      <ReportPreviewActions reportId={data.reportId} />
    </div>
  )
}
