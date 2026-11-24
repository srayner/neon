"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { ALERT_RULE_FIELDS, type AlertRules } from "@/lib/alerts/rules";

type Errors = Partial<Record<keyof AlertRules, string>>;

interface AlertRulesFormProps {
  initialRules: AlertRules;
}

export function AlertRulesForm({ initialRules }: AlertRulesFormProps) {
  // Kept as typed text so a half-typed or invalid value reaches the server's
  // validation unchanged and gets its message.
  const [values, setValues] = useState<Record<keyof AlertRules, string>>(
    () =>
      Object.fromEntries(
        ALERT_RULE_FIELDS.map(({ key }) => [key, String(initialRules[key])])
      ) as Record<keyof AlertRules, string>
  );
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [failure, setFailure] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    setErrors({});
    setFailure(null);

    const body = Object.fromEntries(
      ALERT_RULE_FIELDS.map(({ key }) => {
        // Only plain digits count as a number ("1e2" or "0x10" must not
        // become 100 or 16); anything else is sent as typed and rejected.
        const text = values[key].trim();
        return [key, /^-?\d+$/.test(text) ? Number(text) : text];
      })
    );

    try {
      const res = await fetch("/api/settings/alert-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => null);
      if (res.status === 400 && result?.errors) {
        setErrors(result.errors);
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        throw new Error(result?.error || `Failed to save (HTTP ${res.status}).`);
      }
      setStatus("saved");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Failed to save.");
      setStatus("failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {ALERT_RULE_FIELDS.map(({ key, label, unit, help }) => (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="text-sm font-medium text-zinc-400">
            {label}
          </label>
          <div className="flex items-center gap-3">
            <input
              id={key}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={values[key]}
              onChange={(e) => {
                setValues((v) => ({ ...v, [key]: e.target.value }));
                setStatus("idle");
              }}
              aria-invalid={errors[key] ? true : undefined}
              aria-describedby={`${key}-help`}
              className={`w-28 rounded-lg border bg-zinc-800 px-4 py-2.5 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-1 ${
                errors[key]
                  ? "border-red-700 focus:ring-red-600"
                  : "border-zinc-800 focus:border-cyan-700 focus:ring-cyan-700"
              }`}
            />
            <span className="text-sm text-zinc-500">{unit}</span>
          </div>
          {errors[key] && <p className="text-xs text-red-400">{errors[key]}</p>}
          <p id={`${key}-help`} className="text-xs text-zinc-500">
            {help}
          </p>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={status === "saving"}
          className="flex items-center gap-2 rounded-md border border-cyan-700/50 bg-cyan-900/20 px-3.5 py-2 text-sm font-medium text-cyan-300 transition-colors hover:border-cyan-600 hover:bg-cyan-900/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {status === "saving" ? "Saving…" : "Save alert rules"}
        </button>
        {status === "saved" && <span className="text-sm text-emerald-400">Saved.</span>}
        {status === "failed" && failure && <span className="text-sm text-red-400">{failure}</span>}
      </div>
    </form>
  );
}
