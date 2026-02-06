"use client"

import { useState } from "react"
import type { User } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type UserTableProps = {
  users: User[]
}

export function UserTable({ users }: UserTableProps) {
  const { toast } = useToast()
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const resendWelcome = async (userId: string) => {
    setPending((prev) => ({ ...prev, [userId]: true }))
    try {
      const response = await fetch(`/api/admin/users/${userId}/welcome`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to send welcome guide.")
      }
      toast({ title: "Welcome guide sent", description: "Email delivery queued." })
    } catch (error) {
      toast({
        title: "Resend failed",
        description: error instanceof Error ? error.message : "Unable to send welcome guide.",
        variant: "destructive",
      })
    } finally {
      setPending((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Department</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground">
              No learners found.
            </TableCell>
          </TableRow>
        ) : (
          users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.team}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resendWelcome(user.id)}
                  disabled={Boolean(pending[user.id])}
                >
                  {pending[user.id] ? "Sending..." : "Resend Welcome Guide"}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
