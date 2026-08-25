"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import type { AuthSession } from "@/features/auth/auth-client";
import {
  createEmptyOrderSetDefinition,
  defaultOrderSetAvailability,
  definitionFromDetail,
  orderSetAmountBasisLabels,
  orderSetAvailabilityLabels,
  orderSetSalesUnitLabels,
  orderSetSpeciesLabels,
  resolveOrderSetItemLabel,
  type OrderSetAvailability,
} from "@/features/hospital-admin/order-set-management";
import type {
  OrderCatalogItem,
  OrderSetDefinition,
  OrderSetDetail,
  OrderSetRevision,
  OrderSetSummary,
  OrderSetUpdateReview,
} from "@/features/hospital-admin/server-order-catalog";
import type { Species } from "@/types/emr-domain";

export type OrderSetDrawerTarget =
  | { kind: "create"; initialDefinition?: OrderSetDefinition }
  | { kind: "edit"; orderSetId: string };

type OrderSetReadResponse = {
  orderSet?: OrderSetDetail;
  history?: OrderSetRevision[];
  reviews?: OrderSetUpdateReview[];
};

type OrderSetMutationBody = {
  ok?: boolean;
  error?: { code?: string; message?: string } | null;
  result?: { orderSet?: OrderSetDetail | null } | null;
};

const speciesOptions = Object.entries(orderSetSpeciesLabels) as Array<[Species, string]>;

export function OrderSetDrawer({
  catalog,
  onOpenChange,
  onSaved,
  open,
  session,
  summaries,
  target,
  workspaceId,
}: {
  catalog: OrderCatalogItem[];
  onOpenChange: (open: boolean) => void;
  onSaved: (orderSetId: string) => Promise<void> | void;
  open: boolean;
  session: AuthSession | null;
  summaries: OrderSetSummary[];
  target: OrderSetDrawerTarget | null;
  workspaceId: string;
}) {
  const [availabilityStatus, setAvailabilityStatus] = useState<OrderSetAvailability>(defaultOrderSetAvailability);
  const [definition, setDefinition] = useState<OrderSetDefinition>(createEmptyOrderSetDefinition);
  const [detail, setDetail] = useState<OrderSetDetail | null>(null);
  const [history, setHistory] = useState<OrderSetRevision[]>([]);
  const [reviews, setReviews] = useState<OrderSetUpdateReview[]>([]);
  const [readStatus, setReadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [compositionQuery, setCompositionQuery] = useState("");

  const loadDetail = useCallback(async (orderSetId: string) => {
    setReadStatus("loading");
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-sets/${encodeURIComponent(orderSetId)}`,
        { headers: getDemoActorHeaders(session) },
      );
      const body = (await response.json()) as OrderSetReadResponse;
      if (!response.ok || !body.orderSet) throw new Error("order_set_read_failed");
      setDetail(body.orderSet);
      setDefinition(definitionFromDetail(body.orderSet));
      setAvailabilityStatus(body.orderSet.availabilityStatus);
      setHistory(body.history ?? []);
      setReviews(body.reviews ?? []);
      setReadStatus("ready");
    } catch {
      setReadStatus("error");
    }
  }, [session, workspaceId]);

  useEffect(() => {
    if (!open || !target) return;
    // The drawer must reset draft state when the focused target changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompositionQuery("");
    if (target.kind === "create") {
      setDefinition(target.initialDefinition ?? createEmptyOrderSetDefinition());
      setAvailabilityStatus(defaultOrderSetAvailability);
      setDetail(null);
      setHistory([]);
      setReviews([]);
      setReadStatus("ready");
      return;
    }
    void loadDetail(target.orderSetId);
  }, [loadDetail, open, target]);

  const filteredCatalog = useMemo(() => {
    const query = compositionQuery.trim().toLocaleLowerCase("ko-KR");
    const availableCatalog = catalog.filter(
      (item) => item.availabilityStatus === "active",
    );
    if (!query) return availableCatalog.slice(0, 8);
    return availableCatalog
      .filter((item) =>
        [item.standardOrderName, item.inHospitalOrderName, item.billingName, ...item.aliases]
          .join(" ")
          .toLocaleLowerCase("ko-KR")
          .includes(query),
      )
      .slice(0, 8);
  }, [catalog, compositionQuery]);

  const nestedSetCandidates = useMemo(() => {
    const query = compositionQuery.trim().toLocaleLowerCase("ko-KR");
    return summaries
      .filter(
        (summary) =>
          summary.currentRevisionId &&
          summary.availabilityStatus === "active" &&
          summary.orderSetId !== detail?.orderSetId &&
          (!query || summary.setName.toLocaleLowerCase("ko-KR").includes(query)),
      )
      .slice(0, 6);
  }, [compositionQuery, detail?.orderSetId, summaries]);

  const updateDefinition = <TKey extends keyof OrderSetDefinition>(
    key: TKey,
    value: OrderSetDefinition[TKey],
  ) => setDefinition((current) => ({ ...current, [key]: value }));

  const addAtomicOrder = (item: OrderCatalogItem) => {
    if (definition.items.some((entry) => entry.childOrderCatalogItemId === item.id)) return;
    setDefinition((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          childKind: "atomic",
          childOrderCatalogItemId: item.id,
          childOrderCatalogRevision: item.catalogRevision ?? item.sourceMasterRevision ?? 1,
          childOrderSetId: null,
          childSetRevisionId: null,
          sortOrder: current.items.length,
          defaultSelected: true,
          billingReflectionDefault: current.amountBasis === "included_order_sum",
          defaultQuantity: 1,
          quantitySource: "fixed_one",
        },
      ],
    }));
  };

  const addNestedSet = (summary: OrderSetSummary) => {
    if (!summary.currentRevisionId || definition.items.some((entry) => entry.childOrderSetId === summary.orderSetId)) return;
    setDefinition((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          childKind: "order_set",
          childOrderCatalogItemId: null,
          childOrderCatalogRevision: null,
          childOrderSetId: summary.orderSetId,
          childSetRevisionId: summary.currentRevisionId,
          sortOrder: current.items.length,
          defaultSelected: true,
          billingReflectionDefault: current.amountBasis === "included_order_sum",
          defaultQuantity: 1,
          quantitySource: "fixed_one",
        },
      ],
    }));
  };

  const updateItem = (index: number, patch: Partial<OrderSetDefinition["items"][number]>) => {
    setDefinition((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= definition.items.length) return;
    setDefinition((current) => {
      const items = [...current.items];
      [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      return { ...current, items: items.map((item, sortOrder) => ({ ...item, sortOrder })) };
    });
  };

  const removeItem = (index: number) => {
    setDefinition((current) => ({
      ...current,
      items: current.items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, sortOrder) => ({ ...item, sortOrder })),
    }));
  };

  const handleAmountBasisChange = (amountBasis: OrderSetDefinition["amountBasis"]) => {
    setDefinition((current) => ({
      ...current,
      amountBasis,
      setPriceKrw: amountBasis === "set_fixed_price" ? (current.setPriceKrw ?? 0) : null,
      rangeBasis: amountBasis === "range_price" ? (current.rangeBasis ?? "patient_weight_kg") : null,
      taxType: amountBasis === "included_order_sum" ? "derived" : current.taxType === "derived" ? "taxable" : current.taxType,
      priceRanges:
        amountBasis === "range_price"
          ? current.priceRanges.length > 0
            ? current.priceRanges
            : [{ sortOrder: 0, lowerBound: 0, upperBound: null, priceKrw: 0 }]
          : [],
      items: current.items.map((item) => ({
        ...item,
        billingReflectionDefault: amountBasis === "included_order_sum",
      })),
    }));
  };

  const save = async () => {
    if (!definition.setName.trim() || !definition.billingName.trim()) {
      toast.error("세트명과 청구서명을 입력해 주세요.");
      return;
    }
    if (availabilityStatus === "active" && definition.items.length === 0) {
      toast.error("사용 상태로 저장하려면 구성항목이 필요합니다.");
      return;
    }
    if (definition.amountBasis === "set_fixed_price" && (definition.setPriceKrw ?? 0) < 0) {
      toast.error("세트 고정가는 0원 이상이어야 합니다.");
      return;
    }

    const isEdit = target?.kind === "edit";
    if (isEdit && !detail?.currentRevisionId) {
      toast.error("현재 revision이 없어 수정할 수 없습니다. 복제해 새 세트로 저장해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = isEdit
        ? `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-sets/${encodeURIComponent(target.orderSetId)}`
        : `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-sets`;
      const headers = new Headers(getDemoActorHeaders(session));
      headers.set("Content-Type", "application/json");
      headers.set("Idempotency-Key", crypto.randomUUID());
      if (isEdit && detail?.currentRevisionId) {
        headers.set("If-Match", `\"order-set-revision-${detail.currentRevisionId}\"`);
      } else {
        headers.set("If-None-Match", "*");
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ availabilityStatus, definition }),
      });
      const body = (await response.json()) as OrderSetMutationBody;
      if (!response.ok || !body.ok) {
        if (response.status === 409) {
          if (isEdit) await loadDetail(target.orderSetId);
          toast.error("다른 변경이 먼저 저장되었습니다. 최신 내용을 다시 불러왔어요.");
          return;
        }
        throw new Error(body.error?.message ?? "order_set_save_failed");
      }
      const saved = body.result?.orderSet;
      const savedId = saved?.orderSetId ?? (isEdit ? target.orderSetId : null);
      if (!savedId) throw new Error("order_set_save_result_missing");
      toast.success(isEdit ? "Order 세트 revision을 저장했어요." : "Order 세트를 만들었어요.");
      await onSaved(savedId);
    } catch {
      toast.error("Order 세트를 저장하지 못했습니다. 입력값과 권한을 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const resolveReview = async (review: OrderSetUpdateReview, action: "accept" | "dismiss") => {
    if (!detail?.currentRevisionId) return;
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-sets/${encodeURIComponent(detail.orderSetId)}/reviews/${encodeURIComponent(review.id)}`,
        {
          method: "POST",
          headers: {
            ...getDemoActorHeaders(session),
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
            "If-Match": `\"order-set-revision-${detail.currentRevisionId}\"`,
          },
          body: JSON.stringify({ action }),
        },
      );
      if (response.status === 409) {
        await loadDetail(detail.orderSetId);
        toast.error("검토 대상이 변경되어 최신 내용을 다시 불러왔어요.");
        return;
      }
      if (!response.ok) throw new Error("order_set_review_failed");
      toast.success(action === "accept" ? "새 하위 revision을 반영했어요." : "이번 변경을 보류했어요.");
      await loadDetail(detail.orderSetId);
      await onSaved(detail.orderSetId);
    } catch {
      toast.error("구성 검토를 처리하지 못했습니다.");
    }
  };

  const title = target?.kind === "edit" ? "Order 세트 수정" : "Order 세트 생성";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[min(760px,calc(100vw-1rem))] gap-0 data-[side=right]:!w-[min(760px,calc(100vw-1rem))] sm:max-w-[760px] data-[side=right]:sm:!max-w-[760px]"
        data-testid="order-set-drawer"
      >
        <SheetHeader className="border-b border-[var(--emr-border-default)] px-6 py-6 pr-14">
          <SheetTitle className="text-xl font-semibold">{title}</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {readStatus === "loading" ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Order 세트를 불러오는 중입니다.</p>
          ) : readStatus === "error" ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">Order 세트를 불러오지 못했습니다.</p>
              {target?.kind === "edit" ? <Button variant="outline" onClick={() => void loadDetail(target.orderSetId)}>다시 시도</Button> : null}
            </div>
          ) : (
            <div className="space-y-8">
              <section className="space-y-4" aria-labelledby="order-set-basic-heading">
                <h2 id="order-set-basic-heading" className="text-base font-semibold">기본 정보</h2>
                <BasicInformationSection
                  availabilityStatus={availabilityStatus}
                  definition={definition}
                  onAvailabilityChange={setAvailabilityStatus}
                  onDefinitionChange={updateDefinition}
                />
              </section>

              <section className="border-t border-[var(--emr-border-default)] pt-8" aria-label="구성">
                <CompositionSection
                  catalog={catalog}
                  catalogCandidates={filteredCatalog}
                  compositionQuery={compositionQuery}
                  definition={definition}
                  nestedSetCandidates={nestedSetCandidates}
                  summaries={summaries}
                  onAddAtomic={addAtomicOrder}
                  onAddNested={addNestedSet}
                  onMove={moveItem}
                  onQueryChange={setCompositionQuery}
                  onRemove={removeItem}
                  onUpdateItem={updateItem}
                />
              </section>

              <section className="space-y-4 border-t border-[var(--emr-border-default)] pt-8" aria-labelledby="order-set-pricing-heading">
                <h2 id="order-set-pricing-heading" className="text-base font-semibold">가격·안내</h2>
                <PricingSection
                  definition={definition}
                  onAmountBasisChange={handleAmountBasisChange}
                  onDefinitionChange={updateDefinition}
                />
              </section>

              {target?.kind === "edit" ? (
                <section className="space-y-4 border-t border-[var(--emr-border-default)] pt-8" aria-labelledby="order-set-revision-heading">
                  <h2 id="order-set-revision-heading" className="text-base font-semibold">Revision·검토</h2>
                  <RevisionSection history={history} reviews={reviews} onResolveReview={resolveReview} />
                </section>
              ) : null}
            </div>
          )}
        </div>

        <SheetFooter className="flex-row justify-between border-t border-[var(--emr-border-default)] px-6 py-4">
          <span className="self-center text-xs text-muted-foreground">
            {availabilityStatus === "active" ? "활성화 시 구성항목이 필요합니다." : "빈 세트도 임시 저장할 수 있습니다."}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
            <Button disabled={saving || readStatus !== "ready"} onClick={() => void save()}>
              {saving ? "저장 중" : target?.kind === "edit" ? "새 revision 저장" : "Order 세트 저장"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function BasicInformationSection({
  availabilityStatus,
  definition,
  onAvailabilityChange,
  onDefinitionChange,
}: {
  availabilityStatus: OrderSetAvailability;
  definition: OrderSetDefinition;
  onAvailabilityChange: (status: OrderSetAvailability) => void;
  onDefinitionChange: <TKey extends keyof OrderSetDefinition>(key: TKey, value: OrderSetDefinition[TKey]) => void;
}) {
  return (
    <FieldGroup className="gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="order-set-name">Order 세트명</FieldLabel>
          <Input id="order-set-name" value={definition.setName} placeholder="예: 노령견 건강검진" onChange={(event) => onDefinitionChange("setName", event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="order-set-billing-name">청구서명</FieldLabel>
          <Input id="order-set-billing-name" value={definition.billingName} placeholder="보호자 청구서에 표시될 이름" onChange={(event) => onDefinitionChange("billingName", event.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="order-set-category">분류</FieldLabel>
          <Input id="order-set-category" value={definition.setCategory ?? ""} placeholder="예: 건강검진" onChange={(event) => onDefinitionChange("setCategory", event.target.value || null)} />
        </Field>
        <Field>
          <FieldLabel>사용 여부</FieldLabel>
          <Select value={availabilityStatus} onValueChange={(value) => onAvailabilityChange(value as OrderSetAvailability)}>
            <SelectTrigger aria-label="Order 세트 사용 여부" className="w-full">{orderSetAvailabilityLabels[availabilityStatus]}</SelectTrigger>
            <SelectContent><SelectGroup>{Object.entries(orderSetAvailabilityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </Field>
      </div>
      <Field>
        <FieldLabel>대상 동물</FieldLabel>
        <FieldDescription>이 세트를 검색하고 적용할 수 있는 환자 대상을 선택합니다.</FieldDescription>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-[var(--emr-border-default)] p-4">
          {speciesOptions.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={definition.targetSpecies.includes(value)}
                onCheckedChange={(checked) => onDefinitionChange(
                  "targetSpecies",
                  checked
                    ? [...definition.targetSpecies, value]
                    : definition.targetSpecies.filter((species) => species !== value),
                )}
              />
              {label}
            </label>
          ))}
        </div>
      </Field>
    </FieldGroup>
  );
}

function CompositionSection({
  catalog,
  catalogCandidates,
  compositionQuery,
  definition,
  nestedSetCandidates,
  onAddAtomic,
  onAddNested,
  onMove,
  onQueryChange,
  onRemove,
  onUpdateItem,
  summaries,
}: {
  catalog: OrderCatalogItem[];
  catalogCandidates: OrderCatalogItem[];
  compositionQuery: string;
  definition: OrderSetDefinition;
  nestedSetCandidates: OrderSetSummary[];
  onAddAtomic: (item: OrderCatalogItem) => void;
  onAddNested: (summary: OrderSetSummary) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onQueryChange: (query: string) => void;
  onRemove: (index: number) => void;
  onUpdateItem: (index: number, patch: Partial<OrderSetDefinition["items"][number]>) => void;
  summaries: OrderSetSummary[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">구성항목</h3>
        <p className="mt-1 text-xs text-muted-foreground">원자 오더 또는 한 단계의 Order 세트를 추가할 수 있습니다.</p>
      </div>
      {definition.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--emr-border-default)] px-4 py-8 text-center text-sm text-muted-foreground">아직 구성항목이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {definition.items.map((item, index) => (
            <div key={`${item.childKind}-${item.childOrderCatalogItemId ?? item.childOrderSetId}-${index}`} className="rounded-lg border border-[var(--emr-border-default)] bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md bg-[var(--emr-surface-muted)] px-2 py-1 text-xs font-medium">{item.childKind === "atomic" ? "오더" : "세트"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{resolveOrderSetItemLabel(item, catalog, summaries)}</p>
                  <div className="mt-3 grid grid-cols-[110px_1fr_1fr] gap-3">
                    <Field>
                      <FieldLabel className="text-xs">수량</FieldLabel>
                      <Input type="number" min={0.01} step={0.01} value={item.defaultQuantity} onChange={(event) => onUpdateItem(index, { defaultQuantity: Number(event.target.value) || 1 })} />
                    </Field>
                    <Field>
                      <FieldLabel className="text-xs">수량 입력</FieldLabel>
                      <Select value={item.quantitySource} onValueChange={(value) => onUpdateItem(index, { quantitySource: value as typeof item.quantitySource })}>
                        <SelectTrigger aria-label={`${resolveOrderSetItemLabel(item, catalog, summaries)} 수량 입력 방식`} className="w-full">{{ fixed_one: "1개 고정", preset_quantity: "기본 수량", manual_at_apply: "적용 시 입력" }[item.quantitySource]}</SelectTrigger>
                        <SelectContent><SelectGroup><SelectItem value="fixed_one">1개 고정</SelectItem><SelectItem value="preset_quantity">기본 수량</SelectItem><SelectItem value="manual_at_apply">적용 시 입력</SelectItem></SelectGroup></SelectContent>
                      </Select>
                    </Field>
                    <div className="flex flex-col justify-end gap-2 pb-1 text-xs">
                      <label className="flex items-center gap-2"><Checkbox checked={item.defaultSelected} onCheckedChange={(checked) => onUpdateItem(index, { defaultSelected: Boolean(checked) })} />기본 선택</label>
                      <label className="flex items-center gap-2"><Checkbox checked={item.billingReflectionDefault} onCheckedChange={(checked) => onUpdateItem(index, { billingReflectionDefault: Boolean(checked) })} />청구 반영</label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon-xs" variant="ghost" aria-label="위로 이동" disabled={index === 0} onClick={() => onMove(index, -1)}>↑</Button>
                  <Button size="icon-xs" variant="ghost" aria-label="아래로 이동" disabled={index === definition.items.length - 1} onClick={() => onMove(index, 1)}>↓</Button>
                  <Button size="sm" variant="ghost" onClick={() => onRemove(index)}>제거</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-lg border border-[var(--emr-border-default)] p-4">
        <Field>
          <FieldLabel htmlFor="order-set-item-search">구성항목 검색</FieldLabel>
          <Input id="order-set-item-search" value={compositionQuery} placeholder="오더명 또는 세트명 검색" onChange={(event) => onQueryChange(event.target.value)} />
        </Field>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">원자 오더</p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {catalogCandidates.map((item) => {
                const added = definition.items.some((entry) => entry.childOrderCatalogItemId === item.id);
                return <button key={item.id} type="button" disabled={added} className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-[var(--emr-state-hover)] disabled:opacity-50" onClick={() => onAddAtomic(item)}><span className="truncate">{item.inHospitalOrderName}</span><span className="ml-2 text-xs">{added ? "추가됨" : "+ 추가"}</span></button>;
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">중첩 Order 세트</p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {nestedSetCandidates.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">추가할 수 있는 세트가 없습니다.</p> : nestedSetCandidates.map((summary) => {
                const added = definition.items.some((entry) => entry.childOrderSetId === summary.orderSetId);
                return <button key={summary.orderSetId} type="button" disabled={added} className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-[var(--emr-state-hover)] disabled:opacity-50" onClick={() => onAddNested(summary)}><span className="truncate">{summary.setName}</span><span className="ml-2 text-xs">{added ? "추가됨" : "+ 추가"}</span></button>;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingSection({
  definition,
  onAmountBasisChange,
  onDefinitionChange,
}: {
  definition: OrderSetDefinition;
  onAmountBasisChange: (basis: OrderSetDefinition["amountBasis"]) => void;
  onDefinitionChange: <TKey extends keyof OrderSetDefinition>(key: TKey, value: OrderSetDefinition[TKey]) => void;
}) {
  return (
    <FieldGroup className="gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>가격 방식</FieldLabel>
          <Select value={definition.amountBasis} onValueChange={(value) => onAmountBasisChange(value as OrderSetDefinition["amountBasis"])}>
            <SelectTrigger aria-label="Order 세트 가격 방식" className="w-full">{orderSetAmountBasisLabels[definition.amountBasis]}</SelectTrigger>
            <SelectContent><SelectGroup>{Object.entries(orderSetAmountBasisLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>판매 단위</FieldLabel>
          <Select value={definition.salesUnit} onValueChange={(value) => onDefinitionChange("salesUnit", value as OrderSetDefinition["salesUnit"])}>
            <SelectTrigger aria-label="Order 세트 판매 단위" className="w-full">{orderSetSalesUnitLabels[definition.salesUnit]}</SelectTrigger>
            <SelectContent><SelectGroup>{Object.entries(orderSetSalesUnitLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </Field>
      </div>
      {definition.amountBasis === "set_fixed_price" ? (
        <Field>
          <FieldLabel htmlFor="order-set-fixed-price">세트 고정가</FieldLabel>
          <Input id="order-set-fixed-price" type="number" min={0} step={100} value={definition.setPriceKrw ?? 0} onChange={(event) => onDefinitionChange("setPriceKrw", Number(event.target.value) || 0)} />
          <FieldDescription>고정가에서는 자식 오더의 청구 반영이 기본 해제됩니다.</FieldDescription>
        </Field>
      ) : definition.amountBasis === "range_price" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between"><div><p className="text-sm font-medium">가격 구간</p><p className="text-xs text-muted-foreground">기준값에 따라 적용할 가격을 설정합니다.</p></div><Button size="sm" variant="outline" onClick={() => onDefinitionChange("priceRanges", [...definition.priceRanges, { sortOrder: definition.priceRanges.length, lowerBound: 0, upperBound: null, priceKrw: 0 }])}>+ 구간</Button></div>
          {definition.priceRanges.map((range, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border border-[var(--emr-border-default)] p-3">
              <Input aria-label={`${index + 1}번 구간 시작값`} type="number" min={0} value={range.lowerBound} onChange={(event) => onDefinitionChange("priceRanges", definition.priceRanges.map((item, itemIndex) => itemIndex === index ? { ...item, lowerBound: Number(event.target.value) || 0 } : item))} />
              <Input aria-label={`${index + 1}번 구간 종료값`} type="number" min={0} placeholder="상한 없음" value={range.upperBound ?? ""} onChange={(event) => onDefinitionChange("priceRanges", definition.priceRanges.map((item, itemIndex) => itemIndex === index ? { ...item, upperBound: event.target.value ? Number(event.target.value) : null } : item))} />
              <Input aria-label={`${index + 1}번 구간 가격`} type="number" min={0} step={100} value={range.priceKrw} onChange={(event) => onDefinitionChange("priceRanges", definition.priceRanges.map((item, itemIndex) => itemIndex === index ? { ...item, priceKrw: Number(event.target.value) || 0 } : item))} />
              <Button variant="ghost" size="sm" onClick={() => onDefinitionChange("priceRanges", definition.priceRanges.filter((_, itemIndex) => itemIndex !== index).map((item, sortOrder) => ({ ...item, sortOrder })))}>삭제</Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-[var(--emr-surface-muted)] p-4 text-sm text-muted-foreground">선택된 구성항목의 판매금액을 합산합니다.</div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>세금</FieldLabel>
          <Select value={definition.taxType} disabled={definition.amountBasis === "included_order_sum"} onValueChange={(value) => onDefinitionChange("taxType", value as OrderSetDefinition["taxType"])}>
            <SelectTrigger aria-label="Order 세트 세금 유형" className="w-full">{{ derived: "구성항목에서 계산", taxable: "과세", non_taxable: "비과세" }[definition.taxType]}</SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="derived">구성항목에서 계산</SelectItem><SelectItem value="taxable">과세</SelectItem><SelectItem value="non_taxable">비과세</SelectItem></SelectGroup></SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>세트 자체 청구</FieldLabel>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-[var(--emr-border-default)] px-3 text-sm"><Checkbox checked={definition.billingReflectionEnabled} onCheckedChange={(checked) => onDefinitionChange("billingReflectionEnabled", Boolean(checked))} />청구서에 반영</label>
        </Field>
      </div>
      <Field><FieldLabel htmlFor="order-set-care-guide">보호자 안내</FieldLabel><Textarea id="order-set-care-guide" value={definition.careGuide ?? ""} placeholder="세트 적용 시 보호자에게 안내할 내용을 입력해 주세요." onChange={(event) => onDefinitionChange("careGuide", event.target.value || null)} /></Field>
      <Field><FieldLabel htmlFor="order-set-internal-instruction">내부 지시</FieldLabel><Textarea id="order-set-internal-instruction" value={definition.internalInstruction ?? ""} placeholder="직원이 확인할 내부 지시를 입력해 주세요." onChange={(event) => onDefinitionChange("internalInstruction", event.target.value || null)} /></Field>
    </FieldGroup>
  );
}

function RevisionSection({
  history,
  onResolveReview,
  reviews,
}: {
  history: OrderSetRevision[];
  onResolveReview: (review: OrderSetUpdateReview, action: "accept" | "dismiss") => Promise<void>;
  reviews: OrderSetUpdateReview[];
}) {
  const pendingReviews = reviews.filter((review) => review.status === "pending");
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold">구성 검토</h3>
        <p className="mt-1 text-xs text-muted-foreground">중첩된 하위 세트의 새 revision을 반영할지 결정합니다.</p>
        <div className="mt-3 space-y-2">
          {pendingReviews.length === 0 ? <div className="rounded-lg border border-dashed border-[var(--emr-border-default)] p-5 text-center text-sm text-muted-foreground">검토할 구성 변경이 없습니다.</div> : pendingReviews.map((review) => (
            <div key={review.id} className="flex items-center justify-between rounded-lg border border-[var(--emr-border-default)] p-3">
              <div><p className="text-sm font-medium">하위 Order 세트 revision 변경</p><p className="mt-1 text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleString("ko-KR")}</p></div>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void onResolveReview(review, "dismiss")}>보류</Button><Button size="sm" onClick={() => void onResolveReview(review, "accept")}>수락</Button></div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold">변경 이력</h3>
        <div className="mt-3 divide-y divide-[var(--emr-border-default)] rounded-lg border border-[var(--emr-border-default)]">
          {history.length === 0 ? <p className="p-5 text-center text-sm text-muted-foreground">저장된 revision 이력이 없습니다.</p> : history.map((revision) => (
            <div key={revision.id} className="flex items-center justify-between px-4 py-3"><div><p className="text-sm font-medium">Revision {revision.revisionNo}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(revision.createdAt).toLocaleString("ko-KR")} · 구성 {revision.items.length}개</p></div><span className="text-xs text-muted-foreground">{revision.validationStatus === "valid" ? "유효" : "검토 필요"}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}
