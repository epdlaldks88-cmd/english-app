import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { db } from "../db/database";
import { mergeSubtitles } from "../utils/mergeSubtitles";
import DiffMatchPatch from "diff-match-patch";

const dmp = new DiffMatchPatch();

function DiffResult({ original, userText }) {
  const diffs = dmp.diff_main(
    userText.trim().toLowerCase(),
    original
      .replace(/[^a-zA-Z0-9\s'-]/g, "")
      .trim()
      .toLowerCase(),
  );
  dmp.diff_cleanupSemantic(diffs);

  return (
    <div className="text-sm leading-relaxed">
      {diffs.map(([type, text], i) => {
        if (type === 0) return <span key={i}>{text}</span>;
        if (type === -1)
          return (
            <span key={i} className="bg-danger/20 text-danger line-through">
              {text}
            </span>
          );
        if (type === 1)
          return (
            <span key={i} className="bg-success/20 text-success">
              {text}
            </span>
          );
        return null;
      })}
    </div>
  );
}

export default function DictationPage() {
  const { videoId } = useParams();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userText, setUserText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState({ perfect: 0, total: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef(null);
  const textareaRef = useRef(null);

  const video = useLiveQuery(() => db.videos.get(videoId), [videoId]);
  const subtitles = useLiveQuery(
    () => db.subtitles.where("videoId").equals(videoId).sortBy("startTime"),
    [videoId],
  );
  const translations = useLiveQuery(
    () => db.translations.where("videoId").equals(videoId).toArray(),
    [videoId],
  );

  const merged = useMemo(() => mergeSubtitles(subtitles), [subtitles]);

  const translationMap = {};
  translations?.forEach((t) => {
    translationMap[t.id] = t.korean;
  });

  const currentSentence = merged?.[currentIdx];

  const playCurrent = useCallback(() => {
    if (!currentSentence || !iframeRef.current) return;
    const start = Math.floor(currentSentence.startTime);
    iframeRef.current.src = `https://www.youtube.com/embed/${videoId}?rel=0&start=${start}&autoplay=1`;
    setIsPlaying(true);

    // 문장 길이만큼 재생 후 자동 정지 (iframe은 직접 제어 불가하므로 대체)
    const duration =
      (currentSentence.endTime - currentSentence.startTime) * 1000 + 500;
    setTimeout(() => {
      setIsPlaying(false);
    }, duration);
  }, [currentSentence, videoId]);

  const handleSubmit = () => {
    const original = currentSentence.text
      .replace(/[^a-zA-Z0-9\s'-]/g, "")
      .trim()
      .toLowerCase();
    const typed = userText.trim().toLowerCase();
    const isPerfect = original === typed;

    setSubmitted(true);
    setStats((prev) => ({
      perfect: prev.perfect + (isPerfect ? 1 : 0),
      total: prev.total + 1,
    }));
  };

  const handleNext = () => {
    if (currentIdx + 1 >= merged.length) {
      setFinished(true);
    } else {
      setCurrentIdx(currentIdx + 1);
      setUserText("");
      setSubmitted(false);
      setShowAnswer(false);
    }
  };

  const restart = () => {
    setCurrentIdx(0);
    setUserText("");
    setSubmitted(false);
    setShowAnswer(false);
    setFinished(false);
    setStats({ perfect: 0, total: 0 });
  };

  // 문장 바뀔 때 자동 재생
  useEffect(() => {
    if (currentSentence && !finished) {
      const timer = setTimeout(() => playCurrent(), 500);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, currentSentence, finished]);

  // 재생 후 textarea 포커스
  useEffect(() => {
    if (!isPlaying && textareaRef.current && !submitted) {
      textareaRef.current.focus();
    }
  }, [isPlaying, submitted]);

  if (!video || !merged?.length) {
    return (
      <div className="p-6 md:p-10 text-text-muted text-sm">
        영상을 찾을 수 없습니다.
      </div>
    );
  }

  if (finished) {
    const pct =
      stats.total > 0 ? Math.round((stats.perfect / stats.total) * 100) : 0;
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          to={`/videos/${videoId}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> 영상으로
        </Link>
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <h3 className="text-xl font-bold mb-2">받아쓰기 완료!</h3>
          <p className="text-3xl font-bold text-accent mb-1">{pct}%</p>
          <p className="text-sm text-text-muted mb-6">
            {stats.total}문장 중 {stats.perfect}문장 완벽
          </p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            <RotateCcw size={14} /> 다시 풀기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        to={`/videos/${videoId}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> 영상으로
      </Link>

      {/* 진행 표시 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${((currentIdx + 1) / merged.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-muted shrink-0">
          {currentIdx + 1} / {merged.length}
        </span>
      </div>

      {/* 영상 플레이어 (작게) */}
      <div className="relative w-full pb-[30%] bg-black rounded-xl overflow-hidden mb-4">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* 재생 컨트롤 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={playCurrent}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          <Play size={14} /> 다시 듣기
        </button>
        {translationMap[currentSentence.id] && (
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
          >
            {showAnswer ? <EyeOff size={14} /> : <Eye size={14} />}
            {showAnswer ? "힌트 숨기기" : "한글 힌트"}
          </button>
        )}
      </div>

      {/* 한글 힌트 */}
      {showAnswer && translationMap[currentSentence.id] && (
        <div className="bg-accent/10 rounded-lg px-4 py-2.5 mb-4">
          <p className="text-sm text-accent">
            {translationMap[currentSentence.id]}
          </p>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="mb-4">
        <textarea
          ref={textareaRef}
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          disabled={submitted}
          placeholder="들은 내용을 영어로 타이핑하세요..."
          rows={3}
          className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm resize-none focus:outline-none focus:border-accent transition-colors disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !submitted) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </div>

      {/* 결과 */}
      {submitted && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-4 space-y-3">
          <div>
            <p className="text-xs text-text-muted mb-1">비교 결과</p>
            <DiffResult original={currentSentence.text} userText={userText} />
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">원문</p>
            <p className="text-sm">{currentSentence.text}</p>
          </div>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-2">
        {!submitted ? (
          <>
            <button
              onClick={handleSubmit}
              disabled={!userText.trim()}
              className="flex-1 py-2.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40"
            >
              제출
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2.5 text-sm text-text-muted border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              <SkipForward size={16} />
            </button>
          </>
        ) : (
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
          >
            다음 문장 →
          </button>
        )}
      </div>
    </div>
  );
}
