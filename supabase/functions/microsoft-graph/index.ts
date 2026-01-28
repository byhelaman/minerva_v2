// Supabase Edge Function: microsoft-graph
// Interactúa con Microsoft Graph API (OneDrive)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyPermission } from '../_shared/auth-utils.ts'

const MS_CLIENT_ID = Deno.env.get('MS_CLIENT_ID')!
const MS_CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET')!
const MS_REDIRECT_URI = Deno.env.get('MS_REDIRECT_URI')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ORIGINS = [
    'http://localhost:1420',
    'tauri://localhost',
    'http://tauri.localhost',
]

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('origin') || ''
    const isAllowed = ALLOWED_ORIGINS.includes(origin)
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-app-version',
    }
}

async function getAccessToken(supabase: any) {
    const { data: creds, error } = await supabase
        .from('microsoft_credentials_decrypted')
        .select('*')
        .single()

    if (error || !creds) throw new Error('Not connected to Microsoft')

    const expiresAt = new Date(creds.expires_at).getTime()
    const now = Date.now()

    // Refresh if expired or expiring in < 5 minutes
    if (expiresAt < now + 5 * 60 * 1000) {
        console.log('Refreshing Microsoft Token...')
        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: MS_CLIENT_ID,
                client_secret: MS_CLIENT_SECRET,
                refresh_token: creds.refresh_token,
                grant_type: 'refresh_token',
                scope: 'offline_access User.Read Files.Read.All'
            })
        })

        if (!tokenResponse.ok) {
            throw new Error('Failed to refresh token. Please reconnect.')
        }

        const tokens = await tokenResponse.json()

        // Update credentials
        await supabase.rpc('store_microsoft_credentials', {
            p_user_id: creds.microsoft_user_id,
            p_email: creds.microsoft_email,
            p_name: null, // Don't update name on refresh to avoid graph call
            p_access_token: tokens.access_token,
            p_refresh_token: tokens.refresh_token || creds.refresh_token, // Sometimes refresh token doesn't rotate
            p_scope: tokens.scope,
            p_expires_in: tokens.expires_in
        })

        return tokens.access_token
    }

    return creds.access_token
}

serve(async (req: Request) => {
    const corsHeaders = getCorsHeaders(req)
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        await verifyPermission(req, supabase, 'settings.manage')

        const { action, folderId } = await req.json()

        if (action === 'list-children') {
            const token = await getAccessToken(supabase)
            const targetId = folderId || 'root'

            const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${targetId}/children?$select=id,name,lastModifiedDateTime,file,folder`
            const response = await fetch(graphUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error?.message || 'Graph API Error')
            }

            const data = await response.json()
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })

    } catch (error: any) {
        console.error('Graph Error', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
