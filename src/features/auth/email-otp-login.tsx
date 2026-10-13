"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuthClient } from "./auth-client";
import { AuthEntryBackLink, AuthEntryHeading, AuthEntryNotice, AuthEntryPanel, AuthEntryScene } from "./auth-entry";
import { getEmailAuthError, getSafeLoginNextHref, isLoginEmailValid } from "./login-entry-contract";
import styles from "./auth-entry.module.css";

// The local provider uses six digits; the existing invite UI uses eight.
// Accept either length and let Supabase validate expiry, attempts and correctness.
const isCompleteToken = (value: string) => /^\d{6,8}$/.test(value);
const resendDelaySeconds = 60;

export function EmailOtpLogin({ initialEmail = "", next, invalidLink = false, onVerified }: { initialEmail?: string; next: string | null; invalidLink?: boolean; onVerified: () => void }) {
  const auth = useAuthClient();
  const [email, setEmail] = useState(initialEmail);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState(invalidLink ? "로그인 링크가 만료되었거나 올바르지 않습니다. 인증번호를 다시 받아 주세요." : "");
  const [emailTouched, setEmailTouched] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const active = useRef(false);
  const pending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const safeNext = getSafeLoginNextHref(next);
  const backHref = `/login?next=${encodeURIComponent(safeNext)}`;
  const invalidEmail = emailTouched && !isLoginEmailValid(email);

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!resendAt) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  useEffect(() => { if (sentEmail) codeInput.current?.focus(); }, [sentEmail]);

  async function send() {
    if (pending.current || !isLoginEmailValid(email) || Date.now() < resendAt) return;
    pending.current = true;
    setBusy("send"); setError("");
    try {
      if (auth.authProvider !== "supabase" || !auth.supabaseConfigured) throw new Error("unavailable");
      const redirectTo = new URL("/auth/login", window.location.origin);
      redirectTo.searchParams.set("next", safeNext);
      try {
        await auth.signInWithEmailOtp({ email: email.trim(), redirectTo: redirectTo.href, shouldCreateUser: false });
      } catch (caught) {
        // Keep account existence private, matching password recovery's neutral result.
        const code = caught && typeof caught === "object" && "code" in caught ? caught.code : null;
        if (code !== "otp_disabled" && code !== "user_not_found") throw caught;
      }
      if (!active.current) return;
      setSentEmail(email.trim()); setToken("");
      setResendAt(Date.now() + resendDelaySeconds * 1000); setRemaining(resendDelaySeconds);
      window.requestAnimationFrame(() => codeInput.current?.focus());
    } catch (caught) {
      if (active.current) setError(auth.authProvider !== "supabase" || !auth.supabaseConfigured ? "이메일 인증을 사용할 수 없습니다. 비밀번호로 로그인하거나 관리자에게 문의해 주세요." : getEmailAuthError(caught));
    } finally { pending.current = false; if (active.current) setBusy(null); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentEmail) { await send(); return; }
    if (pending.current || !isCompleteToken(token)) return;
    pending.current = true; setBusy("verify"); setError("");
    try {
      await auth.verifyEmailOtp({ email: sentEmail, token });
      if (active.current) onVerified();
    } catch (caught) { if (active.current) setError(getEmailAuthError(caught, true)); }
    finally { pending.current = false; if (active.current) setBusy(null); }
  }

  return <AuthEntryScene><AuthEntryPanel>
    <form noValidate onSubmit={submit} className={styles.form} aria-busy={Boolean(busy)}>
      <AuthEntryHeading title={sentEmail ? "인증번호 입력" : "OTP 로그인"} description={sentEmail ? "메일에 적힌 인증번호를 입력해 주세요." : "비밀번호 없이 이메일 인증번호로 로그인하세요."} />
      <div className={styles.stack}>
        {sentEmail ? <>
          <p className={styles.description}>{sentEmail}<br />가입된 이메일이라면 인증번호 안내가 도착합니다. 스팸 메일함도 확인해 주세요.</p>
          <div className={styles.field}>
            <label htmlFor="login-otp">인증번호</label>
            <InputOTP ref={codeInput} id="login-otp" maxLength={8} pattern={REGEXP_ONLY_DIGITS} value={token} onChange={(value) => { setToken(value); setError(""); }} disabled={Boolean(busy)} autoComplete="one-time-code" aria-describedby="otp-help" aria-invalid={Boolean(error)}>
              <InputOTPGroup className={styles.otpGroup}>{Array.from({ length: 8 }, (_, index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup>
            </InputOTP>
            <p id="otp-help" className={styles.hint}>받은 6~8자리 숫자를 입력해 주세요. 인증번호가 만료되면 다시 받아 주세요.</p>
          </div>
          <div className={styles.otpMeta}><span>메일을 받지 못하셨나요?</span><button type="button" className={styles.textButton} disabled={Boolean(busy) || remaining > 0} onClick={() => void send()}>{busy === "send" ? "다시 받는 중" : remaining > 0 ? `다시 받기 (${remaining}초)` : "다시 받기"}</button></div>
        </> : <div className={styles.field}>
          <label htmlFor="otp-email">이메일</label>
          <Input id="otp-email" type="email" autoComplete="email" autoFocus value={email} disabled={Boolean(busy)} placeholder="이메일을 입력해주세요" onBlur={() => setEmailTouched(true)} onChange={(event) => { setEmail(event.target.value); setError(""); }} aria-invalid={invalidEmail} aria-describedby={invalidEmail ? "otp-email-error" : undefined} />
          {invalidEmail ? <p id="otp-email-error" className={styles.error}>올바른 이메일 주소를 입력해 주세요.</p> : null}
        </div>}
        {!sentEmail && remaining > 0 ? <p className={styles.hint}>다시 요청하려면 {remaining}초만 기다려 주세요.</p> : null}
        {error ? <AuthEntryNotice error>{error}</AuthEntryNotice> : null}
        <Button type="submit" size="xl" className={styles.primary} disabled={Boolean(busy) || (sentEmail ? !isCompleteToken(token) : !isLoginEmailValid(email) || remaining > 0)}>{busy === "verify" ? "확인 중" : busy === "send" ? "인증번호 요청 중" : sentEmail ? "확인하고 로그인" : "인증번호 받기"}</Button>
        {sentEmail ? <button type="button" className={styles.textButton} disabled={Boolean(busy)} onClick={() => { setSentEmail(null); setToken(""); setError(""); }}>다른 이메일로 받기</button> : null}
      </div>
      <AuthEntryBackLink href={backHref} />
    </form>
  </AuthEntryPanel></AuthEntryScene>;
}
