import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname } from "node:path";
import { createHash } from "node:crypto";

// Inventory only Git-owned and non-ignored project files; never traverse local secrets or backups.
const files = [...new Set(execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\0").filter(Boolean))].sort();
const manual = new Set([
  "backendServer/src/routes/userRoutes.ts", "backendServer/src/routes/settingsRoutes.ts",
  "backendServer/src/routes/dispatchRoutes.ts", "backendServer/src/controllers/depotController.ts",
  "backendServer/src/controllers/settingsController.ts", "backendServer/src/services/charterPricingService.ts",
  "backendServer/src/validators/charterPricingSchema.ts", "backendServer/src/validators/settingsSchema.ts",
  "backendServer/src/services/workplaceCommon.ts", "backendServer/src/services/timesheetService.ts",
  "backendServer/src/services/migrationService.ts", "backendServer/src/services/recordLifecycle.ts",
  "backendServer/src/services/settingsService.ts", "backendServer/src/services/businessTime.ts",
  "backendServer/src/services/quotationMath.ts", "backendServer/src/tests/timesheets.test.ts",
  "backendServer/src/index.ts", "backendServer/src/config/trustedOrigins.ts",
  "backendServer/src/middleware/authMiddleware.ts", "backendServer/src/middleware/employeeAuth.ts",
  "backendServer/src/middleware/staffAuth.ts", "backendServer/src/middleware/errorMiddleware.ts",
  "backendServer/src/routes/quotationRoutes.ts", "backendServer/src/routes/recordLifecycleRoutes.ts",
  "backendServer/src/controllers/userController.ts", "backendServer/src/validators/userSchema.ts",
  "backendServer/src/services/employeePermissions.ts", "backendServer/src/services/userService.ts",
  "backendServer/src/services/attachmentService.ts", "backendServer/src/services/emailProviders/resend.ts",
  "backendServer/src/websocket/socketServer.ts", "backendServer/src/websocket/dispatchNamespace.ts",
  "backendServer/src/tests/workflowDatabase.test.ts", "backendServer/src/tests/workplaceDatabase.test.ts",
  "backendServer/package.json", "frontend/package.json", "frontend/middleware.ts", "frontend/next.config.ts",
  "frontend/providers/store-provider.tsx", "frontend/providers/app-provider.tsx", "frontend/providers/websocket-provider.tsx",
  "frontend/store/index.ts", "frontend/store/recordChanges.ts", "frontend/store/dispatchUI.slice.ts",
  "frontend/services/api/base-query.ts", "frontend/config/api.ts", "frontend/components/workplace/access.tsx",
  "frontend/lib/workflow-api.ts", "frontend/lib/booking-draft.ts",
  "frontend/components/bookings/hooks/useBookingWorkflow.ts", "frontend/components/bookings/hooks/useQuotationEditor.ts",
  "frontend/components/settings/useCharterPricingSettings.ts", ".github/workflows/ci.yml",
  ".github/workflows/frontend-ci.yml", ".github/workflows/quotation-workflow.yml", ".gitignore",
]);
const patterns = [
  ["explicit-any", /\bany\b/g],
  ["unsafe-sql", /\$(?:queryRawUnsafe|executeRawUnsafe)\b/g],
  ["html-injection-sink", /dangerouslySetInnerHTML|\beval\s*\(/g],
  ["browser-storage", /(?:localStorage|sessionStorage|document\.cookie)/g],
  ["database-list", /\.findMany\s*\(/g],
  ["network-call", /\bfetch\s*\(/g],
];
const rows = files.filter(file => !file.startsWith("docs/audit/inventory.")).map(file => {
  if (!existsSync(file)) return { file, status: "reviewed", depth: "absent from working tree; see deletion evidence and pre-existing changes" };
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith(".example")) return { file, status: "blocked", depth: "secret configuration; values deliberately not read" };
  if (/(^|\/)(generated|node_modules|dist|\.next)\//.test(file)) return { file, status: "generated/vendor-excluded", depth: "generated" };
  const bytes = readFileSync(file);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (![".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css", ".sql", ".yml", ".yaml", ".toml", ".svg", ".example", ""].includes(extname(file))) return { file, status: "reviewed", depth: "automated binary inventory only", bytes: bytes.length, hash };
  const text = bytes.toString("utf8");
  const signals = patterns.flatMap(([label, expression]) => {
    const matches = [...text.matchAll(expression)];
    return matches.length ? [`${label}:${matches.length}`] : [];
  });
  if (file.endsWith(".json") && !file.endsWith("tsconfig.json")) {
    try { JSON.parse(text); } catch { signals.push("json-parse-review"); }
  }
  return { file, status: "reviewed", depth: manual.has(file) ? "manual targeted review + automated scan" : "automated structural scan only; manual review outstanding", lines: text.split(/\r?\n/).length, bytes: bytes.length, signals: signals.join("; "), hash };
});
if (process.argv.includes("--write")) {
  mkdirSync("docs/audit", { recursive: true });
  writeFileSync("docs/audit/inventory.json", JSON.stringify(rows, null, 2) + "\n");
  const fields = ["file", "status", "depth", "lines", "bytes", "signals", "hash"];
  const csv = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  writeFileSync("docs/audit/inventory.csv", [fields.join(","), ...rows.map(row => fields.map(field => csv(row[field])).join(","))].join("\n") + "\n");
}
console.log(JSON.stringify({ total: rows.length, targetedManual: rows.filter(row => row.depth.startsWith("manual")).length, automatedOnly: rows.filter(row => row.depth.startsWith("automated")).length, blocked: rows.filter(row => row.status === "blocked").length }, null, 2));
