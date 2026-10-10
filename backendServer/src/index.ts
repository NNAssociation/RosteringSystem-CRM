import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import morgan from "morgan";
import { originAllowed, trustedOrigins } from "./config/trustedOrigins.js";
import { processAutoSchedule } from "./jobs/autoScheduleJob.js";
import { processSLAWarnings } from "./jobs/slaWarningJob.js";
import { clerkMiddleware } from "./middleware/authMiddleware.js";
import { requireEmployee, requireOffice } from "./middleware/employeeAuth.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import depotRoutes from "./routes/depotRoutes.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import fleetRoutes from "./routes/fleetRoutes.js";
import { quotationRouter } from "./routes/quotationRoutes.js";
import { recordLifecycleRouter } from "./routes/recordLifecycleRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { workplaceRouter } from "./routes/workplaceRoutes.js";
import { yardRouter } from "./routes/yardRoutes.js";
import { cleanupAttachments } from "./services/attachmentService.js";
import { startWorkflowWorker } from "./services/emailService.js";
import { processNoticeSchedule } from "./services/noticeService.js";
import { registerJobProcessor, setupRecurringJobs } from "./services/queueService.js";
import { seedDefaultSettings } from "./services/settingsService.js";
import { initializeSocket } from "./websocket/socketServer.js";

// Configure environment variables
dotenv.config();
const app = express();
const origins = trustedOrigins();

// ── Global Middleware ─────────────────────────────────────
app.use(requestIdMiddleware);
app.use((req, res, next) => {
  if (!originAllowed(req.headers.origin, origins)) {
    res.status(403).set("Cache-Control", "no-store").json({ error: "Origin is not allowed" });
    return;
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => callback(null, originAllowed(origin, origins)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "x-request-id"],
    optionsSuccessStatus: 200,
  }),
);

app.use(
  express.json({
    verify: (req, _res, buffer) => {
      if (req.url?.split("?")[0] === "/quotations/webhooks/resend") {
        (req as typeof req & { rawBody?: string }).rawBody = buffer.toString("utf8");
      }
    },
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
  }),
);
// Sanitize query parameters in request logs to prevent token/credential leakage
morgan.token("url", (req) => {
  if (!req.url) return "-";
  try {
    const [path, query] = req.url.split("?");
    if (!query) return path;
    const params = new URLSearchParams(query);
    for (const key of ["token", "key", "secret", "sig", "signature", "auth", "apiKey"]) {
      if (params.has(key)) params.set(key, "[REDACTED]");
    }
    return `${path}?${params.toString()}`;
  } catch {
    return req.url.split("?")[0] || "-";
  }
});
// Public quotation URLs carry bearer capabilities; do not persist them in request logs.
app.use(morgan("common", { skip: (req) => /^\/quotations\/public(?:\/|$)/i.test(req.url) }));

// Clerk auth middleware — initializes auth context on every request
app.use(clerkMiddleware());

const port = process.env.PORT || 8000;

// ── Routes ────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("---RosteringSystem API---");
});

app.use("/dashboard", requireEmployee, requireOffice, dashboardRoutes);
app.use("/users", requireEmployee, requireOffice, recordLifecycleRouter("users"), userRoutes);
app.use(
  "/customers",
  requireEmployee,
  requireOffice,
  recordLifecycleRouter("customers"),
  customerRoutes,
);
app.use("/fleet", requireEmployee, requireOffice, recordLifecycleRouter("fleet"), fleetRoutes);
app.use(
  "/bookings",
  requireEmployee,
  requireOffice,
  recordLifecycleRouter("bookings"),
  bookingRoutes,
);
app.use("/quotations", quotationRouter);
app.use("/dispatch", requireEmployee, requireOffice, dispatchRoutes);
app.use("/yard", yardRouter);
app.use("/depots", requireEmployee, requireOffice, depotRoutes);
app.use("/settings", requireEmployee, requireOffice, settingsRoutes);
app.use(workplaceRouter);

// ── Error Handling (must come after routes) ───────────────
app.use(notFound);
app.use(errorHandler);

// ── Server ────────────────────────────────────────────────
const httpServer = createServer(app);
initializeSocket(httpServer);
startWorkflowWorker();
let workplaceWorkerBusy = false;
const workplaceTimer = setInterval(async () => {
  if (workplaceWorkerBusy) return;
  workplaceWorkerBusy = true;
  try {
    await processNoticeSchedule();
    await cleanupAttachments();
  } catch (error: any) {
    console.error("[Workplace] scheduled work failed", error.code || error.message);
  } finally {
    workplaceWorkerBusy = false;
  }
}, 30000);
workplaceTimer.unref();

// Initialize Background Jobs
registerJobProcessor("sla-warning", processSLAWarnings);
registerJobProcessor("auto-schedule", processAutoSchedule);
setupRecurringJobs().catch((err) => console.error("Failed to setup recurring jobs", err));
seedDefaultSettings().catch((err) => console.error("Failed to seed default settings", err));

httpServer.listen(port, () => {
  console.log(`Server is running on port - ${port}`);
});
