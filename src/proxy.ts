import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";
import { isSupabaseAuthCookie } from "@/lib/supabase/cookie-options";
import { isUserBanned } from "@/lib/auth/user-status";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PRIVATE_ROUTE_PREFIXES = [
  "/dashboard",
  "/clients",
  "/templates",
  "/documents",
  "/notarial-index",
  "/receivables",
  "/settings",
];

// Public auth routes — authenticated users are redirected away from these.
// /update-password is deliberately NOT here: its own page (Server
// Component) decides what to show based on whether a session exists —
// treating it as a plain "auth route" would bounce an already-logged-in
// user away before they could use it from a recovery link.
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

function expireAuthCookies(request: NextRequest, response: NextResponse): void {
  const options = getAuthCookieOptions();
  for (const cookie of request.cookies.getAll()) {
    if (isSupabaseAuthCookie(cookie.name)) {
      response.cookies.set(cookie.name, "", {
        ...options,
        expires: new Date(0),
        maxAge: 0,
      });
    }
  }
}

export async function proxy(request: NextRequest) {
  // supabaseResponse must be returned at the end so session cookies are forwarded.
  // When setAll reassigns it, the new response carries the refreshed tokens.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  // getUser() contacts the Supabase Auth server to validate the JWT on every request.
  // This is required for a reliable session — do not replace with getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Banning a user only blocks *new* sign-ins/refreshes — it does not
  // invalidate an access token already issued (JWTs are validated
  // statelessly and getUser() still returns 200 for it). Checking
  // banned_until here is what actually cuts off access immediately, which
  // matters for revoking a pilot user's session on request.
  const banned = isUserBanned(user);

  const { pathname } = request.nextUrl;

  const isPrivateRoute = PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  if (banned) {
    await supabase.auth.signOut();
  }

  if (banned && pathname.startsWith("/api/")) {
    const response = NextResponse.json({ error: "No autorizado." }, { status: 401 });
    expireAuthCookies(request, response);
    return response;
  }

  if ((!user || banned) && isPrivateRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    if (banned) expireAuthCookies(request, response);
    return response;
  }

  if (user && !banned && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
