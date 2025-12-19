import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { CreateBookingSchema } from "@/lib/validators";
import { resend, ADMIN_EMAIL, FROM_EMAIL, APP_URL } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function token() {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { date, time, name, phone, email } = parsed.data;

    if (!prisma) {
  return NextResponse.json(
    { ok: false, error: "Database not configured yet." },
    { status: 500 }
  );
}


    // 先检查该时间是否已被 CONFIRMED 占用
    const conflict = await prisma.booking.findFirst({
      where: { date, time, status: "CONFIRMED" },
    });
    if (conflict) {
      return NextResponse.json(
        { ok: false, error: "This time slot is already booked." },
        { status: 409 }
      );
    }

    const decisionToken = token();

    const booking = await prisma.booking.create({
      data: { date, time, name, phone, email, decisionToken, status: "PENDING" },
    });

    const confirmUrl = `${APP_URL}/admin/decision?token=${decisionToken}&action=confirm`;
    const rejectUrl = `${APP_URL}/admin/decision?token=${decisionToken}&action=reject`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Booking Request: ${date} ${time}`,
      html: `
        <div>
          <h2>New Booking Request</h2>
          <p><b>Date:</b> ${date}</p>
          <p><b>Time:</b> ${time}</p>
          <p><b>Name:</b> ${name}</p>
          <p><b>Phone:</b> ${phone}</p>
          <p><b>Email:</b> ${email}</p>
          <hr/>
          <p>
            <a href="${confirmUrl}">✅ Confirm</a>
            &nbsp; | &nbsp;
            <a href="${rejectUrl}">❌ Reject</a>
          </p>
          <p style="color:#666;font-size:12px;">Booking ID: ${booking.id}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, bookingId: booking.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
