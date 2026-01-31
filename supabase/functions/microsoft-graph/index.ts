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
                scope: 'offline_access User.Read Files.Read.All Files.ReadWrite.All'
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
        await verifyPermission(req, supabase, 'system.manage')

        const { action, folderId, fileId, sheetId, tableId, range, name, values } = await req.json()

        // === READ ACTIONS ===

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

        if (action === 'list-worksheets' || action === 'list-content') {
            if (!fileId) throw new Error('File ID is required')

            const token = await getAccessToken(supabase)

            const sheetsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets?$select=id,name,position,visibility`
            const tablesUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables?$select=id,name,showHeaders`

            const [sheetsRes, tablesRes] = await Promise.all([
                fetch(sheetsUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(tablesUrl, { headers: { 'Authorization': `Bearer ${token}` } })
            ])

            if (!sheetsRes.ok) {
                const err = await sheetsRes.json()
                if (err.error?.code === 'ItemNotFound') {
                    throw new Error('File not found or not a valid Excel workbook')
                }
                throw new Error(err.error?.message || 'Graph API Error (Sheets)')
            }

            let tables = []
            if (tablesRes.ok) {
                const tablesData = await tablesRes.json()
                tables = tablesData.value
            }

            const sheetsData = await sheetsRes.json()

            const combined = [
                ...sheetsData.value.map((s: any) => ({ ...s, type: 'sheet' })),
                ...tables.map((t: any) => ({ ...t, type: 'table' }))
            ]

            return new Response(JSON.stringify({ value: combined }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (action === 'get-range') {
            if (!fileId) throw new Error('File ID is required')
            if (!sheetId && !tableId) throw new Error('Sheet ID or Table ID is required')

            const token = await getAccessToken(supabase)
            let graphUrl = ''

            if (tableId) {
                graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableId}/range`
            } else {
                graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheetId}/`
                if (range) {
                    graphUrl += `range(address='${range}')`
                } else {
                    graphUrl += `usedRange`
                }
            }

            graphUrl += `?$select=address,columnCount,rowCount,text`

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

        // === WRITE ACTIONS ===

        if (action === 'create-worksheet') {
            if (!fileId || !name) throw new Error('File ID and Name are required')
            const token = await getAccessToken(supabase)

            const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`
            const response = await fetch(graphUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error?.message || 'Failed to create worksheet')
            }

            const data = await response.json()
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (action === 'update-range') {
            if (!fileId || !sheetId || !values) throw new Error('File ID, Sheet ID and Values are required')
            const token = await getAccessToken(supabase)

            // If range is provided, use it (e.g. A1). If not, default to A1 (start of sheet)
            // Note: To overwrite, we usually target A1 and let Excel expand the range.
            const targetRange = range || 'A1'
            const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheetId}/range(address='${targetRange}')`

            const response = await fetch(graphUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values })
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error?.message || 'Failed to update range')
            }

            const data = await response.json()
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (action === 'append-row') {
            if (!fileId || (!tableId && !sheetId) || !values) throw new Error('File ID, Table/Sheet ID and Values are required')
            const token = await getAccessToken(supabase)

            let graphUrl = ''
            // Prefer Table Append if tableId is given (structured)
            if (tableId) {
                graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableId}/rows`
            } else {
                // If only sheetId, we can't easily "append" without knowing the last row.
                // But for pure tables, usually we use table endpoints.
                // If it's just a raw sheet, we might need to find the last used row first.
                // For Incidences, we strongly recommend using a Pivot Table or ListObject (Table).
                // Let's assume Table for now as it's cleaner.
                throw new Error('Append Row currently requires a Table ID')
            }

            const response = await fetch(graphUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values }) // Array of arrays
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error?.message || 'Failed to append row')
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
