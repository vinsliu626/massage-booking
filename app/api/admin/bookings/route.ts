import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!process.env.ADMIN_SECRET) return unauthorized();
  if (key !== process.env.ADMIN_SECRET) return unauthorized();
  if (!prisma) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  }

  const list = await prisma.booking.findMany({
    orderBy: [{ date: "desc" }, { time: "desc" }],
  });

  return NextResponse.json({ ok: true, list });
}
