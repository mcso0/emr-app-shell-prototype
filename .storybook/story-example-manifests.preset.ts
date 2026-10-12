import { readFileSync } from "node:fs";
import type { Manifests } from "storybook/internal/types";

// These three catalog entries use local examples that Storybook 10.4 omits
// from its snippets. Read the executed examples; do not copy their bodies.
const examples = [
  {
    id: "design-system-emr-emrrightpanel",
    name: "EmrRightPanel",
    source: "../src/components/emr/right-panel.stories.tsx",
    firstDeclaration: "type EmrRightPanelStoryArgs",
    imports: [
      ["./right-panel-header", "@/components/emr/right-panel-header"],
      ["./right-panel", "@/components/emr/right-panel"],
    ],
  },
  {
    id: "design-system-emr-emrtablefilterbuilder",
    name: "EmrTableFilterBuilder",
    source: "../src/components/emr/table-filter-builder.stories.tsx",
    firstDeclaration: "type TableFilterBuilderArgs",
    imports: [
      ["./table-filter-builder", "@/components/emr/table-filter-builder"],
      ["./table-filter-builder-model", "@/components/emr/table-filter-builder-model"],
      ["./table-filter.stories.fixture", "@/components/emr/table-filter.stories.fixture"],
    ],
  },
  {
    id: "design-system-ui-table",
    name: "Table",
    source: "../src/components/ui/table.stories.tsx",
    firstDeclaration: "type TableStoryArgs",
    imports: [["./table", "@/components/ui/table"]],
  },
];

export function experimental_manifests(manifests: Manifests): Manifests {
  const componentsManifest = manifests.components;
  if (!componentsManifest) return manifests;
  const components = { ...componentsManifest.components };

  for (const example of examples) {
    const component = components[example.id];
    if (!component) continue;
    const source = readFileSync(new URL(example.source, import.meta.url), "utf8");
    const end = source.indexOf("\nconst meta =");
    const start = source.indexOf(example.firstDeclaration);
    if (start < 0 || end <= start) {
      throw new Error(`Story example declarations are missing for ${example.id}.`);
    }
    let imports = source.slice(0, start)
      .replace('import type { Meta, StoryObj } from "@storybook/nextjs-vite";', "")
      .replace('import { userEvent } from "storybook/test";', "");
    for (const [from, to] of example.imports) {
      imports = imports.replace(`from "${from}"`, `from "${to}"`);
    }
    const declarations = source.slice(start, end).trim();
    components[example.id] = {
      ...component,
      name: example.name,
      import: imports.trim(),
      description: `${component.description ?? ""}\n\n코드의 Example 함수와 합성 데이터는 Storybook 전용 예시입니다. 예시 설정을 실제 컴포넌트 props로 전달하지 말고, 함수 안의 실제 API 사용을 참고해 주세요.`.trim(),
      stories: component.stories.map((story) => {
        if (!story.snippet) throw new Error(`Story snippet is missing for ${story.name}.`);
        return { ...story, snippet: `${declarations}\n\n${story.snippet}` };
      }),
    };
  }

  return { ...manifests, components: { ...componentsManifest, components } };
}
