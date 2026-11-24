import { describe, expect, it } from "vitest";
import { formatNotification, ntfyPriority } from "./format";

// docs/alerts.md section 4: each severity's ntfy priority.
describe("ntfyPriority", () => {
  it.each([
    ["critical", 5],
    ["warning", 3],
    ["info", 2],
  ] as const)("%s → %i", (severity, priority) => {
    expect(ntfyPriority(severity)).toBe(priority);
  });
});

// docs/alerts.md section 5: every notification states when the change
// happened, in UTC; the stored message carries no time.
describe("formatNotification", () => {
  const at = new Date("2026-07-15T14:02:30Z"); // BST in the UK: must still say 14:02 UTC

  it("ends the body with the change time in UTC, and adds no time to the message", () => {
    const message = "atlas down";
    const { title, body } = formatNotification({ code: "C1", message, kind: "opened", at });

    expect(title).toBe("C1 Container down");
    expect(body).toBe("atlas down at 14:02 UTC on 15 Jul 2026");
    expect(message).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("marks a resolved notification and uses the resolved time", () => {
    const resolvedAt = new Date("2026-07-15T14:09:00Z");
    const { title, body } = formatNotification({
      code: "C1",
      message: "atlas down",
      kind: "resolved",
      at: resolvedAt,
    });

    expect(title).toBe("Resolved: C1 Container down");
    expect(body).toBe("Resolved: atlas down at 14:09 UTC on 15 Jul 2026");
  });
});
