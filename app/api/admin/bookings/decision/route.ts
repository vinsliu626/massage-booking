import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend, getMailerEnv } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

async function sendDecisionEmails(params: {
  booking: any;
  newStatus: "CONFIRMED" | "REJECTED";
}) {
  const resend = getResend();
  const { ADMIN_EMAIL, FROM_EMAIL } = getMailerEnv();
  const mailerReady = !!resend && !!ADMIN_EMAIL && !!FROM_EMAIL;

  if (!mailerReady) return;

  const { booking, newStatus } = params;

  const subjectCustomer =
    newStatus === "CONFIRMED"
      ? "✅ Your massage booking is confirmed"
      : "❌ Your massage booking was rejected";

  const subjectAdmin =
    newStatus === "CONFIRMED"
      ? `Confirmed: ${booking.date} ${booking.time}`
      : `Rejected: ${booking.date} ${booking.time}`;

  // Customer email
  await resend!.emails.send({
    from: FROM_EMAIL,
    to: booking.email,
    subject: subjectCustomer,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>${newStatus === "CONFIRMED" ? "Booking Confirmed" : "Booking Rejected"}</h2>
        <p><b>Date:</b> ${booking.date}</p>
        <p><b>Time:</b> ${booking.time}</p>
        <p><b>Name:</b> ${booking.name}</p>
        <p><b>Phone:</b> ${booking.phone}</p>
        ${
          newStatus === "CONFIRMED"
            ? "<p>Your appointment has been confirmed. We look forward to seeing you!</p>"
            : "<p>Sorry, this time slot is no longer available.</p>"
        }
      </div>
    `,
  });

  // Admin copy
  await resend!.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: subjectAdmin,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <p>Status updated to <b>${newStatus}</b></p>
        <p><b>${booking.date} ${booking.time}</b></p>
        <p>${booking.name} (${booking.phone}, ${booking.email})</p>
      </div>
    `,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const key = body?.key;
  const id = body?.id;
  const action = body?.action as "confirm" | "reject" | undefined;

  if (!process.env.ADMIN_SECRET) return unauthorized();
  if (key !== process.env.ADMIN_SECRET) return unauthorized();

  if (!prisma) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  }
  if (!id || (action !== "confirm" && action !== "reject")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  if (booking.status !== "PENDING") {
    return NextResponse.json({ ok: true, booking, note: "Already processed" });
  }

  let note: string | undefined;
  let newStatus: "CONFIRMED" | "REJECTED" = action === "confirm" ? "CONFIRMED" : "REJECTED";

  // confirm 时做一次并发冲突检查：如果已经有 CONFIRMED，则自动 REJECT
  if (action === "confirm") {
    const conflict = await prisma.booking.findFirst({
      where: { date: booking.date, time: booking.time, status: "CONFIRMED" },
      select: { id: true },
    });

    if (conflict) {
      newStatus = "REJECTED";
      note = "Conflict existed, auto-rejected";
    }
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: newStatus },
  });

  // 发邮件（失败不影响成功）
  try {
    await sendDecisionEmails({ booking: updated, newStatus });
  } catch (err) {
    console.error("[mailer] decision email failed:", err);
  }

  return NextResponse.json({ ok: true, booking: updated, note });
}
