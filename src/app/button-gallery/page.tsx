import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

const variants = [
  { label: "primary", value: "default" },
  { label: "outline", value: "outline" },
  { label: "secondary", value: "secondary" },
  { label: "ghost", value: "ghost" },
  { label: "destructive", value: "destructive" },
] as const;

const textSizes = [
  { label: "xs", value: "xs" },
  { label: "sm", value: "sm" },
  { label: "default", value: "default" },
  { label: "lg", value: "lg" },
] as const;

const iconSizes = [
  { label: "xs", value: "icon-xs" },
  { label: "sm", value: "icon-sm" },
  { label: "default", value: "icon" },
  { label: "lg", value: "icon-lg" },
] as const;

const roundnessValues = [
  { label: "Default", value: "default" },
  { label: "round", value: "round" },
] as const;

const states = [
  { label: "enable", value: "enable" },
  { label: "hover/select", value: "hover" },
  { label: "focus", value: "focus" },
  { label: "disable", value: "disable" },
] as const;

const forcedHoverClasses = {
  default: "bg-[var(--clair-color-atomic-gray-700)]",
  outline: "bg-[var(--clair-color-background-surface)]",
  secondary: "bg-[var(--clair-color-background-subtle)]",
  ghost: "bg-[var(--clair-color-background-subtle)]",
  destructive: "bg-[var(--clair-color-atomic-red-100)]",
} as const;

function stateClass(
  variant: (typeof variants)[number]["value"],
  state: (typeof states)[number]["value"],
) {
  if (state === "hover") {
    return forcedHoverClasses[variant];
  }

  if (state === "focus") {
    return variant === "destructive"
      ? "ring-3 ring-destructive/20"
      : "ring-3 ring-ring/50";
  }

  return undefined;
}

export default function ButtonGalleryPage() {
  return (
    <main className="min-h-screen bg-background px-8 py-8 text-foreground">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-8">
        <header className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-[20px] font-semibold leading-7">Button Gallery</h1>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              CLAiR button variants for Figma comparison.
            </p>
          </div>
          <div className="text-[12px] font-medium text-muted-foreground">
            Temporary internal route
          </div>
        </header>

        <section className="flex flex-col gap-4" aria-labelledby="text-button-gallery">
          <h2 id="text-button-gallery" className="text-[14px] font-semibold">
            Button
          </h2>
          {roundnessValues.map((roundness) => (
            <div key={roundness.value} className="overflow-x-auto rounded-lg bg-card p-5">
              <div className="mb-4 text-[12px] font-medium text-muted-foreground">
                roundness={roundness.label}
              </div>
              <div className="grid min-w-[920px] grid-cols-[120px_repeat(4,1fr)] gap-x-5 gap-y-3">
                <div />
                {states.map((state) => (
                  <div key={state.value} className="text-[11px] font-medium text-muted-foreground">
                    {state.label}
                  </div>
                ))}
                {textSizes.flatMap((size) =>
                  variants.map((variant) => (
                    <div key={`${roundness.value}-${size.value}-${variant.value}`} className="contents">
                      <div className="flex h-9 items-center text-[12px] font-medium text-muted-foreground">
                        {size.label} / {variant.label}
                      </div>
                      {states.map((state) => (
                        <div key={state.value} className="flex h-9 items-center">
                          <Button
                            variant={variant.value}
                            size={size.value}
                            roundness={roundness.value}
                            disabled={state.value === "disable"}
                            className={stateClass(variant.value, state.value)}
                            data-testid={`text-${roundness.value}-${size.value}-${variant.value}-${state.value}`}
                          >
                            <CheckIcon data-icon="inline-start" />
                            버튼 8
                            <CheckIcon data-icon="inline-end" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )),
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="icon-button-gallery">
          <h2 id="icon-button-gallery" className="text-[14px] font-semibold">
            IconButton
          </h2>
          {roundnessValues.map((roundness) => (
            <div key={roundness.value} className="overflow-x-auto rounded-lg bg-card p-5">
              <div className="mb-4 text-[12px] font-medium text-muted-foreground">
                roundness={roundness.label}
              </div>
              <div className="grid min-w-[760px] grid-cols-[120px_repeat(4,1fr)] gap-x-5 gap-y-3">
                <div />
                {states.map((state) => (
                  <div key={state.value} className="text-[11px] font-medium text-muted-foreground">
                    {state.label}
                  </div>
                ))}
                {iconSizes.flatMap((size) =>
                  variants.map((variant) => (
                    <div key={`${roundness.value}-${size.value}-${variant.value}`} className="contents">
                      <div className="flex h-9 items-center text-[12px] font-medium text-muted-foreground">
                        {size.label} / {variant.label}
                      </div>
                      {states.map((state) => (
                        <div key={state.value} className="flex h-9 items-center">
                          <Button
                            variant={variant.value}
                            size={size.value}
                            roundness={roundness.value}
                            disabled={state.value === "disable"}
                            className={stateClass(variant.value, state.value)}
                            aria-label={`${size.label} ${variant.label} ${state.label}`}
                            data-testid={`icon-${roundness.value}-${size.value}-${variant.value}-${state.value}`}
                          >
                            <CheckIcon />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )),
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
