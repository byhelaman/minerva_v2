// Supabase Edge Function: zoom-webhook
// Handles incoming webhooks from Zoom
//
// POST / - Receive and process Zoom webhook events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts"

const ZOOM_WEBHOOK_SECRET = Deno.env.get('ZOOM_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// SECURITY: Restrict CORS - webhooks come from Zoom servers, not browsers
// Server-to-server requests (no Origin header) are always allowed
// Browser requests are restricted to known origins
const ALLOWED_ORIGINS = [
    'http://localhost:1420',
    'tauri://localhost',
    'https://tauri.localhost',
]

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('origin') || ''
    const isAllowed = ALLOWED_ORIGINS.includes(origin)
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp',
    }
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req)

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.text()
        const signature = req.headers.get('x-zm-signature')
        const timestamp = req.headers.get('x-zm-request-timestamp')

        // Validate webhook signature
        if (!verifySignature(body, signature, timestamp)) {
            console.error('Invalid webhook signature')
            return new Response('Unauthorized', { status: 401 })
        }

        const event = JSON.parse(body)

        // Handle Zoom URL validation challenge
        if (event.event === 'endpoint.url_validation') {
            const plainToken = event.payload.plainToken
            const hash = createHmac('sha256', ZOOM_WEBHOOK_SECRET)
                .update(plainToken)
                .digest('hex')

            return new Response(JSON.stringify({
                plainToken,
                encryptedToken: hash
            }), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Store event in database
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        await supabase
            .from('webhook_events')
            .insert({
                event_type: event.event,
                payload: event.payload,
                processed: false
            })

        // Process event based on type
        await processEvent(supabase, event)

        return new Response('OK', { status: 200 })

    } catch (error) {
        console.error('Webhook error:', error)
        return new Response('Error', { status: 500 })
    }
})

function verifySignature(body: string, signature: string | null, timestamp: string | null): boolean {
    if (!signature || !timestamp || !ZOOM_WEBHOOK_SECRET) {
        return false
    }

    const timestampMs = parseInt(timestamp) * 1000
    const now = Date.now()
    if (Math.abs(now - timestampMs) > 5 * 60 * 1000) {
        console.error('Webhook timestamp too old')
        return false
    }

    const message = `v0:${timestamp}:${body}`
    const hash = createHmac('sha256', ZOOM_WEBHOOK_SECRET)
        .update(message)
        .digest('hex')
    const expectedSignature = `v0=${hash}`

    return signature === expectedSignature
}

async function processEvent(supabase: any, event: any): Promise<void> {
    const eventType = event.event
    const payload = event.payload

    console.log(`Processing event: ${eventType}`)

    try {
        switch (eventType) {
            // ========== USER EVENTS ==========
            case 'user.created':
            case 'user.updated':
                await upsertUser(supabase, payload.object)
                break

            case 'user.deleted':
            case 'user.deactivated':
                await deleteUser(supabase, payload.object.id)
                break

            // ========== MEETING EVENTS ==========
            case 'meeting.created':
            case 'meeting.updated':
                await upsertMeeting(supabase, payload.object)
                break

            case 'meeting.deleted':
                await deleteMeeting(supabase, payload.object.id)
                break

            case 'meeting.started':
                console.log(`Meeting started: ${payload.object.id}`)
                break

            case 'meeting.ended':
                console.log(`Meeting ended: ${payload.object.id}`)
                break

            default:
                console.log(`Unhandled event type: ${eventType}`)
        }

        // Mark event as processed
        await supabase
            .from('webhook_events')
            .update({
                processed: true,
                processed_at: new Date().toISOString()
            })
            .eq('event_type', eventType)
            .order('created_at', { ascending: false })
            .limit(1)

    } catch (error) {
        console.error(`Error processing ${eventType}:`, error)
    }
}

// ========== USER HANDLERS ==========
async function upsertUser(supabase: any, user: any): Promise<void> {
    const userRecord = {
        id: user.id,
        email: user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        display_name: user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        synced_at: new Date().toISOString()
    }

    const { error } = await supabase
        .from('zoom_users')
        .upsert(userRecord, { onConflict: 'id' })

    if (error) {
        console.error('Error upserting user:', error)
    } else {
        console.log(`User upserted: ${user.email}`)
    }
}

async function deleteUser(supabase: any, userId: string): Promise<void> {
    const { error } = await supabase
        .from('zoom_users')
        .delete()
        .eq('id', userId)

    if (error) {
        console.error('Error deleting user:', error)
    } else {
        console.log(`User deleted: ${userId}`)
    }
}

// ========== MEETING HANDLERS ==========
async function upsertMeeting(supabase: any, meeting: any): Promise<void> {
    // Build record with only non-null fields to avoid overwriting existing data
    // This is important for meeting.updated events which may not include all fields
    const meetingRecord: any = {
        meeting_id: meeting.id,
        synced_at: new Date().toISOString()
    }

    // Only add fields if they have values (avoid overwriting with null)
    if (meeting.uuid) meetingRecord.uuid = meeting.uuid
    if (meeting.host_id) meetingRecord.host_id = meeting.host_id
    if (meeting.topic) meetingRecord.topic = meeting.topic
    if (meeting.type !== undefined) meetingRecord.type = meeting.type
    if (meeting.start_time) meetingRecord.start_time = meeting.start_time
    if (meeting.duration) meetingRecord.duration = meeting.duration
    if (meeting.timezone) meetingRecord.timezone = meeting.timezone
    if (meeting.join_url) meetingRecord.join_url = meeting.join_url

    console.log('Upserting meeting:', meeting.id, 'topic:', meeting.topic || '(not provided)')

    const { error } = await supabase
        .from('zoom_meetings')
        .upsert(meetingRecord, { onConflict: 'meeting_id' })

    if (error) {
        console.error('Error upserting meeting:', error)
    } else {
        console.log(`Meeting upserted: ${meeting.id}`)
    }
}

async function deleteMeeting(supabase: any, meetingId: number): Promise<void> {
    const { error } = await supabase
        .from('zoom_meetings')
        .delete()
        .eq('meeting_id', meetingId)

    if (error) {
        console.error('Error deleting meeting:', error)
    } else {
        console.log(`Meeting deleted: ${meetingId}`)
    }
}
