"use client";

import type { CSSProperties, FormEvent, TouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem, DailyItemRow, DailyRoutine, RoutineCategory, RoutineItem, UserSettings } from "@/lib/types";
import { formatKoreanDate } from "@/lib/date";
import {
  addDailyItem,
  dayTypeOptions,
  getOrCreateRoutineForDate,
  mapDailyItemToRoutineItem,
  replaceRoutineDayType,
  softDeleteDailyItem,
  updateDailyItemContent,
  updateDailyItemMemo,
  updateDailyItemStatus
} from "@/lib/routines";
import { ensureDefaultCatalogItems, mapCatalogToDailyItem, upsertCatalogItem } from "@/lib/catalog";
import { defaultUserSettings, getOrCreateUserSettings } from "@/lib/settings";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { applyThemeToDocument, getAccessibleHeaderTextColor } from "@/lib/theme";
import type { WeightLog } from "@/lib/types";
import { toDateKey } from "@/lib/date";
import { getPreviousWeightLog, getWeightLog, upsertWeightLog } from "@/lib/weight";
import { StatusCalendar } from "./StatusCalendar";
import { WeightSheet } from "./WeightSheet";

const categoryLabel: Record<RoutineCategory, string> = {
  meal: "식단",
  exercise: "운동",
  supplement: "영양제",
  life: "생활"
};

const timeTabs: Array<{ id: DailyItemRow["time_bucket"] | "all"; label: string }> = [
  { id: "all", label: "종일" },
  { id: "morning", label: "오전" },
  { id: "afternoon", label: "오후" },
  { id: "evening", label: "저녁" }
];

const timeSections: Array<{ id: DailyItemRow["time_bucket"]; label: string }> = [
  { id: "all_day", label: "종일" },
  { id: "morning", label: "오전" },
  { id: "afternoon", label: "오후" },
  { id: "evening", label: "저녁" }
];

type AddCategory = RoutineCategory | "custom";
type ReportSnapshot = {
  routines: DailyRoutine[];
  items: DailyItemRow[];
  weights: WeightLog[];
};

const reportInitialSnapshot: ReportSnapshot = {
  routines: [],
  items: [],
  weights: []
};

const customTimeOptions = [
  { label: "종일", value: "all_day" },
  ...Array.from({ length: 48 }, (_, index) => {
    const minutes = index * 30;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return {
      label,
      value: String(minutes)
    };
  })
];

function bucketFromMinutes(minutes: number | null): DailyItemRow["time_bucket"] {
  if (minutes === null) return "all_day";
  if (minutes < 720) return "morning";
  if (minutes < 1140) return "afternoon";
  return "evening";
}

function shiftDateKey(dateKey: string, offset: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function dayDiffFromToday(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getRoutineStatusIcon(routine: DailyRoutine | null) {
  if (!routine || routine.total_count === 0) {
    return { alt: "진행중", src: "/calendar_sword_title.png" };
  }

  if (routine.completion_pct >= 80) {
    return { alt: "달성", src: "/calendar_heart.png" };
  }

  return { alt: "진행중", src: "/calendar_sword_title.png" };
}

function getDateRangeKeys(endDateKey: string, days: number) {
  return Array.from({ length: days }, (_, index) => shiftDateKey(endDateKey, index - (days - 1)));
}

function getPercent(checked: number, total: number) {
  return total > 0 ? Math.round((checked / total) * 100) : 0;
}

function getMealCalories(item: Pick<DailyItemRow, "actual_calories" | "planned_calories">) {
  return item.actual_calories ?? item.planned_calories ?? null;
}

function formatWeightDelta(delta: number | null) {
  if (delta === null) return "비교 데이터 없음";
  if (delta === 0) return "변화 없음";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}kg`;
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "좋은 아침";
  if (hour >= 12 && hour < 18) return "좋은 오후";
  return "좋은 밤";
}

export function RoutineShell() {
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [routine, setRoutine] = useState<DailyRoutine | null>(null);
  const [dailyItems, setDailyItems] = useState<DailyItemRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [weightLog, setWeightLog] = useState<WeightLog | null>(null);
  const [fallbackWeightLog, setFallbackWeightLog] = useState<WeightLog | null>(null);
  const [navigableDateKeys, setNavigableDateKeys] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Omit<UserSettings, "id" | "user_id">>(defaultUserSettings);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [categorySheetItem, setCategorySheetItem] = useState<DailyItemRow | null>(null);
  const [memoSheetItem, setMemoSheetItem] = useState<DailyItemRow | null>(null);
  const [memoText, setMemoText] = useState("");
  const [mealSheetOpen, setMealSheetOpen] = useState(false);
  const [mealTitle, setMealTitle] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealSaveTemplate, setMealSaveTemplate] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [routineDockExpanded, setRoutineDockExpanded] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [reportSnapshot, setReportSnapshot] = useState<ReportSnapshot>(reportInitialSnapshot);
  const [reportLoading, setReportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DailyItemRow["time_bucket"] | "all">("all");
  const [addCategory, setAddCategory] = useState<AddCategory>("meal");
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState<RoutineCategory>("meal");
  const [customTime, setCustomTime] = useState("all_day");
  const [customCalories, setCustomCalories] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const daySelectorRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollYRef = useRef<number | null>(null);
  const routineDockTouchStartYRef = useRef<number | null>(null);
  const routineRowTouchStartXRef = useRef<number | null>(null);

  const routineItems = useMemo<RoutineItem[]>(
    () => dailyItems.map(mapDailyItemToRoutineItem),
    [dailyItems]
  );

  const groupedItems = useMemo(() => {
    return timeSections.reduce<Record<DailyItemRow["time_bucket"], DailyItemRow[]>>(
      (groups, section) => {
        groups[section.id] = dailyItems.filter((item) => item.time_bucket === section.id);
        return groups;
      },
      { all_day: [], morning: [], afternoon: [], evening: [] }
    );
  }, [dailyItems]);

  const percent = routine?.completion_pct || 0;
  const selectedDateParts = selectedDateKey.split("-").map(Number);
  const selectedDate = new Date(selectedDateParts[0], selectedDateParts[1] - 1, selectedDateParts[2]);
  const todayLabel = formatKoreanDate(selectedDate);
  const selectedDayDiff = dayDiffFromToday(selectedDateKey);
  const isReadOnlyDate = selectedDayDiff > 0 || selectedDayDiff < -settings.editable_past_days;
  const dayTypeLabel =
    dayTypeOptions.find((option) => option.value === routine?.day_type)?.label || "출근 + 헬스";
  const statusIcon = getRoutineStatusIcon(routine);
  const greeting = `${getTimeGreeting()}, ${settings.nickname || "냉이"}!`;
  const fullDateLabel = `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
  const calorieGoal = settings.daily_calorie_goal;
  const successThreshold = settings.success_threshold_pct;
  const headerTextColor = getAccessibleHeaderTextColor(settings.selected_theme_key);
  const displayWeight = weightLog?.weight ?? fallbackWeightLog?.weight ?? null;
  const targetWeight = settings.target_weight;
  const canShiftDate = (offset: number) => {
    const nextDateKey = shiftDateKey(selectedDateKey, offset);
    return nextDateKey <= toDateKey(new Date()) && navigableDateKeys.has(nextDateKey);
  };

  const checkedCalories = dailyItems
    .filter((item) => item.status === "checked" && item.category === "meal" && getMealCalories(item) !== null)
    .reduce((sum, item) => sum + (getMealCalories(item) || 0), 0);
  const checkedMealItems = dailyItems.filter(
    (item) => item.status === "checked" && item.category === "meal" && getMealCalories(item) !== null
  );
  const caloriePct = Math.min(100, Math.round((checkedCalories / calorieGoal) * 100));
  const reportData = useMemo(() => {
    const activeItems = dailyItems.filter((item) => item.status !== "skipped");
    const incompleteCount = activeItems.filter((item) => item.status !== "checked").length;

    const categoryStats = (Object.keys(categoryLabel) as RoutineCategory[]).map((category) => {
      const rows = activeItems.filter((item) => item.category === category);
      const checked = rows.filter((item) => item.status === "checked").length;
      return {
        id: category,
        label: categoryLabel[category],
        checked,
        total: rows.length,
        percent: getPercent(checked, rows.length)
      };
    });

    const timeStats = timeSections.map((section) => {
      const rows = activeItems.filter((item) => item.time_bucket === section.id);
      const checked = rows.filter((item) => item.status === "checked").length;
      return {
        id: section.id,
        label: section.label,
        checked,
        total: rows.length,
        percent: getPercent(checked, rows.length)
      };
    });

    const strongestTime = timeStats
      .filter((stat) => stat.total > 0)
      .sort((a, b) => b.percent - a.percent)[0];
    const weakestTime = timeStats
      .filter((stat) => stat.total > 0)
      .sort((a, b) => a.percent - b.percent)[0];

    const routineById = reportSnapshot.routines.reduce<Record<string, DailyRoutine>>((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const dateKeys = getDateRangeKeys(selectedDateKey, 7);
    const routineByDate = reportSnapshot.routines.reduce<Record<string, DailyRoutine>>((acc, row) => {
      acc[row.routine_date] = row;
      return acc;
    }, {});
    const sortedRoutines = dateKeys
      .map((dateKey) => routineByDate[dateKey])
      .filter(Boolean) as DailyRoutine[];

    let currentStreak = 0;
    for (let index = dateKeys.length - 1; index >= 0; index -= 1) {
      const row = routineByDate[dateKeys[index]];
      if (row && row.completion_pct >= successThreshold) currentStreak += 1;
      else break;
    }

    let bestStreak = 0;
    let runningStreak = 0;
    dateKeys.forEach((dateKey) => {
      const row = routineByDate[dateKey];
      if (row && row.completion_pct >= successThreshold) {
        runningStreak += 1;
        bestStreak = Math.max(bestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    });

    const weeklyBars = dateKeys.map((dateKey) => {
      const row = routineByDate[dateKey];
      return {
        dateKey,
        day: Number(dateKey.slice(-2)),
        percent: row?.completion_pct || 0
      };
    });
    const recordedRoutineDays = sortedRoutines.filter((row) => row.total_count > 0);
    const weeklyAverageCompletion = recordedRoutineDays.length
      ? Math.round(
          recordedRoutineDays.reduce((sum, row) => sum + row.completion_pct, 0) / recordedRoutineDays.length
        )
      : 0;

    const itemsByRoutineDate = reportSnapshot.items.reduce<Record<string, DailyItemRow[]>>((acc, item) => {
      const dateKey = routineById[item.daily_routine_id]?.routine_date;
      if (!dateKey) return acc;
      acc[dateKey] = [...(acc[dateKey] || []), item];
      return acc;
    }, {});

    const calorieDays = dateKeys.map((dateKey) => {
      const sum = (itemsByRoutineDate[dateKey] || [])
        .filter((item) => item.status === "checked" && item.category === "meal" && getMealCalories(item) !== null)
        .reduce((total, item) => total + (getMealCalories(item) || 0), 0);
      return { dateKey, kcal: sum };
    });
    const calorieBars = calorieDays.map((day) => ({
      ...day,
      day: Number(day.dateKey.slice(-2)),
      percent: calorieGoal ? Math.min(100, Math.round((day.kcal / calorieGoal) * 100)) : 0
    }));
    const recordedCalorieDays = calorieDays.filter((day) => day.kcal > 0);
    const averageCalories = recordedCalorieDays.length
      ? Math.round(recordedCalorieDays.reduce((sum, day) => sum + day.kcal, 0) / recordedCalorieDays.length)
      : 0;
    const calorieGoalDays = recordedCalorieDays.filter((day) => day.kcal <= calorieGoal).length;
    const calorieGoalRate = getPercent(calorieGoalDays, recordedCalorieDays.length);
    const overCalorieDays = recordedCalorieDays.filter((day) => day.kcal > calorieGoal).length;
    const underCalorieDays = recordedCalorieDays.filter((day) => day.kcal > 0 && day.kcal < calorieGoal * 0.75).length;

    const sortedWeights = [...reportSnapshot.weights].sort((a, b) =>
      a.measured_date.localeCompare(b.measured_date)
    );
    const selectedWeight =
      sortedWeights.find((weight) => weight.measured_date === selectedDateKey) || weightLog || null;
    const previousWeight = [...sortedWeights]
      .reverse()
      .find((weight) => weight.measured_date < selectedDateKey);
    const firstWeight = sortedWeights[0] || null;
    const lastWeight = sortedWeights[sortedWeights.length - 1] || null;
    const weightDelta = selectedWeight && previousWeight
      ? Number(selectedWeight.weight) - Number(previousWeight.weight)
      : null;
    const weeklyWeightDelta = firstWeight && lastWeight
      ? Number(lastWeight.weight) - Number(firstWeight.weight)
      : null;
    const minWeight = sortedWeights.length
      ? Math.min(...sortedWeights.map((weight) => Number(weight.weight)))
      : null;
    const maxWeight = sortedWeights.length
      ? Math.max(...sortedWeights.map((weight) => Number(weight.weight)))
      : null;
    const averageWeight = sortedWeights.length
      ? sortedWeights.reduce((sum, weight) => sum + Number(weight.weight), 0) / sortedWeights.length
      : null;
    const weightByDate = sortedWeights.reduce<Record<string, WeightLog>>((acc, weight) => {
      acc[weight.measured_date] = weight;
      return acc;
    }, {});
    const weightRange = minWeight !== null && maxWeight !== null ? Math.max(maxWeight - minWeight, 0.1) : 0.1;
    const weightTrendBars = dateKeys.map((dateKey) => {
      const weight = weightByDate[dateKey];
      const value = weight ? Number(weight.weight) : null;
      const percent = value !== null && minWeight !== null
        ? Math.round(((value - minWeight) / weightRange) * 80) + 10
        : 0;
      return {
        dateKey,
        day: Number(dateKey.slice(-2)),
        value,
        percent
      };
    });
    const targetWeightProgress = settings.start_weight && settings.target_weight && lastWeight
      ? Math.max(
          0,
          Math.min(
            100,
            settings.goal_type === "gain"
              ? Math.round(
                  ((Number(lastWeight.weight) - Number(settings.start_weight)) /
                    (Number(settings.target_weight) - Number(settings.start_weight) || 1)) *
                    100
                )
              : Math.round(
                  ((Number(settings.start_weight) - Number(lastWeight.weight)) /
                    (Number(settings.start_weight) - Number(settings.target_weight) || 1)) *
                    100
                )
          )
        )
      : null;

    const routineStats = reportSnapshot.items.reduce<Record<string, { title: string; checked: number; total: number }>>(
      (acc, item) => {
        const current = acc[item.title] || { title: item.title, checked: 0, total: 0 };
        if (item.status !== "skipped") {
          current.total += 1;
          if (item.status === "checked") current.checked += 1;
        }
        acc[item.title] = current;
        return acc;
      },
      {}
    );
    const rankedRoutines = Object.values(routineStats)
      .filter((item) => item.total > 0)
      .map((item) => ({ ...item, percent: getPercent(item.checked, item.total) }))
      .sort((a, b) => b.percent - a.percent);
    const bestRoutines = rankedRoutines.slice(0, 3);
    const riskRoutines = [...rankedRoutines].sort((a, b) => a.percent - b.percent).slice(0, 2);

    const exerciseStats = categoryStats.find((stat) => stat.id === "exercise");
    const mealStats = categoryStats.find((stat) => stat.id === "meal");
    const summary =
      percent >= successThreshold
        ? "오늘은 루틴 흐름이 안정적이에요. 남은 항목은 유지 리듬을 깨지 않는 선에서 가볍게 마무리하면 좋아요."
        : weakestTime
          ? `${weakestTime.label} 루틴이 오늘의 병목이에요. 가장 작은 항목 1개만 먼저 완료하면 달성률을 끌어올릴 수 있어요.`
          : "아직 분석할 항목이 적어요. 오늘 루틴을 몇 개만 체크해도 패턴이 더 선명해져요.";
    const coaching =
      exerciseStats && exerciseStats.percent < 50
        ? "운동은 60분 목표보다 20분 시작으로 낮추고, 식단 직후에 붙이면 성공 확률이 올라가요."
        : mealStats && mealStats.percent < 60
          ? "식단 루틴은 직접 입력보다 자주 먹는 조합을 먼저 선택하는 방식이 더 안정적이에요."
          : "현재 잘 유지되는 루틴을 그대로 두고, 자주 빠뜨린 시간대만 하나씩 줄여보세요.";

    return {
      averageCalories,
      averageWeight,
      bestRoutines,
      bestStreak,
      calorieGoalRate,
      categoryStats,
      coaching,
      currentStreak,
      incompleteCount,
      maxWeight,
      minWeight,
      overCalorieDays,
      recordedCalorieDays,
      riskRoutines,
      selectedWeight,
      sortedRoutines,
      strongestTime,
      summary,
      timeStats,
      underCalorieDays,
      calorieBars,
      targetWeightProgress,
      weeklyBars,
      weeklyAverageCompletion,
      weeklyWeightDelta,
      weightTrendBars,
      weightDelta,
      weakestTime
    };
  }, [calorieGoal, dailyItems, percent, reportSnapshot, selectedDateKey, settings, successThreshold, weightLog]);

  useEffect(() => {
    let ignore = false;
    loadRoutineForDate(selectedDateKey, ignore);

    return () => {
      ignore = true;
    };
  }, [selectedDateKey]);

  useEffect(() => {
    if (loading || pendingScrollYRef.current === null) return;

    const targetY = pendingScrollYRef.current;
    pendingScrollYRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    });
  }, [dailyItems, loading]);

  useEffect(() => {
    applyThemeToDocument(settings.selected_theme_key);
  }, [settings.selected_theme_key]);

  useEffect(() => {
    if (!dayMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!daySelectorRef.current?.contains(event.target as Node)) {
        setDayMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [dayMenuOpen]);

  useEffect(() => {
    const sheetOpen =
      addSheetOpen ||
      Boolean(memoSheetItem) ||
      calendarOpen ||
      mealSheetOpen ||
      reportOpen ||
      routineDockExpanded ||
      weightSheetOpen;
    if (!sheetOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [addSheetOpen, calendarOpen, mealSheetOpen, memoSheetItem, reportOpen, routineDockExpanded, weightSheetOpen]);

  useEffect(() => {
    let ticking = false;

    function updateActiveTabByScroll() {
      const anchors = timeTabs
        .map((tab) => {
          const sectionId = tab.id === "all" ? "all_day" : tab.id;
          const element = document.getElementById(`routine-dock-section-${sectionId}`);
          return element ? { id: tab.id, top: element.getBoundingClientRect().top } : null;
        })
        .filter(Boolean) as Array<{ id: DailyItemRow["time_bucket"] | "all"; top: number }>;

      if (anchors.length === 0) return;

      const activationLine = 118;
      const passedAnchors = anchors.filter((anchor) => anchor.top <= activationLine);
      const nextActive = passedAnchors.length > 0 ? passedAnchors[passedAnchors.length - 1].id : anchors[0].id;
      setActiveTab((current) => (current === nextActive ? current : nextActive));
    }

    function handleScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        updateActiveTabByScroll();
        ticking = false;
      });
    }

    updateActiveTabByScroll();
    const dockScroller = document.querySelector(".routine-dock-scroll");
    dockScroller?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      dockScroller?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [dailyItems, routineDockExpanded]);

  useEffect(() => {
    if (!reportOpen || !userId) return;

    let cancelled = false;

    async function loadReport() {
      setReportLoading(true);
      const supabase = getSupabaseBrowserClient();
      const dateKeys = getDateRangeKeys(selectedDateKey, 7);
      const startDate = dateKeys[0];
      const endDate = dateKeys[dateKeys.length - 1];

      try {
        const { data: routinesData, error: routinesError } = await supabase
          .from("daily_routines")
          .select("*")
          .eq("user_id", userId)
          .gte("routine_date", startDate)
          .lte("routine_date", endDate)
          .returns<DailyRoutine[]>();

        if (routinesError) throw routinesError;

        const routineIds = (routinesData || []).map((row) => row.id);
        const { data: itemsData, error: itemsError } = routineIds.length
          ? await supabase
              .from("daily_items")
              .select("*")
              .in("daily_routine_id", routineIds)
              .is("deleted_at", null)
              .returns<DailyItemRow[]>()
          : { data: [], error: null };

        if (itemsError) throw itemsError;

        const { data: weightsData, error: weightsError } = await supabase
          .from("weight_logs")
          .select("*")
          .eq("user_id", userId)
          .gte("measured_date", startDate)
          .lte("measured_date", endDate)
          .returns<WeightLog[]>();

        if (weightsError) throw weightsError;

        if (!cancelled) {
          setReportSnapshot({
            routines: routinesData || [],
            items: itemsData || [],
            weights: weightsData || []
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "리포트 데이터를 불러오지 못했어요.");
        }
      } finally {
        if (!cancelled) {
          setReportLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      cancelled = true;
    };
  }, [reportOpen, selectedDateKey, userId]);

  async function loadRoutineForDate(dateKey: string, ignore = false) {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        throw new Error("로그인 정보를 찾을 수 없어요.");
      }

      setUserId(data.user.id);
      const nextSettings = await getOrCreateUserSettings(data.user.id);
      const readOnlyDate =
        dayDiffFromToday(dateKey) > 0 || dayDiffFromToday(dateKey) < -nextSettings.editable_past_days;
      const result = await getOrCreateRoutineForDate(data.user.id, dateKey, {
        createIfMissing: !readOnlyDate
      });
      const weight = await getWeightLog(data.user.id, dateKey);
      const previousWeight = await getPreviousWeightLog(data.user.id, dateKey);
      const nextCatalogItems = await ensureDefaultCatalogItems(data.user.id);
      const { data: routineDates } = await supabase
        .from("daily_routines")
        .select("routine_date")
        .eq("user_id", data.user.id)
        .lte("routine_date", toDateKey(new Date()))
        .returns<Array<Pick<DailyRoutine, "routine_date">>>();

      if (!ignore) {
        setRoutine(result.routine);
        setDailyItems(result.items);
        setWeightLog(weight);
        setFallbackWeightLog(previousWeight);
        setCatalogItems(nextCatalogItems);
        setNavigableDateKeys(
          new Set([
            ...(routineDates || []).map((row) => row.routine_date),
            ...(result.routine ? [result.routine.routine_date] : [])
          ])
        );
        setSettings({
          start_weight: nextSettings.start_weight,
          target_weight: nextSettings.target_weight,
          goal_type: nextSettings.goal_type,
          daily_calorie_goal: nextSettings.daily_calorie_goal,
          daily_protein_goal: nextSettings.daily_protein_goal,
          success_threshold_pct: nextSettings.success_threshold_pct,
          editable_past_days: nextSettings.editable_past_days,
          selected_theme_key: nextSettings.selected_theme_key,
          nickname: nextSettings.nickname
        });
      }
    } catch (err) {
      if (!ignore) {
        setError(err instanceof Error ? err.message : "루틴을 불러오지 못했어요.");
      }
    } finally {
      if (!ignore) {
        setLoading(false);
      }
    }
  }

  async function handleToggle(item: RoutineItem) {
    if (!routine || isReadOnlyDate) return;
    const previousRoutine = routine;
    const previousItems = dailyItems;
    const nextStatus: DailyItemRow["status"] = item.status === "checked" ? "pending" : "checked";
    const nextItems = dailyItems.map((row) =>
      row.id === item.id
        ? {
            ...row,
            status: nextStatus,
            checked_at: nextStatus === "checked" ? new Date().toISOString() : null
          }
        : row
    );
    const activeItems = nextItems.filter((row) => row.status !== "skipped");
    const checkedCount = activeItems.filter((row) => row.status === "checked").length;

    setDailyItems(nextItems);
    setRoutine({
      ...routine,
      total_count: activeItems.length,
      checked_count: checkedCount,
      failed_count: 0,
      skipped_count: nextItems.filter((row) => row.status === "skipped").length,
      completion_pct: activeItems.length ? Math.round((checkedCount / activeItems.length) * 100) : 0
    });
    setBusyItemId(item.id);
    setError(null);

    try {
      const result = await updateDailyItemStatus(routine.id, item.id, nextStatus);
      setRoutine(result.routine);
      setDailyItems(result.items);
    } catch (err) {
      setRoutine(previousRoutine);
      setDailyItems(previousItems);
      setError(err instanceof Error ? err.message : "상태를 저장하지 못했어요.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleDayType(nextDayType: DailyRoutine["day_type"]) {
    if (!routine || !userId || isReadOnlyDate) return;
    setDayMenuOpen(false);
    setLoading(true);
    setError(null);

    try {
      const result = await replaceRoutineDayType(userId, routine.id, nextDayType);
      setRoutine(result.routine);
      setDailyItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿을 바꾸지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  function handleScrollTo(sectionId: DailyItemRow["time_bucket"] | "all") {
    setActiveTab(sectionId);
    const targetId = sectionId === "all" ? "routine-dock-section-all_day" : `routine-dock-section-${sectionId}`;
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSelectCalendarDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setCalendarOpen(false);
  }

  function handleShiftSelectedDate(offset: number) {
    if (!canShiftDate(offset)) return;
    pendingScrollYRef.current = window.scrollY;
    setSelectedDateKey((current) => shiftDateKey(current, offset));
  }

  function closeAddSheet() {
    setAddSheetOpen(false);
    setCategorySheetItem(null);
    setSelectedCatalogItemId(null);
  }

  function openAddSheet(nextCategory: AddCategory = "meal", replaceItem: DailyItemRow | null = null) {
    setCategorySheetItem(replaceItem);
    setAddCategory(nextCategory);
    setCustomCategory(nextCategory === "custom" ? replaceItem?.category || "meal" : (nextCategory as RoutineCategory));
    setSelectedCatalogItemId(null);
    setCustomTitle(replaceItem?.title || "");
    setCustomTime(replaceItem?.time_minutes === null || !replaceItem ? "all_day" : String(replaceItem.time_minutes));
    setCustomCalories(
      replaceItem?.planned_calories || replaceItem?.actual_calories
        ? String(replaceItem.actual_calories ?? replaceItem.planned_calories)
        : ""
    );
    setAddSheetOpen(true);
  }

  function handleMemo(item: DailyItemRow) {
    if (!routine || isReadOnlyDate) return;
    setMemoSheetItem(item);
    setMemoText(item.memo || "");
  }

  async function handleSaveMemo() {
    if (!routine || !memoSheetItem || isReadOnlyDate) return;

    setBusyItemId(memoSheetItem.id);
    setError(null);
    try {
      const result = await updateDailyItemMemo(routine.id, memoSheetItem.id, memoText.trim());
      setDailyItems(result.items);
      setMemoSheetItem(null);
      setMemoText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "메모를 저장하지 못했어요.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleDeleteMemo() {
    if (!routine || !memoSheetItem || isReadOnlyDate) return;

    setBusyItemId(memoSheetItem.id);
    setError(null);
    try {
      const result = await updateDailyItemMemo(routine.id, memoSheetItem.id, "");
      setDailyItems(result.items);
      setMemoSheetItem(null);
      setMemoText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "메모를 삭제하지 못했어요.");
    } finally {
      setBusyItemId(null);
    }
  }

  function handlePhoto() {
    if (isReadOnlyDate) return;
    window.alert("사진 첨부는 다음 단계에서 Supabase Storage와 연결할 예정이에요.");
  }

  function openMealSheet() {
    setMealTitle("");
    setMealCalories("");
    setMealSaveTemplate(false);
    setMealSheetOpen(true);
  }

  async function handleSaveQuickMeal(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!routine || !userId || isReadOnlyDate || !mealTitle.trim()) return;

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const kcal = mealCalories.trim() ? Number(mealCalories) : null;
    const mealItem = {
      category: "meal" as RoutineCategory,
      title: mealTitle.trim(),
      subtitle: "빠른 식단 기록",
      time_bucket: bucketFromMinutes(minutes),
      time_minutes: minutes,
      planned_calories: kcal
    };

    setError(null);
    try {
      const added = await addDailyItem(userId, routine.id, mealItem);
      const createdItem = [...added.items]
        .filter((item) => item.title === mealItem.title && item.category === "meal")
        .sort((a, b) => b.sort_order - a.sort_order)[0];

      if (createdItem) {
        const checked = await updateDailyItemStatus(routine.id, createdItem.id, "checked");
        setRoutine(checked.routine);
        setDailyItems(checked.items);
      } else {
        setRoutine(added.routine);
        setDailyItems(added.items);
      }

      if (mealSaveTemplate) {
        const nextCatalogItems = await upsertCatalogItem(userId, {
          category: "meal",
          title: mealItem.title,
          subtitle: "",
          default_time_bucket: mealItem.time_bucket,
          default_time_minutes: mealItem.time_minutes,
          calories: kcal
        });
        setCatalogItems(nextCatalogItems);
      }

      setMealTitle("");
      setMealCalories("");
      setMealSaveTemplate(false);
      setMealSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "식단을 저장하지 못했어요.");
    }
  }

  async function handleDelete(item: DailyItemRow) {
    if (!routine || isReadOnlyDate) return;
    const confirmed = window.confirm(`항목을 삭제할까요?

삭제하면 오늘 루틴에서 바로 사라져요.`);
    if (!confirmed) return;

    setBusyItemId(item.id);
    setError(null);
    try {
      const result = await softDeleteDailyItem(routine.id, item.id);
      setRoutine(result.routine);
      setDailyItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "항목을 삭제하지 못했어요.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleConfirmAdd() {
    if (!routine || !userId || isReadOnlyDate) return;

    const selectedItem = catalogItems.find((item) => item.id === selectedCatalogItemId);

    const customMinutes = customTime === "all_day" ? null : Number(customTime);
    const customKcal = customCategory === "meal" && customCalories.trim() ? Number(customCalories) : null;
    const nextItem = selectedItem ? mapCatalogToDailyItem(selectedItem) : (customTitle.trim()
      ? {
          category: customCategory,
          title: customTitle.trim(),
          subtitle: "직접 추가",
          time_bucket: bucketFromMinutes(customMinutes),
          time_minutes: customMinutes,
          planned_calories: customKcal
        }
      : null);

    if (!nextItem) return;

    setError(null);
    setBusyItemId(categorySheetItem?.id || null);
    try {
      if (categorySheetItem) {
        const result = await updateDailyItemContent(routine.id, categorySheetItem.id, nextItem);
        setDailyItems(result.items);
      } else {
        const result = await addDailyItem(userId, routine.id, nextItem);
        setRoutine(result.routine);
        setDailyItems(result.items);
      }
      setCustomTitle("");
      setCustomTime("all_day");
      setCustomCalories("");
      setSelectedCatalogItemId(null);
      closeAddSheet();
    } catch (err) {
      setError(err instanceof Error ? err.message : categorySheetItem ? "항목을 변경하지 못했어요." : "항목을 추가하지 못했어요.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleCustomAdd(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!routine || !userId || !customTitle.trim() || isReadOnlyDate) return;

    setError(null);
    const customMinutes = customTime === "all_day" ? null : Number(customTime);
    const customKcal = customCategory === "meal" && customCalories.trim() ? Number(customCalories) : null;
    try {
      const result = await addDailyItem(userId, routine.id, {
        category: customCategory,
        title: customTitle.trim(),
        subtitle: "직접 추가",
        time_bucket: bucketFromMinutes(customMinutes),
        time_minutes: customMinutes,
        planned_calories: customKcal
      });
      setRoutine(result.routine);
      setDailyItems(result.items);
      setCustomTitle("");
      setCustomTime("all_day");
      setCustomCalories("");
      setSelectedCatalogItemId(null);
      setAddSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "항목을 추가하지 못했어요.");
    }
  }

  async function handleSaveWeight(nextWeight: number) {
    if (isReadOnlyDate) {
      throw new Error("이 날짜는 수정할 수 없어요.");
    }

    if (!userId) {
      throw new Error("로그인 정보를 찾을 수 없어요.");
    }

    const saved = await upsertWeightLog(userId, selectedDateKey, nextWeight);
    setWeightLog(saved);
  }

  function handleRoutineDockTouchStart(event: TouchEvent<HTMLElement>) {
    routineDockTouchStartYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleRoutineDockTouchEnd(event: TouchEvent<HTMLElement>) {
    const startY = routineDockTouchStartYRef.current;
    routineDockTouchStartYRef.current = null;
    if (startY === null) return;

    const endY = event.changedTouches[0]?.clientY ?? startY;
    const deltaY = startY - endY;
    if (deltaY > 48) {
      setRoutineDockExpanded(true);
      return;
    }
    if (deltaY < -48) {
      setRoutineDockExpanded(false);
      setDeleteMode(false);
      setSelectedDeleteIds([]);
      setSwipedItemId(null);
    }
  }

  function toggleRoutineDockExpanded() {
    setRoutineDockExpanded((expanded) => {
      const nextExpanded = !expanded;
      if (!nextExpanded) {
        setDeleteMode(false);
        setSelectedDeleteIds([]);
        setSwipedItemId(null);
      }
      return nextExpanded;
    });
  }

  function handleRoutineRowTouchStart(event: TouchEvent<HTMLElement>) {
    routineRowTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleRoutineRowTouchEnd(event: TouchEvent<HTMLElement>, itemId: string) {
    const startX = routineRowTouchStartXRef.current;
    routineRowTouchStartXRef.current = null;
    if (startX === null || !routineDockExpanded || deleteMode) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = startX - endX;
    if (deltaX > 44) {
      setSwipedItemId(itemId);
      return;
    }
    if (deltaX < -32) {
      setSwipedItemId((current) => (current === itemId ? null : current));
    }
  }

  function toggleDeleteSelection(itemId: string) {
    setSelectedDeleteIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  function handleToggleDeleteMode() {
    setRoutineDockExpanded(true);
    setSwipedItemId(null);
    setDeleteMode((enabled) => {
      if (enabled) {
        setSelectedDeleteIds([]);
      }
      return !enabled;
    });
  }

  async function handleConfirmDeleteSelected() {
    if (!routine || isReadOnlyDate || selectedDeleteIds.length === 0) return;

    setBusyItemId("delete-selected");
    setError(null);
    try {
      let latestRoutine = routine;
      let latestItems = dailyItems;
      for (const itemId of selectedDeleteIds) {
        const result = await softDeleteDailyItem(latestRoutine.id, itemId);
        latestRoutine = result.routine;
        latestItems = result.items;
      }
      setRoutine(latestRoutine);
      setDailyItems(latestItems);
      setSelectedDeleteIds([]);
      setDeleteMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "선택한 항목을 삭제하지 못했어요.");
    } finally {
      setBusyItemId(null);
    }
  }

  function renderRoutineDockRow(row: DailyItemRow) {
    const item = routineItems.find((routineItem) => routineItem.id === row.id);
    if (!item) return null;

    const mealCalories = row.category === "meal" ? getMealCalories(row) : null;
    const displayTimeLabel = item.timeLabel || "종일";
    const deleteSelected = selectedDeleteIds.includes(row.id);
    const actionsOpen = routineDockExpanded && !deleteMode && swipedItemId === row.id;

    return (
      <article
        className={`routine-row dock-routine-row ${item.status} ${actionsOpen ? "actions-open" : ""}`}
        key={row.id}
        onTouchEnd={(event) => handleRoutineRowTouchEnd(event, row.id)}
        onTouchStart={handleRoutineRowTouchStart}
      >
        <div className="dock-row-content">
          {deleteMode ? (
            <button
              aria-label={`${item.title} 삭제 선택`}
              className={`delete-select-dot ${deleteSelected ? "selected" : ""}`}
              disabled={busyItemId === "delete-selected" || isReadOnlyDate}
              onClick={() => toggleDeleteSelection(row.id)}
              type="button"
            />
          ) : (
            <button
              aria-label={`${item.title} 체크`}
              className={`check-dot ${item.status}`}
              disabled={busyItemId === item.id || isReadOnlyDate}
              onClick={() => handleToggle(item)}
              type="button"
            />
          )}
          <div className="routine-body">
            <div className="routine-meta">
              <span className={`category-badge ${item.category}`}>
                <span>{categoryLabel[item.category]}</span>
              </span>
              {mealCalories !== null ? (
                <span className="source-label calorie-badge">{mealCalories} kcal</span>
              ) : null}
              {item.source === "standing" ? <span className="source-label">매일</span> : null}
            </div>
            <h3>{item.title}</h3>
            {item.subtitle ? <p>{item.subtitle}</p> : null}
            {item.memo ? <p className="memo-line">메모: {item.memo}</p> : null}
          </div>
          <div className="dock-row-side">
            <span className="routine-time-text">{displayTimeLabel}</span>
          </div>
        </div>
        <div className="dock-swipe-actions" aria-label="항목 액션">
          <button aria-label="사진 첨부" disabled={isReadOnlyDate} onClick={handlePhoto} title="사진 첨부" type="button">
            <span className="camera-icon" aria-hidden />
          </button>
          <button aria-label="메모" disabled={isReadOnlyDate} onClick={() => handleMemo(row)} title="메모" type="button">
            <span className="note-icon" aria-hidden />
          </button>
          <button
            aria-label="수정"
            disabled={isReadOnlyDate}
            onClick={() => openAddSheet(row.category, row)}
            title="수정"
            type="button"
          >
            <span className="edit-icon" aria-hidden />
          </button>
        </div>
      </article>
    );
  }

  return (
    <main
      className="app-shell"
      style={{ "--header-text-color": headerTextColor } as CSSProperties}
    >
      <button
        aria-label="이전 날짜"
        className="date-edge-zone left"
        disabled={!canShiftDate(-1)}
        onClick={() => handleShiftSelectedDate(-1)}
        type="button"
      />
      <button
        aria-label="다음 날짜"
        className="date-edge-zone right"
        disabled={!canShiftDate(1)}
        onClick={() => handleShiftSelectedDate(1)}
        type="button"
      />
      <div className="app-top-bar app-top-bar-main">
        <button aria-label="캘린더" className="header-icon-button glass-icon-button" onClick={() => setCalendarOpen(true)} type="button">
          <svg aria-hidden viewBox="0 0 22 22">
            <rect x="3" y="4" width="16" height="15" rx="2" />
            <line x1="3" y1="8" x2="19" y2="8" />
            <line x1="7" y1="2" x2="7" y2="6" />
            <line x1="15" y1="2" x2="15" y2="6" />
            <circle cx="7" cy="12" r="0.8" />
            <circle cx="11" cy="12" r="0.8" />
            <circle cx="15" cy="12" r="0.8" />
          </svg>
        </button>
        <a aria-label="설정" className="header-icon-button glass-icon-button" href="/settings">
          <svg aria-hidden viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="3.5" />
            <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.6 4.6l1.4 1.4M16 16l1.4 1.4M4.6 17.4l1.4-1.4M16 6l1.4-1.4" />
          </svg>
        </a>
      </div>
      <section className="dashboard-title-summary">
        <div className="title-row">
          <div className="date-title-group">
            <p className="micro muted">{fullDateLabel}</p>
            <div className="date-line">
              <h1>{greeting}</h1>
              <img alt={statusIcon.alt} className="profile-pixel status-pixel" src={statusIcon.src} />
            </div>
          </div>
          <div className="progress-block">
            <div
              className="progress-ring"
              style={
                {
                  "--pct": percent,
                  "--pct-start-angle": `${percent * 1.2}deg`,
                  "--pct-mid-angle": `${percent * 2.4}deg`,
                  "--pct-angle": `${percent * 3.6}deg`
                } as CSSProperties
              }
            >
              <span>{percent}%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card dashboard-header">
        <div className="header-actions">
          <button
            className="weight-chip"
            disabled={isReadOnlyDate}
            onClick={() => setWeightSheetOpen(true)}
            type="button"
          >
            <span>{displayWeight ? `${Number(displayWeight).toFixed(1)} kg` : "-- kg"}</span>
            <span aria-hidden className="chip-icon">
              ›
            </span>
          </button>
          <div className="day-selector" ref={daySelectorRef}>
            <button
              aria-expanded={dayMenuOpen}
              className="day-chip"
              disabled={isReadOnlyDate}
              onClick={() => setDayMenuOpen((open) => !open)}
              type="button"
            >
              <span>{dayTypeLabel}</span>
              <span aria-hidden className="chip-icon chip-icon-down">
                ›
              </span>
            </button>
            {dayMenuOpen ? (
              <div className="day-menu">
                {dayTypeOptions.map((option) => (
                  <button
                    className={option.value === routine?.day_type ? "active" : ""}
                    key={option.value}
                    onClick={() => handleDayType(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="calorie-block">
          <div className="calorie-head">
            <span>섭취 칼로리</span>
            <strong>
              {checkedCalories} / {calorieGoal} kcal
            </strong>
          </div>
          <div className="calorie-track">
            <span style={{ width: `${caloriePct}%` }} />
          </div>
          <div className="calorie-detail-list">
            {checkedMealItems.length > 0 ? (
              checkedMealItems.map((item) => (
                <span key={item.id}>
                  {item.actual_title || item.title} · {getMealCalories(item)} kcal
                </span>
              ))
            ) : (
              <span>kcal가 있는 식단을 체크하면 반영돼요</span>
            )}
          </div>
        </div>
      </section>

      <section
        aria-label="오늘 루틴"
        className={`routine-dock ${routineDockExpanded ? "expanded" : "collapsed"}`}
        id="today-routine-dock"
        onTouchEnd={handleRoutineDockTouchEnd}
        onTouchStart={handleRoutineDockTouchStart}
      >
        <button
          aria-label={routineDockExpanded ? "투두리스트 접기" : "투두리스트 펼치기"}
          aria-pressed={routineDockExpanded}
          className="routine-dock-handle"
          onClick={toggleRoutineDockExpanded}
          type="button"
        >
          <svg aria-hidden viewBox="0 0 24 24">
            <path d="M6 14l6-6 6 6" />
          </svg>
        </button>

        <div className="time-tabs routine-dock-tabs" aria-label="루틴 시간대 이동">
          {timeTabs.map((tab) => (
            <button
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => handleScrollTo(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error ? <p className="inline-error">{error}</p> : null}
        {loading ? <p className="body-copy">루틴을 불러오는 중이에요.</p> : null}

        <div className="routine-dock-scroll">
          <div className="routine-list">
            {timeSections.map((section) => {
              const sectionItems = groupedItems[section.id];
              if (sectionItems.length === 0) return null;

              return (
                <div className="routine-section" id={`routine-dock-section-${section.id}`} key={section.id}>
                  {section.id !== "all_day" ? (
                    <h3 className="routine-section-title">{section.label}</h3>
                  ) : null}
                  {sectionItems.map((row) => renderRoutineDockRow(row))}
                </div>
              );
            })}
            {!loading && dailyItems.length === 0 ? (
              <p className="body-copy">오늘 등록된 루틴이 없어요.</p>
            ) : null}
          </div>
        </div>

        <div className="routine-dock-toolbar" aria-label="루틴 액션">
          <button
            aria-label="항목 추가"
            className="dock-tool-button active"
            disabled={isReadOnlyDate}
            onClick={() => openAddSheet("meal")}
            type="button"
          >
            <svg aria-hidden viewBox="0 0 22 22">
              <line x1="11" y1="4" x2="11" y2="18" />
              <line x1="4" y1="11" x2="18" y2="11" />
            </svg>
          </button>
          <button aria-label="리포트" className="dock-tool-button" onClick={() => setReportOpen(true)} type="button">
            <svg aria-hidden viewBox="0 0 22 22">
              <rect x="3" y="13" width="4" height="6" />
              <rect x="9" y="9" width="4" height="10" />
              <rect x="15" y="5" width="4" height="14" />
            </svg>
          </button>
          <button
            aria-label="삭제 모드"
            className={`dock-tool-button ${deleteMode ? "active" : ""}`}
            disabled={isReadOnlyDate}
            onClick={handleToggleDeleteMode}
            type="button"
          >
            <svg aria-hidden viewBox="0 0 22 22">
              <path d="M5 6h12" />
              <path d="M9 6V4h4v2" />
              <path d="M7 8l1 10h6l1-10" />
            </svg>
          </button>
        </div>
        {deleteMode && selectedDeleteIds.length > 0 ? (
          <div className="delete-confirm-alert" role="alertdialog" aria-label="투두 삭제 확인">
            <p>{selectedDeleteIds.length}개 투두를 삭제할까요?</p>
            <div>
              <button
                className="secondary-button"
                onClick={() => {
                  setSelectedDeleteIds([]);
                  setDeleteMode(false);
                }}
                type="button"
              >
                아니오
              </button>
              <button className="primary-button" onClick={handleConfirmDeleteSelected} type="button">
                네
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {calendarOpen ? (
        <section className="calendar-screen" aria-label="캘린더 화면">
          <div className="calendar-screen-top">
            <button
              aria-label="캘린더 닫기"
              className="header-icon-button glass-icon-button"
              onClick={() => setCalendarOpen(false)}
              type="button"
            >
              <svg aria-hidden viewBox="0 0 22 22">
                <path d="M14 5l-6 6 6 6" />
              </svg>
            </button>
          </div>
          <StatusCalendar
            onSelectDate={handleSelectCalendarDate}
            selectedDateKey={selectedDateKey}
            successThreshold={successThreshold}
          />
        </section>
      ) : null}

      <WeightSheet
        currentWeight={weightLog?.weight ?? fallbackWeightLog?.weight}
        dateLabel={todayLabel.dayLabel}
        onClose={() => setWeightSheetOpen(false)}
        onSave={handleSaveWeight}
        open={weightSheetOpen}
        placeholderWeight={targetWeight}
      />

      {addSheetOpen ? (
        <div
          className="sheet-overlay"
          onClick={closeAddSheet}
          role="presentation"
        >
          <section
            className="bottom-sheet add-bottom-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={categorySheetItem ? "항목 수정" : "항목 추가"}
          >
            <div className="sheet-fixed-area">
              <div className="sheet-handle" />
              <p className="micro muted">오늘의 루틴</p>
              <h2 className="sheet-title">{categorySheetItem ? "항목 수정" : "항목 추가"}</h2>
              <div className="sheet-segment add-sheet-segment" aria-label="카테고리 선택">
                {[
                  { id: "meal", label: "식단" },
                  { id: "supplement", label: "영양제" },
                  { id: "exercise", label: "운동" },
                  { id: "life", label: "생활" },
                  { id: "custom", label: "직접" }
                ].map((tab) => (
                  <button
                    className={addCategory === tab.id ? "active" : ""}
                    key={tab.id}
                    onClick={() => {
                      setAddCategory(tab.id as AddCategory);
                      setSelectedCatalogItemId(null);
                      if (tab.id !== "custom") {
                        setCustomCategory(tab.id as RoutineCategory);
                      }
                    }}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sheet-content">
              {categorySheetItem || addCategory === "custom" ? (
                <form
                  className="custom-add-form custom-add-form-full"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleConfirmAdd();
                  }}
                >
                  <select
                    aria-label="카테고리"
                    onChange={(event) => setCustomCategory(event.target.value as RoutineCategory)}
                    value={customCategory}
                  >
                    <option value="meal">식단</option>
                    <option value="supplement">영양제</option>
                    <option value="exercise">운동</option>
                    <option value="life">생활</option>
                  </select>
                  <input
                    onChange={(event) => setCustomTitle(event.target.value)}
                    placeholder="직접 항목 입력"
                    value={customTitle}
                  />
                  <select
                    aria-label="시간"
                    className="custom-time-select"
                    onChange={(event) => setCustomTime(event.target.value)}
                    value={customTime}
                  >
                    {customTimeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {customCategory === "meal" ? (
                    <input
                      inputMode="numeric"
                      min={0}
                      onChange={(event) => setCustomCalories(event.target.value)}
                      placeholder="kcal 선택 입력"
                      type="number"
                      value={customCalories}
                    />
                  ) : null}
                </form>
              ) : null}

              {addCategory !== "custom" ? (
                <div className="quick-add-list">
                  {categorySheetItem ? <p className="template-helper">템플릿으로 빠르게 교체</p> : null}
                  {catalogItems
                    .filter((item) => item.category === addCategory)
                    .map((item) => {
                      const alreadySelected = dailyItems.some(
                        (row) => row.category === item.category && row.title === item.title
                      );
                      const isActive = selectedCatalogItemId === item.id;

                      return (
                        <button
                          className={`${alreadySelected ? "already-selected" : ""} ${isActive ? "active" : ""}`}
                          key={item.id}
                          onClick={() => setSelectedCatalogItemId(item.id)}
                          type="button"
                        >
                          <span className={`category-badge ${item.category}`}>
                            <span>{categoryLabel[item.category]}</span>
                          </span>
                          <strong>{item.title}</strong>
                          <small>{item.subtitle}</small>
                          {item.category === "meal" && item.calories ? (
                            <span className="quick-kcal">{item.calories} kcal</span>
                          ) : null}
                        </button>
                      );
                    })}
                  {catalogItems.filter((item) => item.category === addCategory).length === 0 ? (
                    <p className="body-copy">설정에서 자주 쓰는 템플릿을 추가할 수 있어요.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="sheet-command-row">
              <button className="secondary-button" onClick={closeAddSheet} type="button">
                취소
              </button>
              <button
                className="primary-button"
                disabled={
                  categorySheetItem
                    ? !customTitle.trim() && !selectedCatalogItemId
                    : addCategory === "custom"
                      ? !customTitle.trim()
                      : !selectedCatalogItemId
                }
                onClick={handleConfirmAdd}
                type="button"
              >
                {categorySheetItem ? "수정 완료" : "추가"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {memoSheetItem ? (
        <div
          className="sheet-overlay"
          onClick={() => {
            setMemoSheetItem(null);
            setMemoText("");
          }}
          role="presentation"
        >
          <section
            className="bottom-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="메모"
          >
            <div className="sheet-fixed-area">
              <div className="sheet-handle" />
              <p className="micro muted">{memoSheetItem.title}</p>
              <h2 className="sheet-title">메모</h2>
            </div>
            <div className="sheet-content">
              <textarea
                className="memo-textarea"
                onChange={(event) => setMemoText(event.target.value)}
                placeholder="오늘 이 항목에 대한 메모를 남겨주세요."
                value={memoText}
              />
            </div>
            <div className="sheet-command-row">
              <button
                className={memoSheetItem.memo ? "secondary-button danger-button" : "secondary-button"}
                onClick={() => {
                  if (memoSheetItem.memo) {
                    void handleDeleteMemo();
                    return;
                  }
                  setMemoSheetItem(null);
                  setMemoText("");
                }}
                type="button"
              >
                {memoSheetItem.memo ? "삭제" : "취소"}
              </button>
              <button className="primary-button" onClick={handleSaveMemo} type="button">
                저장
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {mealSheetOpen ? (
        <div
          className="sheet-overlay"
          onClick={() => setMealSheetOpen(false)}
          role="presentation"
        >
          <form
            className="bottom-sheet"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSaveQuickMeal}
            role="dialog"
            aria-modal="true"
            aria-label="식단 빠른 기록"
          >
            <div className="sheet-fixed-area">
              <div className="sheet-handle" />
              <p className="micro muted">오늘 먹은 것</p>
              <h2 className="sheet-title">식단 빠른 기록</h2>
            </div>
            <div className="sheet-content">
              <div className="quick-meal-form">
                <label>
                  <span>메뉴</span>
                  <input
                    autoFocus
                    onChange={(event) => setMealTitle(event.target.value)}
                    placeholder="예: 김치찌개 + 공기밥"
                    value={mealTitle}
                  />
                </label>
                <label>
                  <span>kcal</span>
                  <input
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => setMealCalories(event.target.value)}
                    placeholder="선택 입력"
                    type="number"
                    value={mealCalories}
                  />
                </label>
                <label className="inline-check-row">
                  <input
                    checked={mealSaveTemplate}
                    onChange={(event) => setMealSaveTemplate(event.target.checked)}
                    type="checkbox"
                  />
                  <span>자주 쓰는 템플릿으로 저장</span>
                </label>
              </div>
            </div>
            <div className="sheet-command-row">
              <button className="secondary-button" onClick={() => setMealSheetOpen(false)} type="button">
                취소
              </button>
              <button className="primary-button" disabled={!mealTitle.trim()} type="submit">
                기록
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {reportOpen ? (
        <div className="sheet-overlay" onClick={() => setReportOpen(false)} role="presentation">
          <section
            className="bottom-sheet report-bottom-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="리포트"
          >
            <div className="sheet-fixed-area">
              <div className="sheet-handle" />
              <p className="micro muted">최근 7일 기록</p>
              <h2 className="sheet-title">리포트</h2>
            </div>
            <div className="sheet-content report-content">
              {reportLoading ? <p className="body-copy">최근 7일 데이터를 분석하고 있어요.</p> : null}

              <section className="report-hero">
                <div>
                  <span>이번 주 루틴 완료율</span>
                  <strong>{percent}%</strong>
                </div>
                <div>
                  <span>연속 기록</span>
                  <strong>{reportData.currentStreak}일</strong>
                </div>
                <div>
                  <span>체중</span>
                  <strong>{reportData.selectedWeight ? `${Number(reportData.selectedWeight.weight).toFixed(1)}kg` : "--"}</strong>
                </div>
                <div>
                  <span>섭취 kcal</span>
                  <strong>{checkedCalories}/{calorieGoal}</strong>
                </div>
              </section>

              <p className="report-ai-copy">{reportData.summary}</p>

              <section className="report-section">
                <div className="report-section-head">
                  <h3>루틴 완료</h3>
                  <span>7일 평균 {reportData.weeklyAverageCompletion}%</span>
                </div>
                <div className="report-stat-grid">
                  <div>
                    <span>총 루틴</span>
                    <strong>{routine?.total_count || 0}</strong>
                  </div>
                  <div>
                    <span>완료</span>
                    <strong>{routine?.checked_count || 0}</strong>
                  </div>
                  <div>
                    <span>미완료</span>
                    <strong>{reportData.incompleteCount}</strong>
                  </div>
                </div>
                <div className="report-week-bars" aria-label="최근 7일 루틴 달성률">
                  {reportData.weeklyBars.map((bar) => (
                    <div key={bar.dateKey}>
                      <i>
                        <b style={{ height: `${Math.max(6, bar.percent)}%` }} />
                      </i>
                      <span>{bar.day}</span>
                    </div>
                  ))}
                </div>
                <div className="report-progress-list">
                  {reportData.categoryStats.map((stat) => (
                    <div className="report-progress-row" key={stat.id}>
                      <div>
                        <span>{stat.label}</span>
                        <strong>{stat.percent}%</strong>
                      </div>
                      <i>
                        <b style={{ width: `${stat.percent}%` }} />
                      </i>
                    </div>
                  ))}
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-head">
                  <h3>시간대 패턴</h3>
                  <span>
                    강점 {reportData.strongestTime?.label || "--"} · 약점 {reportData.weakestTime?.label || "--"}
                  </span>
                </div>
                <div className="report-progress-list">
                  {reportData.timeStats.map((stat) => (
                    <div className="report-progress-row" key={stat.id}>
                      <div>
                        <span>{stat.label}</span>
                        <strong>{stat.percent}%</strong>
                      </div>
                      <i>
                        <b style={{ width: `${stat.percent}%` }} />
                      </i>
                    </div>
                  ))}
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-head">
                  <h3>체중 흐름</h3>
                  <span>{formatWeightDelta(reportData.weeklyWeightDelta)}</span>
                </div>
                <div className="report-stat-grid">
                  <div>
                    <span>전일 대비</span>
                    <strong>{formatWeightDelta(reportData.weightDelta)}</strong>
                  </div>
                  <div>
                    <span>평균</span>
                    <strong>{reportData.averageWeight ? `${reportData.averageWeight.toFixed(1)}kg` : "--"}</strong>
                  </div>
                  <div>
                    <span>최저/최고</span>
                    <strong>
                      {reportData.minWeight && reportData.maxWeight
                        ? `${reportData.minWeight.toFixed(1)}/${reportData.maxWeight.toFixed(1)}`
                        : "--"}
                    </strong>
                  </div>
                  <div>
                    <span>목표 진행</span>
                    <strong>{reportData.targetWeightProgress === null ? "--" : `${reportData.targetWeightProgress}%`}</strong>
                  </div>
                </div>
                <div className="report-weight-trend" aria-label="최근 7일 체중 추세">
                  {reportData.weightTrendBars.map((bar) => (
                    <div key={bar.dateKey}>
                      <i>
                        {bar.value !== null ? <b style={{ bottom: `${bar.percent}%` }} /> : null}
                      </i>
                      <span>{bar.day}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-head">
                  <h3>칼로리</h3>
                  <span>목표 달성 {reportData.calorieGoalRate}%</span>
                </div>
                <div className="report-stat-grid">
                  <div>
                    <span>평균</span>
                    <strong>{reportData.averageCalories || "--"} kcal</strong>
                  </div>
                  <div>
                    <span>초과 일수</span>
                    <strong>{reportData.overCalorieDays}일</strong>
                  </div>
                  <div>
                    <span>부족 일수</span>
                    <strong>{reportData.underCalorieDays}일</strong>
                  </div>
                </div>
                <div className="report-week-bars calorie-bars" aria-label="최근 7일 칼로리 추세">
                  {reportData.calorieBars.map((bar) => (
                    <div key={bar.dateKey}>
                      <i>
                        <b style={{ height: `${Math.max(6, bar.percent)}%` }} />
                      </i>
                      <span>{bar.day}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-head">
                  <h3>잘 지킨 루틴</h3>
                  <span>최근 7일</span>
                </div>
                <div className="routine-rank-list">
                  {reportData.bestRoutines.length > 0 ? (
                    reportData.bestRoutines.map((item) => (
                      <div key={item.title}>
                        <span>{item.title}</span>
                        <strong>{item.percent}%</strong>
                      </div>
                    ))
                  ) : (
                    <p className="body-copy">아직 비교할 기록이 부족해요.</p>
                  )}
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-head">
                  <h3>자주 빠뜨린 루틴</h3>
                  <span>최근 7일</span>
                </div>
                <div className="routine-rank-list risk">
                  {reportData.riskRoutines.length > 0 ? (
                    reportData.riskRoutines.map((item) => (
                      <div key={item.title}>
                        <span>{item.title}</span>
                        <strong>{item.percent}%</strong>
                      </div>
                    ))
                  ) : (
                    <p className="body-copy">자주 빠뜨린 루틴이 없어요.</p>
                  )}
                </div>
              </section>

              <section className="report-coach-card">
                <span>다음에 시도해볼 것</span>
                <p>{reportData.coaching}</p>
              </section>
            </div>
            <div className="sheet-command-row report-close-row">
              <button className="secondary-button" onClick={() => setReportOpen(false)} type="button">
                닫기
              </button>
              </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
