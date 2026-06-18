"use client";

import type { FormEvent } from "react";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { deleteCatalogItem, ensureDefaultCatalogItems, upsertCatalogItem } from "@/lib/catalog";
import { getOrCreateUserSettings, updateUserSettings } from "@/lib/settings";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { applyThemeToDocument, getAccessibleHeaderTextColor } from "@/lib/theme";
import type { CatalogItem, DailyItemRow, RoutineCategory, UserSettings } from "@/lib/types";

const themeOptions = [
  { key: "summer_surf", label: "여름 서핑" },
  { key: "autumn_walk", label: "가을 산책" },
  { key: "winter_room", label: "겨울 방" },
  { key: "spring_flower", label: "봄 꽃" }
];

const categoryLabels: Record<RoutineCategory, string> = {
  meal: "식단",
  exercise: "운동",
  supplement: "영양제",
  life: "생활"
};

const timeOptions = [
  { label: "종일", value: "all_day" },
  ...Array.from({ length: 48 }, (_, index) => {
    const minutes = index * 30;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return {
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      value: String(minutes)
    };
  })
];

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  return Number(value);
}

function getInitialCatalogForm(category: RoutineCategory = "meal") {
  return {
    category,
    title: "",
    subtitle: "",
    time: "all_day",
    calories: "",
    protein: ""
  };
}

export function SettingsPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogCategory, setCatalogCategory] = useState<RoutineCategory>("meal");
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState(() => getInitialCatalogForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("로그인 정보를 찾을 수 없어요.");

        const nextSettings = await getOrCreateUserSettings(data.user.id);
        const nextCatalogItems = await ensureDefaultCatalogItems(data.user.id);
        if (!cancelled) {
          setUserId(data.user.id);
          setSettings(nextSettings);
          setCatalogItems(nextCatalogItems);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "설정을 불러오지 못했어요.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !settings) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const saved = await updateUserSettings(userId, {
        nickname: settings.nickname,
        start_weight: settings.start_weight,
        target_weight: settings.target_weight,
        daily_calorie_goal: settings.daily_calorie_goal,
        daily_protein_goal: settings.daily_protein_goal,
        success_threshold_pct: settings.success_threshold_pct,
        editable_past_days: settings.editable_past_days,
        selected_theme_key: settings.selected_theme_key
      });
      setSettings(saved);
      setMessage("저장했어요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "설정을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectTheme(themeKey: string) {
    if (!userId || !settings) return;

    const previousSettings = settings;
    const nextSettings = { ...settings, selected_theme_key: themeKey };
    setSettings(nextSettings);
    applyThemeToDocument(themeKey);
    setMessage(null);
    setError(null);

    try {
      const saved = await updateUserSettings(userId, {
        selected_theme_key: themeKey
      });
      setSettings(saved);
      setMessage("테마를 저장했어요.");
    } catch (err) {
      setSettings(previousSettings);
      applyThemeToDocument(previousSettings.selected_theme_key);
      setError(err instanceof Error ? err.message : "테마를 저장하지 못했어요.");
    }
  }

  function resetCatalogForm(nextCategory = catalogCategory) {
    setEditingCatalogId(null);
    setCatalogForm(getInitialCatalogForm(nextCategory));
  }

  useEffect(() => {
    if (settings?.selected_theme_key) {
      applyThemeToDocument(settings.selected_theme_key);
    }
  }, [settings?.selected_theme_key]);

  function handleEditCatalog(item: CatalogItem) {
    setCatalogCategory(item.category);
    setEditingCatalogId(item.id);
    setCatalogForm({
      category: item.category,
      title: item.title,
      subtitle: item.subtitle || "",
      time: item.default_time_minutes === null ? "all_day" : String(item.default_time_minutes),
      calories: item.calories === null ? "" : String(item.calories),
      protein: item.protein_g === null ? "" : String(item.protein_g)
    });
  }

  async function handleSaveCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !catalogForm.title.trim()) return;

    setCatalogSaving(true);
    setMessage(null);
    setError(null);

    try {
      const minutes = catalogForm.time === "all_day" ? null : Number(catalogForm.time);
      const nextItems = await upsertCatalogItem(
        userId,
        {
          category: catalogForm.category,
          title: catalogForm.title.trim(),
          subtitle: catalogForm.subtitle.trim(),
          default_time_bucket: (minutes === null
            ? "all_day"
            : minutes < 720
              ? "morning"
              : minutes < 1140
                ? "afternoon"
                : "evening") as DailyItemRow["time_bucket"],
          default_time_minutes: minutes,
          calories: catalogForm.calories.trim() ? Number(catalogForm.calories) : null,
          protein_g: catalogForm.protein.trim() ? Number(catalogForm.protein) : null
        },
        editingCatalogId || undefined
      );
      setCatalogItems(nextItems);
      setCatalogCategory(catalogForm.category);
      resetCatalogForm(catalogForm.category);
      setMessage("템플릿에 저장했어요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿을 저장하지 못했어요.");
    } finally {
      setCatalogSaving(false);
    }
  }

  async function handleDeleteCatalog(item: CatalogItem) {
    if (!userId) return;
    const confirmed = window.confirm(`템플릿을 삭제할까요?`);
    if (!confirmed) return;

    setCatalogSaving(true);
    setError(null);

    try {
      const nextItems = await deleteCatalogItem(userId, item.id);
      setCatalogItems(nextItems);
      if (editingCatalogId === item.id) resetCatalogForm(item.category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿을 삭제하지 못했어요.");
    } finally {
      setCatalogSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <section className="glass-card page-card">
          <p className="body-copy">설정을 불러오는 중이에요.</p>
        </section>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="app-shell">
        <section className="glass-card page-card">
          <p className="inline-error">{error || "설정을 찾지 못했어요."}</p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="app-shell"
      style={
        { "--header-text-color": getAccessibleHeaderTextColor(settings.selected_theme_key) } as CSSProperties
      }
    >
      <div className="app-top-bar">
        <a className="text-link-button muted-link" href="/">
          ‹ 뒤로
        </a>
        <a className="text-link-button muted-link" href="#catalog-settings">
          템플릿 관리
        </a>
      </div>
      <section className="glass-card page-card">
        <p className="micro muted">설정</p>
        <div className="settings-top-row">
          <h1 className="settings-title">내 루틴 기준</h1>
        </div>
        <div className="settings-list">
          <div>
            <span className="settings-label">성공 기준</span>
            <strong>{settings.success_threshold_pct}%</strong>
          </div>
          <div>
            <span className="settings-label">목표 kcal</span>
            <strong>{settings.daily_calorie_goal} kcal</strong>
          </div>
          <div>
            <span className="settings-label">단백질 목표</span>
            <strong>{settings.daily_protein_goal ? `${settings.daily_protein_goal}g` : "미설정"}</strong>
          </div>
          <div>
            <span className="settings-label">과거 수정</span>
            <strong>최근 {settings.editable_past_days}일</strong>
          </div>
          <div>
            <span className="settings-label">닉네임</span>
            <strong>{settings.nickname || "냉이"}</strong>
          </div>
        </div>
      </section>

      <section className="glass-card page-card" id="catalog-settings">
        <div className="settings-top-row">
          <h2 className="section-title">자주 쓰는 템플릿</h2>
          <button className="text-link-button" onClick={() => resetCatalogForm()} type="button">
            새 템플릿
          </button>
        </div>

        <div className="sheet-segment settings-category-segment" aria-label="템플릿 카테고리">
          {(Object.keys(categoryLabels) as RoutineCategory[]).map((category) => (
            <button
              className={catalogCategory === category ? "active" : ""}
              key={category}
              onClick={() => {
                setCatalogCategory(category);
                setCatalogForm((current) => ({ ...current, category }));
                setEditingCatalogId(null);
              }}
              type="button"
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>

        <form className="settings-form catalog-form" onSubmit={handleSaveCatalog}>
          <label>
            <span>템플릿 이름</span>
            <input
              onChange={(event) => setCatalogForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="예: 닭다리살 + 메밀면"
              value={catalogForm.title}
            />
          </label>
          <label>
            <span>메모</span>
            <input
              onChange={(event) => setCatalogForm((current) => ({ ...current, subtitle: event.target.value }))}
              placeholder="예: 저녁 메뉴 A"
              value={catalogForm.subtitle}
            />
          </label>
          <label>
            <span>목표 시간</span>
            <select
              onChange={(event) => setCatalogForm((current) => ({ ...current, time: event.target.value }))}
              value={catalogForm.time}
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {catalogForm.category === "meal" ? (
            <label>
              <span>kcal</span>
              <input
                inputMode="numeric"
                min={0}
                onChange={(event) => setCatalogForm((current) => ({ ...current, calories: event.target.value }))}
                placeholder="선택 입력"
                type="number"
                value={catalogForm.calories}
              />
            </label>
          ) : null}
          <button className="primary-button" disabled={catalogSaving || !catalogForm.title.trim()} type="submit">
            {catalogSaving ? "저장 중" : editingCatalogId ? "수정 완료" : "템플릿 저장"}
          </button>
        </form>

        <div className="catalog-list">
          {catalogItems
            .filter((item) => item.category === catalogCategory)
            .map((item) => (
              <div className="catalog-row" key={item.id}>
                <button onClick={() => handleEditCatalog(item)} type="button">
                  <strong>{item.title}</strong>
                  <span>
                    {item.subtitle || "메모 없음"}
                    {item.category === "meal" && item.calories ? ` · ${item.calories} kcal` : ""}
                  </span>
                </button>
                <button
                  aria-label={`${item.title} 삭제`}
                  className="catalog-delete-button"
                  disabled={catalogSaving}
                  onClick={() => void handleDeleteCatalog(item)}
                  type="button"
                >
                  삭제
                </button>
              </div>
            ))}
          {catalogItems.filter((item) => item.category === catalogCategory).length === 0 ? (
            <p className="body-copy">등록한 템플릿이 없어요.</p>
          ) : null}
        </div>
      </section>

      <form className="glass-card page-card settings-form" onSubmit={handleSubmit}>
        <h2 className="section-title">숫자 기준</h2>
        <label>
          <span>닉네임</span>
          <input
            maxLength={10}
            onChange={(event) =>
              setSettings((current) => current && { ...current, nickname: event.target.value })
            }
            pattern="[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]{1,10}"
            placeholder="예: 냉이"
            required
            value={settings.nickname ?? ""}
          />
        </label>
        <label>
          <span>시작 체중</span>
          <input
            inputMode="decimal"
            onChange={(event) =>
              setSettings((current) => current && { ...current, start_weight: numberOrNull(event.target.value) })
            }
            placeholder="예: 64.5"
            type="number"
            value={settings.start_weight ?? ""}
          />
        </label>
        <label>
          <span>목표 체중</span>
          <input
            inputMode="decimal"
            onChange={(event) =>
              setSettings((current) => current && { ...current, target_weight: numberOrNull(event.target.value) })
            }
            placeholder="예: 58"
            type="number"
            value={settings.target_weight ?? ""}
          />
        </label>
        <label>
          <span>일일 kcal 목표</span>
          <input
            inputMode="numeric"
            max={6000}
            min={800}
            onChange={(event) =>
              setSettings((current) => current && { ...current, daily_calorie_goal: Number(event.target.value) })
            }
            type="number"
            value={settings.daily_calorie_goal}
          />
        </label>
        <label>
          <span>일일 단백질 목표</span>
          <input
            inputMode="decimal"
            max={400}
            min={0}
            onChange={(event) =>
              setSettings((current) => current && { ...current, daily_protein_goal: numberOrNull(event.target.value) })
            }
            type="number"
            value={settings.daily_protein_goal ?? ""}
          />
        </label>
        <label>
          <span>성공 기준</span>
          <input
            inputMode="numeric"
            max={100}
            min={1}
            onChange={(event) =>
              setSettings((current) => current && { ...current, success_threshold_pct: Number(event.target.value) })
            }
            type="number"
            value={settings.success_threshold_pct}
          />
        </label>
        <label>
          <span>과거 수정 가능 일수</span>
          <input
            inputMode="numeric"
            max={365}
            min={0}
            onChange={(event) =>
              setSettings((current) => current && { ...current, editable_past_days: Number(event.target.value) })
            }
            type="number"
            value={settings.editable_past_days}
          />
        </label>

        {message ? <p className="auth-message">{message}</p> : null}
        {error ? <p className="inline-error">{error}</p> : null}

        <button className="primary-button" disabled={saving} type="submit">
          {saving ? "저장 중" : "저장"}
        </button>
      </form>

      <section className="glass-card page-card">
        <h2 className="section-title">픽셀 테마</h2>
        <div className="theme-grid">
          {themeOptions.map((theme) => (
            <button
              className={`theme-tile ${settings.selected_theme_key === theme.key ? "active" : ""}`}
              key={theme.key}
              onClick={() => void handleSelectTheme(theme.key)}
              type="button"
            >
              <span className={`theme-preview ${theme.key}`} />
              <span>{theme.label}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
