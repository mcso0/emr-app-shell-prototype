import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./auth-entry.module.css";

export function AuthEntryScene({ children }: { children: ReactNode }) {
  return <main className={styles.scene} data-testid="auth-entry-scene">{children}</main>;
}
export function AuthEntryPanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel} data-testid="auth-entry-panel">{children}</div>;
}
export function AuthEntryHeading({ title, description }: { title: string; description?: string }) {
  return <header className={styles.heading}>
    <span className={styles.logo} aria-hidden="true">
      <Image src="/auth-entry/logo-water.png" alt="" width={56} height={56} loading="eager" unoptimized />
      <Image src="/auth-entry/logo.svg" alt="" width={56} height={56} loading="eager" unoptimized />
    </span>
    <h1>{title}</h1>
    {description ? <p className={styles.description}>{description}</p> : null}
  </header>;
}
export function AuthEntryBackLink({ href = "/login", children = "로그인으로 돌아가기" }: { href?: string; children?: ReactNode }) {
  return <Link href={href} className={styles.back}>{children}</Link>;
}
export function AuthEntryNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p className={styles.notice} data-tone={error ? "error" : undefined} role={error ? "alert" : "status"}>{children}</p>;
}
