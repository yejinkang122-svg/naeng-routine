"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase";

type UserMenuProps = {
  email: string;
};

export function UserMenu({ email }: UserMenuProps) {
  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div className="user-menu">
      <span>{email}</span>
      <button onClick={handleSignOut} type="button">
        로그아웃
      </button>
    </div>
  );
}
