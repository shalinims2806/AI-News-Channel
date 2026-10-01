/**
 * Long-running scheduler for self-hosted / Docker / VPS deployments (an alternative to Vercel Cron).
 *   npm run worker
 * Runs the ingestion pipeline on INGEST_INTERVAL_CRON (default: every 10 minutes).
 * Note: it cannot call Next's revalidateTag, so pages pick up new data when the 60s query cache expires.
 */
import cron from "node-cron";
import { runIngestion } from "../src/services/ingestion/pipeline";

const schedule = process.env.INGEST_INTERVAL_CRON || "*/10 * * * *";
if (!cron.validate(schedule)) throw new Error(`Invalid INGEST_INTERVAL_CRON: ${schedule}`);

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const s = await runIngestion();
    console.log(`[${new Date().toISOString()}]`, s.skipped ? `skipped: ${s.skipped}` : `new=${s.created} grouped=${s.grouped} dup=${s.duplicates} invalid=${s.invalid} ai=${s.aiProcessed} tg=${s.telegramSent} (${s.durationMs}ms)`);
  } catch (e) {
    console.error("worker tick failed:", e);
  } finally {
    running = false;
  }
}

console.log(`Ingestion worker started. Schedule: ${schedule}`);
cron.schedule(schedule, tick);
void tick();
