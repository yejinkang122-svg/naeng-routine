export type RoutineStatus = "pending" | "checked" | "skipped" | "failed";
export type RoutineCategory = "meal" | "exercise" | "supplement" | "life";

export type RoutineItem = {
  id: string;
  title: string;
  subtitle?: string;
  category: RoutineCategory;
  timeLabel?: string;
  status: RoutineStatus;
  source: "standing" | "template" | "manual" | "meal_log" | "meal_preset";
  memo?: string | null;
};

export type DailyRoutine = {
  id: string;
  routine_date: string;
  day_type: "office" | "wfh" | "weekend" | "holiday" | "custom";
  completion_pct: number;
  total_count: number;
  checked_count: number;
  skipped_count: number;
  failed_count: number;
};

export type DailyItemRow = {
  id: string;
  user_id: string;
  daily_routine_id: string;
  category: RoutineCategory;
  title: string;
  subtitle: string | null;
  time_bucket: "all_day" | "morning" | "afternoon" | "evening";
  time_minutes: number | null;
  status: RoutineStatus;
  checked_at: string | null;
  source: RoutineItem["source"];
  sort_order: number;
  memo: string | null;
  planned_calories: number | null;
  actual_calories: number | null;
  actual_title: string | null;
};

export type CatalogItem = {
  id: string;
  user_id: string;
  category: RoutineCategory;
  title: string;
  subtitle: string | null;
  default_time_bucket: DailyItemRow["time_bucket"];
  default_time_minutes: number | null;
  calories: number | null;
  protein_g: number | null;
  is_active: boolean;
  sort_order: number;
};

export type WeightLog = {
  id: string;
  measured_date: string;
  weight: number;
  measurement_context: "morning_empty" | "after_pt" | "evening" | "custom";
  memo: string | null;
};

export type UserSettings = {
  id: string;
  user_id: string;
  start_weight: number | null;
  target_weight: number | null;
  goal_type: "lose" | "gain" | "maintain";
  daily_calorie_goal: number;
  daily_protein_goal: number | null;
  success_threshold_pct: number;
  editable_past_days: number;
  selected_theme_key: string;
};

export type CalendarDayState =
  | "no_record"
  | "planned"
  | "in_progress"
  | "success"
  | "perfect"
  | "failed";
