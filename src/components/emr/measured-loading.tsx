"use client";

import type { CSSProperties, ReactNode } from "react";
import { Skeleton as MeasuredSkeleton, SkulletProvider } from "skullet/react";

/** Loading-only boundary. Children must be synthetic, presentation-only content.
 * Never pass a data-fetching owner, editor, or previously loaded personal data.
 * Unmount on completion: real content never enters Skullet's shape/data memory.
 */
export function EmrMeasuredLoading({
  children,
  className,
  label,
  testId,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className={className}>
      <SkulletProvider reveal={{ duration: 0, hold: 150 }} theme={{ animation: "pulse" }}>
        <MeasuredSkeleton
          // Pinned 0.0.3: empty ID opts out of automatic persisted shape keys.
          // The browser contract story guards this behavior before upgrades.
          id=""
          loading
          label={label}
          style={{
            "--skullet-base": "var(--muted)",
            "--skullet-highlight": "var(--emr-surface-canvas)",
          } as CSSProperties}
        >
          {children}
        </MeasuredSkeleton>
      </SkulletProvider>
    </div>
  );
}
