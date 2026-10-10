import { WorkflowError } from "./workflowError.js";

type IdentityFields = {
  role?: string | null | undefined;
  email?: string | undefined;
  status?: string | undefined;
};

export function assertEmployeeIdentityChange(
  actorRole: string,
  input: IdentityFields,
  current?: IdentityFields,
) {
  if (actorRole === "ADMIN") return;
  if (!current) {
    if (input.role && ["ADMIN", "MANAGER", "DISPATCHER"].includes(input.role)) {
      throw new WorkflowError("Only administrators can grant office access", 403);
    }
    return;
  }
  if (input.role !== undefined && input.role !== current.role) {
    throw new WorkflowError("Only administrators can change employee roles", 403);
  }
  if (input.email !== undefined && input.email !== current.email) {
    throw new WorkflowError("Only administrators can change sign-in email addresses", 403);
  }
  if (input.status === "ACTIVE" && current.status !== "ACTIVE") {
    throw new WorkflowError("Only administrators can reactivate employee access", 403);
  }
}
