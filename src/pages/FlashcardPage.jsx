import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, RotateCcw, Volume2 } from "lucide-react";
import { db } from "../db/database";
import { syncToCloud } from "../db/sync";

// SM-2 알고리즘
function calcSRS(word, quality) {
  // quality: 0=Again, 3=Hard, 4=Good, 5=Easy
  let { repetitions, easeFactor, interval } = word;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    repetitions,
    easeFactor,
    interval,
    nextReview: nextReview.toISOString(),
  };
}

export default function FlashcardPage() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

  const reviewWords = useLiveQuery(async () => {
    const all = await db.words.toArray();
    return all.filter((w) => new Date(w.nextReview) <= new Date());
  });

  const current = reviewWords?.[index];

  const handleGrade = async (quality) => {
    if (!current) return;

    const updates = calcSRS(current, quality);
    await db.words.update(current.id, updates);

    syncToCloud();

    if (index + 1 >= reviewWords.length) {
      setFinished(true);
    } else {
      setIndex(index + 1);
      setFlipped(false);
    }
  };

  const playAudio = async () => {
    if (!current) return;
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${current.word}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const audioUrl = data[0]?.phonetics?.find((p) => p.audio)?.audio;
      if (audioUrl) new Audio(audioUrl).play();
    } catch {}
  };

  const restart = () => {
    setIndex(0);
    setFlipped(false);
    setFinished(false);
  };

  if (!reviewWords) return null;

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto">
      <Link
        to="/vocabulary"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> 단어장으로
      </Link>

      {reviewWords.length === 0 || finished ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <p className="text-lg font-bold mb-2">
            {finished ? "복습 완료!" : "복습할 단어가 없습니다"}
          </p>
          <p className="text-sm text-text-muted mb-4">
            {finished
              ? `${reviewWords.length}개 단어를 복습했습니다.`
              : "새 단어를 영상에서 추가하거나 내일 다시 확인하세요."}
          </p>
          {finished && (
            <button
              onClick={restart}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              <RotateCcw size={14} /> 다시 복습
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 진행 표시 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{
                  width: `${((index + 1) / reviewWords.length) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-text-muted shrink-0">
              {index + 1} / {reviewWords.length}
            </span>
          </div>

          {/* 카드 */}
          <div
            onClick={() => !flipped && setFlipped(true)}
            className={`bg-surface border border-border rounded-2xl p-8 min-h-[280px] flex flex-col items-center justify-center cursor-pointer hover:border-accent/30 transition-all ${
              !flipped ? "hover:scale-[1.01]" : ""
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-3xl font-bold">{current?.word}</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio();
                }}
                className="text-text-muted hover:text-accent transition-colors"
              >
                <Volume2 size={20} />
              </button>
            </div>

            {current?.phonetic && (
              <p className="text-sm text-text-muted mb-4">{current.phonetic}</p>
            )}

            {!flipped ? (
              <p className="text-xs text-text-muted mt-4">탭하여 뜻 보기</p>
            ) : (
              <div className="mt-2 space-y-3 w-full max-w-sm">
                {current?.meanings?.length > 0 ? (
                  current.meanings.map((m, i) => (
                    <div key={i} className="text-center">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-accent/15 text-accent rounded mb-1">
                        {m.partOfSpeech}
                      </span>
                      {m.definitions?.map((d, j) => (
                        <div key={j} className="mb-2">
                          <p className="text-sm font-medium">
                            {d.korean || d.english}
                          </p>
                          {d.korean && (
                            <p className="text-xs text-text-muted">
                              {d.english}
                            </p>
                          )}
                          {d.example && (
                            <p className="text-xs text-text-muted mt-0.5 italic">
                              "{d.example}"
                            </p>
                          )}
                        </div>
                      )) || <p className="text-sm">{m.definition || ""}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted text-center">
                    뜻이 등록되지 않았습니다.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 채점 버튼 */}
          {flipped && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <button
                onClick={() => handleGrade(0)}
                className="py-3 text-sm rounded-xl bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
              >
                모름
              </button>
              <button
                onClick={() => handleGrade(3)}
                className="py-3 text-sm rounded-xl bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
              >
                어려움
              </button>
              <button
                onClick={() => handleGrade(4)}
                className="py-3 text-sm rounded-xl bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
              >
                보통
              </button>
              <button
                onClick={() => handleGrade(5)}
                className="py-3 text-sm rounded-xl bg-success/15 text-success hover:bg-success/25 transition-colors"
              >
                쉬움
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
