import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2, Volume2, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "../db/database";

export default function VocabularyPage() {
  const [filter, setFilter] = useState("all"); // all, review

  const words = useLiveQuery(() =>
    db.words.orderBy("addedAt").reverse().toArray(),
  );

  const reviewWords = words?.filter(
    (w) => new Date(w.nextReview) <= new Date(),
  );

  const displayed = filter === "review" ? reviewWords : words;

  const handleDelete = async (id) => {
    if (!confirm("이 단어를 삭제할까요?")) return;
    await db.words.delete(id);
  };

  const playAudio = async (word) => {
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

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1 w-fit">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            filter === "all"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          전체 {words?.length || 0}
        </button>
        <button
          onClick={() => setFilter("review")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            filter === "review"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          복습 대상 {reviewWords?.length || 0}
        </button>
      </div>

      {!displayed?.length ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          {filter === "review"
            ? "복습할 단어가 없습니다."
            : "저장된 단어가 없습니다. 영상 자막에서 단어를 클릭하여 추가하세요."}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((w) => (
            <div
              key={w.id}
              className="bg-surface border border-border rounded-xl px-5 py-4 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{w.word}</span>
                    {w.phonetic && (
                      <span className="text-xs text-text-muted">
                        {w.phonetic}
                      </span>
                    )}
                    <button
                      onClick={() => playAudio(w.word)}
                      className="text-text-muted hover:text-accent transition-colors"
                    >
                      <Volume2 size={14} />
                    </button>
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
              <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
                <span>
                  추가: {new Date(w.addedAt).toLocaleDateString("ko-KR")}
                </span>
                <span>
                  복습: {new Date(w.nextReview).toLocaleDateString("ko-KR")}
                </span>
                <span>반복: {w.repetitions}회</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
