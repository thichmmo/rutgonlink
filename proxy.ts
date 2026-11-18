import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isGarbageRequestLog } from "@/lib/request-log-filter";
import { buildSiteUrl, getSiteUrl, isMainAppHostname } from "@/lib/site-config";
import { SHARED_DOMAINS } from "@/lib/shared-domains";
import { GOOGLE_REDIRECT_URL, isGoogleTrafficSource } from "@/lib/traffic-source";

function parseUA(ua: string) {
  const l = ua.toLowerCase();
  let device = "desktop";
  if (/mobile|android|iphone/.test(l)) device = "mobile";
  else if (/tablet|ipad/.test(l)) device = "tablet";
  let browser = "Other";
  if (l.includes("edg/")) browser = "Edge";
  else if (l.includes("chrome")) browser = "Chrome";
  else if (l.includes("firefox")) browser = "Firefox";
  else if (l.includes("safari")) browser = "Safari";
  let os = "Other";
  if (l.includes("windows")) os = "Windows";
  else if (l.includes("android")) os = "Android";
  else if (l.includes("iphone") || l.includes("ipad")) os = "iOS";
  else if (l.includes("mac")) os = "MacOS";
  else if (l.includes("linux")) os = "Linux";
  return { device, browser, os };
}

export async function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const pathname = req.nextUrl.pathname;

  const isLocalRequest = hostname === "localhost" || hostname === "127.0.0.1";
  const cloudflareVisitor = req.headers.get("cf-visitor");
  let visitorScheme: string | undefined;
  if (cloudflareVisitor) {
    try {
      visitorScheme = (JSON.parse(cloudflareVisitor) as { scheme?: string }).scheme;
    } catch {
      visitorScheme = undefined;
    }
  }
  // Keep /robots.txt at 200 on edge HTTP so Cloudflare Managed robots.txt appends
  // our social-crawler Allow rules instead of emitting a broken 200+Location+Refresh,
  // and leave HTTP-01 ACME challenges reachable for cPanel AutoSSL renewals.
  const isHttpPassthroughPath =
    pathname === "/robots.txt" ||
    pathname.startsWith("/.well-known/acme-challenge/");
  // Next.js injects a non-standard Refresh: 0;url=... header on 308 responses;
  // use standard 301 for GET/HEAD and reserve method-preserving 308 for writes.
  const permanentRedirectStatus =
    req.method === "GET" || req.method === "HEAD" ? 301 : 308;

  if (!isLocalRequest && isMainAppHostname(hostname)) {
    const primaryUrl = new URL(getSiteUrl());
    const usesWrongHost = hostname !== primaryUrl.hostname;
    const usesInsecureProtocol = visitorScheme === "http" && !isHttpPassthroughPath;

    // Hợp nhất tín hiệu SEO vào một origin nhưng không ảnh hưởng custom short-link domains.
    if (usesWrongHost || usesInsecureProtocol) {
      const canonicalUrl = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, primaryUrl);
      return NextResponse.redirect(canonicalUrl, permanentRedirectStatus);
    }
  }

  if (SHARED_DOMAINS.includes(hostname) && visitorScheme === "http" && !isHttpPassthroughPath) {
    // Trust the edge's visitor scheme, not Passenger's internal HTTP URL.
    // Clone instead of resolving a pathname: //... must stay on this known host.
    const secureUrl = req.nextUrl.clone();
    secureUrl.protocol = "https:";
    secureUrl.hostname = hostname;
    secureUrl.port = "";
    return NextResponse.redirect(secureUrl, permanentRedirectStatus);
  }

  // Fire-and-forget request log (skip all API calls and static beacon pixel, only log page navigations)
  if (!pathname.startsWith("/api/") && pathname !== "/t.gif" && process.env.LOG_SECRET) {
    const ua = req.headers.get("user-agent") || "";
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";
    if (!isGarbageRequestLog({ method: req.method, path: pathname, userAgent: ua, ip })) {
      const hasSessionCookie =
        req.cookies.has("next-auth.session-token") ||
        req.cookies.has("__Secure-next-auth.session-token");
      const token = hasSessionCookie
        ? await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        : null;
      const { device, browser, os } = parseUA(ua);
      // Shared/custom domains return 404 on /api/*; always post telemetry to the main app origin.
      fetch(buildSiteUrl("/api/internal/log"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-log-key": process.env.LOG_SECRET,
        },
        body: JSON.stringify({
          site: "rutgon",
          method: req.method,
          path: pathname,
          ip,
          country: req.headers.get("cf-ipcountry") || "",
          device,
          browser,
          os,
          userAgent: ua.slice(0, 500),
          referer: (req.headers.get("referer") || "").slice(0, 500),
          userId: (token?.sub as string) || null,
          userEmail: (token?.email as string) || null,
        }),
      }).catch(() => { });
    }
  }

  // Domain chính lấy từ NEXTAUTH_URL; alias tùy chọn lấy từ APP_ALLOWED_HOSTS.
  if (
    isMainAppHostname(hostname) ||
    hostname === process.env.VPS_HOST
  ) {
    // Check auth cho dashboard
    if (pathname.startsWith("/dashboard")) {
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (!token) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }
    if (
      (pathname.startsWith("/p/") ||
        pathname.startsWith("/share/") ||
        pathname.startsWith("/bio/")) &&
      isGoogleTrafficSource({
        userAgent: req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
        url: req.nextUrl,
      })
    ) {
      return NextResponse.redirect(GOOGLE_REDIRECT_URL, {
        status: 302,
        headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" },
      });
    }
    return NextResponse.next();
  }

  // Shared/custom posts send same-origin beacons; expose only this public write endpoint.
  // Its signed token binds the rendered post, popup and host. Dashboard APIs stay blocked.
  if (pathname === "/api/popup-clicks" && req.method === "POST") return NextResponse.next();

  // Domain la: chi cho phep /shortCode
  const blockedPrefixes = [
    "/dashboard",
    "/login",
    "/register",
    "/api",
    "/_next",
    "/favicon.ico",
  ];
  const isBlocked = blockedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (pathname === "/" || isBlocked) {
    return new Response("Not Found", { status: 404 });
  }

  if (
    !isHttpPassthroughPath &&
    isGoogleTrafficSource({
      userAgent: req.headers.get("user-agent"),
      referer: req.headers.get("referer"),
      url: req.nextUrl,
    })
  ) {
    return NextResponse.redirect(GOOGLE_REDIRECT_URL, {
      status: 302,
      headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|t\\.gif).*)"],
};
