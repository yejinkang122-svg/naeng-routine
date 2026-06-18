import type { DailyItemRow, RoutineCategory } from "@/lib/types";

export type DefaultCatalogSeedItem = {
  category: RoutineCategory;
  title: string;
  subtitle: string;
  time_bucket: DailyItemRow["time_bucket"];
  time_minutes: number | null;
  planned_calories?: number | null;
};

export const defaultCatalogSeedItems: DefaultCatalogSeedItem[] = [
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
