import { AuthGate } from "@/components/AuthGate";

const themeOptions = [
  { key: "summer_surf", label: "여름 서핑", active: true },
  { key: "autumn_walk", label: "가을 산책", active: false },
  { key: "winter_room", label: "겨울 방", active: false },
  { key: "spring_flower", label: "봄 꽃", active: false }
];

export default function SettingsPage() {
  return (
    <AuthGate>
      <main className="app-shell">
        <section className="glass-card page-card">
          <p className="micro muted">설정</p>
          <h1 className="settings-title">내 루틴 기준</h1>
          <div className="settings-list">
            <div>
              <span className="settings-label">성공 기준</span>
              <strong>80%</strong>
            </div>
            <div>
              <span className="settings-label">과거 수정</span>
              <strong>최근 7일</strong>
            </div>
            <div>
              <span className="settings-label">테마</span>
              <strong>여름 서핑</strong>
            </div>
          </div>
        </section>

        <section className="glass-card page-card">
          <h2 className="section-title">픽셀 테마</h2>
          <div className="theme-grid">
            {themeOptions.map((theme) => (
              <button
                className={`theme-tile ${theme.active ? "active" : ""}`}
                key={theme.key}
                type="button"
              >
                <span className="theme-preview" />
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
