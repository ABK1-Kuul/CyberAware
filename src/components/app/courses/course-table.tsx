'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, UserPlus } from "lucide-react"
import { format } from "date-fns"
import type { Course, User } from "@/lib/types"
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { useToast } from '@/hooks/use-toast'
import { UI_MESSAGES } from '@/lib/ui-messages'

function AssignLearnerDialog({
  users,
  courseId,
  onOptimistic,
  onRevert,
}: {
  users: User[]
  courseId: string
  onOptimistic?: (courseId: string) => void
  onRevert?: (courseId: string) => void
}) {
    const { toast } = useToast()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [assigning, setAssigning] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState<string>("")

    const handleAssign = async () => {
        if (!selectedUserId) {
            toast({
                title: UI_MESSAGES.assignment.noLearnerTitle,
                description: UI_MESSAGES.assignment.noLearnerDescription,
                variant: "destructive",
            })
            return
        }
        setAssigning(true)
        onOptimistic?.(courseId)
        try {
            const res = await fetch("/api/enrollments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: selectedUserId, courseId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                onRevert?.(courseId)
                toast({
                    title: UI_MESSAGES.assignment.assignFailedTitle,
                    description: data.error ?? UI_MESSAGES.assignment.assignFailedFallback,
                    variant: "destructive",
                })
                return
            }
            toast({
                title: UI_MESSAGES.assignment.assignSuccessTitle,
                description: UI_MESSAGES.assignment.assignSuccessDescription,
            })
            setOpen(false)
            setSelectedUserId("")
            router.refresh()
        } catch {
            onRevert?.(courseId)
            toast({
                title: UI_MESSAGES.assignment.assignFailedTitle,
                description: UI_MESSAGES.assignment.networkError,
                variant: "destructive",
            })
        } finally {
            setAssigning(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm"><UserPlus className="mr-2 h-4 w-4"/>{UI_MESSAGES.assignment.assignTrigger}</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{UI_MESSAGES.assignment.dialogTitle}</DialogTitle>
                    <DialogDescription>{UI_MESSAGES.assignment.dialogDescription}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={assigning}>
                        <SelectTrigger>
                            <SelectValue placeholder={UI_MESSAGES.assignment.selectPlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button onClick={handleAssign} disabled={assigning}>
                        {assigning ? UI_MESSAGES.assignment.assigningButton : UI_MESSAGES.assignment.assignButton}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


import { EmptyState } from "@/components/ui/empty-state"

export default function CourseTable({
  courses,
  users,
  onEnrollmentOptimistic,
  onEnrollmentRevert,
}: {
  courses: Course[]
  users: User[]
  onEnrollmentOptimistic?: (courseId: string) => void
  onEnrollmentRevert?: (courseId: string) => void
}) {
  return (
    <Card>
      <CardContent>
        {courses.length === 0 ? (
          <EmptyState
            message={UI_MESSAGES.emptyStates.noCoursesTitle}
            description={UI_MESSAGES.emptyStates.noCoursesDescription}
          />
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course Title</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Enrollments</TableHead>
              <TableHead>Date Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium">{course.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{course.version}</Badge>
                </TableCell>
                <TableCell>{course.enrollmentCount}</TableCell>
                <TableCell>{format(new Date(course.createdAt), "MMMM d, yyyy")}</TableCell>
                <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                        <AssignLearnerDialog
                          users={users}
                          courseId={course.id}
                          onOptimistic={onEnrollmentOptimistic}
                          onRevert={onEnrollmentRevert}
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>View Enrollments</DropdownMenuItem>
                            <DropdownMenuItem>Edit Course</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">Delete Course</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>
  )
}
