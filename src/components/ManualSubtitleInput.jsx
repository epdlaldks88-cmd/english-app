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
  const trimmed = text.trim();

  // SRT 형식 감지
  if (/\d+\r?\n\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return parseSRT(trimmed, videoId);
  }

  // VTT 형식 감지
  if (trimmed.includes("WEBVTT")) {
    return parseVTT(trimmed, videoId);
  }

  // YouTube 스크립트 형식 감지 (줄바꿈 있는 버전)
  // 패턴: 타임스탬프가 별도 줄에 있음
  // 0:00
  // hello I'm Lucy
  // 0:02
  // World Service
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const timePattern = /^(\d{1,2}:\d{2}(?::\d{2})?)$/;

  let hasYouTubeFormat = false;
  for (const line of lines) {
    if (timePattern.test(line)) {
      hasYouTubeFormat = true;
      break;
    }
  }

  if (hasYouTubeFormat) {
    return parseYouTubeTranscript(lines, videoId);
  }

  // YouTube 스크립트 한 줄로 복사된 경우
  // "0:00 hello I'm Lucy 0:02 World Service..."
  const inlineTimePattern = /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)\s/;
  if (inlineTimePattern.test(trimmed)) {
    return parseYouTubeInline(trimmed, videoId);
  }

  // 일반 텍스트: 줄 단위 분리
  const subtitles = [];
  const avgDuration = 3;
  let i = 0;
  for (const line of lines) {
    if (line) {
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
  }
  return subtitles;
}

// YouTube 스크립트 (줄바꿈 형식)
function parseYouTubeTranscript(lines, videoId) {
  const timePattern = /^(\d{1,2}:\d{2}(?::\d{2})?)$/;
  const segments = [];
  let currentTime = null;
  let currentTexts = [];

  // "동영상에서 검색", "Introduction" 같은 헤더 스킵
  const skipPatterns =
    /^(동영상에서 검색|Introduction|Transcript|Description)$/i;

  for (const line of lines) {
    if (skipPatterns.test(line)) continue;

    if (timePattern.test(line)) {
      // 이전 세그먼트 저장
      if (currentTime !== null && currentTexts.length > 0) {
        segments.push({
          time: currentTime,
          text: currentTexts.join(" ").trim(),
        });
      }
      currentTime = parseTimestamp(line);
      currentTexts = [];
    } else {
      // [Music] 같은 태그 제거
      const cleaned = line.replace(/\[.*?\]/g, "").trim();
      if (cleaned) {
        currentTexts.push(cleaned);
      }
    }
  }

  // 마지막 세그먼트
  if (currentTime !== null && currentTexts.length > 0) {
    segments.push({
      time: currentTime,
      text: currentTexts.join(" ").trim(),
    });
  }

  // 세그먼트 → 자막 변환
  return segments.map((seg, i) => {
    const endTime =
      i + 1 < segments.length ? segments[i + 1].time : seg.time + 3;
    return {
      id: `${videoId}_${i}`,
      videoId,
      text: seg.text,
      startTime: seg.time,
      duration: endTime - seg.time,
      endTime,
    };
  });
}

// YouTube 스크립트 (한 줄로 복사된 경우)
function parseYouTubeInline(text, videoId) {
  // "동영상에서 검색" 등 헤더 제거
  const cleaned = text
    .replace(/동영상에서 검색/g, "")
    .replace(/\[.*?\]/g, "")
    .trim();

  // 타임스탬프 기준으로 분리
  const parts = cleaned.split(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)\s/);

  const segments = [];
  // parts: ['앞부분', '0:00', 'hello...', '0:02', 'world...', ...]
  for (let i = 1; i < parts.length; i += 2) {
    const time = parseTimestamp(parts[i]);
    const textPart = (parts[i + 1] || "").trim();

    // 섹션 제목 제거 (예: "Introduction", "Pisa education tests")
    const lines = textPart.split(/\s{2,}/);
    const mainText = lines
      .filter((l) => l.length > 3)
      .join(" ")
      .trim();

    if (mainText) {
      segments.push({ time, text: mainText });
    }
  }

  return segments.map((seg, i) => {
    const endTime =
      i + 1 < segments.length ? segments[i + 1].time : seg.time + 3;
    return {
      id: `${videoId}_${i}`,
      videoId,
      text: seg.text,
      startTime: seg.time,
      duration: endTime - seg.time,
      endTime,
    };
  });
}

function parseSRT(text, videoId) {
  const subtitles = [];
  const blocks = text.trim().split(/\r?\n\r?\n/);
  let i = 0;

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

function parseVTT(text, videoId) {
  const subtitles = [];
  const blocks = text.trim().split(/\r?\n\r?\n/);
  let i = 0;

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

export default function ManualSubtitleInput({ videoId, onComplete }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [preview, setPreview] = useState(null);

  const handlePreview = () => {
    if (!text.trim()) return;
    const subtitles = parseSubtitleText(text, videoId);
    setPreview(subtitles);
  };

  const handleSave = async () => {
    const subtitles = preview || parseSubtitleText(text, videoId);

    if (subtitles.length === 0) {
      alert("자막을 파싱할 수 없습니다.");
      return;
    }

    setSaving(true);

    try {
      await db.subtitles.bulkPut(subtitles);

      if (supabase) {
        const rows = subtitles.map((s) => ({
          id: s.id,
          video_id: s.videoId,
          text: s.text,
          start_time: s.startTime,
          duration: s.duration,
          end_time: s.endTime,
        }));

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
      setPreview(null);
    } catch {
      alert("클립보드 접근이 거부되었습니다.");
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
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
          <p className="mt-1">
            YouTube 스크립트, SRT, VTT 형식 모두 자동 인식됩니다.
          </p>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        placeholder="YouTube 스크립트를 붙여넣기 하세요..."
        rows={6}
        className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-accent transition-colors mb-3"
      />

      <div className="flex gap-2 mb-3">
        <button
          onClick={handlePaste}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
        >
          <ClipboardPaste size={14} /> 붙여넣기
        </button>
        <button
          onClick={handlePreview}
          disabled={!text.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg text-text-muted hover:bg-surface-hover transition-colors disabled:opacity-40"
        >
          미리보기
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
              <Upload size={14} /> 자막 저장{" "}
              {preview ? `(${preview.length}개)` : ""}
            </>
          )}
        </button>
      </div>

      {/* 미리보기 */}
      {preview && (
        <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
          {preview.slice(0, 20).map((sub) => (
            <div key={sub.id} className="px-3 py-2 text-xs">
              <span className="text-text-muted font-mono mr-2">
                {formatTime(sub.startTime)}
              </span>
              <span>{sub.text}</span>
            </div>
          ))}
          {preview.length > 20 && (
            <div className="px-3 py-2 text-xs text-text-muted text-center">
              ... 외 {preview.length - 20}개
            </div>
          )}
        </div>
      )}
    </div>
  );
}
