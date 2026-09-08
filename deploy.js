#!/usr/bin/env node
// One-click deploy to Vercel — reads your .env.local, uploads every value to
// Vercel, and deploys to production. Run this by double-clicking deploy.bat.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ENV_FILE = path.join(ROOT, ".env.local");
const VERCEL_PROJECT_FILE = path.join(ROOT, ".vercel", "project.json");
const VERCEL = "vercel@latest";

// Only these keys are ever pushed to Vercel — anything else in .env.local
// (like Vercel CLI's own VERCEL_OIDC_TOKEN) is left alone.
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

// NEXT_PUBLIC_SUPABASE_ANON_KEY specifically has, four separate times now,
// come back removed-but-not-successfully-re-added after this script's usual
// remove-then-add cycle — every other managed key has been reliable. Rather
// than keep re-triggering whatever that is, this key is only ever removed
// and re-added when it's actually wrong or missing; if it's already correct
// on Vercel, this leaves it alone entirely.
const TOUCH_ONLY_IF_WRONG = new Set(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

function run(args, opts = {}) {
  console.log(`\n> npx ${args.join(" ")}`);
  const res = spawnSync("npx", args, { stdio: "inherit", shell: true, cwd: ROOT, ...opts });
  if (res.status !== 0) {
    console.error(`\nStep failed (npx ${args.join(" ")}). Fix the issue above and run deploy.bat again.`);
    process.exit(res.status || 1);
  }
}

// True synchronous sleep (no subprocess) — used to give Vercel's API a
// moment to settle between removing and re-adding the same env var, and
// between retry attempts.
function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function isLoggedIn() {
  const res = spawnSync("npx", [VERCEL, "whoami"], { stdio: "pipe", shell: true, cwd: ROOT });
  return res.status === 0;
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

console.log("=== FlockBooks Deploy ===");

if (!fs.existsSync(ENV_FILE)) {
  console.error("\n.env.local not found in this folder. Follow SETUP.md first, then run this again.");
  process.exit(1);
}

const env = parseEnvFile(ENV_FILE);

if (env.NEXT_PUBLIC_SITE_URL && env.NEXT_PUBLIC_SITE_URL.includes("localhost")) {
  console.log(
    "\nNote: NEXT_PUBLIC_SITE_URL in .env.local is still set to localhost.\n" +
    "That's fine for a first deploy — afterwards, update it to your real\n" +
    "address (e.g. https://flockbooks.net) and run deploy.bat again so\n" +
    "invite emails link to the right place."
  );
}

if (isLoggedIn()) {
  console.log("\nStep 1: Already signed in to Vercel.");
} else {
  console.log("\nStep 1: Sign in to Vercel (a browser tab will open)...");
  run([VERCEL, "login"]);
}

if (fs.existsSync(VERCEL_PROJECT_FILE)) {
  console.log("\nStep 2: Already linked to your Vercel project.");
} else {
  console.log("\nStep 2: First-time setup — answer Vercel's few questions below");
  console.log("(pick your team/scope if asked, and accept the defaults otherwise):");
  run([VERCEL, "link"]);
}

console.log("\nStep 3: Uploading your settings to Vercel...");

function setKey(key, value) {
  // Remove any old value first so re-runs always match .env.local exactly.
  spawnSync("npx", [VERCEL, "env", "rm", key, "production", "--yes"], {
    stdio: "ignore", shell: true, cwd: ROOT,
  });
  sleepSync(500); // this key's removal and re-add can race on Vercel's end without a beat between them
  return spawnSync("npx", [VERCEL, "env", "add", key, "production"], {
    input: value + "\n", stdio: ["pipe", "pipe", "pipe"], shell: true, cwd: ROOT,
  });
}

// The Vercel CLI has, three times now, exited 0 on `env add` for a key that
// never actually shows up on Vercel afterward (a race on Vercel's own end,
// not something retrying the same command fixes on its own) — so a
// successful exit code is never trusted by itself. `vercel env pull` writes
// the real values Vercel currently has for Production to a plain KEY=value
// file, which this parses with the same parser used for .env.local and
// compares directly — far more reliable than screen-scraping `vercel env
// ls`'s formatted table (tried that first; its padding/columns aren't
// worth reverse-engineering blind).
const VERIFY_FILE = path.join(ROOT, ".vercel", ".deploy-verify.env");
function pullProductionEnv() {
  // --environment and its value as separate args, not one "--environment=production"
  // string — cheap insurance against the CLI's arg parser splitting on "=" differently
  // than expected under shell:true.
  const res = spawnSync(
    "npx", [VERCEL, "env", "pull", VERIFY_FILE, "--environment", "production", "--yes"],
    { stdio: "pipe", shell: true, cwd: ROOT }
  );
  if (res.status !== 0 || !fs.existsSync(VERIFY_FILE)) {
    console.warn("    (vercel env pull did not run cleanly — output below)");
    console.warn("    " + (res.stderr || res.stdout || "").toString().trim().split("\n").join("\n    "));
    return null; // inconclusive
  }
  try {
    return parseEnvFile(VERIFY_FILE);
  } catch (e) {
    console.warn("    (could not read back " + VERIFY_FILE + ": " + e.message + ")");
    return null;
  }
}

// Safe-ish preview for the console: length + a short prefix, never the full
// value, so a screenshot of this doesn't hand out working secrets — but
// enough to tell truncation, wrong-environment, or stray-whitespace apart at
// a glance.
function preview(v) {
  if (v === undefined) return "MISSING";
  if (v === "") return "EMPTY STRING";
  return `${v.length} chars, starts "${v.slice(0, 10)}", ends "${v.slice(-6)}"`;
}

// `vercel env pull` can't return the plaintext of a key stored as "Secret"
// type — Vercel never lets that value be read back outside a real build,
// by design, not a bug. So a pull mismatch alone doesn't prove a key is
// missing; it also happens for every correctly-set Secret-type key. This
// checks `vercel env ls production` for the key merely *existing* (any line
// that, trimmed, starts with the key name) as a second, weaker signal —
// loose on purpose, since we only need "is it there at all", not its value.
function remoteKeyListed(key) {
  const ls = spawnSync("npx", [VERCEL, "env", "ls", "production"], {
    stdio: "pipe", shell: true, cwd: ROOT,
  });
  if (ls.status !== 0) return null; // inconclusive
  const out = (ls.stdout || "").toString().replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  return out.split(/\r?\n/).some((line) => {
    const t = line.trim();
    return t === key || t.startsWith(key + " ") || t.startsWith(key + "\t");
  });
}

// A read of what's on Vercel right now, before touching anything — lets the
// touch-only-if-wrong keys skip the remove/re-add cycle entirely when
// they're already correct.
const before = pullProductionEnv();

const addResults = {};
for (const key of MANAGED_KEYS) {
  const value = env[key];
  if (!value) {
    console.warn(`  - ${key}: MISSING from .env.local, skipping`);
    continue;
  }
  if (TOUCH_ONLY_IF_WRONG.has(key) && before && before[key] === value) {
    console.log(`  - ${key}: already correct on Vercel, leaving it alone`);
    addResults[key] = true;
    continue;
  }
  process.stdout.write(`  - ${key}\n`);
  const add = setKey(key, value);
  addResults[key] = add.status === 0;
  if (add.status !== 0) {
    console.warn("    vercel env add reported an error (checking anyway):");
    console.warn("    " + (add.stderr || add.stdout || "").toString().trim().split("\n").join("\n    "));
  }
}

console.log("\nVerifying everything actually landed on Vercel...");
sleepSync(1500); // give the API a moment to settle after the last write
let failedKeys = [];
let remote = pullProductionEnv();

function classify(keysToCheck) {
  // Pull-match: definitely fine. Pull-mismatch: check `ls` for mere
  // presence — if it's listed AND the add reported success, treat it as a
  // Secret-type key we simply can't read back (fine). Only a key that's
  // truly absent from `ls` too counts as a real failure.
  const confirmed = [];
  const stillFailing = [];
  for (const key of keysToCheck) {
    if (remote && remote[key] === env[key]) {
      confirmed.push(key);
      continue;
    }
    const listed = remoteKeyListed(key);
    if (listed && addResults[key]) {
      console.warn(`    ${key}: value unreadable (likely Secret-type), but confirmed present via \`vercel env ls\` and the upload reported success — treating as OK.`);
      confirmed.push(key);
    } else {
      stillFailing.push(key);
    }
  }
  return { confirmed, stillFailing };
}

if (remote === null) {
  console.warn(
    "  Could not verify (`vercel env pull` itself failed to run) — proceeding on trust.\n" +
    "  If the site breaks after this deploy, that's the first thing to check."
  );
} else {
  const mismatched = MANAGED_KEYS.filter((k) => env[k] && remote[k] !== env[k]);
  if (mismatched.length > 0) {
    console.warn(`  Pull didn't match on: ${mismatched.join(", ")} — checking each one further...`);
    const { stillFailing } = classify(mismatched);
    failedKeys = stillFailing;

    if (failedKeys.length > 0) {
      console.warn(`  Genuinely unresolved: ${failedKeys.join(", ")} — retrying once...`);
      for (const key of failedKeys) {
        const add = setKey(key, env[key]);
        addResults[key] = add.status === 0;
      }
      sleepSync(1500);
      remote = pullProductionEnv();
      const retryMismatch = remote === null ? [] : failedKeys.filter((k) => remote[k] !== env[k]);
      failedKeys = remote === null ? [] : classify(retryMismatch).stillFailing;
      if (failedKeys.length > 0) {
        console.warn(`  Still failing after retry: ${failedKeys.join(", ")}`);
        for (const key of failedKeys) {
          console.warn(`    ${key}`);
          console.warn(`      expected (.env.local): ${preview(env[key])}`);
          console.warn(`      got (pulled from Vercel): ${preview(remote ? remote[key] : undefined)}`);
        }
      }
    }
  }
}

fs.rmSync(VERIFY_FILE, { force: true });

if (failedKeys.length > 0) {
  console.error(
    `\n=== Stopped: ${failedKeys.length} setting(s) did not upload correctly: ${failedKeys.join(", ")}. ===\n` +
    "Not deploying — going live without these would break the site the same way\n" +
    "it has before. Check https://vercel.com (your project -> Settings ->\n" +
    "Environment Variables), add any missing ones by hand, then run deploy.bat again."
  );
  process.exit(1);
}
console.log("  All settings confirmed on Vercel.");

console.log("\nStep 4: Deploying to production — this takes a minute or two...");
run([VERCEL, "--prod"]);

console.log("\n=== Done! Your live address is printed above. ===");
