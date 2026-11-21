import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useId, useRef, useState, type FormEvent } from "react";
import { expect, fn, mocked, userEvent } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { EmrInlineAlert } from "./inline-alert";

type SavePhase = "idle" | "saving" | "error" | "retrying" | "saved";

function SaveRecoveryExample({
  onSave,
}: {
  onSave: (memo: string) => Promise<void>;
}) {
  const memoId = useId();
  const pendingSave = useRef(false);
  const [memo, setMemo] = useState("");
  const [phase, setPhase] = useState<SavePhase>("idle");
  const pending = phase === "saving" || phase === "retrying";
  const hasError = phase === "error" || phase === "retrying";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Block repeated submits immediately, before React updates the button.
    if (pendingSave.current || !memo.trim() || phase === "saved") return;

    pendingSave.current = true;
    setPhase(hasError ? "retrying" : "saving");
    try {
      await onSave(memo);
      setPhase("saved");
    } catch {
      setPhase("error");
    } finally {
      pendingSave.current = false;
    }
  }

  return (
    <form aria-label="샘플 메모 저장" className="grid max-w-xl gap-3" onSubmit={save}>
      <p className="text-sm text-muted-foreground">합성 예제이며 실제로 저장하지 않아요.</p>
      <Field>
        <FieldLabel htmlFor={memoId}>업무 메모</FieldLabel>
        <Input
          id={memoId}
          value={memo}
          required
          readOnly={pending}
          onChange={(event) => {
            setMemo(event.target.value);
            if (phase === "saved") setPhase("idle");
          }}
        />
      </Field>
      <span role="status" className="sr-only">{pending ? "메모를 저장하고 있어요." : ""}</span>
      {hasError ? (
        <EmrInlineAlert
          severity="error"
          title="메모를 저장하지 못했어요."
          action={
            <Button type="submit" size="sm" disabled={pending || !memo.trim()}>
              {pending ? "저장 중…" : "다시 시도"}
            </Button>
          }
        >
          입력한 내용은 그대로예요.
        </EmrInlineAlert>
      ) : (
        <>
          <Button
            type="submit"
            className="justify-self-start"
            disabled={pending || !memo.trim() || phase === "saved"}
          >
            {pending ? "저장 중…" : "저장"}
          </Button>
          {phase === "saved" ? (
            <EmrInlineAlert severity="success" title="메모를 저장했어요.">
              {memo}
            </EmrInlineAlert>
          ) : null}
        </>
      )}
    </form>
  );
}

const meta = {
  title: "Design System/EMR/Form Save Recovery",
  component: SaveRecoveryExample,
  tags: ["autodocs"],
  args: { onSave: fn<(memo: string) => Promise<void>>() },
  beforeEach: ({ args }) => {
    const onSave = mocked(args.onSave);
    let attempts = 0;
    onSave.mockReset();
    // Keep the manual Docs example local and independent of the play test.
    onSave.mockImplementation(async () => {
      const attempt = ++attempts;
      await new Promise<void>((resolve) => setTimeout(resolve, 650));
      if (attempt === 1) throw new Error("Synthetic save failure");
    });
  },
  parameters: {
    controls: { disable: true },
    docs: { story: { inline: true, autoplay: false } },
  },
} satisfies Meta<typeof SaveRecoveryExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SaveFailureAndRetry: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Uses Field, Input, Button and EmrInlineAlert to show draft retention after a definite save failure. The same form handles the initial save and retry; it locks submission while a request is pending. This is a synthetic Storybook recipe, not a production save or server idempotency example.",
      },
    },
  },
  play: async ({ args, canvas }) => {
    const first = Promise.withResolvers<void>();
    const retry = Promise.withResolvers<void>();
    const onSave = mocked(args.onSave);
    onSave.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);

    const draft = "합성 업무 메모";
    const input = canvas.getByRole("textbox", { name: "업무 메모" });
    const form = canvas.getByRole<HTMLFormElement>("form", { name: "샘플 메모 저장" });
    await userEvent.type(input, draft);
    await userEvent.dblClick(canvas.getByRole("button", { name: /^저장$/ }));
    await expect(canvas.getByRole("button", { name: "저장 중…" })).toBeDisabled();
    input.focus();
    await userEvent.keyboard("{Enter}{Enter}");
    form.requestSubmit();
    await expect(onSave).toHaveBeenCalledTimes(1);
    await expect(onSave).toHaveBeenNthCalledWith(1, draft);

    first.reject(new Error("Synthetic save failure"));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("메모를 저장하지 못했어요.");
    await expect(input).toHaveValue(draft);
    const retryButton = canvas.getByRole("button", { name: "다시 시도" });
    input.focus();
    await userEvent.tab();
    await expect(retryButton).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("button", { name: "저장 중…" })).toBeDisabled();
    form.requestSubmit();
    await expect(onSave).toHaveBeenCalledTimes(2);
    await expect(onSave).toHaveBeenNthCalledWith(2, draft);

    retry.resolve();
    await expect(await canvas.findByText("메모를 저장했어요.")).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(input).toHaveValue(draft);
    await expect(onSave).toHaveBeenCalledTimes(2);
  },
};
