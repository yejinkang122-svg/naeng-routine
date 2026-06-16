import type { WeightLog } from "@/lib/types";
import { getSupabaseBrowserClient } from "./supabase";

export async function getWeightLog(userId: string, measuredDate: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("measured_date", measuredDate)
    .maybeSingle<WeightLog>();

  if (error) throw error;
  return data;
}

export async function upsertWeightLog(userId: string, measuredDate: string, weight: number) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        user_id: userId,
        measured_date: measuredDate,
        weight,
        measurement_context: "custom"
      },
      { onConflict: "user_id,measured_date" }
    )
    .select("*")
    .single<WeightLog>();

  if (error) throw error;
  return data;
}
