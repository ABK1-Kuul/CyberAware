'use client'

import * as React from 'react'
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

function AssignLearnerDialog({ users }: { users: User[] }) {
    const { toast } = useToast()
    
    const handleAssign = () => {
        toast({
            title: "Learner Assigned",
            description: "The selected learner has been enrolled in the course.",
        })
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm"><UserPlus className="mr-2 h-4 w-4"/>Assign Learner</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign Learner</DialogTitle>
                    <DialogDescription>
                        Select a learner to enroll them in this course.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a learner" />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button onClick={handleAssign}>Assign</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export default function CourseTable({ courses, users }: { courses: Course[], users: User[] }) {
  return (
    <Card>
      <CardContent>
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
                        <AssignLearnerDialog users={users}/>
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
      </CardContent>
    </Card>
  )
}
