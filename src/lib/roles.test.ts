import { describe, it, expect } from "vitest";
import {
  nextStage, statusLabel, SIGNOFF_STAGES, SIGNOFF_STATUS_FOR_STAGE,
  ROLE_TO_STAGE, SUB_ADMIN_ASSIGNABLE_ROLES, BRANCH_ROLE_LABELS,
} from "./roles";

describe("nextStage", () => {
  it("walks the sign-off chain in the documented order", () => {
    expect(nextStage("waiting_on_accountant")).toBe("accountant");
    expect(nextStage("waiting_on_admin")).toBe("admin");
    expect(nextStage("waiting_on_assembly_pastor")).toBe("assembly_pastor");
    expect(nextStage("waiting_on_regional_overseer")).toBe("regional_overseer");
  });

  it("returns null once a record is closed", () => {
    expect(nextStage("closed")).toBeNull();
  });

  it("returns null for an unrecognized status rather than throwing", () => {
    expect(nextStage("something_unexpected")).toBeNull();
  });
});

describe("statusLabel", () => {
  it("labels a closed record distinctly", () => {
    expect(statusLabel("closed")).toBe("Closed — fully signed off");
  });

  it("labels an in-progress record with who's up next", () => {
    expect(statusLabel("waiting_on_admin")).toBe("Waiting on Admin");
  });
});

describe("SIGNOFF_STAGES consistency", () => {
  it("every stage has a matching status and label — no gaps", () => {
    for (const stage of SIGNOFF_STAGES) {
      expect(SIGNOFF_STATUS_FOR_STAGE[stage]).toBeTruthy();
      // every stage's status round-trips back to that same stage
      expect(nextStage(SIGNOFF_STATUS_FOR_STAGE[stage])).toBe(stage);
    }
  });

  it("every stage has exactly one branch role mapped to it", () => {
    const mappedStages = Object.values(ROLE_TO_STAGE);
    for (const stage of SIGNOFF_STAGES) {
      expect(mappedStages.filter((s) => s === stage)).toHaveLength(1);
    }
  });
});

describe("SUB_ADMIN_ASSIGNABLE_ROLES", () => {
  it("never includes sub_admin itself — a Sub Admin can't grant that role", () => {
    expect(SUB_ADMIN_ASSIGNABLE_ROLES).not.toContain("sub_admin");
  });

  it("never includes regional_overseer — that's Super-Admin-only", () => {
    expect(SUB_ADMIN_ASSIGNABLE_ROLES).not.toContain("regional_overseer");
  });

  it("every assignable role has a display label", () => {
    for (const role of SUB_ADMIN_ASSIGNABLE_ROLES) {
      expect(BRANCH_ROLE_LABELS[role]).toBeTruthy();
    }
  });
});
