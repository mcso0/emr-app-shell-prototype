type SidePanelStatusTitleInput = {
  id?: string;
  label: string;
};

const sidePanelStatusTitleById: Record<string, string> = {
  canceled: "취소",
  cancelled: "취소",
  completed: "완료",
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

export function getEmrSidePanelStatusTitle({ id, label }: SidePanelStatusTitleInput) {
  if (id && sidePanelStatusTitleById[id]) {
    return sidePanelStatusTitleById[id];
  }

  return sidePanelStatusTitleByLabel[label] ?? label;
}
