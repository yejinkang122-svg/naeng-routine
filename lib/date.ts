export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatKoreanDate(date: Date) {
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return {
    monthLabel: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
    dayLabel: `${date.getDate()}일 ${weekdays[date.getDay()]}`
  };
}

export function formatTimeFromMinutes(minutes: number | null) {
  if (minutes === null) return undefined;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
