"use client";

import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { LoginPanel } from "./LoginPanel";
import { UserMenu } from "./UserMenu";

type AuthGateProps = {
  children: React.ReactNode;
};

function timeout<T>(promise: Promise<T>, ms: number, message: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    })
  ]);
}

async function ensureUserDefaults(user: User) {
  const supabase = getSupabaseBrowserClient();
  const displayName =
    user.user_metadata?.name ||
    user.user_metadata?.nickname ||
    user.email?.split("@")[0] ||
    "냉이";

  await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName
    },
    { onConflict: "user_id" }
  );

  const { data: settings } = await supabase
    .from("user_settings")
    .select("id,nickname")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; nickname: string | null }>();

  if (!settings) {
    await supabase.from("user_settings").insert({
      user_id: user.id,
      nickname: displayName
    });
  } else if (!settings.nickname) {
    await supabase
      .from("user_settings")
      .update({ nickname: displayName })
      .eq("user_id", user.id);
  }
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
      }
    }, 2500);

    timeout(
      supabase.auth.getSession(),
      1800,
      "로그인 확인이 늦어져서 로그인 화면으로 이동했어요. 다시 시도해도 괜찮아요."
    )
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          setSetupError(error.message);
        }

        const nextSession = data.session;
        setSession(nextSession);
        setLoading(false);

        if (nextSession?.user) {
          ensureUserDefaults(nextSession.user).catch((err) => {
            if (!cancelled) {
              setSetupError(
                err instanceof Error ? err.message : "사용자 기본 설정 생성에 실패했어요."
              );
            }
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSetupError(err instanceof Error ? err.message : "로그인 상태 확인에 실패했어요.");
          setLoading(false);
        }
      })
      .finally(() => {
        window.clearTimeout(fallbackTimer);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setLoading(false);
      if (nextSession?.user) {
        ensureUserDefaults(nextSession.user).catch((err) => {
          if (!cancelled) {
            setSetupError(err instanceof Error ? err.message : "사용자 기본 설정 생성에 실패했어요.");
          }
        });
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="app-shell">
        <section className="glass-card page-card auth-card">
          <p className="micro muted">냉이랑 루틴</p>
          <h1 className="auth-title">로그인 상태 확인 중</h1>
          <p className="body-copy">클라우드 루틴 저장을 준비하고 있어요.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <LoginPanel initialError={setupError} />;
  }

  return (
    <>
      {setupError ? (
        <section className="glass-card page-card auth-warning">
          <strong>설정 확인이 필요해요</strong>
          <p>{setupError}</p>
        </section>
      ) : null}
      {children}
      <UserMenu email={session.user.email || ""} />
    </>
  );
}
