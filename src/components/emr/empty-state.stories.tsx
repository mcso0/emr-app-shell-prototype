import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";

import {
  CdsActionsFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";

import {
  EmrEmptyState,
  type EmrEmptyStateAlign,
  type EmrEmptyStateDensity,
  type EmrEmptyStateKind,
  type EmrEmptyStatePriority,
  type EmrEmptyStateProps,
  type EmrEmptyStateSize,
  type EmrEmptyStateSurface,
} from "./empty-state";

type EmrEmptyStateStoryArgs = {
  align?: EmrEmptyStateAlign;
  density?: EmrEmptyStateDensity;
  description?: string;
  kind: EmrEmptyStateKind;
  primaryActionLabel?: string;
  priority: EmrEmptyStatePriority;
  reserveActionSpace?: boolean;
  secondaryActionLabel?: string;
  size?: EmrEmptyStateSize;
  surface: EmrEmptyStateSurface;
  title: string;
};

function EmptyStatePrimaryButton({
  children,
  size,
}: {
  children: ReactNode;
  size?: EmrEmptyStateSize;
}) {
  const buttonSize = size ?? "sm";

  return (
    <Button
      type="button"
      size={buttonSize === "xl" ? "default" : buttonSize === "lg" ? "sm" : "xs"}
      roundness="round"
      className="bg-[var(--clair-color-atomic-neutral-900)] text-[var(--clair-color-atomic-common-100)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--clair-color-atomic-neutral-900)] hover:text-[var(--clair-color-atomic-common-100)]"
    >
      {children}
    </Button>
  );
}

function EmptyStateSecondaryButton({
  children,
  size,
}: {
  children: ReactNode;
  size?: EmrEmptyStateSize;
}) {
  const buttonSize = size ?? "sm";

  return (
    <Button
      type="button"
      variant="outline"
      size={buttonSize === "xl" ? "default" : buttonSize === "lg" ? "sm" : "xs"}
      roundness="round"
      className="border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-white-alpha-8)] text-[var(--clair-color-atomic-neutral-900)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--clair-color-atomic-white-alpha-8)] hover:text-[var(--clair-color-atomic-neutral-900)]"
    >
      {children}
    </Button>
  );
}

function EmptyStatePreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[260px] w-full max-w-[420px] items-center justify-center rounded-lg border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] p-8">
      {children}
    </div>
  );
}

function EmptyStateStoryExample({
  align,
  density,
  description,
  kind,
  primaryActionLabel,
  priority,
  reserveActionSpace,
  secondaryActionLabel,
  size,
  surface,
  title,
}: EmrEmptyStateStoryArgs) {
  const resolvedSize = size ?? "lg";

  return (
    <EmrEmptyState
      align={align}
      density={density}
      description={description}
      kind={kind}
      priority={priority}
      primaryAction={
        primaryActionLabel ? (
          <EmptyStatePrimaryButton size={resolvedSize}>
            {primaryActionLabel}
          </EmptyStatePrimaryButton>
        ) : undefined
      }
      reserveActionSpace={reserveActionSpace}
      secondaryAction={
        secondaryActionLabel ? (
          <EmptyStateSecondaryButton size={resolvedSize}>
            {secondaryActionLabel}
          </EmptyStateSecondaryButton>
        ) : undefined
      }
      size={resolvedSize}
      surface={surface}
      title={title}
    />
  );
}

const meta = {
  title: "Design System/EMR/EmrEmptyState",
  component: EmptyStateStoryExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrEmptyState for shared EMR empty states after the caller has decided the state kind, surface, and CTA owner. 사용할 때: queue, content, drawer, table, widget empty surfaces share the same layout contract, or a whole-content read failure prevents the normal body from rendering. 쓰지 말아야 할 때: loading, partial degraded read/write, save failure, stale-data warning, permission blockers needing recovery alert, or feature logic that belongs in the screen.",
      },
    },
  },
  argTypes: {
    align: {
      control: "radio",
      options: ["start", "center"],
      description: "Text and action alignment. Use start only when the surrounding surface already provides strong structure.",
    },
    density: {
      control: "radio",
      options: ["compact", "standard", "table-row"],
      description: "Spatial density. Defaults are derived from surface when omitted.",
    },
    description: {
      control: "text",
      description: "One or two short sentences explaining why the expected object is missing and what can happen next.",
    },
    kind: {
      control: "select",
      options: [
        "no-data",
        "no-search-results",
        "no-filter-results",
        "no-scope-result",
        "no-permission",
        "upstream-pending",
        "read-error",
      ],
      description: "Why the expected content is missing.",
    },
    primaryActionLabel: {
      control: "text",
      description: "Synthetic label for the screen-level or local primary action slot.",
    },
    priority: {
      control: "radio",
      options: ["supporting", "local-recovery", "primary-decision"],
      description: "CTA ownership. Only one visible surface in a screen should use primary-decision.",
    },
    reserveActionSpace: {
      control: "boolean",
      description: "Reserve the xs action height for no-action component-set previews.",
    },
    secondaryActionLabel: {
      control: "text",
      description: "Synthetic label for the secondary action slot.",
    },
    size: {
      control: "radio",
      options: ["xl", "lg", "md", "sm"],
      description: "Figma visual size tier. Use xl only for full workspace empty states.",
    },
    surface: {
      control: "select",
      options: ["queue", "content", "drawer", "table", "widget", "global-shell"],
      description: "Where the empty state appears.",
    },
    title: {
      control: "text",
      description: "Short title naming the missing object.",
    },
  },
  args: {
    description: "접수/예약이 있으면 진료 차트를 시작할 수 있습니다.",
    kind: "upstream-pending",
    primaryActionLabel: "접수/예약으로 이동",
    priority: "primary-decision",
    size: "lg",
    surface: "content",
    title: "진료 대기 환자가 없습니다",
  },
  render: (args) => (
    <div className="max-w-3xl p-2">
      <EmptyStateStoryExample {...args} />
    </div>
  ),
} satisfies Meta<EmrEmptyStateStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    description: "접수나 예약이 생기면 이 영역에 표시됩니다.",
    kind: "no-data",
    primaryActionLabel: undefined,
    priority: "supporting",
    reserveActionSpace: true,
    secondaryActionLabel: undefined,
    size: "lg",
    surface: "content",
    title: "접수/예약이 없습니다",
  },
  render: (args) => (
    <EmptyStatePreviewShell>
      <EmptyStateStoryExample {...args} />
    </EmptyStatePreviewShell>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Figma `style=Default` 기준. 액션은 없지만 컴포넌트 세트 비교에서는 하단 액션 높이를 예약할 수 있습니다.",
      },
    },
  },
};

function FigmaSizeContractExample() {
  const sizes: EmrEmptyStateSize[] = ["xl", "lg", "md", "sm"];

  return (
    <div className="grid gap-6 md:grid-cols-4">
      {sizes.map((size) => (
        <div key={size} className="flex min-h-[240px] items-center justify-center border p-6">
          <EmrEmptyState
            description="설명이 두 줄로 표시됩니다."
            kind="no-data"
            reserveActionSpace
            size={size}
            surface="content"
            testId={`figma-empty-state-${size}`}
            title={`${size} empty state`}
          />
        </div>
      ))}
    </div>
  );
}

export const FigmaSizeContract: Story = {
  render: () => <FigmaSizeContractExample />,
  play: async ({ canvasElement }) => {
    const resolveColorToken = (token: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };

    const blackAlpha4 = resolveColorToken("--clair-color-atomic-black-alpha-4");
    const blackAlpha36 = resolveColorToken("--clair-color-atomic-black-alpha-36");
    const blackAlpha48 = resolveColorToken("--clair-color-atomic-black-alpha-48");
    const blackAlpha64 = resolveColorToken("--clair-color-atomic-black-alpha-64");
    const neutral200 = resolveColorToken("--clair-color-atomic-neutral-200");
    const expected = {
      xl: {
        icon: 80,
        innerIcon: 36,
        rootGap: "24px",
        titleColor: blackAlpha64,
        titleSize: "18px",
      },
      lg: {
        icon: 48,
        innerIcon: 24,
        rootGap: "16px",
        titleColor: blackAlpha48,
        titleSize: "16px",
      },
      md: {
        icon: 40,
        innerIcon: 24,
        rootGap: "8px",
        titleColor: blackAlpha48,
        titleSize: "14px",
      },
      sm: {
        icon: 0,
        innerIcon: 0,
        rootGap: "8px",
        titleColor: blackAlpha48,
        titleSize: "14px",
      },
    } as const;

    for (const [size, contract] of Object.entries(expected)) {
      const emptyState = canvasElement.querySelector<HTMLElement>(
        `section[data-testid="figma-empty-state-${size}"]`,
      );
      if (!emptyState) throw new Error(`Expected ${size} empty state section.`);
      if (emptyState.dataset.size !== size) {
        throw new Error(`Expected ${size} data-size contract.`);
      }

      if (getComputedStyle(emptyState).gap !== contract.rootGap) {
        throw new Error(`Expected ${size} root gap ${contract.rootGap}.`);
      }

      const title = emptyState.querySelector<HTMLElement>("[data-slot='copy'] h3");
      if (!title) throw new Error(`Expected ${size} title.`);
      if (getComputedStyle(title).fontSize !== contract.titleSize) {
        throw new Error(`Expected ${size} title size ${contract.titleSize}.`);
      }
      if (getComputedStyle(title).color !== contract.titleColor) {
        throw new Error(`Expected ${size} title color ${contract.titleColor}.`);
      }

      const description = emptyState.querySelector<HTMLElement>("[data-slot='copy'] p");
      if (!description) throw new Error(`Expected ${size} description.`);
      if (getComputedStyle(description).color !== blackAlpha36) {
        throw new Error(`Expected ${size} description color black alpha 36.`);
      }

      const iconArea = emptyState.querySelector<HTMLElement>("[data-slot='icon-area']");
      if (contract.icon === 0) {
        if (iconArea) throw new Error("Expected sm empty state to omit the icon slot.");
      } else {
        if (!iconArea) throw new Error(`Expected ${size} icon slot.`);
        const iconWidth = Number.parseFloat(getComputedStyle(iconArea).width);
        if (iconWidth !== contract.icon) {
          throw new Error(`Expected ${size} icon area ${contract.icon}px, got ${iconWidth}px.`);
        }
        if (size !== "xl" && getComputedStyle(iconArea).backgroundColor !== blackAlpha4) {
          throw new Error(`Expected ${size} icon background black alpha 4.`);
        }
        const icon = emptyState.querySelector<HTMLElement>("[data-slot='icon']");
        if (!icon) throw new Error(`Expected ${size} inner icon slot.`);
        const iconSize = Number.parseFloat(getComputedStyle(icon).width);
        if (iconSize !== contract.innerIcon) {
          throw new Error(`Expected ${size} inner icon ${contract.innerIcon}px, got ${iconSize}px.`);
        }
        if (size === "xl") {
          if (getComputedStyle(iconArea).backgroundColor !== neutral200) {
            throw new Error("Expected xl icon area background neutral 200.");
          }
          if (getComputedStyle(iconArea).borderRadius !== "28px") {
            throw new Error("Expected xl icon area radius 28px.");
          }
          const iconSurface = emptyState.querySelector<HTMLElement>(
            "[data-slot='icon-surface']",
          );
          if (!iconSurface) throw new Error("Expected xl inner icon surface.");
          if (getComputedStyle(iconSurface).width !== "76px") {
            throw new Error("Expected xl inner icon surface to be 76px wide.");
          }
          if (getComputedStyle(iconSurface).borderRadius !== "26px") {
            throw new Error("Expected xl inner icon surface radius 26px.");
          }
          if (getComputedStyle(iconSurface).borderWidth !== "2px") {
            throw new Error("Expected xl inner icon surface border 2px.");
          }
          if (!getComputedStyle(iconSurface).backgroundImage.includes("0deg")) {
            throw new Error("Expected xl inner icon surface to preserve the Figma gradient.");
          }
          const copy = emptyState.querySelector<HTMLElement>("[data-slot='copy']");
          if (!copy || getComputedStyle(copy).gap !== "8px") {
            throw new Error("Expected xl title-description gap 8px.");
          }
          if (getComputedStyle(title).fontWeight !== "600") {
            throw new Error("Expected xl title weight 600.");
          }
          if (getComputedStyle(title).lineHeight !== "26px") {
            throw new Error("Expected xl title line height 26px.");
          }
          if (getComputedStyle(description).fontSize !== "16px") {
            throw new Error("Expected xl description size 16px.");
          }
          if (getComputedStyle(description).lineHeight !== "24px") {
            throw new Error("Expected xl description line height 24px.");
          }
        }
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          "Figma `xl`/`lg`/`md`/`sm` visual contract. `xl` is reserved for full workspace empty states, and `md` is the implementation tier for the requested `mg` usage.",
      },
    },
  },
};

function FigmaActionContractExample() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <EmrEmptyState
        description="하단 액션 공간을 유지합니다."
        kind="no-data"
        size="xl"
        surface="content"
        testId="figma-action-default"
        title="기본형"
      />
      <EmrEmptyState
        description="복구 액션 하나를 제공합니다."
        kind="no-search-results"
        primaryAction={undefined}
        secondaryAction={<EmptyStateSecondaryButton size="xl">button</EmptyStateSecondaryButton>}
        size="xl"
        surface="content"
        testId="figma-action-one"
        title="1 action"
      />
      <EmrEmptyState
        description="보조 액션과 주요 액션을 제공합니다."
        kind="no-scope-result"
        primaryAction={<EmptyStatePrimaryButton size="xl">button</EmptyStatePrimaryButton>}
        secondaryAction={<EmptyStateSecondaryButton size="xl">button</EmptyStateSecondaryButton>}
        size="xl"
        surface="content"
        testId="figma-action-two"
        title="2 action"
      />
    </div>
  );
}

export const FigmaActionContract: Story = {
  render: () => <FigmaActionContractExample />,
  play: async ({ canvasElement }) => {
    const resolveColorToken = (token: string) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${token})`;
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    };
    const expected = {
      default: { count: "0", buttonCount: 0 },
      one: { count: "1", buttonCount: 1 },
      two: { count: "2", buttonCount: 2 },
    } as const;

    for (const [variant, contract] of Object.entries(expected)) {
      const emptyState = canvasElement.querySelector<HTMLElement>(
        `section[data-testid="figma-action-${variant}"]`,
      );
      if (!emptyState) throw new Error(`Expected ${variant} action variant.`);
      if (emptyState.dataset.actionCount !== contract.count) {
        throw new Error(`Expected ${variant} action count ${contract.count}.`);
      }

      const buttons = emptyState.querySelectorAll("[data-slot='actions'] button");
      if (buttons.length !== contract.buttonCount) {
        throw new Error(`Expected ${variant} to render ${contract.buttonCount} action buttons.`);
      }
      for (const button of buttons) {
        if (getComputedStyle(button).height !== "32px") {
          throw new Error(`Expected ${variant} action buttons to be 32px high.`);
        }
      }
      const actions = emptyState.querySelector<HTMLElement>("[data-slot='actions']");
      if (actions && getComputedStyle(actions).gap !== "8px") {
        throw new Error(`Expected ${variant} action gap 8px.`);
      }
      if (actions && getComputedStyle(actions).flexWrap !== "nowrap") {
        throw new Error(`Expected ${variant} xl actions to stay on one row.`);
      }
    }

    const twoActionButtons = canvasElement.querySelectorAll(
      "section[data-testid='figma-action-two'] [data-slot='actions'] button",
    );
    const primaryColor = resolveColorToken("--clair-color-atomic-neutral-900");
    if (twoActionButtons[0] && getComputedStyle(twoActionButtons[0]).backgroundColor === primaryColor) {
      throw new Error("Expected the outline secondary action to render first.");
    }
    if (!twoActionButtons[1] || getComputedStyle(twoActionButtons[1]).backgroundColor !== primaryColor) {
      throw new Error("Expected the dark primary action to render second.");
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          "Figma `Default`, `1 action`, and `2 action` variants. One action is outline; two actions are outline then primary.",
      },
    },
  },
};

export const OneAction: Story = {
  args: {
    description: "검색어를 지우면 전체 대기열이 다시 보입니다.",
    kind: "no-search-results",
    primaryActionLabel: undefined,
    priority: "local-recovery",
    reserveActionSpace: false,
    secondaryActionLabel: "검색 초기화",
    size: "lg",
    surface: "content",
    title: "검색 결과가 없습니다",
  },
  render: (args) => (
    <EmptyStatePreviewShell>
      <EmptyStateStoryExample {...args} />
    </EmptyStatePreviewShell>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Figma `style=1 action` 기준. 하나의 회복 액션만 empty state 안에 둡니다.",
      },
    },
  },
};

export const TwoActions: Story = {
  args: {
    description: "새 요청을 만들거나 날짜를 바꿔 확인합니다.",
    kind: "no-scope-result",
    primaryActionLabel: "접수/예약으로 이동",
    priority: "primary-decision",
    reserveActionSpace: false,
    secondaryActionLabel: "날짜 변경",
    size: "lg",
    surface: "content",
    title: "진료 대기 환자가 없습니다",
  },
  render: (args) => (
    <EmptyStatePreviewShell>
      <EmptyStateStoryExample {...args} />
    </EmptyStatePreviewShell>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Figma `style=2 action` 기준. secondary를 왼쪽, primary를 오른쪽에 둡니다.",
      },
    },
  },
};

export const ContentPrimaryDecision: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 본문이 화면의 다음 결정을 소유할 때. 쓰지 말아야 할 때: 같은 primary CTA가 queue나 toolbar에서도 같은 강도로 반복될 때.",
      },
    },
  },
};

export const QueueSupporting: Story = {
  args: {
    kind: "no-data",
    primaryActionLabel: undefined,
    priority: "supporting",
    surface: "queue",
    title: "접수/예약이 없습니다",
  },
  render: () => (
    <div className="w-[288px] rounded-lg bg-[var(--emr-surface-sidepanel)] p-3">
      <EmrEmptyState
        kind="no-data"
        priority="supporting"
        surface="queue"
        title="접수/예약이 없습니다"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 좁은 queue surface에서 현재 목록이 비었음을 짧게 알려줄 때. 쓰지 말아야 할 때: 접수 생성이나 workflow 이동 CTA를 queue가 소유해야 한다고 해석될 때.",
      },
    },
  },
};

export const QueueSearchRecovery: Story = {
  args: {
    description: "검색어를 지우면 전체 대기열이 다시 보입니다.",
    kind: "no-search-results",
    primaryActionLabel: undefined,
    priority: "local-recovery",
    secondaryActionLabel: "검색 초기화",
    size: "sm",
    surface: "queue",
    title: "검색 결과가 없습니다",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: queue 안에서 해결되는 검색 결과 없음. 쓰지 말아야 할 때: 검색 실패나 API 오류를 검색 결과 없음처럼 보이게 할 때.",
      },
    },
  },
};

export const DrawerSupporting: Story = {
  args: {
    description: "환자나 업무를 선택하면 세부 정보가 표시됩니다.",
    kind: "no-scope-result",
    primaryActionLabel: undefined,
    priority: "supporting",
    size: "sm",
    surface: "drawer",
    title: "선택된 환자 없음",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: drawer가 selected object 부재를 안내할 때. 쓰지 말아야 할 때: 원천 workflow 생성이나 이동을 drawer primary action으로 소유할 때.",
      },
    },
  },
};

export const TableFilterRecovery: Story = {
  args: {
    description: "조건을 초기화하면 숨겨진 행이 다시 보입니다.",
    kind: "no-filter-results",
    primaryActionLabel: undefined,
    priority: "local-recovery",
    secondaryActionLabel: "조건 초기화",
    size: "md",
    surface: "table",
    title: "조건에 맞는 오더가 없습니다",
  },
  render: (args) => (
    <div className="overflow-hidden rounded-lg border border-[var(--emr-border-default)]">
      <div className="grid grid-cols-[1fr_120px_120px] bg-[var(--emr-surface-muted)] px-3 py-2 emr-text-metadata font-semibold text-muted-foreground">
        <span>오더명</span>
        <span>상태</span>
        <span>담당</span>
      </div>
      <div className="flex min-h-[160px] items-center justify-center border-t border-[var(--emr-border-default)] p-4">
        <EmptyStateStoryExample {...args} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table body 안에서 필터가 모든 행을 숨겼을 때. 쓰지 말아야 할 때: table 밖 toolbar나 content 전체의 primary decision을 대신할 때.",
      },
    },
  },
};

export const WidgetSupporting: Story = {
  args: {
    description: "현재 조건에서 표시할 알림이 없습니다.",
    kind: "no-data",
    primaryActionLabel: undefined,
    priority: "supporting",
    size: "sm",
    surface: "widget",
    title: "알림이 없습니다",
  },
  render: (args) => (
    <div className="w-[360px] rounded-lg border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] p-3">
      <div className="mb-2 emr-text-section font-semibold">오늘의 업무 알림</div>
      <EmptyStateStoryExample {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 홈 카드나 작은 요약 위젯 안의 보조 상태. 쓰지 말아야 할 때: 실패, 권한 차단, source workflow 이동을 위젯이 primary로 소유할 때.",
      },
    },
  },
};

export const PermissionInfoBoundary: Story = {
  args: {
    description: "현재 역할에서는 이 목록을 볼 수 없습니다.",
    kind: "no-permission",
    primaryActionLabel: undefined,
    priority: "supporting",
    surface: "content",
    title: "조회 권한이 없습니다",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 안내성 permission empty/info로 충분한 경우. 쓰지 말아야 할 때: 즉시 복구나 재시도가 필요한 permission blocker, degraded read/write 상태.",
      },
    },
  },
};

function ReadErrorRecoveryExample() {
  return (
    <EmptyStatePreviewShell>
      <EmrEmptyState
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요. 대기 목록의 접수 정보는 변경되지 않았어요."
        kind="read-error"
        primaryAction={<EmptyStatePrimaryButton size="lg">다시 시도</EmptyStatePrimaryButton>}
        priority="local-recovery"
        reserveActionSpace={false}
        secondaryAction={<EmptyStateSecondaryButton size="lg">대기 목록으로</EmptyStateSecondaryButton>}
        size="lg"
        surface="content"
        testId="read-error-recovery"
        title="접수 정보를 불러오지 못했어요"
      />
    </EmptyStatePreviewShell>
  );
}

export const ReadErrorRecovery: Story = {
  render: () => <ReadErrorRecoveryExample />,
  play: async ({ canvasElement }) => {
    const emptyState = canvasElement.querySelector<HTMLElement>(
      'section[data-testid="read-error-recovery"]',
    );
    if (!emptyState) throw new Error("Expected the shared read-error empty state.");
    if (emptyState.dataset.kind !== "read-error") {
      throw new Error("Expected the read-error state kind.");
    }

    const icon = emptyState.querySelector<SVGElement>(
      '[data-slot="icon"] svg[data-empty-state-icon="read-error"]',
    );
    if (!icon) throw new Error("Expected the default read-error alert icon.");

    const buttons = emptyState.querySelectorAll<HTMLButtonElement>(
      '[data-slot="actions"] button',
    );
    if (buttons.length !== 2) throw new Error("Expected two recovery actions.");
    if (buttons[0]?.textContent !== "대기 목록으로") {
      throw new Error("Expected the secondary recovery action first.");
    }
    if (buttons[1]?.textContent !== "다시 시도") {
      throw new Error("Expected the primary retry action second.");
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 접수 호출 전 본문 전체를 구성하는 조회가 실패해 정상 콘텐츠를 표시할 수 없고, 본문이 재시도와 안전한 이탈 액션을 소유할 때. 부분 실패, 저장 실패, stale data 경고에는 EmrInlineAlert를 유지합니다.",
      },
    },
  },
};

const stateExamples: Array<
  Pick<
    EmrEmptyStateProps,
    | "description"
    | "kind"
    | "primaryAction"
    | "priority"
    | "size"
    | "surface"
    | "title"
  >
> = [
  {
    kind: "no-data",
    priority: "supporting",
    size: "sm",
    surface: "queue",
    title: "접수/예약이 없습니다",
  },
  {
    description: "검색어를 지우면 전체 목록이 다시 보입니다.",
    kind: "no-search-results",
    primaryAction: (
      <EmptyStateSecondaryButton size="sm">
        <CdsActionsSearchIcon data-icon="inline-start" />
        검색 초기화
      </EmptyStateSecondaryButton>
    ),
    priority: "local-recovery",
    size: "sm",
    surface: "queue",
    title: "검색 결과가 없습니다",
  },
  {
    description: "조건을 초기화하면 숨겨진 업무가 다시 보입니다.",
    kind: "no-filter-results",
    primaryAction: (
      <EmptyStateSecondaryButton size="md">
        <CdsActionsFilterIcon data-icon="inline-start" />
        조건 초기화
      </EmptyStateSecondaryButton>
    ),
    priority: "local-recovery",
    size: "md",
    surface: "table",
    title: "조건에 맞는 업무가 없습니다",
  },
  {
    description: "날짜나 범위를 바꾸면 다른 업무가 보입니다.",
    kind: "no-scope-result",
    priority: "supporting",
    size: "lg",
    surface: "content",
    title: "선택 범위에 업무가 없습니다",
  },
  {
    description: "현재 역할에서는 이 정보를 볼 수 없습니다.",
    kind: "no-permission",
    priority: "supporting",
    size: "lg",
    surface: "content",
    title: "조회 권한이 없습니다",
  },
  {
    description: "차트 요청이 확정되면 후속 업무가 표시됩니다.",
    kind: "upstream-pending",
    primaryAction: (
      <EmptyStatePrimaryButton size="lg">차트로 이동</EmptyStatePrimaryButton>
    ),
    priority: "primary-decision",
    size: "lg",
    surface: "content",
    title: "넘어온 요청이 없습니다",
  },
  {
    description: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    kind: "read-error",
    primaryAction: (
      <EmptyStatePrimaryButton size="lg">다시 시도</EmptyStatePrimaryButton>
    ),
    priority: "local-recovery",
    size: "lg",
    surface: "content",
    title: "접수 정보를 불러오지 못했어요",
  },
];

export const StateKindSet: Story = {
  render: () => (
    <div className="grid max-w-5xl gap-3 md:grid-cols-2">
      {stateExamples.map((example) => (
        <div
          key={example.kind}
          className="flex min-h-[236px] items-center justify-center rounded-lg border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] p-6"
        >
          <EmrEmptyState
            description={example.description}
            kind={example.kind}
            primaryAction={example.primaryAction}
            priority={example.priority}
            size={example.size}
            surface={example.surface}
            title={example.title}
          />
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 7개 kind의 icon, copy, action 차이를 한 번에 검토할 때. 쓰지 말아야 할 때: 한 화면에 이 모든 state를 동시에 노출하는 실제 workflow로 해석할 때.",
      },
    },
  },
};
