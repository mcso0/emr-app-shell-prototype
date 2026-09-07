"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validatePersonalPassword } from "./personal-password";
export function PersonalPasswordDialog({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  function close() {
    if (saving) return;
    setOpen(false);
    setCurrentPassword("");
    setPassword("");
    setConfirmation("");
    setError("");
  }
  async function save() {
    const input = validatePersonalPassword({
      currentPassword,
      password,
      confirmation,
    });
    if (!input) {
      setError(
        "현재 비밀번호와 서로 일치하는 8자 이상의 새 비밀번호를 입력해 주세요.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          result.message ??
            "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.",
        );
        return;
      }
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
      window.location.replace("/login?reason=password_changed");
    } catch {
      setError("연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        비밀번호 변경
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent showCloseButton={!saving}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="contents"
          >
            <DialogHeader>
              <DialogTitle>비밀번호 변경</DialogTitle>
              <DialogDescription>
                현재 비밀번호를 확인합니다. 변경을 마치면 다시 로그인해 주세요.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <label className="grid gap-2">
                현재 비밀번호
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  disabled={saving}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label className="grid gap-2">
                새 비밀번호
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  disabled={saving}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="grid gap-2">
                새 비밀번호 확인
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  disabled={saving}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              {error ? (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                disabled={saving}
                onClick={close}
              >
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "변경 중" : "비밀번호 변경"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
