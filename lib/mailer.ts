import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
export const FROM_EMAIL = process.env.FROM_EMAIL!; // 例如 "Bookings <onboarding@resend.dev>"
export const APP_URL = process.env.APP_URL!;       // 例如 "https://xxx.vercel.app"
