import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import dns from "dns/promises";

const SERVER_IPS = (process.env.VPS_HOST ? [process.env.VPS_HOST] : []);
const SERVER_HOST = (() => {
  try {
    return new URL(process.env.NEXTAUTH_URL || "https://rutgonlink.site").hostname;
  } catch {
    return "rutgonlink.site";
  }
})();

async function checkDomainPoints(domainName: string): Promise<boolean> {
  try {
    // Check A record
    const aRecords = await dns.resolve4(domainName).catch(() => [] as string[]);
    if (aRecords.some((ip) => SERVER_IPS.includes(ip))) return true;

    // Check CNAME pointing to our server
    const cname = await dns
      .resolveCname(domainName)
      .catch(() => [] as string[]);
    if (cname.some((c) => c.replace(/\.$/, "") === SERVER_HOST)) return true;

    return false;
  } catch {
    return false;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const domain = await prisma.domain.findFirst({
    where: { id, userId: user.id },
  });

  if (!domain) {
    return NextResponse.json(
      { error: "Không tìm thấy domain" },
      { status: 404 },
    );
  }

  await prisma.domain.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const domain = await prisma.domain.findFirst({
    where: { id, userId: user.id },
  });

  if (!domain) {
    return NextResponse.json(
      { error: "Không tìm thấy domain" },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));

  // Force-verify action (manual override by user)
  if (body.action === "force-verify") {
    const updated = await prisma.domain.update({
      where: { id },
      data: { verified: true },
      include: { _count: { select: { links: true } } },
    });
    return NextResponse.json(updated);
  }

  // DNS-based verification
  const isVerified = await checkDomainPoints(domain.domain);

  if (!isVerified) {
    return NextResponse.json(
      {
        error: "DNS chưa trỏ đúng. Vui lòng kiểm tra lại bản ghi A hoặc CNAME.",
        verified: false,
      },
      { status: 400 },
    );
  }

  const updated = await prisma.domain.update({
    where: { id },
    data: { verified: true },
    include: { _count: { select: { links: true } } },
  });

  return NextResponse.json({ ...updated, verified: true });
}
