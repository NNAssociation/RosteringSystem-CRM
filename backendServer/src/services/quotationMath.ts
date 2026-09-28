import { WorkflowError } from "./workflowError.js";

export interface PriceItem { description: string; quantity: number; unitPriceMinor: number }
export function quotationTotals(items: PriceItem[], discountMinor: number, taxBasisPoints: number) {
  if (!items.length || items.length > 100) throw new WorkflowError("Add between 1 and 100 quotation lines");
  const calculated = items.map((item, position) => {
    if (!item.description.trim() || item.description.length > 500 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000 || !Number.isSafeInteger(item.unitPriceMinor) || item.unitPriceMinor < 0) throw new WorkflowError("Invalid quotation line");
    return { ...item, position, totalMinor: item.quantity * item.unitPriceMinor };
  });
  const subtotalMinor = calculated.reduce((sum, i) => sum + i.totalMinor, 0);
  if (!Number.isSafeInteger(discountMinor) || discountMinor < 0 || discountMinor > subtotalMinor) throw new WorkflowError("Discount must be between zero and subtotal");
  if (!Number.isInteger(taxBasisPoints) || taxBasisPoints < 0 || taxBasisPoints > 10000) throw new WorkflowError("Tax must be between 0 and 100 percent");
  const taxMinor = Math.round((subtotalMinor - discountMinor) * taxBasisPoints / 10000);
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor) || subtotalMinor > 1000000000 || totalMinor > 1000000000) throw new WorkflowError("Quotation total exceeds supported limit");
  return { items: calculated, subtotalMinor, taxMinor, totalMinor };
}
