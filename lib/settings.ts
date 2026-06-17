import type { UserSettings } from "@/lib/types";
import { getSupabaseBrowserClient } from "./supabase";

export const defaultUserSettings: Omit<UserSettings, "id" | "user_id"> = {
  start_weight: null,
  target_weight: null,
  goal_type: "lose",
  daily_calorie_goal: 1494,
  daily_protein_goal: 90,
  success_threshold_pct: 80,
  editable_past_days: 7,
  selected_theme_key: "summer_surf"
};

export async function getOrCreateUserSettings(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data: existing, error: fetchError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserSettings>();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("user_settings")
    .insert({
      user_id: userId,
      ...defaultUserSettings
    })
    .select("*")
    .single<UserSettings>();

  if (createError) throw createError;
  return created;
}

export async function updateUserSettings(
  userId: string,
  values: Partial<Omit<UserSettings, "id" | "user_id">>
) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("user_settings")
    .update(values)
    .eq("user_id", userId)
    .select("*")
    .single<UserSettings>();

  if (error) throw error;
  return data;
}
