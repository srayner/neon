import { describe, expect, it } from "vitest";
import { ALERT_RULE_FIELDS, DEFAULT_ALERT_RULES, validateAlertRules } from "./rules";

// docs/alerts.md section 7.1: every rule is a whole number of at least 1.
describe("validateAlertRules", () => {
  it("accepts whole numbers of at least 1, including the defaults", () => {
    expect(validateAlertRules(DEFAULT_ALERT_RULES)).toEqual({ ok: true, rules: DEFAULT_ALERT_RULES });

    const ones = Object.fromEntries(ALERT_RULE_FIELDS.map(({ key }) => [key, 1]));
    expect(validateAlertRules(ones)).toEqual({ ok: true, rules: ones });
  });

  it.each([
    ["a fraction", 2.5],
    ["text", "5"],
    ["empty", null],
    ["missing", undefined],
    ["not a number", NaN],
  ])("rejects %s as not a whole number", (_, value) => {
    for (const { key } of ALERT_RULE_FIELDS) {
      const result = validateAlertRules({ ...DEFAULT_ALERT_RULES, [key]: value });
      expect(result).toEqual({ ok: false, errors: { [key]: "Must be a whole number." } });
    }
  });

  it.each([0, -1])("rejects %i as below 1", (value) => {
    for (const { key } of ALERT_RULE_FIELDS) {
      const result = validateAlertRules({ ...DEFAULT_ALERT_RULES, [key]: value });
      expect(result).toEqual({ ok: false, errors: { [key]: "Must be at least 1." } });
    }
  });
});
