import { describe, expect, it } from "vitest";
import { sanitizeMaterialForClient } from "../../src/modules/materials/router";

describe("sanitizeMaterialForClient", () => {
  it("replaces a failed material's raw internal error message with a generic one", () => {
    const material = {
      id: "mat-1",
      status: "failed",
      errorDetail: "connect ECONNREFUSED 10.0.4.12:5432 at Pool._connect (pg-pool/index.js:45)",
    };

    const sanitized = sanitizeMaterialForClient(material);

    expect(sanitized.errorDetail).not.toContain("10.0.4.12");
    expect(sanitized.errorDetail).not.toContain("pg-pool");
    expect(sanitized).toMatchObject({ id: "mat-1", status: "failed" });
  });

  it("leaves a non-failed material untouched", () => {
    const material = { id: "mat-1", status: "ready", errorDetail: null };
    expect(sanitizeMaterialForClient(material)).toEqual(material);
  });

  it("leaves a failed material with no errorDetail untouched", () => {
    const material = { id: "mat-1", status: "failed", errorDetail: null };
    expect(sanitizeMaterialForClient(material)).toEqual(material);
  });
});
