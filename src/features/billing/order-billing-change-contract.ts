import { z } from "zod";
import { orderFinancialValuesSchema } from "@/features/chart/confirmed-order-edit-contract";
export const orderBillingChangeSchema = z.object({ orderId: z.uuid(), proposalId: z.uuid(), version: z.number().int(), before: orderFinancialValuesSchema, proposed: orderFinancialValuesSchema, canApprove: z.boolean(), createdAt: z.string() });
export const orderBillingApprovalSchema = z.object({ invoiceId: z.uuid(), orderId: z.uuid(), proposalId: z.uuid(), version: z.number().int().nonnegative() }).strict();
