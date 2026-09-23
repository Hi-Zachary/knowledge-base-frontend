import { pool, query } from "./db.js";
import { config } from "./config.js";

async function main() {
  await query(
    `INSERT INTO app_user (email, display_name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
    [config.defaultUser.email, config.defaultUser.displayName],
  );

  const categories = ["课程资料", "论文", "项目文档"];
  for (const [sortOrder, name] of categories.entries()) {
    await query(
      `INSERT INTO document_category (category_name, sort_order)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_active = TRUE`,
      [name, sortOrder],
    );
  }

  await pool.end();
  console.log("Seed data is ready.");
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});
