import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function getMailerEnv() {
  return {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "",
    FROM_EMAIL: process.env.FROM_EMAIL ?? "",
    APP_URL: process.env.APP_URL ?? "",
  };
}
