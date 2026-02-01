import { getCourses, getUsers } from "@/lib/data"
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/lib/constants"
import { CoursesSection } from "@/components/app/courses/courses-section"

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
    <CoursesSection
      initialCourses={coursesData.courses}
      users={usersData.users}
      pagination={{
        total: coursesData.total,
        page: coursesData.page,
        pageSize: coursesData.pageSize,
      }}
    />
  )
}
