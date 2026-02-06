import { prisma } from "@/lib/prisma"
import { gophishApi, type GophishCampaign, type GophishCampaignCreate } from "@/services/gophish-api"

type CampaignAuditMeta = {
  actorId: string
  actorIp?: string
  reason?: string
  complianceStatus?: string
  threatScenario?: string
}

export async function startCampaignWithAudit(
  config: GophishCampaignCreate,
  meta: CampaignAuditMeta
): Promise<GophishCampaign> {
  const campaign = await gophishApi.startCampaign(config)
  await prisma.auditLog.create({
    data: {
      actorId: meta.actorId,
      action: "gophish.campaign.start",
      complianceStatus: meta.complianceStatus ?? null,
      details: {
        campaignId: campaign.id,
        name: campaign.name,
        status: campaign.status,
        reason: meta.reason ?? null,
        actorIp: meta.actorIp ?? null,
        threatScenario: meta.threatScenario ?? null,
      },
    },
  })
  return campaign
}

export async function stopCampaignWithAudit(
  campaignId: number,
  meta: CampaignAuditMeta
): Promise<GophishCampaign> {
  const campaign = await gophishApi.stopCampaign(campaignId)
  await prisma.auditLog.create({
    data: {
      actorId: meta.actorId,
      action: "gophish.campaign.stop",
      complianceStatus: meta.complianceStatus ?? null,
      details: {
        campaignId,
        name: campaign.name,
        status: campaign.status,
        reason: meta.reason ?? null,
        actorIp: meta.actorIp ?? null,
        threatScenario: meta.threatScenario ?? null,
      },
    },
  })
  return campaign
}
