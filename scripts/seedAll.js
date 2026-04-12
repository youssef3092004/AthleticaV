import process from "process";
import { spawn } from "child_process";

const SEED_STEPS = [
  "seed:rbac",
  "seed:plans",
  "seed:foods",
  "seed:exercises:file",
  "seed:workout",
  "seed:client-profile",
  "seed:conversation",
  "seed:demo",
];

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runNpmScript = (script) => {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });

    child.on("error", () => {
      resolve(1);
    });
  });
};

const runWithRetry = async (script) => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      const delayMs = BASE_DELAY_MS * 2 ** (attempt - 2);
      console.log(
        `Retrying ${script} (attempt ${attempt}/${MAX_ATTEMPTS}) after ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }

    const code = await runNpmScript(script);
    if (code === 0) {
      return true;
    }
  }

  return false;
};

const main = async () => {
  for (const script of SEED_STEPS) {
    console.log(`\n=== Running ${script} ===`);
    const ok = await runWithRetry(script);
    if (!ok) {
      console.error(
        `\nSeed pipeline failed at ${script} after ${MAX_ATTEMPTS} attempts.`,
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log("\nAll seed steps completed successfully.");
};

main().catch((error) => {
  console.error("seed:all failed", error);
  process.exitCode = 1;
});
