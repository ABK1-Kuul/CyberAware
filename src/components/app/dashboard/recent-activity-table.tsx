import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { AuditLog } from "@/lib/types"
import { formatDistanceToNow } from 'date-fns'

export function RecentActivityTable({ data }: { data: AuditLog[] }) {
  const getActionBadge = (action: string) => {
    if (action.includes('Completed')) return <Badge variant="secondary" className="bg-green-500/10 text-green-400">Completed</Badge>
    if (action.includes('Assigned')) return <Badge variant="secondary" className="bg-blue-500/10 text-blue-400">Assigned</Badge>
    if (action.includes('Uploaded')) return <Badge variant="secondary" className="bg-purple-500/10 text-purple-400">System</Badge>
    if (action.includes('Started')) return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400">Started</Badge>
    return <Badge variant="outline">{action}</Badge>
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Recent Activity</CardTitle>
        <CardDescription>A log of recent activities in the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  {log.actor ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={log.actor.avatarUrl} alt={log.actor.name} data-ai-hint="person portrait" />
                        <AvatarFallback>{log.actor.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{log.actor.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>?</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-muted-foreground">System</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>{getActionBadge(log.action)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
