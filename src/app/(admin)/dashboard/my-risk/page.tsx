import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Download, ShieldCheck, ShieldHalf, Trophy } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function getRiskGrade(score: number) {
  if (score <= 10) return "A+"
  if (score <= 20) return "A"
  if (score <= 30) return "A-"
  if (score <= 40) return "B"
  if (score <= 55) return "C"
  if (score <= 70) return "D"
  return "F"
}

function getGradeTone(grade: string) {
  if (grade.startsWith("A")) return "text-emerald-300"
  if (grade.startsWith("B")) return "text-lime-300"
  if (grade.startsWith("C")) return "text-amber-300"
  if (grade.startsWith("D")) return "text-orange-300"
  return "text-red-400"
}

function normalizeAchievements(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string")
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

export default async function MyRiskPage() {
  const headerList = headers()
  const request = new Request("http://localhost/dashboard/my-risk", { headers: headerList })
  const auth = await requireUnifiedAuth(request, { requireCookie: true })
  if ("status" in auth) {
    redirect("/access-denied")
  }

  const profile = await prisma.userRiskProfile.findUnique({
    where: { userId: auth.user.id },
    select: {
      riskScore: true,
      reportingStreak: true,
      totalReported: true,
      achievements: true,
    },
  })

  const riskScore = profile?.riskScore ?? 50
  const riskGrade = getRiskGrade(riskScore)
  const achievements = normalizeAchievements(profile?.achievements)
  const reportingStreak = profile?.reportingStreak ?? 0
  const totalReported = profile?.totalReported ?? 0

  return (
    <div className="grid gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-headline">My Risk Profile</h1>
        <p className="text-sm text-muted-foreground">
          Track your personal security posture and achievements.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldHalf className="h-4 w-4 text-sky-300" />
              Risk Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-5xl font-semibold ${getGradeTone(riskGrade)}`}>{riskGrade}</div>
            <p className="text-xs text-muted-foreground font-mono">Score {riskScore}/100</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Reporting Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-emerald-200">
              {reportingStreak}
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {totalReported} total reports logged
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-amber-300" />
              Badges Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-amber-200">
              {achievements.length}
            </div>
            <p className="text-xs text-muted-foreground font-mono">Achievements unlocked</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-headline">My Achievements</CardTitle>
          <Button asChild variant="outline" size="sm">
            <a href="/api/users/me/security-resume">
              <Download className="mr-2 h-4 w-4" />
              Download My Security Resume
            </a>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No badges earned yet.</p>
          ) : (
            achievements.map((badge) => (
              <Badge key={badge} variant="secondary" className="text-xs">
                {badge.replace(/_/g, " ")}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
