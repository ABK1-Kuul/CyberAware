import { getCourses, getUsers } from "@/lib/data"
import CourseTable from "@/components/app/courses/course-table"
import UploadCourseDialog from "@/components/app/courses/upload-course-dialog"

export default async function CoursesPage() {
  const courses = await getCourses()
  const users = await getUsers()

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-headline">Courses</h1>
        <UploadCourseDialog />
      </div>
      <CourseTable courses={courses} users={users} />
    </div>
  )
}
