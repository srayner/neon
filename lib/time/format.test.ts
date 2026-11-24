import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./format";

// The timeline's UTC/Local toggle: the same stored UTC time, shown either way.
describe("formatTimestamp", () => {
  const at = new Date("2026-07-15T14:02:00Z");

  it.each([
    ["utc", undefined, "15 Jul, 14:02 UTC"],
    ["utc", "Europe/London", "15 Jul, 14:02 UTC"], // a zone is ignored in UTC mode
    ["local", "Europe/London", "15 Jul, 15:02 BST"],
    ["local", "Asia/Tokyo", "15 Jul, 23:02 GMT+9"],
    ["local", "America/Los_Angeles", "15 Jul, 07:02 GMT-7"],
  ] as const)("%s in %s → %s", (mode, zone, expected) => {
    expect(formatTimestamp(at, mode, zone)).toBe(expected);
  });

  it("rolls the date over in a zone ahead of UTC", () => {
    expect(formatTimestamp(new Date("2026-07-15T20:30:00Z"), "local", "Asia/Tokyo")).toBe(
      "16 Jul, 05:30 GMT+9"
    );
  });
});
