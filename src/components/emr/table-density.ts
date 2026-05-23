export type EmrTableDensity = "compact" | "standard" | "comfortable";
export type EmrTableLayout = "fill" | "scroll";
export type EmrTableHeaderRole =
  | "static"
  | "sortable"
  | "filterable"
  | "menu"
  | "compound";

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
  { value: "compact", label: "좁게", rowHeight: 36, headerHeight: 36 },
  { value: "standard", label: "기본", rowHeight: 44, headerHeight: 40 },
  { value: "comfortable", label: "넓게", rowHeight: 52, headerHeight: 44 },
];

export const defaultEmrTableDensity: EmrTableDensity = "standard";
export const defaultEmrTableLayout: EmrTableLayout = "fill";

export const emrTableHeaderRoleDefinitions: EmrTableHeaderRoleDefinition[] = [
  { value: "static", label: "정적", allowedAffordance: "none" },
  { value: "sortable", label: "정렬", allowedAffordance: "sort indicator and keyboard sort" },
  { value: "filterable", label: "필터", allowedAffordance: "filter trigger or explicit menu item" },
  { value: "menu", label: "메뉴", allowedAffordance: "explicit column menu button" },
  { value: "compound", label: "복합", allowedAffordance: "static by default" },
];
