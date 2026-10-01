import { setupIndexes } from "../src/lib/db/indexes";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  console.log("Setting up MongoDB indexes...");
  await setupIndexes();
  console.log("Indexes created successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to setup indexes:", err);
  process.exit(1);
});
