import { useState, useEffect } from "react";
import { X, Plus, Check, Loader2, Volume2 } from "lucide-react";
import { db } from "../db/database";

export default function DictionaryPopup({ word, videoId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!word) return;

    const lookup = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      // 이미 저장된 단어인지 확인
      const existing = await db.words
        .where("word")
        .equalsIgnoreCase(word)
        .first();
      if (existing) setSaved(true);
      else setSaved(false);

      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        );
        if (!res.ok) throw new Error("단어를 찾을 수 없습니다.");
        const json = await res.json();
        setData(json[0]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    lookup();
  }, [word]);

  const playAudio = () => {
    const audioUrl = data?.phonetics?.find((p) => p.audio)?.audio;
    if (audioUrl) {
      new Audio(audioUrl).play();
    }
  };

  const saveWord = async () => {
    const meanings =
      data?.meanings?.map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definition: m.definitions[0]?.definition || "",
        example: m.definitions[0]?.example || "",
      })) || [];

    await db.words.put({
      id: `${word.toLowerCase()}_${Date.now()}`,
      word: word.toLowerCase(),
      videoId,
      meanings,
      phonetic: data?.phonetic || "",
      addedAt: new Date().toISOString(),
      nextReview: new Date().toISOString(),
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      level: 0,
    });

    setSaved(true);
  };

  if (!word) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[70vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-surface flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">{word}</h3>
            {data?.phonetic && (
              <span className="text-sm text-text-muted">{data.phonetic}</span>
            )}
            {data?.phonetics?.some((p) => p.audio) && (
              <button
                onClick={playAudio}
                className="text-accent hover:text-accent-hover transition-colors"
              >
                <Volume2 size={18} />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-text-muted text-sm">
              <Loader2 size={16} className="animate-spin" />
              검색 중...
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-text-muted text-sm mb-3">{error}</p>
              {/* 사전에 없어도 단어장 저장 가능 */}
              {!saved && (
                <button
                  onClick={async () => {
                    await db.words.put({
                      id: `${word.toLowerCase()}_${Date.now()}`,
                      word: word.toLowerCase(),
                      videoId,
                      meanings: [],
                      phonetic: "",
                      addedAt: new Date().toISOString(),
                      nextReview: new Date().toISOString(),
                      interval: 1,
                      easeFactor: 2.5,
                      repetitions: 0,
                      level: 0,
                    });
                    setSaved(true);
                  }}
                  className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                >
                  그래도 단어장에 추가
                </button>
              )}
            </div>
          ) : (
            <>
              {data?.meanings?.map((meaning, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  <span className="inline-block px-2 py-0.5 text-xs font-medium bg-accent/15 text-accent rounded mb-2">
                    {meaning.partOfSpeech}
                  </span>
                  {meaning.definitions.slice(0, 3).map((def, j) => (
                    <div key={j} className="mb-2 last:mb-0">
                      <p className="text-sm leading-relaxed">
                        {j + 1}. {def.definition}
                      </p>
                      {def.example && (
                        <p className="text-xs text-text-muted mt-0.5 italic">
                          "{def.example}"
                        </p>
                      )}
                    </div>
                  ))}
                  {meaning.synonyms?.length > 0 && (
                    <p className="text-xs text-text-muted mt-1">
                      유의어: {meaning.synonyms.slice(0, 5).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* 단어장 추가 버튼 */}
        {!loading && data && (
          <div className="sticky bottom-0 bg-surface px-5 py-3 border-t border-border">
            {saved ? (
              <div className="flex items-center justify-center gap-1.5 text-success text-sm">
                <Check size={16} /> 단어장에 저장됨
              </div>
            ) : (
              <button
                onClick={saveWord}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
              >
                <Plus size={16} /> 단어장에 추가
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
