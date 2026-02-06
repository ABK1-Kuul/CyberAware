import { getUsers } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserTable } from "@/components/app/users/user-table"

export default async function UsersPage() {
  const { users, total } = await getUsers(1, 50)
  return (
    <div>
      <h1 className="text-3xl font-bold font-headline mb-6">Learners</h1>
      <Card>
        <CardHeader>
          <CardTitle>Learner Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Showing {users.length} of {total} learners.
          </p>
          <UserTable users={users} />
        </CardContent>
      </Card>
    </div>
  )
}
