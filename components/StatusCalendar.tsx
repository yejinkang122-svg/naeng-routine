"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarDayState, DailyRoutine } from "@/lib/types";
import { toDateKey } from "@/lib/date";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const iconByState: Partial<Record<CalendarDayState, { src: string; alt: string }>> = {
  in_progress: { src: "/calendar_sword.png", alt: "진행중" },
  success: { src: "/calendar_heart.png", alt: "성공" },
  perfect: { src: "/calendar_heart.png", alt: "성공" },
  failed: { src: "/calendar_bomb.png", alt: "실패" }
};

const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];

function getMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function stateFromRoutine(routine: DailyRoutine | undefined, successThreshold: number): CalendarDayState {
  if (!routine) return "no_record";
  if (routine.checked_count === 0 && routine.failed_count === 0 && routine.skipped_count === 0) return "planned";
  if (routine.completion_pct >= 100) return "perfect";
  if (routine.completion_pct >= successThreshold) return "success";
  if (routine.failed_count > 0 && routine.completion_pct < 50) return "failed";
  if (routine.total_count > 0) return "in_progress";
  return "planned";
}

type StatusCalendarProps = {
  onSelectDate: (dateKey: string) => void;
  selectedDateKey: string;
  successThreshold: number;
};

export function StatusCalendar({ onSelectDate, selectedDateKey, successThreshold }: StatusCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [routines, setRoutines] = useState<Record<string, DailyRoutine>>({});
  const monthSelectorRef = useRef<HTMLDivElement | null>(null);
  const todayKey = toDateKey(new Date());

  const monthDays = useMemo(() => getMonthGrid(viewDate), [viewDate]);
  const visibleDays = expanded
    ? monthDays
      : monthDays.filter((date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return date >= weekStart && date <= weekEnd;
      });

  useEffect(() => {
    const [year, month] = selectedDateKey.split("-").map(Number);
    const selectedMonthKey = `${year}-${String(month).padStart(2, "0")}`;
    const viewMonthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}`;

    if (selectedMonthKey !== viewMonthKey) {
      setViewDate(new Date(year, month - 1, 1));
    }
  }, [selectedDateKey, viewDate]);

  useEffect(() => {
    if (!monthMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!monthSelectorRef.current?.contains(event.target as Node)) {
        setMonthMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [monthMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadMonth() {
      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: allRoutines } = await supabase
        .from("daily_routines")
        .select("routine_date")
        .eq("user_id", userData.user.id)
        .order("routine_date", { ascending: false })
        .returns<Array<Pick<DailyRoutine, "routine_date">>>();

      if (!cancelled) {
        const months = Array.from(new Set((allRoutines || []).map((routine) => routine.routine_date.slice(0, 7))));
        setAvailableMonths(months.length > 0 ? months : [toDateKey(viewDate).slice(0, 7)]);
      }

      const first = monthDays[0];
      const last = monthDays[monthDays.length - 1];
      const { data, error } = await supabase
        .from("daily_routines")
        .select("*")
        .eq("user_id", userData.user.id)
        .gte("routine_date", toDateKey(first))
        .lte("routine_date", toDateKey(last))
        .returns<DailyRoutine[]>();

      if (error || cancelled) return;

      setRoutines(
        (data || []).reduce<Record<string, DailyRoutine>>((acc, routine) => {
          acc[routine.routine_date] = routine;
          return acc;
        }, {})
      );
    }

    loadMonth();

    return () => {
      cancelled = true;
    };
  }, [monthDays]);

  function selectMonth(month: string) {
    const [year, monthNumber] = month.split("-").map(Number);
    setViewDate(new Date(year, monthNumber - 1, 1));
    setMonthMenuOpen(false);
  }

  const monthLabel = `${viewDate.getFullYear()}.${String(viewDate.getMonth() + 1).padStart(2, "0")}`;

  return (
    <section className="glass-card page-card">
      <div className="section-head calendar-head">
        <div className="calendar-month-selector" ref={monthSelectorRef}>
          <button
            aria-expanded={monthMenuOpen}
            className="calendar-month-trigger"
            onClick={() => setMonthMenuOpen((open) => !open)}
            type="button"
          >
            <span>{monthLabel}</span>
            <i aria-hidden>›</i>
          </button>
          {monthMenuOpen ? (
            <div className="calendar-month-menu">
              {availableMonths.map((month) => (
                <button
                  className={month === `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}` ? "active" : ""}
                  key={month}
                  onClick={() => selectMonth(month)}
                  type="button"
                >
                  {month.replace("-", ".")}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="calendar-week-labels">
        {weekLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className={`calendar-row ${expanded ? "expanded" : ""}`}>
        {visibleDays.map((date) => {
          const dateKey = toDateKey(date);
          const routine = routines[dateKey];
          const state = stateFromRoutine(routine, successThreshold);
          const outsideMonth = date.getMonth() !== viewDate.getMonth();
          const isToday = dateKey === todayKey;
          const isFuture = dateKey > todayKey;
          const isSelectable = Boolean(routine) && !isFuture;
          const icon = isSelectable ? iconByState[state] : undefined;

          return (
            <button
              className={`calendar-day ${state} ${outsideMonth ? "muted-day" : ""} ${
                isToday ? "today" : ""
              } ${dateKey === selectedDateKey ? "selected" : ""}`}
              disabled={!isSelectable}
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              type="button"
            >
              <span>{date.getDate()}</span>
              <span className="calendar-icon-slot">
                {icon ? <img alt={icon.alt} className="calendar-status-icon" src={icon.src} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <button className="calendar-expand" onClick={() => setExpanded((open) => !open)} type="button">
        <span className={expanded ? "calendar-expand-icon open" : "calendar-expand-icon"}>›</span>
      </button>
    </section>
  );
}
