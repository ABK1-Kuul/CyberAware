"use client"

import { useState, useEffect } from "react"
import type { Course, User } from "@/lib/types"
import CourseTable from "./course-table"
import UploadCourseDialog from "./upload-course-dialog"
import { PaginationLink } from "@/components/ui/pagination-link"

type CoursesSectionProps = {
  initialCourses: Course[]
  users: User[]
  pagination: { total: number; page: number; pageSize: number }
}

export function CoursesSection({ initialCourses, users, pagination }: CoursesSectionProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses)
  useEffect(() => {
    setCourses(initialCourses)
  }, [initialCourses])

  const onEnrollmentOptimistic = (courseId: string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === courseId ? { ...c, enrollmentCount: c.enrollmentCount + 1 } : c
      )
    )
  }

  const onEnrollmentRevert = (courseId: string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === courseId ? { ...c, enrollmentCount: Math.max(0, c.enrollmentCount - 1) } : c
      )
    )
  }

  const onCourseOptimistic = (title: string) => {
    if (pagination.page !== 1) return
    const tempCourse: Course = {
      id: `temp-${Date.now()}`,
      title,
      description: "",
      version: "1.0",
      scormPath: "",
      createdAt: new Date().toISOString(),
      enrollmentCount: 0,
    }
    setCourses((prev) => [tempCourse, ...prev])
  }

  const onCourseRevert = () => {
    setCourses((prev) => prev.filter((c) => !c.id.startsWith("temp-")))
  }

  const onCourseSuccess = (course: { id: string; title: string; version: string }) => {
    setCourses((prev) => {
      const idx = prev.findIndex((c) => c.id.startsWith("temp-"))
      if (idx < 0) return prev
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        id: course.id,
        title: course.title,
        version: course.version,
      }
      return next
    })
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-headline">Courses</h1>
        <UploadCourseDialog
          onOptimisticAdd={onCourseOptimistic}
          onRevert={onCourseRevert}
          onSuccess={onCourseSuccess}
        />
      </div>
      <CourseTable
        courses={courses}
        users={users}
        onEnrollmentOptimistic={onEnrollmentOptimistic}
        onEnrollmentRevert={onEnrollmentRevert}
      />
      <PaginationLink
        basePath="/courses"
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        className="mt-2"
      />
    </div>
  )
}
