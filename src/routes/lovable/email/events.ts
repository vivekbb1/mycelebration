import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'

async function record(eventId: string, type: string, recipient: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { error } = await supabaseAdmin
    .from('email_delivery_events')
    .upsert({ event_id: eventId, event_type: type, recipient: recipient.toLowerCase() }, { onConflict: 'event_id' })
  if (error) throw new Error('Could not record email event')
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            // Placeholder handlers — replace each log with the feature's reaction.
            // Throw on failure so the delivery is retried.
            'email.bounced': async (event) => {
              await record(event.event_id, 'bounced', event.data.recipient)
            },
            'email.complaint': async (event) => {
              await record(event.event_id, 'complaint', event.data.recipient)
            },
            'email.unsubscribed': async (event) => {
              await record(event.event_id, 'unsubscribed', event.data.recipient)
            },
          },
        })
        return handler(request)
      },
    },
  },
})
