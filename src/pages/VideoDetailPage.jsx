import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { db } from "../db/database";
import { useSubtitles } from "../hooks/useSubtitles";

export default function VideoDetailPage() {
  const { videoId } = useParams();
  const playerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const subtitleListRef = useRef(null);

  const video = useLiveQuery(() => db.videos.get(videoId), [videoId]);
  const subtitles = useLiveQuery(
    () => db.subtitles.where("videoId").equals(videoId).sortBy("startTime"),
    [videoId],
  );

  const { fetchSubtitles, loading, error } = useSubtitles(videoId);

  // 자막이 없으면 자동 추출 시도
  useEffect(() => {
    if (subtitles && subtitles.length === 0) {
      fetchSubtitles();
    }
  }, [subtitles, fetchSubtitles]);

  // 자막 하이라이트: 영상 시간에 맞춰 활성 자막 추적
  useEffect(() => {
    if (!subtitles?.length) return;

    const interval = setInterval(() => {
      const iframe = document.querySelector("iframe");
      // YouTube IFrame API 없이는 현재 시간을 가져올 수 없음
      // Phase 1에서는 클릭으로 점프만 지원, 자동 하이라이트는 IFrame API 연동 후 추가
    }, 500);

    return () => clearInterval(interval);
  }, [subtitles]);

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

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <Link
        to="/videos"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> 목록으로
      </Link>

      <h2 className="text-lg font-bold mb-4 line-clamp-2">{video.title}</h2>

      {/* YouTube Player */}
      <div className="relative w-full pb-[56.25%] bg-black rounded-xl overflow-hidden mb-6">
        <iframe
          ref={playerRef}
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* 자막 영역 */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">영어 자막</h3>
          {!loading && subtitles?.length > 0 && (
            <span className="text-xs text-text-muted">
              {subtitles.length}개 구간
            </span>
          )}
        </div>

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
        ) : subtitles?.length > 0 ? (
          <div
            ref={subtitleListRef}
            className="max-h-96 overflow-y-auto divide-y divide-border"
          >
            {subtitles.map((sub, i) => (
              <button
                key={sub.id}
                onClick={() => handleSubtitleClick(sub.startTime)}
                className={`w-full text-left px-5 py-3 hover:bg-surface-hover transition-colors flex gap-3 ${
                  activeIndex === i ? "bg-accent/10 text-accent" : ""
                }`}
              >
                <span className="text-xs text-text-muted font-mono shrink-0 pt-0.5">
                  {formatTime(sub.startTime)}
                </span>
                <span className="text-sm leading-relaxed">{sub.text}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-text-muted text-sm">
            자막을 찾을 수 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
