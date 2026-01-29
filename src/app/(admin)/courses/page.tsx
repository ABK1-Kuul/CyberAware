import { getCourses, getUsers } from "@/lib/data"
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/lib/constants"
import CourseTable from "@/components/app/courses/course-table"
import UploadCourseDialog from "@/components/app/courses/upload-course-dialog"
import { PaginationLink } from "@/components/ui/pagination-link"

const ASSIGN_DROPDOWN_USER_LIMIT = 500

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))

  const [coursesData, usersData] = await Promise.all([
    getCourses(page, pageSize),
    getUsers(1, ASSIGN_DROPDOWN_USER_LIMIT),
  ])

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-headline">Courses</h1>
        <UploadCourseDialog />
      </div>
      <CourseTable courses={coursesData.courses} users={usersData.users} />
      <PaginationLink
        basePath="/courses"
        page={coursesData.page}
        pageSize={coursesData.pageSize}
        total={coursesData.total}
        className="mt-2"
      />
    </div>
  )
}
