import { expect, test } from "@playwright/test";
import { canSubmitPasswordLogin, getSafeLoginNextHref } from "../src/features/auth/login-entry-contract";

test("login input format does not impose new-password policy or trim passwords", () => {
  expect(canSubmitPasswordLogin(" email@example.test ", "x")).toBe(true);
  expect(canSubmitPasswordLogin("email@example.test", " ")).toBe(true);
  for (const [email, password] of [["bad", "password"], ["a@b", "password"], ["email@example.test", ""], ["", "password"]]) expect(canSubmitPasswordLogin(email, password)).toBe(false);
});
test("login and OTP callback redirects reject origin escapes and auth loops", () => {
  const fallback = "/w/workspace-clair-cheongdam/reception?modulePanel=open&aside=closed";
  for (const next of [null, "https://evil.example", "//evil.example", "/\\evil.example", "/login?method=otp", "/auth/login", "javascript:alert(1)", "/\n/evil.example"]) expect(getSafeLoginNextHref(next)).toBe(fallback);
  expect(getSafeLoginNextHref("/w/demo/billing?modulePanel=open&aside=closed#queue")).toBe("/w/demo/billing?modulePanel=open&aside=closed#queue");
});
