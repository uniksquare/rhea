import pg from 'pg';
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import dotenv from 'dotenv';

// Prevent pg from converting date/timestamp/timestamptz columns into JS Date objects
pg.types.setTypeParser(1114, (val) => val);
pg.types.setTypeParser(1184, (val) => val);
pg.types.setTypeParser(1082, (val) => val);

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

function sanitizeDbResult(value: any): any {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDbResult);
  }
  if (typeof value === "object") {
    const sanitized: any = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = sanitizeDbResult(value[key]);
    }
    return sanitized;
  }
  return value;
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
    if (res.rows) {
      res.rows = sanitizeDbResult(res.rows);
    }
    return res;
  } finally {
    await client.end();
  }
}
