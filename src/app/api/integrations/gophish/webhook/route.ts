import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/lib/env'

const webhookPayloadSchema = z.object({
  email: z.string().email(),
  details: z.string(),
})

function verifyWebhookSignature(payload: string, signature: string, secret: string) {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  const signatureBuffer = Buffer.from(signature)
  const digestBuffer = Buffer.from(digest)
  if (signatureBuffer.length !== digestBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(signatureBuffer, digestBuffer)
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-gophish-signature')
    if (!signature) {
      return NextResponse.json({ message: 'Missing signature' }, { status: 401 })
    }

    const rawBody = await request.text()
    if (!verifyWebhookSignature(rawBody, signature, env.GOPHISH_WEBHOOK_SECRET)) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 })
    }

    const parsedJson = JSON.parse(rawBody)
    const payloadResult = webhookPayloadSchema.safeParse(parsedJson)
    if (!payloadResult.success) {
      return NextResponse.json({ message: 'Invalid payload' }, { status: 400 })
    }
    const payload = payloadResult.data

    // In a real app, you would:
    // 1. Validate the payload and a secret key from GoPhish.
    // 2. Look up the user by `payload.email`.
    // 3. Find the appropriate remediation course.
    // 4. Create an `Enrollment` record.
    // 5. Send an email to the user with a link to ` /learn/[enrollmentId]`.
    // 6. Create an `AuditLog` entry.
    
    console.log('GoPhish Webhook Received:', payload)

    if (payload.details === 'failed') {
      console.log(`Simulating course assignment for ${payload.email} due to failed test.`)
    }

    return NextResponse.json({ message: 'Webhook received successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error processing GoPhish webhook:', error)
    return NextResponse.json({ message: 'Error processing webhook' }, { status: 500 })
  }
}
