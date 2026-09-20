export type EmrTableDensity = "compact" | "standard" | "comfortable";
export type EmrTableLayout = "fill" | "scroll";
export type EmrTableKind =
  | "clinical-review"
  | "operational-worklist"
  | "master-data-grid"
  | "financial-edit-grid";
export type EmrTableHeaderInteraction =
  | "static"
  | "sortable"
  | "filterable"
  | "sortable-filterable"
  | "menu"
  | "compound";
export type EmrTableHeaderRole = EmrTableHeaderInteraction;
export type EmrColumnResize =
  | "none"
  | "data-column"
  | "pinned-order-boundary";
export type EmrTableCellTextMode =
  | "one-line"
  | "two-line-if-long"
  | "always-multiline"
  | "badge-wrap"
  | "full-on-demand";

export type EmrTableViewOption = {
  value: EmrTableDensity;
  label: string;
  rowHeight: number;
  headerHeight: number;
};

export type EmrTableHeaderRoleDefinition = {
  value: EmrTableHeaderRole;
  label: string;
  allowedAffordance: string;
};

export const emrTableDensityOptions: EmrTableViewOption[] = [
  { value: "compact", label: "좁은 간격", rowHeight: 36, headerHeight: 36 },
  { value: "standard", label: "기본 간격", rowHeight: 40, headerHeight: 36 },
  { value: "comfortable", label: "넓은 간격", rowHeight: 52, headerHeight: 44 },
];

export const defaultEmrTableDensity: EmrTableDensity = "standard";
export const defaultEmrTableLayout: EmrTableLayout = "fill";

export const emrTableHeaderRoleDefinitions: EmrTableHeaderRoleDefinition[] = [
  { value: "static", label: "정적", allowedAffordance: "none" },
  {
    value: "sortable",
    label: "정렬",
    allowedAffordance: "sort indicator and keyboard sort",
  },
  {
    value: "filterable",
    label: "필터",
    allowedAffordance: "filter trigger or explicit menu item",
  },
  {
    value: "sortable-filterable",
    label: "정렬/필터",
    allowedAffordance: "sort indicator plus explicit filter trigger",
  },
  {
    value: "menu",
    label: "메뉴",
    allowedAffordance: "explicit column menu button",
  },
  { value: "compound", label: "복합", allowedAffordance: "static by default" },
];
