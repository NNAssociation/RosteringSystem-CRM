import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { clerkMiddleware } from "./middleware/authMiddleware.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import userRoutes from "./routes/userRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import fleetRoutes from "./routes/fleetRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import depotRoutes from "./routes/depotRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { createServer } from "http";
import { initializeSocket } from "./websocket/socketServer.js";
import { setupRecurringJobs, registerJobProcessor } from "./services/queueService.js";
import { processSLAWarnings } from "./jobs/slaWarningJob.js";
import { processAutoSchedule } from "./jobs/autoScheduleJob.js";
import { seedDefaultSettings } from "./services/settingsService.js";

// Configure environment variables
dotenv.config();
const app = express();

// ── Global Middleware ─────────────────────────────────────
app.use(requestIdMiddleware);

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "x-request-id"],
    optionsSuccessStatus: 200,
  }),
);

app.use(express.json());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
  }),
);
app.use(morgan("common"));

// Clerk auth middleware — initializes auth context on every request
app.use(clerkMiddleware());

const port = process.env.PORT || 8000;

// ── Routes ────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("---RosteringSystem API---");
});

app.use("/users", userRoutes);
app.use("/customers", customerRoutes);
app.use("/fleet", fleetRoutes);
app.use("/bookings", bookingRoutes);
app.use("/dispatch", dispatchRoutes);
app.use("/depots", depotRoutes);
app.use("/settings", settingsRoutes);
app.use("/api/reports", reportRoutes);

// ── Error Handling (must come after routes) ───────────────
app.use(notFound);
app.use(errorHandler);

// ── Server ────────────────────────────────────────────────
const httpServer = createServer(app);
initializeSocket(httpServer);

// Initialize Background Jobs
registerJobProcessor("sla-warning", processSLAWarnings);
registerJobProcessor("auto-schedule", processAutoSchedule);
setupRecurringJobs().catch(err => console.error("Failed to setup recurring jobs", err));
seedDefaultSettings().catch(err => console.error("Failed to seed default settings", err));

httpServer.listen(port, () => {
  console.log(`Server is running on port - ${port}`);
});
