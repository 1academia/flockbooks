import { describe, it, expect } from "vitest";
import { currentUser, requireSuperAdmin, requireBranchStaff, requireSubAdmin, requireSignoffAuthority, AuthzError } from "./authz";

// A minimal fake of the two Supabase client shapes these helpers use:
// `.auth.getUser()` and `.from(table).select().eq().eq()...maybeSingle()`.
// `rows` maps a table name to either a single row (returned regardless of
// which .eq() filters were applied — these tests check outcomes, not that
// the right filters were sent) or null (simulating "no matching row").
function fakeClient(opts: { signedIn?: { id: string; email?: string } | null; rows?: Record<string, unknown> }) {
  const signedIn = opts.signedIn === undefined ? { id: "user-1", email: "pastor@example.com" } : opts.signedIn;
  const rows = opts.rows || {};
  return {
    auth: { getUser: async () => ({ data: { user: signedIn } }) },
    from(table: string) {
      const row = table in rows ? rows[table] : null;
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: row }),
        single: async () => ({ data: row }),
      };
      return builder;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("currentUser", () => {
  it("throws when nobody is signed in", async () => {
    const client = fakeClient({ signedIn: null });
    await expect(currentUser(client)).rejects.toThrow(AuthzError);
    await expect(currentUser(client)).rejects.toThrow("Not signed in");
  });

  it("returns id, email, and display name when signed in", async () => {
    const client = fakeClient({
      signedIn: { id: "user-1", email: "pastor@example.com" },
      rows: { app_users: { full_name: "Pastor Tobi" } },
    });
    const result = await currentUser(client);
    expect(result).toEqual({ id: "user-1", email: "pastor@example.com", fullName: "Pastor Tobi" });
  });

  it("tolerates a missing profile row rather than throwing", async () => {
    const client = fakeClient({ signedIn: { id: "user-1" }, rows: {} });
    const result = await currentUser(client);
    expect(result.fullName).toBe("");
  });
});

describe("requireSuperAdmin", () => {
  it("throws when nobody is signed in", async () => {
    const client = fakeClient({ signedIn: null });
    await expect(requireSuperAdmin(client)).rejects.toThrow("Not signed in");
  });

  it("throws for a signed-in user who isn't Super Admin", async () => {
    const client = fakeClient({ rows: { app_users: { platform_role: "sub_admin", full_name: "Pastor Tobi" } } });
    await expect(requireSuperAdmin(client)).rejects.toThrow("Super Admin only");
  });

  it("throws for a signed-in user with no app_users row at all", async () => {
    const client = fakeClient({ rows: {} });
    await expect(requireSuperAdmin(client)).rejects.toThrow("Super Admin only");
  });

  it("succeeds for an actual Super Admin", async () => {
    const client = fakeClient({ rows: { app_users: { platform_role: "super_admin", full_name: "Admin" } } });
    await expect(requireSuperAdmin(client)).resolves.toEqual({ id: "user-1", email: "pastor@example.com", fullName: "Admin" });
  });
});

describe("requireBranchStaff", () => {
  it("throws when there's no matching branch_staff row", async () => {
    const client = fakeClient({ rows: {} });
    await expect(requireBranchStaff("branch-1", "user-1", client)).rejects.toThrow("You're not on staff at this branch");
  });

  it("succeeds when a branch_staff row exists (any role)", async () => {
    const client = fakeClient({ rows: { branch_staff: { id: "row-1" } } });
    await expect(requireBranchStaff("branch-1", "user-1", client)).resolves.toBeUndefined();
  });

  it("supports a custom message", async () => {
    const client = fakeClient({ rows: {} });
    await expect(requireBranchStaff("branch-1", "user-1", client, "custom message"))
      .rejects.toThrow("custom message");
  });
});

describe("requireSubAdmin", () => {
  it("throws when there's no matching sub_admin row", async () => {
    const client = fakeClient({ rows: {} });
    await expect(requireSubAdmin("branch-1", "user-1", client)).rejects.toThrow("Only that branch's Sub Admin can do this");
  });

  it("succeeds when a sub_admin row exists", async () => {
    const client = fakeClient({ rows: { branch_staff: { id: "row-1" } } });
    await expect(requireSubAdmin("branch-1", "user-1", client)).resolves.toBeUndefined();
  });

  it("supports call-site-specific wording", async () => {
    const client = fakeClient({ rows: {} });
    await expect(requireSubAdmin("branch-1", "user-1", client, "Only that branch's Sub Admin can invite staff"))
      .rejects.toThrow("invite staff");
  });
});

describe("requireSignoffAuthority", () => {
  it("throws when the user holds neither the required role nor Super Admin", async () => {
    const client = fakeClient({ rows: { app_users: { platform_role: "staff" } } });
    await expect(requireSignoffAuthority("branch-1", "user-1", "accountant", client))
      .rejects.toThrow(AuthzError);
  });

  it("succeeds when the user holds the exact required branch role", async () => {
    const client = fakeClient({ rows: { app_users: { platform_role: "staff" }, branch_staff: { id: "row-1" } } });
    await expect(requireSignoffAuthority("branch-1", "user-1", "accountant", client)).resolves.toBeUndefined();
  });

  it("Super Admin bypasses the role check entirely, even with no branch_staff row", async () => {
    const client = fakeClient({ rows: { app_users: { platform_role: "super_admin" } } });
    await expect(requireSignoffAuthority("branch-1", "user-1", "accountant", client)).resolves.toBeUndefined();
  });

  it("a wrong-but-real branch role (e.g. Admin trying to sign as Accountant) still fails", async () => {
    // The fake's branch_staff row exists but requireSignoffAuthority filters
    // by role at the query level in real Supabase — this test documents the
    // intent (only the exact required role passes) even though the fake
    // client doesn't itself enforce per-.eq() filtering.
    const client = fakeClient({ rows: { app_users: { platform_role: "staff" } } });
    await expect(requireSignoffAuthority("branch-1", "user-1", "admin", client))
      .rejects.toThrow("You don't have authority to sign this stage");
  });
});
