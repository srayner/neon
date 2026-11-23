import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateAndResolvePath } from "./path-utils";

const ROOT = "/srv/backups";

describe("validateAndResolvePath", () => {
  let savedRoot: string | undefined;

  beforeEach(() => {
    savedRoot = process.env.BACKUP_ROOT;
    process.env.BACKUP_ROOT = ROOT;
  });

  afterEach(() => {
    if (savedRoot === undefined) delete process.env.BACKUP_ROOT;
    else process.env.BACKUP_ROOT = savedRoot;
  });

  // Paths inside the backup root resolve to the matching absolute path.
  it.each([
    ["", ROOT],
    [".", ROOT],
    ["server4", path.join(ROOT, "server4")],
    ["server4/db/neon.sql.gz", path.join(ROOT, "server4/db/neon.sql.gz")],
    ["server4/../saturn", path.join(ROOT, "saturn")],
    ["My Backups/2026", path.join(ROOT, "My Backups/2026")],
  ])("resolves %j inside the root", (input, expected) => {
    expect(validateAndResolvePath(input)).toBe(expected);
  });

  // Anything that escapes the root is refused, however it is written.
  it.each([
    ["..", "parent directory"],
    ["../etc/passwd", "relative traversal"],
    ["server4/../../etc", "traversal from a subfolder"],
    ["%2e%2e%2fetc", "URL-encoded traversal"],
    ["/etc/passwd", "absolute path"],
    ["../backups-old", "sibling folder sharing the root's name as a prefix"],
  ])("refuses %j (%s)", (input) => {
    expect(() => validateAndResolvePath(input)).toThrow("Invalid path: access denied");
  });

  // Malformed input is refused before any path is built.
  it("refuses a raw null byte", () => {
    expect(() => validateAndResolvePath("server4\0.sql")).toThrow("contains null bytes");
  });

  it("refuses malformed URI encoding", () => {
    expect(() => validateAndResolvePath("server4%E0%A4%A")).toThrow("malformed URI encoding");
  });

  it("throws when BACKUP_ROOT is not set", () => {
    delete process.env.BACKUP_ROOT;
    expect(() => validateAndResolvePath("server4")).toThrow("BACKUP_ROOT");
  });
});
