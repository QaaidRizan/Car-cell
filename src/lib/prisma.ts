import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

function getTcpUrl(prismaPostgresUrl: string | undefined) {
  if (!prismaPostgresUrl) return undefined;
  if (!prismaPostgresUrl.startsWith('prisma+postgres://')) return prismaPostgresUrl;

  try {
    const url = new URL(prismaPostgresUrl);
    const apiKey = url.searchParams.get('api_key');
    if (apiKey) {
      const decoded = Buffer.from(apiKey, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      return parsed.databaseUrl;
    }
  } catch (e) {
    console.warn("Failed to parse Prisma Postgres API key", e);
  }
  return prismaPostgresUrl;
}

const prismaClientSingleton = () => {
  const dbUrl = getTcpUrl(process.env.DATABASE_URL);

  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    const pool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  return new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL,
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
