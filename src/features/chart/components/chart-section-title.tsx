export function ChartSectionTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2.5">
      <h2 className="shrink-0 text-[length:var(--clair-typography-body-2-normal-font-size)] font-semibold leading-[var(--clair-typography-body-2-normal-line-height)] text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <span className="min-w-0 truncate text-[14px] font-medium text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}
