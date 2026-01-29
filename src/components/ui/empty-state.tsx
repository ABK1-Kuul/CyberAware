import { cn } from "@/lib/utils"

type EmptyStateProps = {
  message: string
  description?: string
  className?: string
}

export function EmptyState({ message, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed py-12 px-4 text-center text-muted-foreground",
        className
      )}
    >
      <p className="font-medium text-foreground">{message}</p>
      {description && <p className="mt-1 text-sm">{description}</p>}
    </div>
  )
}
