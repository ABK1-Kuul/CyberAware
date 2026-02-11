type BlockedDomainRow = {
  domain: string
  source?: string | null
  createdAt?: Date | string
}

type FirewallFormat = "CSV" | "JSON" | "PALO_ALTO" | "FORTINET" | "M365"

function normalizeDomains(data: BlockedDomainRow[]) {
  const domains = data
    .map((entry) => entry.domain?.trim().toLowerCase())
    .filter((entry): entry is string => Boolean(entry))
  return Array.from(new Set(domains)).sort()
}

function formatFortinetCsv(domains: string[]) {
  const header = "domain,comment"
  const rows = domains.map((domain) => `${domain},"Reported by Human Firewall"`)
  return [header, ...rows].join("\n")
}

export function formatBlocklist(data: BlockedDomainRow[], format: FirewallFormat) {
  const domains = normalizeDomains(data)
  switch (format) {
    case "CSV": {
      const header = "domain,source,createdAt"
      const rows = data.map((entry) => {
        const createdAt =
          typeof entry.createdAt === "string"
            ? entry.createdAt
            : entry.createdAt
              ? entry.createdAt.toISOString()
              : ""
        return `${entry.domain},${entry.source ?? ""},${createdAt}`
      })
      return [header, ...rows].join("\n")
    }
    case "JSON":
      return JSON.stringify(
        data.map((entry) => ({
          domain: entry.domain,
          source: entry.source ?? null,
          createdAt: entry.createdAt ?? null,
        })),
        null,
        2
      )
    case "PALO_ALTO":
      // Palo Alto EDL: one domain per line
      return domains.join("\n")
    case "M365": {
      // Microsoft 365 Tenant Allow/Block List CSV
      const header = "Value,Action,ExpirationDate,Comment"
      const rows = domains.map(
        (domain) => `${domain},Block,Never,Reported by Human Firewall`
      )
      return [header, ...rows].join("\n")
    }
    case "FORTINET":
      // Fortinet CSV import (domain + comment)
      return formatFortinetCsv(domains)
    default:
      return JSON.stringify(data, null, 2)
  }
}
