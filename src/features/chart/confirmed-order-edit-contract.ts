import { z } from "zod";

export const orderFinancialValuesSchema = z.object({
  billingName: z.string().trim().min(1).max(200),
  billingQuantity: z.number().finite().positive().max(999999999.999).multipleOf(0.001),
  unitPriceKrw: z.number().finite().nonnegative().max(9999999999.99).multipleOf(0.01),
  taxClass: z.enum(["taxable", "non_taxable"]),
  billingReflectionEnabled: z.boolean(),
  adjustmentSource: z.enum(["amount", "percent"]).nullable(),
  adjustmentAmountKrw: z.number().finite().int(),
  adjustmentPercent: z.number().finite().min(-100).max(10000),
  adjustmentReason: z.string().max(500),
}).strict();
export type OrderFinancialValues = z.infer<typeof orderFinancialValuesSchema>;
export const confirmedOrderEditSchema = z.object({
  orderId: z.uuid(), chartId: z.uuid(), commandId: z.uuid(), expectedVersion: z.string().min(1).max(100),
  clinical: z.object({ detailInputs: z.record(z.string(), z.unknown()), detailSchemaVersion: z.number().int().positive(),
    actualDispenseMode: z.enum(["automatic", "manual"]), actualDispenseQuantity: z.number().finite().positive().optional(),
  }).strict().optional(),
  financial: orderFinancialValuesSchema.partial().optional(),
  reason: z.string().trim().max(500),
}).strict().refine(v => !v.clinical || v.reason.length >= 3, { path: ["reason"], message: "업무 수정 사유는 3자 이상 입력해 주세요." });
export const confirmedOrderContextSchema = z.object({
  orderId: z.uuid(), chartId: z.uuid(), version: z.string(), detailInputs: z.record(z.string(), z.unknown()),
  calculationOutputs: z.record(z.string(), z.unknown()),
  detailSchemaVersion: z.number().int(), taskStatus: z.string(), billingStage: z.enum(["before", "requested", "locked"]),
  financial: orderFinancialValuesSchema.nullable(), canEditClinical: z.boolean(), canEditFinancial: z.boolean(),
  pendingFinancial: orderFinancialValuesSchema.nullable().optional(),
  actualDispenseMode: z.enum(["automatic", "manual"]), actualDispenseQuantity: z.number().nullable(),
});
export type ConfirmedOrderContext = z.infer<typeof confirmedOrderContextSchema>;
export const confirmedOrderErrors: Record<string, string> = {
  permission_missing: "이 내용을 수정할 권한이 없어요.", current_assignee_required: "현재 수납 담당자만 확인할 수 있어요.",
  revision_conflict: "다른 사람이 내용을 변경했어요. 입력은 보존했어요. 최신 내용을 다시 조회해 주세요.",
  idempotency_conflict: "같은 요청의 내용이 달라졌어요. 최신 내용을 다시 조회해 주세요.",
  payment_locked: "결제 처리 중이거나 완료된 건이에요. 수납 정정·환불 경로를 이용해 주세요.",
  order_unavailable: "수정 가능한 조제·처치 오더를 찾지 못했어요.",
  invalid_input: "입력값을 확인해 주세요.", billing_review_required: "기존 수납 검토를 먼저 처리해 주세요.",
  billing_owner_required: "세트의 청구 담당 항목에서 금액을 수정해 주세요.",
  unavailable: "내용을 불러오거나 저장하지 못했어요. 다시 시도해 주세요.",
};

export const orderFinancialLabels: Record<keyof OrderFinancialValues, string> = {
  billingName: "청구명", billingQuantity: "청구 수량", unitPriceKrw: "단가", taxClass: "과세", billingReflectionEnabled: "청구 반영",
  adjustmentSource: "할인·할증 방식", adjustmentAmountKrw: "할인·할증 (원)", adjustmentPercent: "할인·할증 (%)", adjustmentReason: "사유",
};
export const formatOrderFinancialValue = (value: unknown) => value === "amount" ? "금액" : value === "percent" ? "비율" : value === null ? "없음" : value === "taxable" ? "과세" : value === "non_taxable" ? "면세" : typeof value === "boolean" ? value ? "반영" : "제외" : String(value);
