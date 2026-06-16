import type { DailyItemRow, DailyRoutine, RoutineCategory, RoutineStatus } from "@/lib/types";
import { calculateRoutineStats } from "./routines";
import { getSupabaseBrowserClient } from "./supabase";

type LegacyItem = {
  id?: string;
  cat?: RoutineCategory;
  title?: string;
  sub?: string;
  time?: string;
};

type LegacyCatalog = Partial<Record<RoutineCategory, LegacyItem[]>>;

type LegacyWeight = {
  date: string;
  val: number;
};

export type LegacySnapshot = {
  exportedAt: string;
  source: "localStorage";
  keys: Record<string, unknown>;
};

export type MigrationSummary = {
  dailyRoutines: number;
  dailyItems: number;
  weightLogs: number;
  catalogItems: number;
  imageItemsSkipped: number;
  skippedDates: number;
  skippedCatalog: boolean;
};

const legacyKeyPatterns = [
  /^items_\d{4}-\d{2}-\d{2}$/,
  /^chk_\d{4}-\d{2}-\d{2}$/,
  /^memos_\d{4}-\d{2}-\d{2}$/,
  /^imgs_\d{4}-\d{2}-\d{2}$/,
  /^freemeal_\d{4}-\d{2}-\d{2}$/,
  /^dtype_\d{4}-\d{2}-\d{2}$/,
  /^records$/,
  /^wt_hist$/,
  /^catalog$/
];

const legacyKcal: Record<string, number> = {
  "아이스 아메리카노 + 감동란 + 두유": 180,
  자유식: 700,
  "단체 외식": 700,
  "닭다리살 + 채소 + 메밀면": 430,
  "메밀면 + 닭다리살 + 쯔유": 420,
  "호밀빵 + 구운야채 + 크림카레": 520,
  "닭다리살 + 구운야채 + 홀그레인 머스터드": 360,
  "두부스테이크 + 구운야채 + 쯔유": 300,
  "더단백 드링크": 105,
  "마이프로틴 파우더": 100
};

function isLegacyKey(key: string) {
  return legacyKeyPatterns.some((pattern) => pattern.test(key));
}

function readJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function collectLegacyLocalStorage(): LegacySnapshot {
  const keys: Record<string, unknown> = {};

  if (typeof window === "undefined") {
    return {
      exportedAt: new Date().toISOString(),
      source: "localStorage",
      keys
    };
  }

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !isLegacyKey(key)) continue;
    keys[key] = readJson(window.localStorage.getItem(key));
  }

  return {
    exportedAt: new Date().toISOString(),
    source: "localStorage",
    keys
  };
}

export function countLegacySnapshot(snapshot: LegacySnapshot) {
  const itemDates = Object.keys(snapshot.keys).filter((key) => key.startsWith("items_")).length;
  const weights = Array.isArray(snapshot.keys.wt_hist) ? snapshot.keys.wt_hist.length : 0;
  const catalog = countCatalogItems(snapshot.keys.catalog);
  const images = Object.keys(snapshot.keys)
    .filter((key) => key.startsWith("imgs_"))
    .reduce((sum, key) => sum + countImageItems(snapshot.keys[key]), 0);

  return {
    keyCount: Object.keys(snapshot.keys).length,
    itemDates,
    weights,
    catalog,
    images
  };
}

export function downloadSnapshot(snapshot: LegacySnapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `naeng-routine-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dateFromKey(key: string) {
  return key.slice(key.indexOf("_") + 1);
}

function mapDayType(value: unknown): DailyRoutine["day_type"] {
  if (value === "wfh" || value === "weekend" || value === "holiday" || value === "custom") {
    return value;
  }
  return "office";
}

function getLegacyCalories(title?: string) {
  if (!title) return null;
  return legacyKcal[title.trim()] || null;
}

function timeToBucket(time?: string): DailyItemRow["time_bucket"] {
  if (!time || time === "종일") return "all_day";
  if (time === "저녁") return "evening";
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "all_day";
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes < 720) return "morning";
  if (minutes < 1140) return "afternoon";
  return "evening";
}

function countImageItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).filter(
    (entry) => Array.isArray(entry) && entry.length > 0
  ).length;
}

function countCatalogItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value as LegacyCatalog).reduce((sum, entries) => {
    return sum + (Array.isArray(entries) ? entries.length : 0);
  }, 0);
}

function normalizeCategory(value: unknown): RoutineCategory {
  if (value === "meal" || value === "exercise" || value === "supplement" || value === "life") {
    return value;
  }
  return "life";
}

function timeToMinutes(time?: string) {
  if (!time || time === "종일" || time === "저녁") return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export async function migrateLegacySnapshot(userId: string, snapshot: LegacySnapshot) {
  const supabase = getSupabaseBrowserClient();
  const summary: MigrationSummary = {
    dailyRoutines: 0,
    dailyItems: 0,
    weightLogs: 0,
    catalogItems: 0,
    imageItemsSkipped: 0,
    skippedDates: 0,
    skippedCatalog: false
  };

  summary.imageItemsSkipped = Object.keys(snapshot.keys)
    .filter((key) => key.startsWith("imgs_"))
    .reduce((sum, key) => sum + countImageItems(snapshot.keys[key]), 0);

  const catalogCount = countCatalogItems(snapshot.keys.catalog);

  if (catalogCount > 0) {
    const { data: existingCatalog, error: catalogCheckError } = await supabase
      .from("catalog_items")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (catalogCheckError) throw catalogCheckError;

    if (existingCatalog && existingCatalog.length > 0) {
      summary.skippedCatalog = true;
    } else {
      const catalog = snapshot.keys.catalog as LegacyCatalog;
      const catalogRows = Object.entries(catalog).flatMap(([category, entries]) => {
        if (!Array.isArray(entries)) return [];
        return entries.map((item, index) => ({
          user_id: userId,
          category: normalizeCategory(category),
          title: item.title || "이전 항목",
          subtitle: item.sub || null,
          default_time_bucket: timeToBucket(item.time),
          default_time_minutes: timeToMinutes(item.time),
          calories: getLegacyCalories(item.title),
          is_flexible_meal: item.title === "자유식",
          sort_order: index * 10
        }));
      });

      if (catalogRows.length > 0) {
        const { error: catalogError } = await supabase.from("catalog_items").insert(catalogRows);
        if (catalogError) throw catalogError;
        summary.catalogItems = catalogRows.length;
      }
    }
  }

  const weightRows = Array.isArray(snapshot.keys.wt_hist)
    ? (snapshot.keys.wt_hist as LegacyWeight[])
        .filter((entry) => entry.date && Number.isFinite(Number(entry.val)))
        .map((entry) => ({
          user_id: userId,
          measured_date: entry.date,
          weight: Number(entry.val),
          measurement_context: "custom"
        }))
    : [];

  if (weightRows.length > 0) {
    const { error } = await supabase
      .from("weight_logs")
      .upsert(weightRows, { onConflict: "user_id,measured_date" });
    if (error) throw error;
    summary.weightLogs = weightRows.length;
  }

  const itemKeys = Object.keys(snapshot.keys).filter((key) => key.startsWith("items_")).sort();

  for (const itemKey of itemKeys) {
    const date = dateFromKey(itemKey);
    const legacyItems = snapshot.keys[itemKey];
    if (!Array.isArray(legacyItems)) continue;

    const { data: existingRoutine, error: findError } = await supabase
      .from("daily_routines")
      .select("id")
      .eq("user_id", userId)
      .eq("routine_date", date)
      .maybeSingle<{ id: string }>();

    if (findError) throw findError;

    if (existingRoutine) {
      const { data: existingItems, error: itemsError } = await supabase
        .from("daily_items")
        .select("id")
        .eq("daily_routine_id", existingRoutine.id)
        .is("deleted_at", null)
        .limit(1);

      if (itemsError) throw itemsError;
      if (existingItems && existingItems.length > 0) {
        summary.skippedDates += 1;
        continue;
      }
    }

    const checks = (snapshot.keys[`chk_${date}`] || {}) as Record<string, boolean>;
    const memos = (snapshot.keys[`memos_${date}`] || {}) as Record<string, string>;
    const freeMeals = (snapshot.keys[`freemeal_${date}`] || {}) as Record<string, string>;
    const dayType = mapDayType(snapshot.keys[`dtype_${date}`]);

    const { data: routine, error: routineError } = await supabase
      .from("daily_routines")
      .upsert(
        {
          user_id: userId,
          routine_date: date,
          day_type: dayType
        },
        { onConflict: "user_id,routine_date" }
      )
      .select("*")
      .single<DailyRoutine>();

    if (routineError) throw routineError;
    summary.dailyRoutines += 1;

    const rows = (legacyItems as LegacyItem[]).map((item, index) => {
      const legacyId = item.id || `legacy-${index}`;
      const freeMeal = freeMeals[legacyId];
      const memo = memos[legacyId];
      const status: RoutineStatus = checks[legacyId] ? "checked" : "pending";

      return {
        user_id: userId,
        daily_routine_id: routine.id,
        source: "manual",
        category: item.cat || "life",
        title: item.title || "이전 루틴",
        subtitle: item.sub || null,
        actual_title: freeMeal || null,
        memo: memo || null,
        planned_calories: getLegacyCalories(item.title),
        actual_calories: null,
        is_flexible_meal: item.title === "자유식",
        time_bucket: timeToBucket(item.time),
        time_minutes: timeToMinutes(item.time),
        status,
        checked_at: status === "checked" ? new Date().toISOString() : null,
        sort_order: index * 10
      };
    });

    if (rows.length > 0) {
      const { data: createdItems, error: insertError } = await supabase
        .from("daily_items")
        .insert(rows)
        .select("status")
        .returns<Array<Pick<DailyItemRow, "status">>>();

      if (insertError) throw insertError;
      summary.dailyItems += rows.length;

      const stats = calculateRoutineStats(createdItems || []);
      const { error: updateError } = await supabase
        .from("daily_routines")
        .update(stats)
        .eq("id", routine.id);

      if (updateError) throw updateError;
    }
  }

  const { error: importError } = await supabase.from("migration_imports").insert({
    user_id: userId,
    source: "localStorage",
    summary
  });

  if (importError) throw importError;

  return summary;
}
