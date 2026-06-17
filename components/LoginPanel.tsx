"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type LoginPanelProps = {
  initialError?: string | null;
};

export function LoginPanel({ initialError }: LoginPanelProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(initialError || null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const authCall =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await authCall;

    if (error) {
      setMessage(error.message);
    } else if (mode === "signup") {
      setMessage("가입이 완료됐어요. 이메일 확인 설정이 켜져 있다면 메일을 확인해주세요.");
    }

    setBusy(false);
  }

  return (
    <main className="app-shell">
      <section className="glass-card page-card auth-card">
        <p className="micro muted">B-MVP</p>
        <h1 className="auth-title">냉이랑 루틴 로그인</h1>
        <p className="body-copy">
          지금은 로컬 B 버전 테스트 단계예요. 로그인하면 Supabase에 개인 설정이 자동으로 생성됩니다.
        </p>

        <div className="auth-toggle">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => setMode("signin")}
            type="button"
          >
            로그인
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
            type="button"
          >
            가입
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            이메일
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            비밀번호
            <input
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상"
              required
              type="password"
              value={password}
            />
          </label>

          {message ? <p className="auth-message">{message}</p> : null}

          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "처리 중..." : mode === "signin" ? "로그인" : "가입"}
          </button>
        </form>
      </section>
    </main>
  );
}
