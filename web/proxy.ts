import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next 16 proxy convention (formerly middleware.ts). On Vercel, the deprecated
// middleware.ts convention deploys to the EDGE runtime, where a next/server CJS
// dep crashes on __dirname -> site-wide 500. proxy.ts runs on the Node runtime.
// (Pattern copied from ~/Documents/FlowZilla/flowzilla/proxy.ts.)
export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    // Write to request first (required by @supabase/ssr)
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    // Rebuild response so updated cookies are forwarded
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: do not add any logic between createServerClient and getUser().
    // Even a simple mistake here causes random sign-outs.
    const { data: { user } } = await supabase.auth.getUser()

    // Public-read (growth-spec §2d / ORIENTATION-PROMPT item 1): shared links
    // must never hit a login wall. These paths are readable with no session;
    // everything else still redirects to /login. Write actions on these
    // pages are gated at the component/route level, not here.
    const pathname = request.nextUrl.pathname
    const isPublic =
        pathname === '/' ||
        pathname === '/map' || pathname.startsWith('/map/') ||
        pathname === '/match' || pathname.startsWith('/match/') ||
        pathname === '/ledger' || pathname.startsWith('/ledger/') ||
        pathname === '/guide' || pathname.startsWith('/guide/') ||
        pathname === '/crews' || pathname.startsWith('/crews/') ||
        pathname === '/invite' || pathname.startsWith('/invite/') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/auth')

    // Redirect unauthenticated users to /login (skip public paths)
    if (!user && !isPublic) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        // Run on all routes except Next.js internals, static files, and API routes
        // (API routes do their own auth checks via getUser())
        '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
