import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

export type DrawerState = {
  type: string;
  id: string;
} | null;

export type ShellComponentProps = {
  workspaceId: string;
  moduleId: string;
};

export type ModuleDefinition = {
  id: string;
  label: string;
  icon: LucideIcon;
  sidePanel?: ComponentType<ShellComponentProps>;
  contentHeader?: ComponentType<ShellComponentProps>;
  contextPanel?: ComponentType<ShellComponentProps>;
  content: ComponentType<ShellComponentProps>;
  rightPanel?: ComponentType<ShellComponentProps>;
  drawer?: ComponentType<ShellComponentProps>;
  defaultLayout: {
    modulePanelOpen: boolean;
    contextPanelOpen?: boolean;
    rightPanelOpen?: boolean;
    rightPanelWidth?: number;
  };
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
