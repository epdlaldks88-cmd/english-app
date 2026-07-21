import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Languages,
  Loader2,
  Eye,
  EyeOff,
  BookOpen,
  PenTool,
  Headphones,
} from "lucide-react";
import { db } from "../db/database";
import { useSubtitles } from "../hooks/useSubtitles";
import { mergeSubtitles } from "../utils/mergeSubtitles";
import { autoExtractAndSave } from "../utils/extractWords";
import ClickableText from "../components/ClickableText";
import DictionaryPopup from "../components/DictionaryPopup";

export default function VideoDetailPage() {
  const { videoId } = useParams();
  const [showKorean, setShowKorean] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

  const video = useLiveQuery(() => db.videos.get(videoId), [videoId]);
  const subtitles = useLiveQuery(
    () => db.subtitles.where("videoId").equals(videoId).sortBy("startTime"),
    [videoId],
  );
  const translations = useLiveQuery(
    () => db.translations.where("videoId").equals(videoId).toArray(),
    [videoId],
  );

  const { fetchSubtitles, loading, error } = useSubtitles(videoId);

  const merged = useMemo(() => mergeSubtitles(subtitles), [subtitles]);

  useEffect(() => {
    if (subtitles && subtitles.length === 0) {
      fetchSubtitles();
    }
  }, [subtitles, fetchSubtitles]);

  const translationMap = {};
  translations?.forEach((t) => {
    translationMap[t.id] = t.korean;
  });

  const handleTranslate = useCallback(async () => {
    if (!merged?.length) return;

    const untranslated = merged.filter((s) => !translationMap[s.id]);
    if (untranslated.length === 0) return;

    setTranslating(true);
    setTranslateError(null);

    try {
      const batchSize = 50;
      for (let i = 0; i < untranslated.length; i += batchSize) {
        const batch = untranslated.slice(i, i + batchSize);
        const texts = batch.map((s) => s.text);

        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "번역 실패");
        }

        const { translations: translated } = await res.json();

        const records = batch.map((s, j) => ({
          id: s.id,
          videoId,
          korean: translated[j],
        }));

        await db.translations.bulkPut(records);
      }
    } catch (err) {
      setTranslateError(err.message);
    } finally {
      setTranslating(false);
    }
  }, [merged, translationMap, videoId]);

  useEffect(() => {
    if (merged?.length > 0 && translations?.length === 0 && !translating) {
      handleTranslate();
    }
  }, [merged, translations, translating, handleTranslate]);

  // 단어 자동 추출: 번역 완료 후 + 아직 추출 안 한 영상
  useEffect(() => {
    if (
      merged?.length > 0 &&
      translations?.length > 0 &&
      video &&
      !video.wordsExtracted &&
      !extracting &&
      !translating
    ) {
      handleAutoExtract();
    }
  }, [merged, translations, video, extracting, translating]);

  const handleAutoExtract = async () => {
    if (!merged?.length) return;

    setExtracting(true);
    setExtractProgress(0);

    try {
      const result = await autoExtractAndSave(merged, videoId, (progress) => {
        setExtractProgress(progress);
      });

      // 추출 완료 표시
      await db.videos.update(videoId, { wordsExtracted: true });

      console.log(`단어 ${result.added}개 자동 추출 완료`);
    } catch (err) {
      console.error("단어 추출 실패:", err);
    } finally {
      setExtracting(false);
    }
  };

  const handleSubtitleClick = (startTime) => {
    const iframe = document.querySelector("iframe");
    if (iframe) {
      iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&start=${Math.floor(startTime)}&autoplay=1`;
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!video) {
    return (
      <div className="p-6 md:p-10 text-text-muted text-sm">
        영상을 찾을 수 없습니다.
      </div>
    );
  }

  const hasTranslations = translations?.length > 0;

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <Link
        to="/videos"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> 목록으로
      </Link>

      <h2 className="text-lg font-bold mb-4 line-clamp-2">{video.title}</h2>

      <div className="relative w-full pb-[56.25%] bg-black rounded-xl overflow-hidden mb-6">
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* 단어 추출 진행 표시 */}
      {extracting && (
        <div className="bg-surface border border-border rounded-xl px-5 py-3 mb-4 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-accent shrink-0" />
          <div className="flex-1">
            <p className="text-sm">
              단어·숙어 자동 추출 중... {extractProgress}%
            </p>
            <div className="h-1 bg-border rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${extractProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 추출 완료 표시 */}
      {video.wordsExtracted && !extracting && (
        <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-3 mb-4">
          <span className="text-sm text-text-muted">
            단어·숙어 자동 추출 완료
          </span>
          <Link
            to="/vocabulary"
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            <BookOpen size={14} /> 단어장 보기
          </Link>
        </div>
      )}

      {/* 학습 모드 바로가기 */}
      <div className="flex gap-2 mb-4">
        <Link
          to={`/study/cloze/${videoId}`}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-accent/15 text-accent rounded-lg hover:bg-accent/25 transition-colors"
        >
          <PenTool size={14} /> 빈칸 채우기
        </Link>
        <Link
          to={`/study/dictation/${videoId}`}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-success/15 text-success rounded-lg hover:bg-success/25 transition-colors"
        >
          <Headphones size={14} /> 받아쓰기
        </Link>
      </div>

      {/* 자막 영역 */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">
            자막
            {merged?.length > 0 && (
              <span className="text-text-muted font-normal ml-2">
                {merged.length}문장
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {translating && (
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <Loader2 size={12} className="animate-spin" />
                번역 중...
              </span>
            )}
            {hasTranslations && (
              <button
                onClick={() => setShowKorean(!showKorean)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors bg-accent/15 text-accent hover:bg-accent/25"
              >
                {showKorean ? <EyeOff size={12} /> : <Eye size={12} />}
                {showKorean ? "한글 숨기기" : "한글 보기"}
              </button>
            )}
            {!hasTranslations && !translating && merged?.length > 0 && (
              <button
                onClick={handleTranslate}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
              >
                <Languages size={12} /> 번역하기
              </button>
            )}
          </div>
        </div>

        {translateError && (
          <div className="px-5 py-2 bg-danger/10 text-danger text-xs">
            {translateError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-text-muted text-sm">
            <Loader2 size={16} className="animate-spin" />
            자막 추출 중...
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-danger text-sm mb-3">{error}</p>
            <button
              onClick={fetchSubtitles}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : merged?.length > 0 ? (
          <div className="max-h-[32rem] overflow-y-auto divide-y divide-border">
            {merged.map((sub) => (
              <div
                key={sub.id}
                className="px-5 py-4 hover:bg-surface-hover transition-colors"
              >
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSubtitleClick(sub.startTime)}
                    className="text-xs text-text-muted font-mono shrink-0 pt-0.5 hover:text-accent transition-colors"
                  >
                    {formatTime(sub.startTime)}
                  </button>
                  <div className="space-y-1.5">
                    <p className="text-sm leading-relaxed">
                      <ClickableText
                        text={sub.text}
                        onWordClick={setSelectedWord}
                      />
                    </p>
                    {showKorean && translationMap[sub.id] && (
                      <p className="text-xs text-text-muted leading-relaxed">
                        {translationMap[sub.id]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-text-muted text-sm">
            자막을 찾을 수 없습니다.
          </div>
        )}
      </div>

      {selectedWord && (
        <DictionaryPopup
          word={selectedWord}
          videoId={videoId}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
