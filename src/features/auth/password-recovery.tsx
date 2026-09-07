"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
export function PasswordRecovery({ update = false }: { update?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  useEffect(() => {
    if (!update) return;
    const controller = new AbortController();
    void fetch("/api/users/me/password/recovery", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error();
        if (!controller.signal.aborted) setRecoveryReady(true);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNotice(
            "재설정 링크를 확인할 수 없습니다. 메일을 다시 요청해 주세요.",
          );
      });
    return () => controller.abort();
  }, [update]);
  async function submit() {
    if (update && (password.length < 8 || password !== confirmation)) {
      setNotice("서로 일치하는 8자 이상의 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      if (update) {
        if (!recoveryReady) return;
        const response = await fetch("/api/users/me/password/recovery", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password, confirmation }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          setNotice(
            result.message ??
              "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.",
          );
          return;
        }
        setPassword("");
        setConfirmation("");
        setRecoveryReady(false);
        setNotice("비밀번호를 변경했습니다. 다시 로그인해 주세요.");
      } else {
        const client = getBrowserSupabaseClient();
        if (!client) throw new Error();
        const result = await client.auth.resetPasswordForEmail(email, {
          redirectTo: new URL("/auth/password-recovery", window.location.origin)
            .href,
        });
        if (result.error) throw new Error();
        setNotice(
          "가입된 이메일이라면 재설정 안내가 도착합니다. 메일함을 확인해 주세요.",
        );
      }
    } catch {
      setNotice("요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-svh place-items-center bg-[var(--emr-surface-2)] px-4">
      <form
        className="grid w-full max-w-sm gap-5 rounded-xl bg-card p-6 ring-1 ring-border"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1 className="text-2xl font-semibold">비밀번호 재설정</h1>
        {update ? (
          <>
            <label className="grid gap-2">
              새 비밀번호
              <Input
                type="password"
                autoComplete="new-password"
                required
                disabled={busy || (update && !recoveryReady)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="grid gap-2">
              새 비밀번호 확인
              <Input
                type="password"
                autoComplete="new-password"
                required
                disabled={busy || (update && !recoveryReady)}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label className="grid gap-2">
            로그인 이메일
            <Input
              type="email"
              autoComplete="email"
              required
              disabled={busy || (update && !recoveryReady)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {notice ? (
          <p role="status" className="text-sm">
            {notice}
          </p>
        ) : null}
        <Button type="submit" disabled={busy || (update && !recoveryReady)}>
          {busy ? "처리 중" : update ? "새 비밀번호 저장" : "재설정 메일 요청"}
        </Button>
        {update ? (
          <Link
            href="/reset-password"
            className="text-center text-sm underline"
          >
            재설정 메일 다시 요청
          </Link>
        ) : null}
        <Link href="/login" className="text-center text-sm underline">
          로그인으로 돌아가기
        </Link>
      </form>
    </main>
  );
}
