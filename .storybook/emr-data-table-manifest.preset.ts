import { readFileSync } from "node:fs";
import type { Manifests } from "storybook/internal/types";

const componentId = "design-system-emr-emrdatatable";

// Storybook 10.4 filters local demo components and rewrites app imports to its
// package name. Correct only this catalog entry; retain all other manifests.
export function experimental_manifests(manifests: Manifests): Manifests {
  const component = manifests.components?.components[componentId];
  if (!component) return manifests;

  const source = readFileSync(
    new URL("./emr-data-table-doc-example.tsx", import.meta.url),
    "utf8",
  );
  const declaration = "export function EmrDataTableApiExample";
  const start = source.indexOf(declaration);
  if (start < 0) throw new Error("EmrDataTable API example is missing.");
  const imports = source.slice(0, start).trim();
  const example = source
    .slice(start)
    .replace(declaration, "function EmrDataTableApiExample")
    .trim();
  const stories = component.stories.map((story) => {
    // The actual caller has its own fixture and render. The subsequent source
    // manifest preset preserves that CSF instead of applying the API wrapper.
    if ((story as typeof story & { id?: string }).id === `${componentId}--customer-caller`) {
      return story;
    }
    const snippet = story.snippet;
    if (!snippet || !snippet.includes("<EmrDataTableStory")) {
      throw new Error(`EmrDataTable demo render is missing for ${story.name}.`);
    }
    return {
      ...story,
      snippet: `${example}\n\n${snippet.replace(/<(\/?)EmrDataTableStory(?=[\s>])/g, "<$1EmrDataTableApiExample")}`,
    };
  });

  return {
    ...manifests,
    components: {
      ...manifests.components!,
      components: {
        ...manifests.components!.components,
        [componentId]: {
          ...component,
          name: "EmrDataTable",
          import: imports,
          description:
            "EmrDataTable은 table, aria-label, viewportMode가 필요한 공통 테이블입니다. CustomerCaller는 실제 고객 호출부와 전용 합성 fixture를 사용합니다. 나머지 예시의 EmrDataTableApiExample과 useEmrDataTableStoryProps는 합성 데이터·컨트롤을 제공하는 Storybook 전용 코드입니다. pinned, rowCount 등은 예시 설정이며 실제 EmrDataTable props가 아닙니다.",
          stories,
        },
      },
    },
  };
}
