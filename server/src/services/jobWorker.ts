import os from "node:os";
import { query, transaction } from "../db.js";
import { cleanupExpiredSessions } from "./auth.js";
import { processDocument } from "./documentProcessor.js";

const workerId = `${os.hostname()}-${process.pid}`;
let running = false;

async function recoverStaleJobs() {
  await query(
    `UPDATE document_job
     SET status = 'pending', locked_at = NULL, locked_by = NULL,
         error_message = CONCAT(COALESCE(error_message, ''), ' [worker restarted]')
     WHERE status = 'running' AND locked_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`,
  );
}

async function claimParseJob() {
  return transaction(async (connection) => {
    const [rows] = await connection.query<any[]>(
      `SELECT job_id, document_id
       FROM document_job
       WHERE job_type = 'parse' AND status = 'pending'
       ORDER BY created_at, job_id
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    if (!rows.length) return null;
    await connection.query(
      `UPDATE document_job
       SET status = 'running', attempt_count = attempt_count + 1, started_at = NOW(),
           locked_at = NOW(), locked_by = ?
       WHERE job_id = ?`,
      [workerId, rows[0].job_id],
    );
    return { jobId: String(rows[0].job_id), documentId: String(rows[0].document_id) };
  });
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const job = await claimParseJob();
    if (job) await processDocument(job.documentId, job.jobId);
  } catch (error) {
    console.error("document worker error", error);
  } finally {
    running = false;
  }
}

export function startBackgroundWorkers() {
  void recoverStaleJobs().catch((error) => console.error("job recovery error", error));
  void cleanupExpiredSessions().catch((error) => console.error("session cleanup error", error));
  const timer = setInterval(() => {
    void tick();
    void cleanupExpiredSessions().catch(() => undefined);
  }, 1000);
  timer.unref();
  void tick();
}
