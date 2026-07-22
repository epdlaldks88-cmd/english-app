import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Trash2,
  Volume2,
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "../db/database";

const PAGE_SIZE = 30;

export default function VocabularyPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [videoFilter, setVideoFilter] = useState("all");
  const [page, setPage] = useState(0);

  const words = useLiveQuery(() =>
    db.words.orderBy("addedAt").reverse().toArray(),
  );
  const videos = useLiveQuery(() => db.videos.toArray());
  const articles = useLiveQuery(() => db.articles?.toArray());

  // 영상+기사 합친 소스 목록
  const sources = [
    ...(videos?.map((v) => ({ id: v.id, title: v.title, type: "video" })) ||
      []),
    ...(articles?.map((a) => ({ id: a.id, title: a.title, type: "article" })) ||
      []),
  ];

  // 영상/기사 필터
  const videoFiltered =
    videoFilter === "all"
      ? words
      : words?.filter((w) => w.videoId === videoFilter);

  // 타입 필터
  const reviewWords = videoFiltered?.filter(
    (w) => new Date(w.nextReview) <= new Date(),
  );
  const idioms = videoFiltered?.filter((w) => w.isIdiom);

  const displayed =
    typeFilter === "review"
      ? reviewWords
      : typeFilter === "idiom"
        ? idioms
        : videoFiltered;

  // 페이지네이션
  const totalPages = Math.ceil((displayed?.length || 0) / PAGE_SIZE);
  const paged = displayed?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // 소스별 단어 수
  const sourceWordCounts = {};
  words?.forEach((w) => {
    sourceWordCounts[w.videoId] = (sourceWordCounts[w.videoId] || 0) + 1;
  });

  // 필터 변경 시 페이지 리셋
  const changeTypeFilter = (f) => {
    setTypeFilter(f);
    setPage(0);
  };
  const changeVideoFilter = (f) => {
    setVideoFilter(f);
    setPage(0);
  };

  const handleDelete = async (id) => {
    if (!confirm("이 단어를 삭제할까요?")) return;
    await db.words.delete(id);
  };

  const playAudio = async (word) => {
    if (word.includes(" ")) return;
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const audioUrl = data[0]?.phonetics?.find((p) => p.audio)?.audio;
      if (audioUrl) new Audio(audioUrl).play();
    } catch {}
  };

  const selectedSourceTitle = sources.find((s) => s.id === videoFilter)?.title;

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">단어장</h2>
        {words?.length > 0 && (
          <Link
            to="/vocabulary/flashcard"
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
          >
            <BookOpen size={16} /> 플래시카드
          </Link>
        )}
      </div>

      {/* 소스 필터 */}
      <div className="mb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => changeVideoFilter("all")}
            className={`shrink-0 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              videoFilter === "all"
                ? "bg-accent text-white border-accent"
                : "border-border text-text-muted hover:text-text hover:border-text-muted"
            }`}
          >
            전체 ({words?.length || 0})
          </button>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => changeVideoFilter(s.id)}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-lg border transition-colors max-w-48 truncate ${
                videoFilter === s.id
                  ? "bg-accent text-white border-accent"
                  : "border-border text-text-muted hover:text-text hover:border-text-muted"
              }`}
            >
              {s.title} ({sourceWordCounts[s.id] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* 타입 필터 */}
      <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1 w-fit">
        <button
          onClick={() => changeTypeFilter("all")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            typeFilter === "all"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          전체 {videoFiltered?.length || 0}
        </button>
        <button
          onClick={() => changeTypeFilter("idiom")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            typeFilter === "idiom"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          숙어 {idioms?.length || 0}
        </button>
        <button
          onClick={() => changeTypeFilter("review")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            typeFilter === "review"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          복습 {reviewWords?.length || 0}
        </button>
      </div>

      {/* 현재 필터 표시 */}
      {videoFilter !== "all" && (
        <div className="flex items-center gap-2 mb-4 text-xs text-text-muted">
          <Filter size={12} />
          <span className="truncate max-w-xs">{selectedSourceTitle}</span>
          <button
            onClick={() => changeVideoFilter("all")}
            className="text-accent hover:underline shrink-0"
          >
            초기화
          </button>
        </div>
      )}

      {!paged?.length ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          {typeFilter === "review"
            ? "복습할 단어가 없습니다."
            : typeFilter === "idiom"
              ? "추출된 숙어가 없습니다."
              : videoFilter !== "all"
                ? "이 소스에서 추출된 단어가 없습니다."
                : "저장된 단어가 없습니다."}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paged.map((w) => (
              <div
                key={w.id}
                className="bg-surface border border-border rounded-xl px-5 py-4 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{w.word}</span>
                      {w.isIdiom && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-warning/15 text-warning rounded">
                          숙어
                        </span>
                      )}
                      {w.phonetic && (
                        <span className="text-xs text-text-muted">
                          {w.phonetic}
                        </span>
                      )}
                      {!w.word.includes(" ") && (
                        <button
                          onClick={() => playAudio(w.word)}
                          className="text-text-muted hover:text-accent transition-colors"
                        >
                          <Volume2 size={14} />
                        </button>
                      )}
                    </div>
                    {w.meanings?.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {w.meanings.slice(0, 2).map((m, i) => (
                          <p key={i} className="text-xs text-text-muted">
                            <span className="text-accent mr-1">
                              {m.partOfSpeech}
                            </span>
                            {m.definitions?.[0]?.korean ||
                              m.definitions?.[0]?.english ||
                              m.definition ||
                              ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="text-text-muted hover:text-danger transition-colors ml-3"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-border hover:bg-surface-hover transition-colors disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-text-muted">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-border hover:bg-surface-hover transition-colors disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
