"use client";
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useEmployeeAccess } from "./access";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "checkbox" | "datetime-local" | "number" | "multiselect";
  options?: { value: string | number; label: string }[];
  required?: boolean;
  help?: string;
};
export const options = (values: string[]) =>
  values.map((value) => ({
    value,
    label: value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (c) => c.toUpperCase()),
  }));
export const errorMessage = (e: any) =>
  e?.data?.error || e?.message || "Unable to save. Please try again.";
export function dateInput(value: string | Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function zonedISO(value: string, zone: string) {
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) throw new Error("Enter a valid date and time");
  let instant = target;
  for (let i = 0; i < 4; i++)
    instant += target - Date.parse(`${dateInput(new Date(instant), zone)}:00Z`);
  if (dateInput(new Date(instant), zone) !== value)
    throw new Error(`This time does not exist in ${zone}`);
  return new Date(instant).toISOString();
}
export function WorkflowForm({
  title,
  fields,
  initial = {},
  onSubmit,
  onClose,
  children,
  afterFields,
}: {
  title: string;
  fields: Field[];
  initial?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  onClose: () => void;
  children?: React.ReactNode;
  afterFields?: React.ReactNode;
}) {
  const { timeZone } = useEmployeeAccess();
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        initial[f.name] ?? (f.type === "checkbox" ? false : f.type === "multiselect" ? [] : ""),
      ]),
    ),
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (name: string, value: any) =>
    setValues((previous) => ({ ...previous, [name]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = { ...values };
      for (const f of fields) {
        if (f.type === "datetime-local")
          data[f.name] = values[f.name] ? zonedISO(values[f.name], timeZone) : null;
        if (f.type === "number" || (f.type === "select" && /Id$/.test(f.name)))
          data[f.name] = values[f.name] ? Number(values[f.name]) : null;
      }
      await onSubmit(data);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <DialogBox
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={title}
      maxWidth="sm:max-w-2xl"
      contentClassName="max-h-[75vh] overflow-y-auto"
    >
      <form onSubmit={submit} className="space-y-4">
        {children}
        {fields.map((field) => (
          <div key={field.name} className="space-y-1.5">
            <label
              htmlFor={`field-${field.name}`}
              className="block text-sm font-semibold text-slate-700"
            >
              {field.label}
              {field.required ? " *" : ""}
            </label>
            {field.type === "checkbox" ? (
              <input
                id={`field-${field.name}`}
                type="checkbox"
                checked={Boolean(values[field.name])}
                onChange={(e) => change(field.name, e.target.checked)}
                className="size-5 accent-red-600"
              />
            ) : field.type === "textarea" ? (
              <textarea
                id={`field-${field.name}`}
                required={field.required}
                maxLength={10000}
                rows={4}
                value={values[field.name]}
                onChange={(e) => change(field.name, e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            ) : field.type === "select" || field.type === "multiselect" ? (
              <select
                id={`field-${field.name}`}
                multiple={field.type === "multiselect"}
                required={field.required}
                value={values[field.name]}
                onChange={(e) =>
                  change(
                    field.name,
                    field.type === "multiselect"
                      ? Array.from(e.target.selectedOptions).map((o) => o.value)
                      : e.target.value,
                  )
                }
                className="min-h-10 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
              >
                {field.type === "select" && <option value="">Select…</option>}
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={`field-${field.name}`}
                type={field.type || "text"}
                required={field.required}
                min={field.type === "number" ? 1 : undefined}
                maxLength={field.type === "text" ? 500 : undefined}
                value={values[field.name]}
                onChange={(e) => change(field.name, e.target.value)}
                className="rounded-xl"
              />
            )}
            {field.type === "datetime-local" && (
              <p className="text-xs text-slate-500">Timezone: {timeZone}</p>
            )}
            {field.help && <p className="text-xs text-slate-500">{field.help}</p>}
          </div>
        ))}
        {afterFields}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            type="submit"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </DialogBox>
  );
}
