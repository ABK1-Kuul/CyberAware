import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold font-headline mb-6">Learners</h1>
      <Card>
        <CardHeader>
          <CardTitle>Learner Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">This section is under construction. Here you will be able to manage learners, view their progress across all courses, and organize them into groups.</p>
        </CardContent>
      </Card>
    </div>
  )
}
