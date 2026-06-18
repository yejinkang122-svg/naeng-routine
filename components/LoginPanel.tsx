"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type LoginPanelProps = {
  initialError?: string | null;
};

export function LoginPanel({ initialError }: LoginPanelProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState<string | null>(initialError || null);
  const [busy, setBusy] = useState(false);
  const isNicknameValid = /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]{1,10}$/.test(nickname.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "signup" && signupStep === 1) {
      setSignupStep(2);
      setMessage(null);
      return;
    }

    if (mode === "signup" && !isNicknameValid) {
      setMessage("닉네임은 특수문자 없이 1-10자로 입력해주세요.");
      return;
    }

    setBusy(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const authCall = mode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: nickname.trim(),
              nickname: nickname.trim()
            }
          }
        });

    const { data, error } = await authCall;

    if (error) {
      setMessage(error.message);
    } else if (mode === "signup") {
      if (data.user) {
        await supabase.from("profiles").upsert(
          {
            user_id: data.user.id,
            display_name: nickname.trim()
          },
          { onConflict: "user_id" }
        );
        await supabase.from("user_settings").upsert(
          {
            user_id: data.user.id,
            nickname: nickname.trim()
          },
          { onConflict: "user_id" }
        );
      }
      setMessage("가입했어요.");
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
            onClick={() => {
              setMode("signin");
              setSignupStep(1);
              setMessage(null);
            }}
            type="button"
          >
            로그인
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setSignupStep(1);
              setMessage(null);
            }}
            type="button"
          >
            가입
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && signupStep === 2 ? (
            <label>
              닉네임
              <input
                autoComplete="nickname"
                maxLength={10}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="냉이"
                required
                value={nickname}
              />
            </label>
          ) : (
            <>
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
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8자 이상"
                  required
                  type="password"
                  value={password}
                />
              </label>
            </>
          )}

          {message ? <p className="auth-message">{message}</p> : null}

          <button
            className="primary-button"
            disabled={busy || (mode === "signup" && signupStep === 2 && !isNicknameValid)}
            type="submit"
          >
            {busy ? "처리 중" : mode === "signin" ? "로그인" : signupStep === 1 ? "다음" : "가입"}
          </button>
        </form>
      </section>
    </main>
  );
}
