import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { encrypt, decrypt } from "@/lib/crypto";

// Helper to mask sensitive keys in the config object
function maskConfig(config: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    const isSensitive = /key|token|secret|password/i.test(key);
    if (isSensitive && typeof value === "string") {
      masked[key] = "••••••••••••";
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// GET: Retrieve all active integrations for the organization
export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;

  try {
    const res = await queryDsql(
      `SELECT instance_id, connector_type, display_name, config_encrypted, status, last_health_check, created_at
       FROM connector_instances
       WHERE org_id = $1
       ORDER BY created_at DESC;`,
      [orgId]
    );

    const instances = res.rows.map((row) => {
      let config: Record<string, any> = {};
      try {
        if (row.config_encrypted) {
          const decrypted = decrypt(row.config_encrypted);
          config = JSON.parse(decrypted);
        }
      } catch (err: any) {
        console.error(`[connectors API] Failed to decrypt config for ${row.instance_id}:`, err.message);
      }

      return {
        instanceId: row.instance_id,
        connectorType: row.connector_type,
        displayName: row.display_name,
        status: row.status,
        lastHealthCheck: row.last_health_check,
        createdAt: row.created_at,
        config: maskConfig(config), // Expose ONLY masked config to frontend client
      };
    });

    return NextResponse.json(instances);
  } catch (err: any) {
    console.error("[connectors API] GET failed:", err.message);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

// POST: Add or Update an integration
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;

  try {
    const { instanceId, connectorType, displayName, config } = await req.json();

    if (!connectorType || !displayName || !config) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let finalConfig = { ...config };

    // If updating an existing config, preserve any unmodified masked secrets
    if (instanceId) {
      const existingRes = await queryDsql(
        "SELECT config_encrypted FROM connector_instances WHERE instance_id = $1 AND org_id = $2;",
        [instanceId, orgId]
      );

      if (existingRes.rows.length > 0) {
        try {
          const decrypted = decrypt(existingRes.rows[0].config_encrypted);
          const decryptedConfig = JSON.parse(decrypted);
          
          // Merge: if value in updated config is masked, restore the original secret value
          for (const [key, value] of Object.entries(config)) {
            if (value === "••••••••••••" && decryptedConfig[key]) {
              finalConfig[key] = decryptedConfig[key];
            }
          }
        } catch (err: any) {
          console.error("[connectors API] Merge original config decryption failed:", err.message);
        }
      }
    }

    // Encrypt the final combined config object
    const serializedConfig = JSON.stringify(finalConfig);
    const encryptedConfig = encrypt(serializedConfig);

    if (instanceId) {
      // Update existing instance
      await queryDsql(
        `UPDATE connector_instances
         SET display_name = $3, config_encrypted = $4, status = 'ACTIVE'
         WHERE instance_id = $1 AND org_id = $2;`,
        [instanceId, orgId, displayName, encryptedConfig]
      );

      return NextResponse.json({ success: true, message: "Integration updated successfully" });
    } else {
      // Insert new instance
      const insertRes = await queryDsql(
        `INSERT INTO connector_instances (org_id, connector_type, display_name, config_encrypted, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         RETURNING instance_id;`,
        [orgId, connectorType, displayName, encryptedConfig]
      );

      return NextResponse.json({
        success: true,
        message: "Integration created successfully",
        instanceId: insertRes.rows[0].instance_id,
      });
    }
  } catch (err: any) {
    console.error("[connectors API] POST failed:", err.message);
    return NextResponse.json({ error: err.message || "Failed to save integration" }, { status: 500 });
  }
}
