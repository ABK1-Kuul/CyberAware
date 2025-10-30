import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold font-headline">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>GoPhish Integration</CardTitle>
          <CardDescription>Configure the webhook endpoint to automate course assignments based on phishing test results.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-mono p-2 bg-muted rounded-md mb-4">
            /api/integrations/gophish/webhook
          </p>
          <Button>Copy Webhook URL</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>Customize the email notifications sent to learners.</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">This section is under construction.</p>
        </CardContent>
      </Card>
    </div>
  )
}
