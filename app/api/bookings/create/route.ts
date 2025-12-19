import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { CreateBookingSchema } from "@/lib/validators";
import { getResend, getMailerEnv } from "@/lib/mailer";

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

    // ✅ 冲突：PENDING 或 CONFIRMED 都占用（黄/红都不可再预约）
    const conflict = await prisma.booking.findFirst({
      where: {
        date,
        time,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { id: true, status: true },
    });

    if (conflict) {
      return NextResponse.json(
        { ok: false, error: "This time slot is already taken." },
        { status: 409 }
      );
    }

    const decisionToken = token();

    // ✅ 先写入数据库（让前端立刻变黄）
    const booking = await prisma.booking.create({
      data: { date, time, name, phone, email, decisionToken, status: "PENDING" },
    });

    // ✅ 邮件配置：不配置也允许成功
    const resend = getResend();
    const { ADMIN_EMAIL, FROM_EMAIL, APP_URL } = getMailerEnv();
    const mailerReady = !!resend && !!ADMIN_EMAIL && !!FROM_EMAIL && !!APP_URL;

    // ✅ 只有配置齐全才发邮件；发失败也不影响预约成功
    if (mailerReady) {
      const confirmUrl = `${APP_URL}/admin/decision?token=${decisionToken}&action=confirm`;
      const rejectUrl = `${APP_URL}/admin/decision?token=${decisionToken}&action=reject`;

      try {
        await resend!.emails.send({
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
      } catch (mailErr) {
        // 邮件失败不阻止预约；只在日志里留痕
        console.error("[mailer] failed to send admin email:", mailErr);
      }
    }

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      mailerReady,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
