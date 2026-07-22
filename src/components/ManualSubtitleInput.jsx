import { useState } from "react";
import { ClipboardPaste, Upload, Loader2, HelpCircle } from "lucide-react";
import { db } from "../db/database";
import { supabase } from "../db/supabase";

function parseTimestamp(ts) {
  const parts = ts.split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return parseInt(m) * 60 + parseFloat(s);
  }
  return parseFloat(ts) || 0;
}

function parseSubtitleText(text, videoId) {
  const subtitles = [];
  let i = 0;

  // SRT 형식 감지
  if (/\d+\r?\n\d{2}:\d{2}:\d{2}/.test(text)) {
    const blocks = text.trim().split(/\r?\n\r?\n/);
    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      const timeLine = lines.find((l) => l.includes("-->"));
      if (!timeLine) continue;

      const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
      const startTime = parseTimestamp(startStr.replace(",", "."));
      const endTime = parseTimestamp(endStr.replace(",", "."));
      const textLines = lines.filter(
        (l) => !l.includes("-->") && !/^\d+$/.test(l.trim()),
      );
      const lineText = textLines
        .join(" ")
        .replace(/<[^>]+>/g, "")
        .trim();

      if (lineText) {
        subtitles.push({
          id: `${videoId}_${i}`,
          videoId,
          text: lineText,
          startTime,
          duration: endTime - startTime,
          endTime,
        });
        i++;
      }
    }
    return subtitles;
  }

  // VTT 형식 감지
  if (text.includes("WEBVTT")) {
    const blocks = text.trim().split(/\r?\n\r?\n/);
    for (const block of blocks) {
      if (block.includes("WEBVTT")) continue;
      const lines = block.split(/\r?\n/);
      const timeLine = lines.find((l) => l.includes("-->"));
      if (!timeLine) continue;

      const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
      const startTime = parseTimestamp(startStr);
      const endTime = parseTimestamp(endStr);
      const textLines = lines.filter((l) => !l.includes("-->"));
      const lineText = textLines
        .join(" ")
        .replace(/<[^>]+>/g, "")
        .trim();

      if (lineText) {
        subtitles.push({
          id: `${videoId}_${i}`,
          videoId,
          text: lineText,
          startTime,
          duration: endTime - startTime,
          endTime,
        });
        i++;
      }
    }
    return subtitles;
  }

  // 일반 텍스트: 줄 단위로 분리, 시간 없이 균등 배분
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const avgDuration = 3;
  for (const line of lines) {
    subtitles.push({
      id: `${videoId}_${i}`,
      videoId,
      text: line,
      startTime: i * avgDuration,
      duration: avgDuration,
      endTime: (i + 1) * avgDuration,
    });
    i++;
  }

  return subtitles;
}

export default function ManualSubtitleInput({ videoId, onComplete }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;

    setSaving(true);

    try {
      const subtitles = parseSubtitleText(text, videoId);

      if (subtitles.length === 0) {
        alert("자막을 파싱할 수 없습니다. 형식을 확인해주세요.");
        setSaving(false);
        return;
      }

      // Dexie에 저장
      await db.subtitles.bulkPut(subtitles);

      // Supabase에도 업로드
      if (supabase) {
        const rows = subtitles.map((s) => ({
          id: s.id,
          video_id: s.videoId,
          text: s.text,
          start_time: s.startTime,
          duration: s.duration,
          end_time: s.endTime,
        }));

        // 500개씩 배치
        for (let i = 0; i < rows.length; i += 500) {
          await supabase.from("subtitles").upsert(rows.slice(i, i + 500));
        }
      }

      onComplete(subtitles.length);
    } catch (err) {
      console.error("자막 저장 실패:", err);
      alert("자막 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      setText(clipText);
    } catch {
      alert("클립보드 접근이 거부되었습니다.");
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">자막 직접 입력</h3>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-text-muted hover:text-text transition-colors"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {showHelp && (
        <div className="bg-accent/10 rounded-lg px-4 py-3 mb-3 text-xs text-text-muted space-y-1.5">
          <p className="font-medium text-accent">자막 가져오는 방법:</p>
          <p>1. YouTube 영상 → 자막 (CC) 버튼 옆 ··· → 스크립트 열기</p>
          <p>2. 스크립트 전체 선택 (Ctrl+A) → 복사 (Ctrl+C)</p>
          <p>3. 아래에 붙여넣기</p>
          <p className="mt-1">SRT, VTT, 일반 텍스트 모두 지원됩니다.</p>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="YouTube 스크립트 또는 SRT/VTT 자막을 붙여넣기 하세요..."
        rows={6}
        className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-accent transition-colors mb-3"
      />

      <div className="flex gap-2">
        <button
          onClick={handlePaste}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
        >
          <ClipboardPaste size={14} /> 붙여넣기
        </button>
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> 저장 중...
            </>
          ) : (
            <>
              <Upload size={14} /> 자막 저장
            </>
          )}
        </button>
      </div>
    </div>
  );
}
