import { defaultCatalogSeedItems } from "@/lib/catalogSeed";
import type { CatalogItem, DailyItemRow, RoutineCategory } from "@/lib/types";
import { getSupabaseBrowserClient } from "./supabase";

export type CatalogInput = {
  category: RoutineCategory;
  title: string;
  subtitle?: string | null;
  default_time_bucket: DailyItemRow["time_bucket"];
  default_time_minutes?: number | null;
  calories?: number | null;
  protein_g?: number | null;
};

export function mapCatalogToDailyItem(item: CatalogItem) {
  return {
    category: item.category,
    title: item.title,
    subtitle: item.subtitle || "",
    time_bucket: item.default_time_bucket,
    time_minutes: item.default_time_minutes,
    planned_calories: item.category === "meal" ? item.calories : null
  };
}

export async function listCatalogItems(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<CatalogItem[]>();

  if (error) throw error;
  return data || [];
}

export async function ensureDefaultCatalogItems(userId: string) {
  const existing = await listCatalogItems(userId);
  if (existing.length > 0) return existing;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("catalog_items").insert(
    defaultCatalogSeedItems.map((item, index) => ({
      user_id: userId,
      category: item.category,
      title: item.title,
      subtitle: item.subtitle || null,
      default_time_bucket: item.time_bucket,
      default_time_minutes: item.time_minutes,
      calories: item.category === "meal" ? item.planned_calories ?? null : null,
      is_active: true,
      sort_order: index * 10
    }))
  );

  if (error) throw error;
  return listCatalogItems(userId);
}

export async function upsertCatalogItem(userId: string, values: CatalogInput, itemId?: string) {
  const supabase = getSupabaseBrowserClient();
  const payload = {
    user_id: userId,
    category: values.category,
    title: values.title,
    subtitle: values.subtitle || null,
    default_time_bucket: values.default_time_bucket,
    default_time_minutes: values.default_time_minutes ?? null,
    calories: values.category === "meal" ? values.calories ?? null : null,
    protein_g: values.protein_g ?? null,
    is_active: true
  };

  const query = itemId
    ? supabase.from("catalog_items").update(payload).eq("id", itemId)
    : supabase.from("catalog_items").insert(payload);

  const { error } = await query;
  if (error) throw error;

  return listCatalogItems(userId);
}

export async function deleteCatalogItem(userId: string, itemId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("catalog_items")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("id", itemId);

  if (error) throw error;
  return listCatalogItems(userId);
}
