import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/** Server Component / Route Handler client — reads the auth cookie jar. */
export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // called from a Server Component with no response to write to —
                        // safe to ignore because the proxy refreshes sessions too.
                    }
                },
            },
        }
    )
}

/** Service-role client for the GM engine (server-only, never exposed to the client). */
export function createServiceClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return null
    return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}
