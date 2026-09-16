/**
 * Separate entrypoint deployed as its own process (Render/Railway "background
 * worker", per decision D6/T4) — kept apart from src/main.ts (the API process)
 * so the API stays responsive even if job processing is busy/backed up.
 */
import { registerProcessMaterialWorker } from "./processMaterial";

async function main() {
  await registerProcessMaterialWorker();
  console.log("Worker registered and listening for jobs.");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
