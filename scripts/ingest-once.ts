import { db } from "../src/lib/db";
import { runIngestion } from "../src/services/ingestion/pipeline";

runIngestion()
  .then((s) => { console.log(JSON.stringify(s, null, 2)); return db.$disconnect(); })
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
