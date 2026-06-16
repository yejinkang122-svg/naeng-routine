"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  collectLegacyLocalStorage,
  countLegacySnapshot,
  downloadSnapshot,
  migrateLegacySnapshot,
  type LegacySnapshot,
  type MigrationSummary
} from "@/lib/migration";
import { getSupabaseBrowserClient } from "@/lib/supabase";

function emptySnapshot(): LegacySnapshot {
  return {
    exportedAt: new Date().toISOString(),
    source: "localStorage",
    keys: {}
  };
}

export function MigrationPanel() {
  const [snapshot, setSnapshot] = useState<LegacySnapshot>(emptySnapshot);
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = countLegacySnapshot(snapshot);

  useEffect(() => {
    setSnapshot(collectLegacyLocalStorage());
  }, []);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as LegacySnapshot;
      if (!parsed.keys || parsed.source !== "localStorage") {
        throw new Error("냉이랑 루틴 백업 JSON 형식이 아니에요.");
      }
      setSnapshot(parsed);
      setMessage("백업 파일을 불러왔어요.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "백업 파일을 읽지 못했어요.");
    }
  }

  function handlePasteJson() {
    try {
      const parsed = JSON.parse(jsonText) as LegacySnapshot;
      if (!parsed.keys || parsed.source !== "localStorage") {
        throw new Error("냉이랑 루틴 백업 JSON 형식이 아니에요.");
      }
      setSnapshot(parsed);
      setMessage("붙여넣은 JSON을 불러왔어요.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "JSON 내용을 읽지 못했어요.");
    }
  }

  async function handleMigrate() {
    setBusy(true);
    setMessage(null);
    setSummary(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("로그인 정보를 찾을 수 없어요.");

      const result = await migrateLegacySnapshot(data.user.id, snapshot);
      setSummary(result);
      setMessage("마이그레이션이 완료됐어요.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "마이그레이션에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="glass-card page-card">
        <p className="micro muted">데이터 이전</p>
        <h1 className="settings-title">A 버전 기록 가져오기</h1>
        <p className="body-copy">
          같은 도메인에서 열면 localStorage를 자동 감지합니다. 다른 도메인이나 로컬에서는 A 버전에서
          다운로드한 JSON 백업 파일을 가져오면 됩니다.
        </p>
      </section>

      <section className="glass-card page-card">
        <div className="migration-stats">
          <div>
            <span>감지된 키</span>
            <strong>{counts.keyCount}</strong>
          </div>
          <div>
            <span>루틴 날짜</span>
            <strong>{counts.itemDates}</strong>
          </div>
          <div>
            <span>체중 기록</span>
            <strong>{counts.weights}</strong>
          </div>
          <div>
            <span>자주 쓰는 항목</span>
            <strong>{counts.catalog}</strong>
          </div>
          <div>
            <span>사진 포함 항목</span>
            <strong>{counts.images}</strong>
          </div>
        </div>

        <button className="secondary-button" onClick={() => downloadSnapshot(snapshot)} type="button">
          현재 감지 데이터 JSON 백업
        </button>

        <label className="file-import">
          JSON 백업 파일 가져오기
          <input accept="application/json" onChange={handleFile} type="file" />
        </label>

        <label className="paste-import">
          <span>또는 JSON 내용 붙여넣기</span>
          <textarea
            onChange={(event) => setJsonText(event.target.value)}
            placeholder="{ &quot;exportedAt&quot;: ... }"
            value={jsonText}
          />
        </label>
        <button
          className="secondary-button"
          disabled={!jsonText.trim()}
          onClick={handlePasteJson}
          type="button"
        >
          붙여넣은 JSON 불러오기
        </button>

        {counts.images > 0 ? (
          <p className="migration-note">
            사진은 감지됐지만 아직 Storage 연결 전이라 이번 이전에서는 제외됩니다. 루틴, 체크, 메모,
            자유식 이름, 체중, 자주 쓰는 항목은 이전합니다.
          </p>
        ) : null}

        {message ? <p className="auth-message">{message}</p> : null}

        <button
          className="primary-button"
          disabled={busy || counts.keyCount === 0}
          onClick={handleMigrate}
          type="button"
        >
          {busy ? "이전 중..." : "클라우드로 이전하기"}
        </button>
      </section>

      {summary ? (
        <section className="glass-card page-card">
          <h2 className="section-title">이전 결과</h2>
          <div className="settings-list">
            <div>
              <span className="settings-label">날짜 루틴</span>
              <strong>{summary.dailyRoutines}</strong>
            </div>
            <div>
              <span className="settings-label">루틴 항목</span>
              <strong>{summary.dailyItems}</strong>
            </div>
            <div>
              <span className="settings-label">체중 기록</span>
              <strong>{summary.weightLogs}</strong>
            </div>
            <div>
              <span className="settings-label">자주 쓰는 항목</span>
              <strong>{summary.skippedCatalog ? "이미 있음" : summary.catalogItems}</strong>
            </div>
            <div>
              <span className="settings-label">사진 제외</span>
              <strong>{summary.imageItemsSkipped}</strong>
            </div>
            <div>
              <span className="settings-label">이미 있던 날짜</span>
              <strong>{summary.skippedDates}</strong>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
