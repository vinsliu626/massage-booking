import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  // 没配置数据库就先不创建（避免 Vercel build 阶段爆炸）
  if (!process.env.DATABASE_URL) return null;
  return new PrismaClient({ log: ["error", "warn"] });
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma ?? undefined;
}
