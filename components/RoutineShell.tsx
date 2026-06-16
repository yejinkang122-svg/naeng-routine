"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DailyItemRow, DailyRoutine, RoutineCategory, RoutineItem } from "@/lib/types";
import { formatKoreanDate } from "@/lib/date";
import {
  addDailyItem,
  dayTypeOptions,
  getOrCreateRoutineForDate,
  mapDailyItemToRoutineItem,
  quickAddItems,
  replaceRoutineDayType,
  softDeleteDailyItem,
  updateDailyItemContent,
  updateDailyItemMemo,
  updateDailyItemStatus
} from "@/lib/routines";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { WeightLog } from "@/lib/types";
import { toDateKey } from "@/lib/date";
import { getWeightLog, upsertWeightLog } from "@/lib/weight";
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

const calorieGoal = 1494;
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

  if (routine.failed_count > 0) {
    return { alt: "실패", src: "/calendar_bomb.png" };
  }

  if (routine.completion_pct >= 80) {
    return { alt: "성공", src: "/calendar_heart.png" };
  }

  return { alt: "진행중", src: "/calendar_sword_title.png" };
}

function getDateRangeKeys(endDateKey: string, days: number) {
  return Array.from({ length: days }, (_, index) => shiftDateKey(endDateKey, index - (days - 1)));
}

function getPercent(checked: number, total: number) {
  return total > 0 ? Math.round((checked / total) * 100) : 0;
}

function formatWeightDelta(delta: number | null) {
  if (delta === null) return "비교 데이터 없음";
  if (delta === 0) return "변화 없음";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}kg`;
}

export function RoutineShell() {
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [routine, setRoutine] = useState<DailyRoutine | null>(null);
  const [dailyItems, setDailyItems] = useState<DailyItemRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [weightLog, setWeightLog] = useState<WeightLog | null>(null);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [categorySheetItem, setCategorySheetItem] = useState<DailyItemRow | null>(null);
  const [memoSheetItem, setMemoSheetItem] = useState<DailyItemRow | null>(null);
  const [memoText, setMemoText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSnapshot, setReportSnapshot] = useState<ReportSnapshot>(reportInitialSnapshot);
  const [reportLoading, setReportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DailyItemRow["time_bucket"] | "all">("all");
  const [addCategory, setAddCategory] = useState<AddCategory>("meal");
  const [selectedQuickAddTitle, setSelectedQuickAddTitle] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState<RoutineCategory>("meal");
  const [customTime, setCustomTime] = useState("all_day");
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const isReadOnlyDate = selectedDayDiff > 0 || selectedDayDiff < -2;
  const dayTypeLabel =
    dayTypeOptions.find((option) => option.value === routine?.day_type)?.label || "출근 + 헬스";
  const statusIcon = getRoutineStatusIcon(routine);

  const checkedCalories = dailyItems
    .filter((item) => item.status === "checked" && item.category === "meal")
    .reduce((sum, item) => sum + (item.actual_calories || item.planned_calories || 0), 0);
  const checkedMealItems = dailyItems.filter((item) => item.status === "checked" && item.category === "meal");
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
      if (row && row.completion_pct >= 80) currentStreak += 1;
      else break;
    }

    let bestStreak = 0;
    let runningStreak = 0;
    dateKeys.forEach((dateKey) => {
      const row = routineByDate[dateKey];
      if (row && row.completion_pct >= 80) {
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

    const itemsByRoutineDate = reportSnapshot.items.reduce<Record<string, DailyItemRow[]>>((acc, item) => {
      const dateKey = routineById[item.daily_routine_id]?.routine_date;
      if (!dateKey) return acc;
      acc[dateKey] = [...(acc[dateKey] || []), item];
      return acc;
    }, {});

    const calorieDays = dateKeys.map((dateKey) => {
      const sum = (itemsByRoutineDate[dateKey] || [])
        .filter((item) => item.status === "checked" && item.category === "meal")
        .reduce((total, item) => total + (item.actual_calories || item.planned_calories || 0), 0);
      return { dateKey, kcal: sum };
    });
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
      percent >= 80
        ? "오늘은 루틴 흐름이 안정적이에요. 남은 항목은 유지 리듬을 깨지 않는 선에서 가볍게 마무리하면 좋아요."
        : weakestTime
          ? `${weakestTime.label} 루틴이 오늘의 병목이에요. 가장 작은 항목 1개만 먼저 완료하면 달성률을 끌어올릴 수 있어요.`
          : "아직 분석할 항목이 적어요. 오늘 루틴을 몇 개만 체크해도 패턴이 더 선명해져요.";
    const coaching =
      exerciseStats && exerciseStats.percent < 50
        ? "운동은 60분 목표보다 20분 시작으로 낮추고, 식단 직후에 붙이면 성공 확률이 올라가요."
        : mealStats && mealStats.percent < 60
          ? "식단 루틴은 직접 입력보다 자주 먹는 조합을 먼저 선택하는 방식이 더 안정적이에요."
          : "현재 잘 유지되는 루틴을 그대로 두고, 실패율이 높은 시간대만 하나씩 줄여보세요.";

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
      weeklyBars,
      weeklyWeightDelta,
      weightDelta,
      weakestTime
    };
  }, [dailyItems, percent, reportSnapshot, selectedDateKey, weightLog]);

  useEffect(() => {
    let ignore = false;
    loadRoutineForDate(selectedDateKey, ignore);

    return () => {
      ignore = true;
    };
  }, [selectedDateKey]);

  useEffect(() => {
    const sheetOpen = addSheetOpen || Boolean(memoSheetItem) || reportOpen || weightSheetOpen;
    if (!sheetOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [addSheetOpen, memoSheetItem, reportOpen, weightSheetOpen]);

  useEffect(() => {
    let ticking = false;

    function updateActiveTabByScroll() {
      const anchors = timeTabs
        .map((tab) => {
          const sectionId = tab.id === "all" ? "all_day" : tab.id;
          const element = document.getElementById(`routine-section-${sectionId}`);
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
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [dailyItems]);

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
      const readOnlyDate = dayDiffFromToday(dateKey) > 0 || dayDiffFromToday(dateKey) < -2;
      const result = await getOrCreateRoutineForDate(data.user.id, dateKey, {
        createIfMissing: !readOnlyDate
      });
      const weight = await getWeightLog(data.user.id, dateKey);

      if (!ignore) {
        setRoutine(result.routine);
        setDailyItems(result.items);
        setWeightLog(weight);
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
    const failedCount = activeItems.filter((row) => row.status === "failed").length;

    setDailyItems(nextItems);
    setRoutine({
      ...routine,
      total_count: activeItems.length,
      checked_count: checkedCount,
      failed_count: failedCount,
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
      setError(err instanceof Error ? err.message : "체크 상태를 저장하지 못했어요.");
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
    const targetId = sectionId === "all" ? "routine-section-all_day" : `routine-section-${sectionId}`;
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSelectCalendarDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    window.setTimeout(() => {
      document.getElementById("today-routine-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function handleShiftSelectedDate(offset: number) {
    setSelectedDateKey((current) => shiftDateKey(current, offset));
    window.setTimeout(() => {
      document.getElementById("today-routine-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function closeAddSheet() {
    setAddSheetOpen(false);
    setCategorySheetItem(null);
    setSelectedQuickAddTitle(null);
  }

  function openAddSheet(nextCategory: AddCategory = "meal", replaceItem: DailyItemRow | null = null) {
    setCategorySheetItem(replaceItem);
    setAddCategory(nextCategory);
    setCustomCategory(nextCategory === "custom" ? replaceItem?.category || "meal" : (nextCategory as RoutineCategory));
    setSelectedQuickAddTitle(null);
    setCustomTitle(replaceItem?.title || "");
    setCustomTime(replaceItem?.time_minutes === null || !replaceItem ? "all_day" : String(replaceItem.time_minutes));
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

  async function handleDelete(item: DailyItemRow) {
    if (!routine || isReadOnlyDate) return;
    const confirmed = window.confirm(`"${item.title}" 항목을 오늘 루틴에서 삭제할까요?`);
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

    const selectedItem = quickAddItems.find(
      (item) => item.category === addCategory && item.title === selectedQuickAddTitle
    );

    const customMinutes = customTime === "all_day" ? null : Number(customTime);
    const nextItem = selectedItem || (customTitle.trim()
      ? {
          category: customCategory,
          title: customTitle.trim(),
          subtitle: "직접 추가",
          time_bucket: bucketFromMinutes(customMinutes),
          time_minutes: customMinutes,
          planned_calories: null
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
    try {
      const result = await addDailyItem(userId, routine.id, {
        category: customCategory,
        title: customTitle.trim(),
        subtitle: "직접 추가",
        time_bucket: bucketFromMinutes(customMinutes),
        time_minutes: customMinutes
      });
      setRoutine(result.routine);
      setDailyItems(result.items);
      setCustomTitle("");
      setCustomTime("all_day");
      setSelectedQuickAddTitle(null);
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

  return (
    <main className="app-shell">
      <button
        aria-label="이전 날짜"
        className="date-edge-zone left"
        onClick={() => handleShiftSelectedDate(-1)}
        type="button"
      />
      <button
        aria-label="다음 날짜"
        className="date-edge-zone right"
        onClick={() => handleShiftSelectedDate(1)}
        type="button"
      />
      <section className="glass-card dashboard-header">
        <div className="title-row">
          <div className="date-title-group">
            <p className="micro muted">{todayLabel.monthLabel}</p>
            <div className="date-line">
              <h1>{todayLabel.dayLabel}</h1>
              <img alt={statusIcon.alt} className="profile-pixel status-pixel" src={statusIcon.src} />
            </div>
          </div>
          <div className="progress-block">
            <div className="progress-ring" style={{ "--pct": percent } as CSSProperties}>
              <span>{percent}%</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="weight-chip"
            disabled={isReadOnlyDate}
            onClick={() => setWeightSheetOpen(true)}
            type="button"
          >
            <span>{weightLog ? `${Number(weightLog.weight).toFixed(1)} kg` : "-- kg"}</span>
            <span aria-hidden className="chip-icon">
              ›
            </span>
          </button>
          <div className="day-selector">
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
                  {item.actual_title || item.title} · {item.actual_calories || item.planned_calories || 0} kcal
                </span>
              ))
            ) : (
              <span>아직 체크한 음식이 없어요</span>
            )}
          </div>
        </div>
      </section>

      <section className="glass-card page-card routine-card" id="today-routine-card">
        <div className="time-tabs" aria-label="루틴 시간대 이동">
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
        {loading ? <p className="body-copy">오늘의 루틴을 클라우드에서 불러오는 중이에요.</p> : null}

        <div className="routine-list">
          {timeSections.map((section) => {
            const sectionItems = groupedItems[section.id];
            if (sectionItems.length === 0) return null;

            return (
              <div className="routine-section" id={`routine-section-${section.id}`} key={section.id}>
                {section.id !== "all_day" ? (
                  <h3 className="routine-section-title">{section.label}</h3>
                ) : null}
                {sectionItems.map((row) => {
                  const item = routineItems.find((routineItem) => routineItem.id === row.id);
                  if (!item) return null;

                  return (
                    <article className={`routine-row ${item.status}`} key={row.id}>
                        <button
                          aria-label={`${item.title} 체크`}
                          className={`check-dot ${item.status}`}
                          disabled={busyItemId === item.id || isReadOnlyDate}
                        onClick={() => handleToggle(item)}
                        type="button"
                      />
                      <div className="routine-body">
                        <div className="routine-meta">
                          <span className={`category-badge ${item.category}`}>
                            <button
                              disabled={isReadOnlyDate}
                              onClick={() => openAddSheet(row.category, row)}
                              type="button"
                            >
                              {categoryLabel[item.category]}
                            </button>
                          </span>
                          {item.timeLabel ? <span className="time-label">{item.timeLabel}</span> : null}
                          {item.source === "standing" ? <span className="source-label">매일</span> : null}
                          {row.planned_calories ? (
                            <span className="source-label">{row.planned_calories} kcal</span>
                          ) : null}
                        </div>
                        <h3>{item.title}</h3>
                        {item.subtitle ? <p>{item.subtitle}</p> : null}
                        {item.memo ? <p className="memo-line">메모: {item.memo}</p> : null}
                      </div>
                      <div className="todo-actions" aria-label="항목 액션">
                        <button
                          aria-label="메모"
                          disabled={isReadOnlyDate}
                          onClick={() => handleMemo(row)}
                          title="메모"
                          type="button"
                        >
                          ✎
                        </button>
                        <button
                          aria-label="사진 첨부"
                          disabled={isReadOnlyDate}
                          onClick={handlePhoto}
                          title="사진 첨부"
                          type="button"
                        >
                          <span className="camera-icon" aria-hidden />
                        </button>
                        <button
                          aria-label="삭제"
                          disabled={isReadOnlyDate}
                          onClick={() => handleDelete(row)}
                          title="삭제"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>

        <button
          className="add-item-button"
          disabled={isReadOnlyDate}
          onClick={() => openAddSheet("meal")}
          type="button"
        >
          항목 추가 +
        </button>
      </section>

      <StatusCalendar onSelectDate={handleSelectCalendarDate} selectedDateKey={selectedDateKey} />

      <button aria-label="리포트" className="report-fab" onClick={() => setReportOpen(true)} type="button">
        <img alt="" aria-hidden src="/report_trophy.png" />
      </button>

      <WeightSheet
        currentWeight={weightLog?.weight}
        dateLabel={todayLabel.dayLabel}
        onClose={() => setWeightSheetOpen(false)}
        onSave={handleSaveWeight}
        open={weightSheetOpen}
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
            aria-label={categorySheetItem ? "항목 변경" : "항목 추가"}
          >
            <div className="sheet-fixed-area">
              <div className="sheet-handle" />
              <p className="micro muted">오늘의 루틴</p>
              <h2 className="sheet-title">{categorySheetItem ? "항목 변경" : "항목 추가"}</h2>
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
                      setSelectedQuickAddTitle(null);
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
              {addCategory === "custom" ? (
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
                </form>
              ) : (
                <div className="quick-add-list">
                  {quickAddItems
                    .filter((item) => item.category === addCategory)
                    .map((item) => {
                      const alreadySelected = dailyItems.some(
                        (row) => row.category === item.category && row.title === item.title
                      );
                      const isActive = selectedQuickAddTitle === item.title;

                      return (
                        <button
                          className={`${alreadySelected ? "already-selected" : ""} ${isActive ? "active" : ""}`}
                          key={`${item.category}-${item.title}`}
                          onClick={() => setSelectedQuickAddTitle(item.title)}
                          type="button"
                        >
                          <span className={`category-badge ${item.category}`}>
                            <span>{categoryLabel[item.category]}</span>
                          </span>
                          <strong>{item.title}</strong>
                          <small>{item.subtitle}</small>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            <div className="sheet-command-row">
              <button className="secondary-button" onClick={closeAddSheet} type="button">
                닫기
              </button>
              <button
                className="primary-button"
                disabled={addCategory === "custom" ? !customTitle.trim() : !selectedQuickAddTitle}
                onClick={handleConfirmAdd}
                type="button"
              >
                {categorySheetItem ? "저장" : "추가"}
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
              <p className="micro muted">행동 분석 리포트</p>
              <h2 className="sheet-title">오늘의 인사이트</h2>
            </div>
            <div className="sheet-content report-content">
              {reportLoading ? <p className="body-copy">최근 7일 데이터를 분석하고 있어요.</p> : null}

              <section className="report-hero">
                <div>
                  <span>루틴 달성률</span>
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
                  <span>{routine?.checked_count || 0}/{routine?.total_count || 0}</span>
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
              </section>

              <section className="report-section">
                <div className="report-section-head">
                  <h3>좋은 루틴</h3>
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
                    <p className="body-copy">아직 비교할 루틴 데이터가 부족해요.</p>
                  )}
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-head">
                  <h3>주의 루틴</h3>
                  <span>반복 미완료 후보</span>
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
                    <p className="body-copy">아직 위험 루틴이 뚜렷하지 않아요.</p>
                  )}
                </div>
              </section>

              <section className="report-coach-card">
                <span>내일 추천 액션</span>
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
