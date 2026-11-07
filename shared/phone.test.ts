import { describe, expect, it } from "vitest";
import { formatPhone, isValidPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("accepts every shape a Nigerian shopper might type", () => {
    // The whole point of normalising: these are ONE person, and the UNIQUE
    // index on profiles.phone only enforces that if they all collapse to the
    // same string.
    const forms = [
      "08030000000",
      "0803 000 0000",
      "0803-000-0000",
      "+2348030000000",
      "2348030000000",
      "234 803 000 0000",
      "  08030000000  ",
    ];
    for (const f of forms) {
      expect(normalizePhone(f), f).toBe("2348030000000");
    }
  });

  it("handles the 7, 8 and 9 prefixes", () => {
    expect(normalizePhone("07012345678")).toBe("2347012345678");
    expect(normalizePhone("08123456789")).toBe("2348123456789");
    expect(normalizePhone("09098765432")).toBe("2349098765432");
  });

  it("rejects anything that is not a Nigerian mobile number", () => {
    // A landline, a short code, a foreign number and junk must all be refused
    // rather than stored as a sign-in identifier nobody can use.
    for (const bad of ["", "   ", "12345", "0123456789", "+14155552671", "abc", "0803", "06012345678"]) {
      expect(normalizePhone(bad), bad).toBeNull();
    }
  });

  it("is idempotent — normalising a canonical number changes nothing", () => {
    const once = normalizePhone("0803 000 0000")!;
    expect(normalizePhone(once)).toBe(once);
  });
});

describe("isValidPhone", () => {
  it("agrees with normalizePhone", () => {
    expect(isValidPhone("08030000000")).toBe(true);
    expect(isValidPhone("nope")).toBe(false);
  });
});

describe("formatPhone", () => {
  it("renders a canonical number the way a Nigerian reads it", () => {
    expect(formatPhone("2348030000000")).toBe("0803 000 0000");
  });

  it("passes through anything it cannot format rather than mangling it", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone("weird")).toBe("weird");
  });
});
