import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

declare global {
  var prismaGlobal: PrismaClientInstance | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

let _instance: PrismaClientInstance | undefined;

// Proxy defers createPrismaClient() until first actual DB call (request time),
// not at module import time (which would crash next build page data collection).
const prisma = new Proxy<PrismaClientInstance>({} as PrismaClientInstance, {
  get(_, prop) {
    if (!_instance) {
      _instance = globalThis.prismaGlobal ?? createPrismaClient();
      if (process.env.NODE_ENV !== "production") {
        globalThis.prismaGlobal = _instance;
      }
    }
    return (_instance as any)[prop as string];
  },
});

export default prisma;