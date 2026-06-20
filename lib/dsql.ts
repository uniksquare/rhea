import pg from 'pg';
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let cachedPassword = '';
let tokenExpiry = 0;

async function getPassword(host: string, region: string): Promise<string> {
  const now = Date.now();
  if (!cachedPassword || now >= tokenExpiry) {
    const signer = new DsqlSigner({
      hostname: host,
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    });
    cachedPassword = await signer.getDbConnectAdminAuthToken();
    tokenExpiry = now + 9 * 60 * 1000; // Cache for 9 minutes
  }
  return cachedPassword;
}

export async function queryDsql(text: string, params?: any[]) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set in environment");
  }

  const match = dbUrl.match(/postgresql:\/\/([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error("Failed to parse DATABASE_URL");
  }

  const [, user, host, port, database] = match;
  const region = host.split('.')[2] || 'ap-south-1';

  const password = await getPassword(host, region);

  const client = new pg.Client({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    await client.end();
  }
}
