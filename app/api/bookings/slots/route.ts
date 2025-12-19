import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toISODate(d: Date) {
  // YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  // 如果数据库还没配置，直接返回空
  if (!prisma) {
    return NextResponse.json({ ok: true, dates: [], slots: {} });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start"); // YYYY-MM-DD
  const days = Math.min(Number(searchParams.get("days") || 7), 14);

  const startDate = start ? new Date(`${start}T00:00:00`) : new Date();
  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(toISODate(addDays(startDate, i)));

  // ---- lightweight cleanup (keep last 30 days) ----
try {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.booking.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
} catch (e) {
  console.error("[cleanup] ignored:", e);
}


  const bookings = await prisma.booking.findMany({
    where: {
      date: { in: dates },
      status: { in: ["PENDING", "CONFIRMED"] }, // 只关心占用格子
    },
    select: { date: true, time: true, status: true },
  });

  // slots[date][time] = "PENDING" | "CONFIRMED"
  const slots: Record<string, Record<string, string>> = {};
  for (const d of dates) slots[d] = {};

  for (const b of bookings) {
    if (!slots[b.date]) slots[b.date] = {};
    slots[b.date][b.time] = b.status;
  }

  return NextResponse.json({ ok: true, dates, slots });
}
