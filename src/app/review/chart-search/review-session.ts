import type { ChartSearchApi } from "@/features/chart/advanced-search/client";
import type {
  CopyHistoryItem,
  CopyIntent,
  CopyResult,
  PendingCopy,
  SearchChart,
  SearchVisit,
} from "@/features/chart/advanced-search/contract";
import { hasSameDiagnosis } from "@/features/chart/advanced-search/contract";
import { searchPage } from "@/features/chart/advanced-search/ranking";
import { cases } from "./cases";

export function createReviewSession(onChange: () => void) {
  const rows: SearchChart[] = structuredClone(cases.rows);
  const originalOrderIds = new Set(
    rows.flatMap((chart) => chart.orders.map((order) => order.id)),
  );
  const visits: SearchVisit[] = rows
    .filter((row) => row.editable)
    .map((row) => ({
      id: row.encounterId,
      patientId: row.patientId,
      patient: row.patient,
      guardian: row.guardian,
      status: "in_consultation",
      visitAt: row.clinicalAt,
      purpose: row.purpose,
    }));
  const pending = new Map<string, PendingCopy>();
  const receipts = new Map<string, CopyResult>();
  const history = new Map<string, CopyHistoryItem[]>();
  function register(patient: string) {
    const visit: SearchVisit = {
      id: crypto.randomUUID(),
      patientId: crypto.randomUUID(),
      patient,
      guardian: "보호자 아",
      status: "waiting",
      purpose: "합성 재진",
    };
    visits.push(visit);
    return visit;
  }
  visits.push({
    id: "review-waiting",
    patientId: "review-patient",
    patient: "여울",
    guardian: "보호자 아",
    status: "waiting",
    purpose: "합성 재진",
  });
  function newChart(visit: SearchVisit): SearchChart {
    const date = new Date().toISOString();
    const current = rows.find((row) => row.encounterId === visit.id);
    return {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      patientId: visit.patientId,
      encounterId: visit.id,
      patient: visit.patient,
      guardian: visit.guardian,
      clinicalAt: date,
      visitAt: visit.visitAt ?? date,
      purpose: visit.purpose ?? "",
      complaint: "",
      species: current?.species ?? "고양이",
      breed: current?.breed ?? "",
      age: current?.age ?? null,
      author: "한서진",
      doctor: current?.doctor ?? "한서진",
      authorId: cases.actor,
      doctorId: current ? current.doctorId : cases.actor,
      status: "draft",
      editable: true,
      media: [],
      diagnoses: [],
      orders: [],
      paragraphs: [],
    };
  }
  function sourceAndVisit(intent: CopyIntent) {
    const source = rows.find((r) => r.id === intent.sourceId);
    const visit = visits.find(
      (v) => v.id === intent.encounterId && v.patientId === intent.patientId,
    );
    if (!source || source.version !== intent.sourceVersion)
      throw new Error("revision_conflict");
    if (!visit) throw new Error("target_unavailable");
    return { source, visit };
  }
  const api: ChartSearchApi = {
    async search(params) {
      return structuredClone(searchPage(rows, params, cases.actor));
    },
    async visits() {
      return structuredClone(visits);
    },
    async history(chartId) {
      return structuredClone(history.get(chartId) ?? []);
    },
    async park(intent) {
      const { visit } = sourceAndVisit(intent);
      if (visit.status !== "waiting") throw new Error("stale_status");
      const previous = pending.get(visit.id);
      if (previous && previous.id !== intent.requestId)
        throw new Error("pending_exists");
      pending.set(visit.id, {
        ...structuredClone(intent),
        id: intent.requestId,
        canDiscard: true,
      });
      onChange();
      return { id: intent.requestId };
    },
    async pending(input) {
      const task = pending.get(input.encounterId);
      return task?.patientId === input.patientId ? structuredClone(task) : null;
    },
    async discard(id) {
      for (const [visit, task] of pending)
        if (task.id === id) pending.delete(visit);
      onChange();
      return {};
    },
    async apply(intent) {
      const previous = receipts.get(intent.requestId);
      if (previous) return previous;
      const { source, visit } = sourceAndVisit(intent);
      if (visit.status === "waiting") throw new Error("stale_status");
      if (intent.pendingId && pending.get(visit.id)?.id !== intent.pendingId)
        throw new Error("invalid_resume");
      const existing = rows.find((r) => r.id === intent.targetId);
      const target = intent.newChart
        ? newChart(visit)
        : existing && structuredClone(existing);
      if (
        !target?.editable ||
        target.encounterId !== visit.id ||
        (!intent.newChart && target.version !== intent.targetVersion)
      )
        throw new Error("revision_conflict");
      const changes: CopyHistoryItem["changes"] = [];
      for (const pick of intent.selection.paragraphs) {
        const paragraph = source.paragraphs.find((p) => p.id === pick.id);
        if (!paragraph?.section) throw new Error("invalid_selection");
        const copy = { ...paragraph, id: crypto.randomUUID() };
        const index = target.paragraphs.findIndex(
          (p) => p.id === pick.replaceId,
        );
        if (pick.replaceId && index < 0) throw new Error("revision_conflict");
        changes.push({
          section: paragraph.section,
          before: index >= 0 ? target.paragraphs[index] : null,
          after: copy,
        });
        if (index >= 0) target.paragraphs[index] = copy;
        else target.paragraphs.push(copy);
      }
      for (const pick of intent.selection.diagnoses) {
        const dx = source.diagnoses.find((d) => d.id === pick.id);
        if (!dx) throw new Error("invalid_selection");
        if (target.diagnoses.some((d) => hasSameDiagnosis(dx, d))) continue;
        target.diagnoses.push({
          ...dx,
          id: crypto.randomUUID(),
          kind: pick.kind,
          primary: pick.primary,
        });
        changes.push({ after: { diagnosisText: dx.name } });
      }
      for (const pick of intent.selection.orders) {
        const order = source.orders.find((o) => o.id === pick.id);
        if (!order?.available) throw new Error("catalog_item_unavailable");
        if (order.price !== pick.price) throw new Error("price_changed");
        if (
          !pick.duplicate &&
          target.orders.some((o) => o.catalogId === order.catalogId)
        )
          throw new Error("duplicate_order");
        target.orders.push({
          ...order,
          id: crypto.randomUUID(),
          inputs: {
            ...order.inputs,
            ...(pick.dose
              ? {
                  dose: pick.dose,
                  frequency: pick.frequency,
                  durationDays: pick.days,
                }
              : {}),
          },
        });
        changes.push({ originalOrder: order.id, name: order.name });
      }
      target.version = crypto.randomUUID();
      if (existing) rows[rows.indexOf(existing)] = target;
      else rows.push(target);
      const result: CopyResult = {
        unchanged: changes.length === 0,
        chartId: target.id,
        patientId: target.patientId,
        encounterId: visit.id,
        visitAt: target.visitAt,
        requestId: intent.requestId,
      };
      receipts.set(intent.requestId, result);
      history.set(target.id, [
        {
          id: intent.requestId,
          at: new Date().toISOString(),
          source: source.patient,
          sourceId: source.id,
          actor: "한서진",
          selectedBy: "한서진",
          changes,
        },
        ...(history.get(target.id) ?? []),
      ]);
      if (intent.pendingId && pending.get(visit.id)?.id === intent.pendingId)
        pending.delete(visit.id);
      onChange();
      return result;
    },
  };
  function resume(visit: SearchVisit) {
    const task = pending.get(visit.id);
    const source = rows.find((r) => r.id === task?.sourceId);
    if (!source || !task) return;
    visit.status = "in_consultation";
    let target = rows.find((r) => r.encounterId === visit.id);
    if (!target) {
      target = newChart(visit);
      rows.push(target);
    }
    return {
      source: structuredClone(source),
      target: structuredClone(target),
      pending: structuredClone(task),
    };
  }
  return {
    api,
    register,
    resume,
    waiting: () => visits.filter((v) => pending.has(v.id)),
    editParagraph(chartId: string, paragraphId: string, text: string) {
      const chart = rows.find((r) => r.id === chartId && r.editable);
      const paragraph = chart?.paragraphs.find(
        (p) =>
          p.id === paragraphId &&
          (p.section === "subjective" || p.section === "objective"),
      );
      if (!chart || !paragraph) return;
      paragraph.text = text;
      chart.version = crypto.randomUUID();
      onChange();
    },
    isCopiedOrder: (id: string) => !originalOrderIds.has(id),
    chart: (id: string) => rows.find((r) => r.id === id),
  };
}
