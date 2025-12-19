import { prisma } from "@/lib/prisma";
import { resend, ADMIN_EMAIL, FROM_EMAIL } from "@/lib/mailer";

export const dynamic = "force-dynamic";

async function sendResultEmails(booking: any) {
  const subject =
    booking.status === "CONFIRMED"
      ? `✅ Booking Confirmed: ${booking.date} ${booking.time}`
      : `❌ Booking Rejected: ${booking.date} ${booking.time}`;

  // 发给客人
  await resend.emails.send({
    from: FROM_EMAIL,
    to: booking.email,
    subject,
    html: `
      <div>
        <h2>${booking.status === "CONFIRMED" ? "Booking Confirmed" : "Booking Rejected"}</h2>
        <p><b>Date:</b> ${booking.date}</p>
        <p><b>Time:</b> ${booking.time}</p>
        <p><b>Name:</b> ${booking.name}</p>
        <p><b>Phone:</b> ${booking.phone}</p>
      </div>
    `,
  });

  // 回执给管理员
  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `[Admin Copy] ${subject}`,
    html: `
      <div>
        <p>Status updated to <b>${booking.status}</b>.</p>
        <p><b>${booking.date} ${booking.time}</b> — ${booking.name} (${booking.phone}, ${booking.email})</p>
      </div>
    `,
  });
}

export default async function DecisionPage({
  searchParams,
}: {
  searchParams: { token?: string; action?: string };
}) {
  const token = searchParams.token;
  const action = searchParams.action;

  if (!token || (action !== "confirm" && action !== "reject")) {
    return <div style={{ padding: 24 }}>Invalid link.</div>;
  }

  if (!prisma) {
  return (
    <div style={{ padding: 24 }}>
      Database not configured yet. Please set DATABASE_URL in Vercel and run
      migrations.
    </div>
  );
}


  const booking = await prisma.booking.findUnique({
    where: { decisionToken: token },
  });

  if (!booking) return <div style={{ padding: 24 }}>Booking not found.</div>;

  // 如果已经处理过
  if (booking.status !== "PENDING") {
    return (
      <div style={{ padding: 24 }}>
        Already processed: <b>{booking.status}</b>
      </div>
    );
  }

  // confirm 时再做一次冲突检查：防止并发
  if (action === "confirm") {
    const conflict = await prisma.booking.findFirst({
      where: {
        date: booking.date,
        time: booking.time,
        status: "CONFIRMED",
      },
    });
    if (conflict) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "REJECTED" },
      });
      return (
        <div style={{ padding: 24 }}>
          Time slot already booked. This request was auto-rejected.
        </div>
      );
    }
  }

  const newStatus = action === "confirm" ? "CONFIRMED" : "REJECTED";

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: newStatus },
  });

  await sendResultEmails(updated);

  return (
    <div style={{ padding: 24 }}>
      Done. Status updated to <b>{newStatus}</b>.
    </div>
  );
}
