"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthEntryBackLink, AuthEntryHeading, AuthEntryPanel, AuthEntryScene } from "./auth-entry";
import styles from "./auth-entry.module.css";

export function FindId() {
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = /^01[016789]\d{7,8}$/.test(phone.replace(/[\s-]/g, ""));
  return <AuthEntryScene><AuthEntryPanel>
    <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true); }}>
      <AuthEntryHeading title="아이디 찾기" description="등록한 휴대전화번호로 본인확인 후 이메일을 찾습니다." />
      <div className={styles.stack}>
        <p id="find-id-unavailable" className={styles.notice} role="status">휴대전화 본인확인 서비스를 준비하고 있습니다. 아이디 확인이 필요하면 병원 관리자에게 문의해 주세요.</p>
        <div className={styles.field}>
          <label htmlFor="find-id-phone">휴대전화번호</label>
          <Input id="find-id-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="010-0000-0000" value={phone} autoFocus onBlur={() => setTouched(true)} onChange={(event) => { setPhone(event.target.value); }} aria-invalid={touched && !valid} aria-describedby={touched && !valid ? "find-id-phone-error" : undefined} />
          {touched && !valid ? <p className={styles.error} id="find-id-phone-error">올바른 휴대전화번호를 입력해 주세요.</p> : null}
        </div>
        <Button type="submit" size="xl" className={styles.primary} disabled aria-describedby="find-id-unavailable">인증번호 받기</Button>
      </div>
      <AuthEntryBackLink />
    </form>
  </AuthEntryPanel></AuthEntryScene>;
}
