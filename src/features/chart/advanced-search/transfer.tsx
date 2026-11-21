"use client";

import { receptionCreatedEvent } from "./events";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { useLayoutStore } from "@/stores/layout-store";
import { useChartStore } from "@/features/chart/store";
import {
  errorMessage,
  orderCopyPermissionMessage,
  type ChartSearchApi,
} from "./client";
import {
  blankSelection,
  diagnosisLabels,
  sectionNames,
  type CopyIntent,
  type CopyResult,
  type CopySelection,
  type PendingCopy,
  type SearchChart,
  type SearchOrder,
  type SearchVisit,
} from "./contract";
import { Pick, when, type CopyMode } from "./presentation";
import styles from "./workspace.module.css";

type Props = {
  workspace: string;
  api: ChartSearchApi;
  source: SearchChart;
  mode: CopyMode;
  contextId?: string;
  initial?: { pending: PendingCopy; target: SearchChart };
  onTargetDeleted: () => void;
  onClose: () => void;
  onDone: (result: CopyResult | null) => void;
};

type Destination = { chart?: SearchChart; visit?: SearchVisit };
const drug = (o: SearchOrder) =>
  ["medication", "dispensing", "drug"].includes(o.kind);
const frequencies: [string, string][] = [
  ["once", "1회"],
  ["sid", "하루 1회"],
  ["bid", "하루 2회"],
  ["tid", "하루 3회"],
  ["qid", "하루 4회"],
  ["prn", "필요시"],
  ["custom", "직접 지정"],
];
const visitLabel = (visit: SearchVisit) =>
  visit.status === "waiting" ? "접수 대기" : "진료 중";
const price = (n: number | null) =>
  n === null ? "단가 미확인" : n.toLocaleString("ko-KR") + "원";

export function Transfer({
  workspace,
  api,
  source,
  mode,
  contextId,
  initial,
  onTargetDeleted,
  onClose,
  onDone,
}: Props) {
  const [stage, setStage] = useState<"target" | "items" | "review">(
    initial ? "review" : "target",
  );
  const [all, setAll] = useState(false),
    [dest, setDest] = useState<Destination>({ chart: initial?.target });
  const [rows, setRows] = useState<SearchChart[]>([]),
    [visits, setVisits] = useState<SearchVisit[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  const [selection, setSelection] = useState<CopySelection>(
    initial?.pending.selection ?? blankSelection,
  );
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const submitting = useRef(false),
    request = useRef<string | null>(null);
  const registrationId = useRef("");
  const preferredChartId = useRef(contextId);
  const [register, setRegister] = useState(false),
    [newVisit, setNewVisit] = useState(false);
  const activeDrawer = useLayoutStore((s) => s.activeDrawer);
  const target = dest.chart,
    visit = dest.visit,
    waiting = visit?.status === "waiting";
  const count =
    selection.paragraphs.length +
    selection.diagnoses.length +
    selection.orders.length;
  const choose = useCallback((value: Destination) => {
    setDest(value);
    setNewVisit(false);
    setSelection(blankSelection());
    setErr("");
    request.current = null;
  }, []);
  const handleSaveError = useCallback((error: unknown) => {
    if (error instanceof Error && error.message === "target_patient_deleted") {
      preferredChartId.current = undefined;
      choose({});
      setRows([]);
      setCursor(null);
      setVisits([]);
      setStage("target");
      onTargetDeleted();
    }
    setErr(errorMessage(error));
  }, [choose, onTargetDeleted]);
  useEffect(() => {
    if (stage !== "target") return;
    let active = true;
    const load = async () => {
      try {
        if (!(await useChartStore.getState().flushEditors())) {
          if (active)
            setErr(
              "현재 차트의 입력을 저장하지 못했습니다. 다시 시도해 주세요.",
            );
          return;
        }
        if (mode === "new") {
          const list = await api.visits();
          if (active) setVisits(list);
        } else {
          const page = await api.search({
            targets: true,
            mine: !all,
            excludeId: source.id,
          });
          if (active) {
            setRows(page.items);
            setCursor(page.nextCursor);
            const current = page.items.find((c) => c.id === preferredChartId.current);
            if (current) setDest((d) => (d.chart ? d : { chart: current }));
          }
        }
      } catch (e) {
        if (active) setErr(errorMessage(e));
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [api, mode, all, source.id, retry, stage]);
  useEffect(() => {
    if (!register) return;
    const handler = (event: Event) => {
      const receipt = (
        event as CustomEvent<
          SearchVisit & { workspaceId: string; registrationId: string }
        >
      ).detail;
      if (
        receipt.workspaceId !== workspace ||
        receipt.registrationId !== registrationId.current
      )
        return;
      setDest({ visit: receipt });
      setNewVisit(false);
      setRegister(false);
      setStage("review");
      request.current ??= crypto.randomUUID();
      const intent: CopyIntent = {
        requestId: request.current,
        sourceId: source.id,
        sourceVersion: source.version,
        patientId: receipt.patientId,
        encounterId: receipt.id,
        selection,
      };
      submitting.current = true;
      setBusy(true);
      void api
        .park(intent)
        .then(() => onDone(null))
        .catch(handleSaveError)
        .finally(() => {
          submitting.current = false;
          setBusy(false);
        });
    };
    window.addEventListener(receptionCreatedEvent, handler);
    return () => window.removeEventListener(receptionCreatedEvent, handler);
  }, [register, workspace, api, source, selection, onDone, handleSaveError]);
  function select<K extends keyof CopySelection>(
    key: K,
    id: string,
    value: CopySelection[K][number] | null,
  ) {
    request.current = null;
    setErr("");
    setSelection((s) => ({
      ...s,
      [key]: [...s[key].filter((i) => i.id !== id), ...(value ? [value] : [])],
    }));
  }
  const invalid = () => {
    const used = new Set<string>();
    for (const p of selection.paragraphs) {
      if (!p.replaceId) continue;
      if (used.has(p.replaceId)) return "문단 하나를 두 번 교체할 수 없습니다.";
      used.add(p.replaceId);
    }
    for (const o of selection.orders) {
      const original = source.orders.find((i) => i.id === o.id);
      if (
        original &&
        drug(original) &&
        (!(Number(o.dose) > 0) ||
          !o.frequency ||
          !Number.isInteger(Number(o.days)) ||
          Number(o.days) < 1 ||
          (o.frequency === "once" && Number(o.days) !== 1))
      )
        return "용량, 투여 횟수와 기간을 확인해 주세요.";
      if (
        original &&
        target?.orders.some((t) => t.catalogId === original.catalogId) &&
        !o.duplicate
      )
        return "같은 오더가 있습니다. 중복 추가 여부를 확인해 주세요.";
    }
    return "";
  };
  function confirm() {
    const issue = invalid();
    if (issue) {
      setErr(issue);
      return;
    }
    if (newVisit) {
      registrationId.current = "chart-copy:" + crypto.randomUUID();
      setRegister(true);
      useLayoutStore.getState().setActiveDrawer({
        type: "reception-form",
        id: registrationId.current,
      });
      return;
    }
    setStage("review");
    setErr("");
  }
  async function submit() {
    if (submitting.current || (!visit && !target)) return;
    submitting.current = true;
    setBusy(true);
    setErr("");
    try {
      if (!(await useChartStore.getState().flushEditors())) {
        setErr("현재 차트의 입력을 저장하지 못했습니다. 다시 적용해 주세요.");
        return;
      }
      request.current ??= crypto.randomUUID();
      const intent: CopyIntent = {
        requestId: request.current,
        sourceId: source.id,
        sourceVersion: source.version,
        encounterId: target?.encounterId ?? visit!.id,
        patientId: target?.patientId ?? visit!.patientId,
        selection,
        ...(target
          ? { targetId: target.id, targetVersion: target.version }
          : waiting
            ? {}
            : { newChart: true }),
        ...(initial ? { pendingId: initial.pending.id } : {}),
      };
      if (waiting) {
        await api.park(intent);
        onDone(null);
      } else onDone(await api.apply(intent));
    } catch (e) {
      handleSaveError(e);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const selectedName =
    target?.patient ?? visit?.patient ?? (newVisit ? "신규 접수" : "");
  if (register && activeDrawer?.type === "reception-form") return null;
  const dups = source.diagnoses.filter((d) =>
    target?.diagnoses.some((t) =>
      d.catalogId ? t.catalogId === d.catalogId : t.name === d.name,
    ),
  );
  const title =
    stage === "review"
      ? "변경 내용 확인"
      : mode === "existing"
        ? "기존 차트에 복사"
        : "새 차트로 만들기";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <EmrDialogShell
        variant="wide-form"
        title={title}
        description={
          stage === "target"
            ? "적용할 대상 한 건을 선택해 주세요."
            : "원본 " + source.patient + "　→　대상 " + selectedName
        }
        footer={
          <div className={styles.footer}>
            <Button
              variant="outline"
              disabled={busy}
              onClick={
                stage === "review"
                  ? () => setStage("items")
                  : stage === "items" && !initial
                    ? () => setStage("target")
                    : onClose
              }
            >
              {stage === "target" || (initial && stage === "items")
                ? "닫기"
                : "이전"}
            </Button>
            {stage === "target" ? (
              <Button
                disabled={!target && !visit && !newVisit}
                onClick={() => setStage("items")}
              >
                가져올 항목 선택
              </Button>
            ) : stage === "items" ? (
              <Button disabled={!count} onClick={confirm}>
                {newVisit ? "접수하기" : "변경 내용 확인"}
              </Button>
            ) : (
              <Button disabled={busy || !count} onClick={() => void submit()}>
                {busy
                  ? "저장 중"
                  : waiting
                    ? "접수 후 복사 대기"
                    : selectedName + " 차트에 적용"}
              </Button>
            )}
          </div>
        }
      >
        <div className={styles.transfer}>
          {stage !== "target" && (
            <div className={styles.compare}>
              <div>
                <small>원본</small>
                <b>{source.patient}</b>
                <span>
                  {when(source.clinicalAt)} · {source.author}
                </span>
              </div>
              <div>
                <small>적용 대상</small>
                <b>{selectedName}</b>
                <span>
                  {target
                    ? when(target.clinicalAt) + " · " + target.author
                    : visit
                      ? visitLabel(visit)
                      : "접수 후 첫 차트"}
                </span>
              </div>
            </div>
          )}
          {stage === "target" && (
            <>
              {mode === "existing" ? (
                <>
                  <label className={styles.check}>
                    <Checkbox
                      checked={all}
                      onCheckedChange={(v) => {
                        setAll(v === true);
                        choose({});
                        setRows([]);
                      }}
                    />
                    수정 권한이 있는 동료 차트 포함
                  </label>
                  {rows.map((r, i) => (
                    <div key={r.id}>
                      {(i === 0 ||
                        when(r.clinicalAt).slice(0, 13) !==
                          when(rows[i - 1].clinicalAt).slice(0, 13)) && (
                        <h4>
                          {when(r.clinicalAt).split(" ").slice(0, 3).join(" ")}
                        </h4>
                      )}
                      <button
                        className={styles.target}
                        aria-pressed={target?.id === r.id}
                        onClick={() => choose({ chart: r })}
                      >
                        <b>{r.patient}</b>
                        <span>
                          {r.purpose || "방문 목적 미기록"}　·　{r.guardian}
                          　·　{r.author}　·　{when(r.clinicalAt)}
                        </span>
                      </button>
                    </div>
                  ))}
                  {!rows.length && !err && (
                    <p>선택할 작성 중 차트가 없습니다.</p>
                  )}
                  {cursor && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const p = await api.search({
                            targets: true,
                            mine: !all,
                            excludeId: source.id,
                            cursor,
                          });
                          setRows((r) => [...r, ...p.items]);
                          setCursor(p.nextCursor);
                        } catch (e) {
                          setErr(errorMessage(e));
                        }
                      }}
                    >
                      더 보기
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {visits.map((v) => (
                    <button
                      key={v.id}
                      className={styles.target}
                      aria-pressed={visit?.id === v.id}
                      onClick={() => choose({ visit: v })}
                    >
                      <b>{v.patient}</b>
                      <span>
                        {[
                          v.guardian,
                          v.visitAt && when(v.visitAt),
                          v.purpose,
                          visitLabel(v),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                  <button
                    className={styles.target}
                    aria-pressed={newVisit}
                    onClick={() => {
                      choose({});
                      setNewVisit(true);
                    }}
                  >
                    신규 접수로 이어가기
                  </button>
                </>
              )}
            </>
          )}
          {stage === "items" && (
            <>
              {Object.entries(sectionNames).map(([sec, label]) => (
                <section key={sec}>
                  <h3>{label}</h3>
                  {source.paragraphs
                    .filter((p) => p.section === sec)
                    .map((p) => {
                      const picked = selection.paragraphs.find(
                        (v) => v.id === p.id,
                      );
                      const replacements =
                        target?.paragraphs.filter(
                          (t) => t.section === sec && t.replaceable !== false,
                        ) ?? [];
                      return (
                        <div className={styles.line} key={p.id}>
                          <label className={styles.check}>
                            <Checkbox
                              checked={!!picked}
                              onCheckedChange={(v) =>
                                select(
                                  "paragraphs",
                                  p.id,
                                  v ? { id: p.id } : null,
                                )
                              }
                            />
                            {p.text}
                          </label>
                          {picked &&
                            ["assessment", "plan"].includes(sec) &&
                            replacements.length > 0 && (
                              <Pick
                                label={label + " 적용 방식"}
                                value={picked.replaceId ?? "add"}
                                options={[
                                  ["add", "문단 추가"],
                                  ...replacements.map(
                                    (t) =>
                                      [t.id, "교체 · " + t.text] as [
                                        string,
                                        string,
                                      ],
                                  ),
                                ]}
                                onChange={(value) =>
                                  select(
                                    "paragraphs",
                                    p.id,
                                    value === "add"
                                      ? { id: p.id }
                                      : { id: p.id, replaceId: value },
                                  )
                                }
                              />
                            )}
                        </div>
                      );
                    })}
                  {!source.paragraphs.some((p) => p.section === sec) && (
                    <p>기록 없음</p>
                  )}
                </section>
              ))}
              <section>
                <h3>진단</h3>
                {source.diagnoses.map((d) => {
                  const picked = selection.diagnoses.find((v) => v.id === d.id);
                  const duplicate = dups.includes(d);
                  return (
                    <div key={d.id} className={styles.line}>
                      <label className={styles.check}>
                        <Checkbox
                          disabled={duplicate}
                          checked={!!picked}
                          onCheckedChange={(v) =>
                            select(
                              "diagnoses",
                              d.id,
                              v
                                ? {
                                    id: d.id,
                                    kind: d.kind || "suspected",
                                    primary: false,
                                  }
                                : null,
                            )
                          }
                        />
                        {d.name}
                        {duplicate && " · 이미 있는 진단"}
                      </label>
                      {picked && (
                        <div className={styles.controls}>
                          <Pick
                            label="진단 구분"
                            value={picked.kind}
                            options={[
                              "suspected",
                              "confirmed",
                              "differential",
                            ].map((k) => [k, diagnosisLabels[k]])}
                            onChange={(kind) =>
                              select("diagnoses", d.id, { ...picked, kind })
                            }
                          />
                          <label className={styles.check}>
                            <Checkbox
                              checked={picked.primary}
                              onCheckedChange={(v) =>
                                select("diagnoses", d.id, {
                                  ...picked,
                                  primary: !!v,
                                })
                              }
                            />
                            주진단
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
              <section>
                <h3>오더</h3>
                {source.orders.some((o) => o.available === null) && (
                  <p>{orderCopyPermissionMessage}</p>
                )}
                {source.orders.map((o) => {
                  const picked = selection.orders.find((v) => v.id === o.id);
                  const medication = drug(o),
                    unit = String(o.inputs.doseUnit ?? "");
                  const available = o.available && (!medication || !!unit);
                  return (
                    <div className={styles.line} key={o.id}>
                      <label className={styles.check}>
                        <Checkbox
                          disabled={!available}
                          checked={!!picked}
                          onCheckedChange={(v) =>
                            select(
                              "orders",
                              o.id,
                              v
                                ? {
                                    id: o.id,
                                    price: o.price,
                                    ...(medication
                                      ? {
                                          dose: String(o.inputs.dose ?? ""),
                                          frequency: String(
                                            o.inputs.frequency ?? "",
                                          ),
                                          days: String(
                                            o.inputs.durationDays ?? "",
                                          ),
                                        }
                                      : {}),
                                  }
                                : null,
                            )
                          }
                        />
                        {o.name}　
                        {o.available !== null &&
                          (available ? price(o.price) : "현재 복사 불가")}
                      </label>
                      {picked && medication && (
                        <div className={styles.controls}>
                          <label>
                            용량 ({unit})
                            <Input
                              aria-label="용량"
                              type="number"
                              min="0"
                              step="any"
                              value={picked.dose ?? ""}
                              onValueChange={(dose) =>
                                select("orders", o.id, { ...picked, dose })
                              }
                            />
                          </label>
                          <label>
                            횟수
                            <Pick
                              label="횟수"
                              value={picked.frequency ?? ""}
                              options={frequencies}
                              onChange={(frequency) =>
                                select("orders", o.id, { ...picked, frequency })
                              }
                            />
                          </label>
                          <label>
                            기간 (일)
                            <Input
                              aria-label="기간"
                              type="number"
                              min="1"
                              value={picked.days ?? ""}
                              onValueChange={(days) =>
                                select("orders", o.id, { ...picked, days })
                              }
                            />
                          </label>
                        </div>
                      )}
                      {picked &&
                        target?.orders.some(
                          (t) => t.catalogId === o.catalogId,
                        ) && (
                          <label className={styles.check}>
                            <Checkbox
                              checked={!!picked.duplicate}
                              onCheckedChange={(v) =>
                                select("orders", o.id, {
                                  ...picked,
                                  duplicate: !!v,
                                })
                              }
                            />
                            같은 오더 중복 추가
                          </label>
                        )}
                    </div>
                  );
                })}
              </section>
            </>
          )}
          {stage === "review" && (
            <>
              <h3>적용할 내용 {count}개</h3>
              {selection.paragraphs.map((row) => (
                <div className={styles.line} key={row.id}>
                  <b>{row.replaceId ? "문단 교체" : "문단 추가"}</b>
                  {row.replaceId && (
                    <p>
                      기존　
                      {
                        target?.paragraphs.find((p) => p.id === row.replaceId)
                          ?.text
                      }
                    </p>
                  )}
                  <p>{source.paragraphs.find((p) => p.id === row.id)?.text}</p>
                </div>
              ))}
              {selection.diagnoses.map((row) => (
                <p key={row.id}>
                  {source.diagnoses.find((d) => d.id === row.id)?.name}　·　
                  {diagnosisLabels[row.kind]} {row.primary && " · 주진단"}
                </p>
              ))}
              {selection.diagnoses.some((d) => d.primary) &&
                target?.diagnoses.some((d) => d.primary) && (
                  <p>
                    기존 주진단 유지　
                    {target.diagnoses
                      .filter((d) => d.primary)
                      .map((d) => d.name)
                      .join(", ")}
                  </p>
                )}
              {dups.length > 0 && (
                <p>
                  이미 있는 진단 {dups.length}개　
                  {dups.map((d) => d.name).join(", ")}
                </p>
              )}
              {selection.orders.map((row) => (
                <p key={row.id}>
                  {source.orders.find((o) => o.id === row.id)?.name}
                  　·　미확정　
                  {row.dose &&
                    [
                      row.dose,
                      String(
                        source.orders.find((o) => o.id === row.id)?.inputs
                          .doseUnit ?? "",
                      ),
                      frequencies.find(([k]) => k === row.frequency)?.[1],
                      row.days + "일",
                    ].join(" ")}
                  　{price(row.price)}
                </p>
              ))}
              {waiting && (
                <p>
                  호출 후 {selectedName}의 첫 차트에서 ‘복사 이어가기’를 선택해
                  주세요.
                </p>
              )}
            </>
          )}
          {err && (
            <div role="alert">
              {err}{" "}
              {stage !== "target" && (
                <div className={styles.compare}>
                  <div>
                    <small>원본</small>
                    <b>{source.patient}</b>
                    <span>
                      {when(source.clinicalAt)} · {source.author}
                    </span>
                  </div>
                  <div>
                    <small>적용 대상</small>
                    <b>{selectedName}</b>
                    <span>
                      {target
                        ? when(target.clinicalAt) + " · " + target.author
                        : visit
                          ? visitLabel(visit)
                          : "접수 후 첫 차트"}
                    </span>
                  </div>
                </div>
              )}
              {stage === "target" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setErr("");
                    setRetry((n) => n + 1);
                  }}
                >
                  다시 시도
                </Button>
              )}
              {stage === "review" && !initial && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    choose({});
                    setStage("target");
                  }}
                >
                  대상 다시 확인
                </Button>
              )}
            </div>
          )}
        </div>
      </EmrDialogShell>
    </Dialog>
  );
}
