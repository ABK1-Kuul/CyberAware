import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-xl space-y-4">
        <h1 className="text-3xl font-bold font-headline text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">
          This training link is locked to the original device it was opened on. If you believe this is
          an error, please contact your security administrator.
        </p>
        <Button asChild>
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    </div>
  )
}
