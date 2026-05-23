export function ChartSectionTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2.5">
      <h2 className="shrink-0 emr-text-body font-semibold  text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <span className="min-w-0 truncate emr-text-body font-medium text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}
