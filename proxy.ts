import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isGarbageRequestLog } from "@/lib/request-log-filter";
import { isMainAppHostname } from "@/lib/site-config";

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

  // Fire-and-forget request log (skip all API calls, only log page navigations)
  if (!pathname.startsWith("/api/")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const ua = req.headers.get("user-agent") || "";
    const { device, browser, os } = parseUA(ua);
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";
    if (!isGarbageRequestLog({ method: req.method, path: pathname, userAgent: ua, ip })) {
      fetch(new URL("/api/internal/log", req.url).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-log-key": process.env.LOG_SECRET || "",
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
    return NextResponse.next();
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
