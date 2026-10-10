import { EmrDataTable } from "@/components/emr/emr-data-table";
import {
  useEmrDataTableStoryProps,
  type EmrDataTableStoryArgs,
} from "@/components/emr/emr-data-table.stories";

// The hook supplies synthetic Storybook data, a TanStack controller, and demo
// slots. Product callers own their controller and must use EmrDataTableProps.
export function EmrDataTableApiExample(args: EmrDataTableStoryArgs) {
  const props = useEmrDataTableStoryProps(args);

  return (
    <div className="flex h-[420px] min-w-0 flex-col rounded-xl border bg-white p-4">
      <EmrDataTable
        {...props}
        table={props.table}
        aria-label={props["aria-label"]}
        viewportMode={props.viewportMode}
      />
    </div>
  );
}
