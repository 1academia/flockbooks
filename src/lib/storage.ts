import { createAdminClient } from "@/lib/supabase/server";

// Private bucket — create it once in Supabase (Storage > New bucket, name
// exactly "service-photos", leave "Public bucket" OFF). See SETUP.md.
export const SERVICE_PHOTOS_BUCKET = "service-photos";

function extFor(file: File): string {
  const fromType = (file.type.split("/")[1] || "").replace("jpeg", "jpg");
  if (fromType) return fromType;
  const fromName = file.name.split(".").pop();
  return fromName || "jpg";
}

// Uploads a photo of the paper Cash Analysis / Record of Activities sheet
// as evidence it was actually filled in. Returns the storage object path
// (not a public URL — the bucket is private) or null if no file was given.
export async function uploadServicePhoto(
  branchId: string,
  serviceDate: string,
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const admin = createAdminClient();
  const path = `${branchId}/${serviceDate}-${Date.now()}.${extFor(file)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(SERVICE_PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

// Same idea as uploadServicePhoto, for the weekly deposit's teller slip —
// same private bucket, a "deposit-" prefixed name so the two never collide
// inside a branch's folder.
export async function uploadDepositPhoto(
  branchId: string,
  weekStart: string,
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const admin = createAdminClient();
  const path = `${branchId}/deposit-${weekStart}-${Date.now()}.${extFor(file)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(SERVICE_PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

// The bank statement itself — a photo or (more often) a PDF, so this one
// doesn't assume an image content type the way the two above do.
export async function uploadStatementFile(
  branchId: string,
  weekStart: string,
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const admin = createAdminClient();
  const path = `${branchId}/statement-${weekStart}-${Date.now()}.${extFor(file)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(SERVICE_PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(`Statement upload failed: ${error.message}`);
  return path;
}

// The receipt/voucher photo for an outflow (expense) — same private bucket,
// accepts a photo or PDF since receipts come in both.
export async function uploadReceiptFile(
  branchId: string,
  expenseDate: string,
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const admin = createAdminClient();
  const path = `${branchId}/outflow-${expenseDate}-${Date.now()}.${extFor(file)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(SERVICE_PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(`Receipt upload failed: ${error.message}`);
  return path;
}

// A time-limited link to view a private evidence photo. Generate fresh on
// every page render rather than storing it — signed URLs expire.
export async function signedPhotoUrl(path: string | null, expiresInSeconds = 3600): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(SERVICE_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}
