import { queryDsql } from "./dsql";

async function inspect() {
  console.log("Inspecting database tables...");
  const tables = ['organizations', 'users', 'api_keys', 'org_settings', 'incidents', 'investigations', 'root_causes', 'fix_patterns'];
  
  for (const table of tables) {
    try {
      const res = await queryDsql(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = $1;`,
        [table]
      );
      console.log(`\nTable: ${table}`);
      if (res.rows.length === 0) {
        console.log("  (does not exist or no columns)");
      } else {
        res.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
      }
    } catch (err: any) {
      console.error(`Error inspecting table ${table}:`, err.message);
    }
  }
}

inspect();
