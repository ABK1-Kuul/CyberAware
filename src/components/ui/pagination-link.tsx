"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"

type PaginationLinkProps = {
  basePath: string
  page: number
  pageSize: number
  total: number
  className?: string
}

export function PaginationLink({ basePath, page, pageSize, total, className }: PaginationLinkProps) {
  const searchParams = useSearchParams()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const href = (p: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("page", String(p))
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize))
    const q = params.toString()
    return q ? `${basePath}?${q}` : basePath
  }

  if (totalPages <= 1) return null

  return (
    <div className={className}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {total} total
        </span>
        <div className="flex gap-2">
          {hasPrev ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={href(page - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
          )}
          {hasNext ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={href(page + 1)}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
