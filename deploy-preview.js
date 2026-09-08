#!/usr/bin/env node
// Deploys a PREVIEW build — a real, separate URL that isn't flockbooks.net,
// so you (or anyone testing) can click through a change before it goes
// live. Run this by double-clicking deploy-preview.bat.
//
// Honest limitation: this still points at the SAME production Supabase
// database as flockbooks.net — there's no separate staging database yet.
// That means it's genuinely useful for catching things like "the build
// fails" or "this page throws" or "the new layout looks wrong on a
// phone" before they reach real users, but it is NOT safe for testing
// anything that writes data you wouldn't want showing up on the real
// site (a test service record, a test branch, etc.) — those would land
// in the real database. A fully separate staging database (its own
// Supabase project) is a bigger, deliberate step — ask about setting
// that up if you want real data-safe testing, not just code-safe testing.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ENV_FILE = path.join(ROOT, ".env.local");
const VERCEL = "vercel@latest";

const MANAGED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_SITE_URL",
  "SUPER_ADMIN_BOOTSTRAP_EMAIL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_SMS_FROM",
  "TWILIO_WHATSAPP_FROM",
];

function run(args, opts = {}) {
  console.log(`\n> npx ${args.join(" ")}`);
  const res = spawnSync("npx", args, { stdio: "inherit", shell: true, cwd: ROOT, ...opts });
  if (res.status !== 0) {
    console.error(`\nStep failed (npx ${args.join(" ")}).`);
    process.exit(res.status || 1);
  }
}

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function parseEnvFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

console.log("=== FlockBooks Preview Deploy ===");
console.log("(A separate, non-live URL to check a change before running deploy.bat.)");

if (!fs.existsSync(ENV_FILE)) {
  console.error("\n.env.local not found in this folder. Run deploy.bat at least once first.");
  process.exit(1);
}

const env = parseEnvFile(ENV_FILE);

console.log("\nMaking sure preview deploys have the same settings as production...");
for (const key of MANAGED_KEYS) {
  const value = env[key];
  if (!value) continue;
  spawnSync("npx", [VERCEL, "env", "rm", key, "preview", "--yes"], { stdio: "ignore", shell: true, cwd: ROOT });
  sleepSync(300);
  spawnSync("npx", [VERCEL, "env", "add", key, "preview"], {
    input: value + "\n", stdio: ["pipe", "pipe", "pipe"], shell: true, cwd: ROOT,
  });
}

console.log("\nDeploying a preview build — this takes a minute or two...");
run([VERCEL]); // no --prod: this is exactly what makes it a preview deploy

console.log(
  "\n=== Done! The preview URL is printed above (not flockbooks.net). ===\n" +
  "Reminder: it shares the real database — fine for checking the build and\n" +
  "how pages look, not for test data you wouldn't want on the live site."
);
