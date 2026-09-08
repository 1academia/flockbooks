// WhatsApp + SMS for invites, via Twilio's REST API directly (no SDK needed).
//
// Needs three environment variables to actually send — until they're set,
// every call here quietly no-ops so an invite with a phone number still
// saves fine and the email still sends either way:
//   TWILIO_ACCOUNT_SID   — from the Twilio Console
//   TWILIO_AUTH_TOKEN    — from the Twilio Console (keep this secret)
//   TWILIO_SMS_FROM      — a Twilio phone number you own, e.g. "+15017122661"
//   TWILIO_WHATSAPP_FROM — a WhatsApp-enabled sender, e.g.
//                          "whatsapp:+14155238886" (Twilio's sandbox number,
//                          fine for testing — see SETUP.md)
// A failure here (bad credentials, Twilio outage, etc.) is logged and
// swallowed, never thrown — a WhatsApp/SMS hiccup should never block the
// invite itself, since the email is what actually lets someone sign in.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SMS_FROM = process.env.TWILIO_SMS_FROM;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

export type InviteTextOpts = {
  to: string; // phone number, e.g. "+2348012345678"
  fullName: string;
  role: string;
  branchName: string;
  invitedByName: string;
};

function inviteMessage(opts: InviteTextOpts) {
  const roleLabel = opts.role.replace(/_/g, " ");
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://flockbooks.net";
  return `Hi ${opts.fullName}, ${opts.invitedByName} has added you as ${roleLabel} at ${opts.branchName} on FlockBooks. ` +
    `Sign in at ${site}/login with this number's email to get started — no password needed, just a one-time code.`;
}

// Loosely normalizes a phone number: strips spaces/dashes, keeps a leading +.
function cleanNumber(raw: string) {
  const trimmed = raw.trim().replace(/[\s-]/g, "");
  return trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/^0+/, "")}`;
}

async function sendTwilioMessage(to: string, from: string, body: string) {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !from) return; // not configured yet — no-op

  try {
    const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) {
      console.error("Twilio send failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Twilio send threw:", err);
  }
}

export async function sendInviteWhatsApp(opts: InviteTextOpts): Promise<void> {
  if (!WHATSAPP_FROM) return;
  const to = `whatsapp:${cleanNumber(opts.to)}`;
  await sendTwilioMessage(to, WHATSAPP_FROM, inviteMessage(opts));
}

export async function sendInviteSMS(opts: InviteTextOpts): Promise<void> {
  if (!SMS_FROM) return;
  await sendTwilioMessage(cleanNumber(opts.to), SMS_FROM, inviteMessage(opts));
}
