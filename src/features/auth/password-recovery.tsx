"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthEntryBackLink, AuthEntryHeading, AuthEntryNotice, AuthEntryPanel, AuthEntryScene } from "./auth-entry";
import { getEmailAuthError, isLoginEmailValid } from "./login-entry-contract";
import styles from "./auth-entry.module.css";

type RecoveryState = "request" | "sent" | "checking" | "ready" | "invalid" | "check-error" | "success";
export function PasswordRecovery({ update = false, invalidLink = false }: { update?: boolean; invalidLink?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<RecoveryState>(update ? "checking" : "request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const pending = useRef(false);
  const active = useRef(false);
  const emailValid = isLoginEmailValid(email);
  const passwordValid = password.length >= 8 && password.length <= 1024;
  const confirmationValid = passwordValid && password === confirmation;
  const canSubmit = !busy && (update ? state === "ready" && confirmationValid : emailValid && remaining === 0);

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!resendAt) return;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  useEffect(() => {
    if (!update) return;
    const controller = new AbortController();
    void fetch("/api/users/me/password/recovery", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        if (response.status === 403 || response.status === 401) { setState("invalid"); return; }
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error();
        if (!controller.signal.aborted) setState("ready");
      }).catch(() => { if (!controller.signal.aborted) setState("check-error"); });
    return () => controller.abort();
  }, [update, checkVersion]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !canSubmit || (!update && Date.now() < resendAt)) return;
    pending.current = true; setBusy(true); setError("");
    try {
      if (update) {
        const response = await fetch("/api/users/me/password/recovery", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, confirmation }),
        });
        if (!active.current) return;
        if (response.status === 403 || response.status === 401) { setState("invalid"); setPassword(""); setConfirmation(""); return; }
        const result = await response.json();
        if (!response.ok || !result.ok) {
          setError(response.status === 429 ? "요청이 많습니다. 잠시 후 다시 시도해 주세요." : result.message ?? "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.");
          return;
        }
        setPassword(""); setConfirmation(""); setState("success");
        window.dispatchEvent(new Event("clair:session-ended"));
      } else {
        const client = getBrowserSupabaseClient();
        if (!client) throw new Error("unavailable");
        const { error: caught } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: new URL("/auth/password-recovery", window.location.origin).href,
        });
        if (caught) throw caught;
        if (!active.current) return;
        setState("sent"); setResendAt(Date.now() + 60_000); setRemaining(60);
      }
    } catch (caught) { if (active.current) setError(getEmailAuthError(caught)); }
    finally { pending.current = false; if (active.current) setBusy(false); }
  }
  const terminal = state === "checking" || state === "invalid" || state === "check-error" || state === "success";
  return <AuthEntryScene><AuthEntryPanel>
    <form className={styles.form} noValidate onSubmit={submit} aria-busy={busy || state === "checking"}>
      <AuthEntryHeading title={state === "success" ? "비밀번호 변경 완료" : update ? "새 비밀번호 설정" : "비밀번호 찾기"} description={!update && state !== "sent" ? "가입한 이메일로 비밀번호 재설정 안내를 받으세요." : undefined} />
      <div className={styles.stack}>
        {state === "checking" ? <AuthEntryNotice>재설정 링크를 확인하고 있습니다.</AuthEntryNotice> : state === "invalid" ? <>
          <AuthEntryNotice error>재설정 링크가 만료되었거나 이미 사용되었습니다. 메일을 다시 요청해 주세요.</AuthEntryNotice>
          <Link href="/reset-password" className={styles.back}>재설정 메일 다시 요청</Link>
        </> : state === "check-error" ? <>
          <AuthEntryNotice error>재설정 링크를 확인하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.</AuthEntryNotice>
          <Button type="button" size="xl" variant="outline" className={styles.secondary} onClick={() => { setState("checking"); setCheckVersion((value) => value + 1); }}>다시 확인</Button>
        </> : state === "success" ? <div className={styles.result} role="status"><span className={styles.seal} aria-hidden="true">✓</span><p>비밀번호를 변경했습니다.<br />새 비밀번호로 다시 로그인해 주세요.</p></div> : state === "sent" ? <>
          <div className={styles.result} role="status"><span className={styles.seal} aria-hidden="true">✓</span><p><strong>{email.trim()}</strong><br />가입된 이메일이라면 재설정 안내가 도착합니다. 메일함과 스팸 메일함을 확인해 주세요.</p></div>
          <Button type="submit" size="xl" variant="outline" className={styles.secondary} disabled={!canSubmit}>{busy ? "요청 중" : remaining > 0 ? `다시 요청 (${remaining}초)` : "재설정 메일 다시 요청"}</Button>
          <button type="button" className={styles.textButton} disabled={busy} onClick={() => { setState("request"); setError(""); }}>다른 이메일로 요청</button>
        </> : update ? <>
          <div className={styles.field}>
            <label htmlFor="recovery-password">새 비밀번호</label>
            <Input id="recovery-password" type="password" autoComplete="new-password" placeholder="8자 이상 입력해주세요" value={password} maxLength={1024} disabled={busy} autoFocus onBlur={() => setPasswordTouched(true)} onChange={(event) => { setPassword(event.target.value); setError(""); }} aria-invalid={passwordTouched && !passwordValid} aria-describedby="recovery-password-help" />
            <p className={passwordTouched && !passwordValid ? styles.error : styles.hint} id="recovery-password-help">8자 이상, 최대 1024자로 입력해 주세요.</p>
          </div>
          <div className={styles.field}>
            <label htmlFor="recovery-confirmation">새 비밀번호 확인</label>
            <Input id="recovery-confirmation" type="password" autoComplete="new-password" placeholder="새 비밀번호를 다시 입력해주세요" value={confirmation} maxLength={1024} disabled={busy} onBlur={() => setConfirmationTouched(true)} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} aria-invalid={confirmationTouched && password !== confirmation} aria-describedby={confirmationTouched && password !== confirmation ? "recovery-confirmation-error" : undefined} />
            {confirmationTouched && password !== confirmation ? <p id="recovery-confirmation-error" className={styles.error}>비밀번호 확인이 일치하지 않습니다.</p> : null}
          </div>
          <Button type="submit" size="xl" className={styles.primary} disabled={!canSubmit}>{busy ? "변경 중" : "새 비밀번호 저장"}</Button>
        </> : <>
          {invalidLink ? <AuthEntryNotice error>재설정 링크를 확인할 수 없습니다. 메일을 다시 요청해 주세요.</AuthEntryNotice> : null}
          <div className={styles.field}>
            <label htmlFor="recovery-email">로그인 이메일</label>
            <Input id="recovery-email" type="email" autoComplete="email" placeholder="이메일을 입력해주세요" value={email} disabled={busy} autoFocus onBlur={() => setEmailTouched(true)} onChange={(event) => { setEmail(event.target.value); setError(""); }} aria-invalid={emailTouched && !emailValid} aria-describedby={emailTouched && !emailValid ? "recovery-email-error" : undefined} />
            {emailTouched && !emailValid ? <p id="recovery-email-error" className={styles.error}>올바른 이메일 주소를 입력해 주세요.</p> : null}
          </div>
          <Button type="submit" size="xl" className={styles.primary} disabled={!canSubmit}>{busy ? "요청 중" : "재설정 메일 요청"}</Button>
          {remaining > 0 ? <p className={styles.hint}>다시 요청하려면 {remaining}초만 기다려 주세요.</p> : null}
        </>}
        {error ? <AuthEntryNotice error>{error}</AuthEntryNotice> : null}
      </div>
      {update && !terminal ? <Link href="/reset-password" className={styles.back}>재설정 메일 다시 요청</Link> : null}
      <AuthEntryBackLink href={state === "success" ? "/login?reason=password_changed" : "/login"} />
    </form>
  </AuthEntryPanel></AuthEntryScene>;
}
