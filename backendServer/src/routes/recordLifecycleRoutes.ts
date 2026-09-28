import { Router } from "express";
import { requireStaff } from "../middleware/staffAuth.js";
import { changeRecordLifecycle, deletionEligibility, type Resource } from "../services/recordLifecycle.js";
import { cancelBooking, getBookingById } from "../services/bookingService.js";
export function recordLifecycleRouter(resource: Resource) {
  const router = Router();
  const handle = (action: "eligibility" | "deactivate" | "delete") => async (req: any, res: any, next: any) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid record ID" }); return; }
      if (action === "eligibility") { res.json(await deletionEligibility(resource, id)); return; }
      if (req.query.permanent !== undefined && !["true", "false"].includes(req.query.permanent)) { res.status(400).json({ error: "Invalid permanent flag" }); return; }
      const permanent = action === "delete" && req.query.permanent === "true";
      if (resource === "bookings" && !permanent) {
        if (!await getBookingById(id)) { res.status(404).json({ error: "Booking not found" }); return; }
        res.json(await cancelBooking(id));
      } else res.json(await changeRecordLifecycle(resource, id, permanent));
    } catch (e: any) { if (e.status) res.status(e.status).json({ error: e.message }); else next(e); }
  };
  router.get("/:id/deletion-eligibility", requireStaff, handle("eligibility"));
  router.post(`/:id/${resource === "bookings" ? "cancel" : "deactivate"}`, requireStaff, handle("deactivate"));
  router.delete("/:id", requireStaff, handle("delete"));
  return router;
}
