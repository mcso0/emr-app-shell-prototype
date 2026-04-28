import type { ComponentType } from "react";
import type { AppIcon } from "@/components/icons";

export type DrawerState = {
  type: string;
  id: string;
} | null;

export type ShellComponentProps = {
  workspaceId: string;
  moduleId: string;
  hasContentAside?: boolean;
  hasRightPanel?: boolean;
};

export type PanelState = "open" | "closed";

export type ModuleDefinition = {
  id: string;
  label: string;
  icon: AppIcon;
  sidePanel?: ComponentType<ShellComponentProps>;
  contentHeader?: ComponentType<ShellComponentProps>;
  contentAside?: ComponentType<ShellComponentProps>;
  content: ComponentType<ShellComponentProps>;
  rightPanel?: ComponentType<ShellComponentProps>;
  drawer?: ComponentType<ShellComponentProps>;
};

export type Order = {
  id: string;
  category: string;
  name: string;
  route: string;
  dose: string;
  frequency: string;
  status: "대기" | "검토" | "조제중" | "완료";
  requestedAt: string;
  doctor: string;
};
