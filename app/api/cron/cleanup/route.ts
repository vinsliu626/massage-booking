import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    // 保护：必须带密钥，防止别人随便触发清理
    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "CRON_SECRET not set" }, { status: 500 });
    }
    if (key !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!prisma) {
      return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
    }

    // 30 天前
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ⚠️ 这里假设 Booking 有 createdAt 字段
    const result = await prisma.booking.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    return NextResponse.json({
      ok: true,
      deleted: result.count,
      cutoff: cutoff.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
