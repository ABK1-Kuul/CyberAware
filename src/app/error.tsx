'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An unexpected error occurred. Try refreshing the page.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
          <Button className="ml-2" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
