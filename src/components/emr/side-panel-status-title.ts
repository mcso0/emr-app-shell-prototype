import type { EmrSidePanelStateIconState } from "@/components/emr/side-panel-state-icon";

type SidePanelStatusTitleInput = {
  id?: string;
  label: string;
};

type SidePanelStatusIconInput = SidePanelStatusTitleInput & {
  colorToken?: string;
};

const sidePanelStatusTitleById: Record<string, string> = {
  canceled: "취소",
  cancelled: "취소",
  completed: "완료",
  partiallyCompleted: "부분완료",
  in_progress: "진행중",
  inProgress: "진행중",
  re_requested: "재요청",
  reRequested: "재요청",
  waiting: "대기중",
};

const sidePanelStatusTitleByLabel: Record<string, string> = {
  진료대기: "대기중",
  진료중: "진행중",
};

const sidePanelStatusIconByTitle: Record<string, EmrSidePanelStateIconState> = {
  취소: "cancel",
  완료: "done",
  부분완료: "done",
  재요청: "rework",
  호출: "rework",
  미납: "rework",
  진행중: "in-progress",
  조제중: "in-progress",
  진료중: "in-progress",
  대기중: "to-do",
  수납대기: "to-do",
};

export function getEmrSidePanelStatusTitle({ id, label }: SidePanelStatusTitleInput) {
  if (id && sidePanelStatusTitleById[id]) {
    return sidePanelStatusTitleById[id];
  }

  return sidePanelStatusTitleByLabel[label] ?? label;
}

export function getEmrSidePanelStatusIconState({
  colorToken,
  id,
  label,
}: SidePanelStatusIconInput): EmrSidePanelStateIconState {
  const title = getEmrSidePanelStatusTitle({ id, label });
  const state = sidePanelStatusIconByTitle[title];

  if (state) return state;

  if (!colorToken) return "to-do";

  if (colorToken.includes("danger") || colorToken.includes("red")) return "stop";
  if (colorToken.includes("success") || colorToken.includes("green") || colorToken.includes("mint")) return "done";
  if (colorToken.includes("warning") || colorToken.includes("orange")) return "rework";
  if (colorToken.includes("info") || colorToken.includes("blue") || colorToken.includes("sky") || colorToken.includes("primary")) {
    return "in-progress";
  }

  return "to-do";
}
