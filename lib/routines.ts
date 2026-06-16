import type { DailyItemRow, DailyRoutine, RoutineCategory, RoutineItem } from "@/lib/types";
import { formatTimeFromMinutes, toDateKey } from "./date";
import { getSupabaseBrowserClient } from "./supabase";

export const dayTypeOptions: Array<{ value: DailyRoutine["day_type"]; label: string }> = [
  { value: "office", label: "출근 + 헬스" },
  { value: "wfh", label: "재택 근무" },
  { value: "weekend", label: "주말" },
  { value: "holiday", label: "휴일" }
];

const defaultStandingRoutines = [
  {
    category: "life" as RoutineCategory,
    title: "물 1.5L 이상 마시기",
    subtitle: "매일 해야 하는 상시 루틴",
    time_bucket: "all_day",
    time_minutes: null,
    sort_order: 10
  },
  {
    category: "supplement" as RoutineCategory,
    title: "영양제 챙기기",
    subtitle: "유산균 · 오메가3 · 비타민D",
    time_bucket: "morning",
    time_minutes: 540,
    sort_order: 20
  }
];

export const quickAddItems: Array<{
  category: RoutineCategory;
  title: string;
  subtitle: string;
  time_bucket: DailyItemRow["time_bucket"];
  time_minutes: number | null;
  planned_calories?: number | null;
}> = [
  {
    category: "meal",
    title: "아이스 아메리카노 + 감동란 + 두유",
    subtitle: "무가당 국산약콩두유 1팩",
    time_bucket: "morning",
    time_minutes: 420,
    planned_calories: 180
  },
  {
    category: "meal",
    title: "단체 외식",
    subtitle: "외식 평균",
    time_bucket: "afternoon",
    time_minutes: 720,
    planned_calories: 700
  },
  {
    category: "meal",
    title: "자유식",
    subtitle: "양에 따라 나중에 kcal 조정",
    time_bucket: "afternoon",
    time_minutes: 720,
    planned_calories: 700
  },
  {
    category: "meal",
    title: "외식",
    subtitle: "주말 외식",
    time_bucket: "afternoon",
    time_minutes: 720,
    planned_calories: 700
  },
  {
    category: "meal",
    title: "닭다리살 + 채소 + 메밀면",
    subtitle: "단백질 중심 점심",
    time_bucket: "afternoon",
    time_minutes: 720,
    planned_calories: 430
  },
  {
    category: "meal",
    title: "메밀면 + 닭다리살 + 쯔유",
    subtitle: "저녁 메뉴 A",
    time_bucket: "evening",
    time_minutes: 1140,
    planned_calories: 420
  },
  {
    category: "meal",
    title: "두부스테이크 + 구운야채 + 쯔유",
    subtitle: "저녁 메뉴",
    time_bucket: "evening",
    time_minutes: 1110,
    planned_calories: 300
  },
  {
    category: "supplement",
    title: "더단백 드링크",
    subtitle: "운동 직후 편의점 · 단백질 20g",
    time_bucket: "afternoon",
    time_minutes: 1080,
    planned_calories: 105
  },
  {
    category: "supplement",
    title: "마이프로틴 파우더",
    subtitle: "WPI 무향 · 물 300ml",
    time_bucket: "morning",
    time_minutes: 480,
    planned_calories: 100
  },
  {
    category: "exercise",
    title: "헬스",
    subtitle: "근력 60분 + 유산소 20분 + 스트레칭 10분",
    time_bucket: "afternoon",
    time_minutes: 990
  },
  {
    category: "exercise",
    title: "냉이 산책 (1회차)",
    subtitle: "강냉이랑",
    time_bucket: "afternoon",
    time_minutes: 780
  },
  {
    category: "exercise",
    title: "냉이 산책 (2회차)",
    subtitle: "강냉이랑",
    time_bucket: "evening",
    time_minutes: 1140
  },
  {
    category: "exercise",
    title: "러닝",
    subtitle: "주말 1회",
    time_bucket: "morning",
    time_minutes: 600
  },
  {
    category: "life",
    title: "물 1.5L 이상 마시기",
    subtitle: "아메리카노 1잔 = 물 한 컵 추가",
    time_bucket: "all_day",
    time_minutes: null
  },
  {
    category: "life",
    title: "11시 30분 전 취침",
    subtitle: "수면의 질 = 내일 식욕 컨트롤",
    time_bucket: "evening",
    time_minutes: 1380
  },
  {
    category: "life",
    title: "음주 주 1회 제한 지키기",
    subtitle: "와인 or 위스키 1~2잔",
    time_bucket: "evening",
    time_minutes: null
  }
];

const dayTemplateItems: Record<
  Exclude<DailyRoutine["day_type"], "custom">,
  Array<(typeof quickAddItems)[number]>
> = {
  office: [
    {
      category: "meal",
      title: "아이스 아메리카노 + 감동란 + 두유",
      subtitle: "무가당 국산약콩두유 1팩",
      time_bucket: "morning",
      time_minutes: 420,
      planned_calories: 180
    },
    {
      category: "life",
      title: "물 1.5L 이상 마시기",
      subtitle: "아메리카노 1잔 = 물 한 컵 추가",
      time_bucket: "all_day",
      time_minutes: null
    },
    {
      category: "meal",
      title: "단체 외식",
      subtitle: "외식 평균",
      time_bucket: "afternoon",
      time_minutes: 720,
      planned_calories: 700
    },
    {
      category: "exercise",
      title: "헬스",
      subtitle: "근력 60분 + 유산소 20분 + 스트레칭 10분",
      time_bucket: "afternoon",
      time_minutes: 990
    },
    {
      category: "supplement",
      title: "더단백 드링크",
      subtitle: "운동 직후 편의점 · 단백질 20g",
      time_bucket: "afternoon",
      time_minutes: 1080,
      planned_calories: 105
    },
    {
      category: "meal",
      title: "메밀면 + 닭다리살 + 쯔유",
      subtitle: "저녁 메뉴 A",
      time_bucket: "evening",
      time_minutes: 1140,
      planned_calories: 420
    },
    {
      category: "life",
      title: "11시 30분 전 취침",
      subtitle: "수면의 질 = 내일 식욕 컨트롤",
      time_bucket: "evening",
      time_minutes: 1380
    }
  ],
  wfh: [
    {
      category: "meal",
      title: "아이스 아메리카노 + 감동란 + 두유",
      subtitle: "출근일과 동일하게 고정",
      time_bucket: "morning",
      time_minutes: 420,
      planned_calories: 180
    },
    {
      category: "supplement",
      title: "마이프로틴 파우더",
      subtitle: "WPI 무향 · 물 300ml",
      time_bucket: "morning",
      time_minutes: 480,
      planned_calories: 100
    },
    {
      category: "life",
      title: "물 1.5L 이상 마시기",
      subtitle: "아메리카노 1잔 = 물 한 컵 추가",
      time_bucket: "all_day",
      time_minutes: null
    },
    {
      category: "meal",
      title: "닭다리살 + 채소 + 메밀면",
      subtitle: "단백질 중심 점심",
      time_bucket: "afternoon",
      time_minutes: 720,
      planned_calories: 430
    },
    {
      category: "exercise",
      title: "냉이 산책 (1회차)",
      subtitle: "강냉이랑",
      time_bucket: "afternoon",
      time_minutes: 780
    },
    {
      category: "meal",
      title: "두부스테이크 + 구운야채 + 쯔유",
      subtitle: "저녁 메뉴",
      time_bucket: "evening",
      time_minutes: 1110,
      planned_calories: 300
    },
    {
      category: "exercise",
      title: "냉이 산책 (2회차)",
      subtitle: "강냉이랑",
      time_bucket: "evening",
      time_minutes: 1140
    },
    {
      category: "life",
      title: "11시 30분 전 취침",
      subtitle: "수면의 질 = 내일 식욕 컨트롤",
      time_bucket: "evening",
      time_minutes: 1380
    }
  ],
  weekend: [
    {
      category: "supplement",
      title: "마이프로틴 파우더",
      subtitle: "WPI 무향 · 물 300ml",
      time_bucket: "morning",
      time_minutes: 540,
      planned_calories: 100
    },
    {
      category: "exercise",
      title: "러닝",
      subtitle: "주말 1회",
      time_bucket: "morning",
      time_minutes: 600
    },
    {
      category: "life",
      title: "물 1.5L 이상 마시기",
      subtitle: "",
      time_bucket: "all_day",
      time_minutes: null
    },
    {
      category: "meal",
      title: "외식",
      subtitle: "주말 외식",
      time_bucket: "afternoon",
      time_minutes: 720,
      planned_calories: 700
    },
    {
      category: "meal",
      title: "메밀면 + 닭다리살 + 쯔유",
      subtitle: "저녁 메뉴 A",
      time_bucket: "evening",
      time_minutes: 1110
    },
    {
      category: "life",
      title: "음주 주 1회 제한 지키기",
      subtitle: "와인 or 위스키 1~2잔",
      time_bucket: "evening",
      time_minutes: null
    },
    {
      category: "life",
      title: "11시 30분 전 취침",
      subtitle: "수면의 질 = 내일 식욕 컨트롤",
      time_bucket: "evening",
      time_minutes: 1380
    }
  ],
  holiday: [
    {
      category: "life",
      title: "물 1.5L 이상 마시기",
      subtitle: "",
      time_bucket: "all_day",
      time_minutes: null
    },
    {
      category: "supplement",
      title: "마이프로틴 파우더",
      subtitle: "WPI 무향 · 물 300ml",
      time_bucket: "morning",
      time_minutes: 600,
      planned_calories: 100
    },
    {
      category: "life",
      title: "11시 30분 전 취침",
      subtitle: "수면의 질 = 내일 식욕 컨트롤",
      time_bucket: "evening",
      time_minutes: 1380
    }
  ]
};

type StandingRoutineRow = {
  id: string;
  category: RoutineCategory;
  title: string;
  subtitle: string | null;
  time_bucket: "all_day" | "morning" | "afternoon" | "evening";
  time_minutes: number | null;
  sort_order: number;
};

export function mapDailyItemToRoutineItem(item: DailyItemRow): RoutineItem {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle || undefined,
    category: item.category,
    timeLabel: formatTimeFromMinutes(item.time_minutes),
    status: item.status,
    source: item.source,
    memo: item.memo
  };
}

export function calculateRoutineStats(items: Array<Pick<DailyItemRow, "status">>) {
  const activeItems = items.filter((item) => item.status !== "skipped");
  const checkedCount = activeItems.filter((item) => item.status === "checked").length;
  const failedCount = activeItems.filter((item) => item.status === "failed").length;
  const totalCount = activeItems.length;
  const completionPct = totalCount ? Math.round((checkedCount / totalCount) * 100) : 0;

  return {
    completion_pct: completionPct,
    total_count: totalCount,
    checked_count: checkedCount,
    skipped_count: items.filter((item) => item.status === "skipped").length,
    failed_count: failedCount
  };
}

export async function ensureStandingRoutines(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data: existing, error: fetchError } = await supabase
    .from("standing_routines")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1);

  if (fetchError) throw fetchError;
  if (existing && existing.length > 0) return;

  const { error } = await supabase.from("standing_routines").insert(
    defaultStandingRoutines.map((routine) => ({
      user_id: userId,
      ...routine,
      recurrence_rule: { type: "daily" },
      is_active: true
    }))
  );

  if (error) throw error;
}

async function fetchDailyItems(routineId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data: items, error } = await supabase
    .from("daily_items")
    .select("*")
    .eq("daily_routine_id", routineId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .returns<DailyItemRow[]>();

  if (error) throw error;
  return items || [];
}

async function updateRoutineStats(routineId: string, items: DailyItemRow[]) {
  const supabase = getSupabaseBrowserClient();
  const stats = calculateRoutineStats(items);
  const { data: routine, error } = await supabase
    .from("daily_routines")
    .update(stats)
    .eq("id", routineId)
    .select("*")
    .single<DailyRoutine>();

  if (error) throw error;
  return routine;
}

async function buildDefaultRows(userId: string, routine: DailyRoutine) {
  const templateKey = routine.day_type === "custom" ? "office" : routine.day_type;
  const templateRows = dayTemplateItems[templateKey].map((item, index) => ({
    user_id: userId,
    daily_routine_id: routine.id,
    source: "template",
    category: item.category,
    title: item.title,
    subtitle: item.subtitle,
    time_bucket: item.time_bucket,
    time_minutes: item.time_minutes,
    status: "pending",
    sort_order: index * 10,
    planned_calories: item.planned_calories ?? null,
    actual_calories: null
  }));

  return templateRows;
}

export async function getOrCreateRoutineForDate(
  userId: string,
  routineDate: string,
  options: { createIfMissing?: boolean } = {}
) {
  const supabase = getSupabaseBrowserClient();
  const createIfMissing = options.createIfMissing ?? true;

  await ensureStandingRoutines(userId);

  const { data: existingRoutine, error: routineFetchError } = await supabase
    .from("daily_routines")
    .select("*")
    .eq("user_id", userId)
    .eq("routine_date", routineDate)
    .maybeSingle<DailyRoutine>();

  if (routineFetchError) throw routineFetchError;

  let routine = existingRoutine;

  if (!routine && !createIfMissing) {
    return {
      routine: null,
      items: []
    };
  }

  if (!routine) {
    const { data: createdRoutine, error: createRoutineError } = await supabase
      .from("daily_routines")
      .insert({
        user_id: userId,
        routine_date: routineDate,
        day_type: "office",
        completion_pct: 0,
        total_count: 0,
        checked_count: 0,
        skipped_count: 0,
        failed_count: 0
      })
      .select("*")
      .single<DailyRoutine>();

    if (createRoutineError) throw createRoutineError;
    routine = createdRoutine;
  }

  let items = await fetchDailyItems(routine.id);

  if (items.length === 0) {
    const rows = await buildDefaultRows(userId, routine);

    if (rows.length > 0) {
      const { data: createdItems, error: createItemsError } = await supabase
        .from("daily_items")
        .insert(rows)
        .select("*")
        .order("sort_order", { ascending: true })
        .returns<DailyItemRow[]>();

      if (createItemsError) throw createItemsError;
      items = createdItems || [];
    }
  } else if (items.every((item) => item.source === "standing")) {
    const rows = (await buildDefaultRows(userId, routine)).filter((item) => item.source === "template");

    if (rows.length > 0) {
      const { error: createTemplateError } = await supabase.from("daily_items").insert(rows);
      if (createTemplateError) throw createTemplateError;
      items = await fetchDailyItems(routine.id);
    }
  }

  const updatedRoutine = await updateRoutineStats(routine.id, items);

  return {
    routine: updatedRoutine,
    items
  };
}

export async function getOrCreateTodayRoutine(userId: string) {
  return getOrCreateRoutineForDate(userId, toDateKey(new Date()));
}

export async function replaceRoutineDayType(
  userId: string,
  routineId: string,
  nextDayType: DailyRoutine["day_type"]
) {
  const supabase = getSupabaseBrowserClient();
  const { data: routine, error: routineError } = await supabase
    .from("daily_routines")
    .update({ day_type: nextDayType })
    .eq("id", routineId)
    .select("*")
    .single<DailyRoutine>();

  if (routineError) throw routineError;

  const { error: deleteError } = await supabase
    .from("daily_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("daily_routine_id", routineId)
    .is("deleted_at", null);

  if (deleteError) throw deleteError;

  const rows = await buildDefaultRows(userId, routine);
  const { data: items, error: createError } = await supabase
    .from("daily_items")
    .insert(rows)
    .select("*")
    .order("sort_order", { ascending: true })
    .returns<DailyItemRow[]>();

  if (createError) throw createError;

  return {
    routine: await updateRoutineStats(routineId, items || []),
    items: items || []
  };
}

export async function updateDailyItemStatus(
  routineId: string,
  itemId: string,
  nextStatus: DailyItemRow["status"]
) {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase
    .from("daily_items")
    .update({
      status: nextStatus,
      checked_at: nextStatus === "checked" ? new Date().toISOString() : null
    })
    .eq("id", itemId);

  if (error) throw error;

  const items = await fetchDailyItems(routineId);
  const stats = calculateRoutineStats(items);
  const { data: routine, error: routineError } = await supabase
    .from("daily_routines")
    .update({
      ...stats,
      checkin_at: new Date().toISOString()
    })
    .eq("id", routineId)
    .select("*")
    .single<DailyRoutine>();

  if (routineError) throw routineError;

  return {
    routine,
    items
  };
}

export async function updateDailyItemMemo(routineId: string, itemId: string, memo: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("daily_items").update({ memo }).eq("id", itemId);
  if (error) throw error;

  return {
    items: await fetchDailyItems(routineId)
  };
}

export async function updateDailyItemContent(
  routineId: string,
  itemId: string,
  item: {
    category: RoutineCategory;
    title: string;
    subtitle?: string;
    time_bucket: DailyItemRow["time_bucket"];
    time_minutes?: number | null;
    planned_calories?: number | null;
  }
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("daily_items")
    .update({
      category: item.category,
      title: item.title,
      subtitle: item.subtitle || null,
      time_bucket: item.time_bucket,
      time_minutes: item.time_minutes ?? null,
      planned_calories: item.planned_calories ?? null,
      actual_calories: null,
      actual_title: null
    })
    .eq("id", itemId);

  if (error) throw error;

  return {
    items: await fetchDailyItems(routineId)
  };
}

export async function softDeleteDailyItem(routineId: string, itemId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("daily_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) throw error;

  const items = await fetchDailyItems(routineId);
  return {
    routine: await updateRoutineStats(routineId, items),
    items
  };
}

export async function addDailyItem(
  userId: string,
  routineId: string,
  item: {
    category: RoutineCategory;
    title: string;
    subtitle?: string;
    time_bucket: DailyItemRow["time_bucket"];
    time_minutes?: number | null;
    planned_calories?: number | null;
  }
) {
  const supabase = getSupabaseBrowserClient();
  const currentItems = await fetchDailyItems(routineId);
  const lastSortOrder = currentItems.reduce((max, row) => Math.max(max, row.sort_order), 0);

  const { error } = await supabase.from("daily_items").insert({
    user_id: userId,
    daily_routine_id: routineId,
    source: "manual",
    category: item.category,
    title: item.title,
    subtitle: item.subtitle || null,
    time_bucket: item.time_bucket,
    time_minutes: item.time_minutes ?? null,
    planned_calories: item.planned_calories ?? null,
    status: "pending",
    sort_order: lastSortOrder + 10
  });

  if (error) throw error;

  const items = await fetchDailyItems(routineId);
  return {
    routine: await updateRoutineStats(routineId, items),
    items
  };
}
