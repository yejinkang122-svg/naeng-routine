"use client";

import { FormEvent, useEffect, useState } from "react";

type WeightSheetProps = {
  currentWeight?: number | null;
  dateLabel: string;
  open: boolean;
  onClose: () => void;
  onSave: (weight: number) => Promise<void>;
};

export function WeightSheet({ currentWeight, dateLabel, open, onClose, onSave }: WeightSheetProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(currentWeight ? String(currentWeight) : "");
      setError(null);
    }
  }, [currentWeight, open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 30 || parsed > 300) {
      setError("30kg에서 300kg 사이로 입력해주세요.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(Math.round(parsed * 10) / 10);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "체중 저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" role="presentation" onClick={onClose}>
      <form className="bottom-sheet" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <div className="sheet-handle" />
        <p className="micro muted">{dateLabel}</p>
        <h2 className="sheet-title">체중 입력</h2>
        <div className="sheet-content">
          <input
            autoFocus
            className="weight-input"
            inputMode="decimal"
            max="300"
            min="30"
            onChange={(event) => setValue(event.target.value)}
            placeholder="56.0"
            step="0.1"
            type="number"
            value={value}
          />
          {error ? <p className="auth-message">{error}</p> : null}
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "저장 중..." : "저장"}
          </button>
          <button className="secondary-button" disabled={saving} onClick={onClose} type="button">
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
