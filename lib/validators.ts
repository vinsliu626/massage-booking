import { z } from "zod";

const gmailRegex = /^[^\s@]+@(gmail\.com|googlemail\.com)$/i;

export const CreateBookingSchema = z.object({
  date: z.string().min(10),     // "YYYY-MM-DD"
  time: z.string().min(4),      // "HH:MM"
  name: z.string().min(1).max(50),
  phone: z.string().min(6).max(30),
  email: z.string().email().regex(gmailRegex, "Only Gmail is allowed."),
});

