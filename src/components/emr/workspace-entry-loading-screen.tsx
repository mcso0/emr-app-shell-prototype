import Image from "next/image";
import logoMark from "../../../logo/logo48*48.svg";
import { cn } from "@/lib/utils";

type WorkspaceEntryLoadingScreenProps = {
  className?: string;
  "data-testid"?: string;
};

const logoSrc = typeof logoMark === "string" ? logoMark : logoMark.src ?? "";

export function WorkspaceEntryLoadingScreen({
  className,
  "data-testid": dataTestId = "workspace-entry-loading-screen",
}: WorkspaceEntryLoadingScreenProps) {
  return (
    <main
      aria-busy="true"
      aria-label="워크스페이스를 불러오는 중"
      className={cn(
        "grid min-h-svh place-items-center overflow-hidden bg-[var(--emr-surface-app)] text-foreground",
        className
      )}
      data-testid={dataTestId}
    >
      <div className="relative flex size-28 items-center justify-center">
        <span
          aria-hidden="true"
          className="clair-logo-loader-orbit absolute inset-0 rounded-full border border-[var(--emr-line-hairline)]"
        />
        <span
          aria-hidden="true"
          className="clair-logo-loader-ring absolute inset-3 rounded-full"
        />
        <span className="clair-logo-loader-mark relative flex size-16 items-center justify-center rounded-[18px] bg-[var(--emr-surface-panel)] shadow-[var(--clair-shadow-lg)]">
          <Image
            src={logoSrc}
            alt=""
            width={48}
            height={48}
            unoptimized
            aria-hidden="true"
            className="size-12 object-contain"
            priority
            draggable={false}
          />
        </span>
      </div>
    </main>
  );
}
