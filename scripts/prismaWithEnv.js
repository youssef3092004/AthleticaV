import fs from "fs";
import path from "path";
import process from "process";
import dotenv from "dotenv";
import { spawn } from "child_process";

const [, , envFileArg, ...prismaArgs] = process.argv;

if (!envFileArg || prismaArgs.length === 0) {
  console.error(
    "Usage: node scripts/prismaWithEnv.js <env-file> <prisma-args...>",
  );
  process.exit(1);
}

const envFilePath = path.resolve(process.cwd(), envFileArg);

if (fs.existsSync(envFilePath)) {
  const result = dotenv.config({ path: envFilePath, override: true });
  if (result.error) {
    console.error(`Failed to load env file: ${envFilePath}`);
    console.error(result.error.message);
    process.exit(1);
  }
} else {
  console.error(`Env file not found: ${envFilePath}`);
  process.exit(1);
}

const npmBinary = process.platform === "win32" ? "npm.cmd" : "npm";

const child = spawn(npmBinary, ["exec", "--", "prisma", ...prismaArgs], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Failed to start Prisma CLI");
  console.error(error.message);
  process.exit(1);
});
