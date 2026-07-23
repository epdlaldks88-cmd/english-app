import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, X, SkipForward, RotateCcw } from "lucide-react";
import { db } from "../db/database";

function splitSentences(text) {
  const protected_ = text
    .replace(/Mr\./g, "Mr\u200B")
    .replace(/Mrs\./g, "Mrs\u200B")
    .replace(/Ms\./g, "Ms\u200B")
    .replace(/Dr\./g, "Dr\u200B")
    .replace(/Prof\./g, "Prof\u200B")
    .replace(/Sr\./g, "Sr\u200B")
    .replace(/Jr\./g, "Jr\u200B")
    .replace(/St\./g, "St\u200B")
    .replace(/U\.S\./g, "U\u200BS\u200B")
    .replace(/U\.K\./g, "U\u200BK\u200B")
    .replace(/U\.N\./g, "U\u200BN\u200B")
    .replace(/E\.U\./g, "E\u200BU\u200B")
    .replace(/vs\./g, "vs\u200B")
    .replace(/etc\./g, "etc\u200B")
    .replace(/Inc\./g, "Inc\u200B")
    .replace(/Corp\./g, "Corp\u200B")
    .replace(/No\./g, "No\u200B");

  const marked = protected_.replace(/([.?!])\s+(?=[A-Z"\u201C])/g, "$1|||");
  return marked
    .split("|||")
    .map((s) => s.replace(/\u200B/g, ".").trim())
    .filter((s) => s.length > 0);
}

function makeCloze(text, difficulty) {
  const words = text.split(/\s+/);
  const rate = difficulty === "easy" ? 0.1 : difficulty === "hard" ? 0.3 : 0.2;

  const candidates = words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.replace(/[^a-zA-Z]/g, "").length >= 3);

  const count = Math.max(1, Math.round(candidates.length * rate));
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count).map((c) => c.i);

  return words.map((w, i) => ({
    word: w,
    isBlank: selected.includes(i),
    clean: w.replace(/[^a-zA-Z'-]/g, "").toLowerCase(),
  }));
}

export default function ArticleClozePage() {
  const { articleId } = useParams();
  const [difficulty, setDifficulty] = useState("normal");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  const article = useLiveQuery(() => db.articles.get(articleId), [articleId]);
  const translations = useLiveQuery(
    () =>
      db.articleTranslations
        .where("articleId")
        .equals(articleId)
        .sortBy("sentenceIndex"),
    [articleId],
  );

  const sentences = useMemo(
    () => (article ? splitSentences(article.content) : []),
    [article],
  );

  const translationMap = {};
  translations?.forEach((t) => {
    translationMap[t.sentenceIndex] = t.korean;
  });

  const currentSentence = sentences[currentIdx];
  const cloze = useMemo(
    () => (currentSentence ? makeCloze(currentSentence, difficulty) : []),
    [currentSentence, difficulty, currentIdx],
  );

  const blanks = cloze.filter((c) => c.isBlank);

  const handleSubmit = () => {
    let correct = 0;
    blanks.forEach((b, i) => {
      if ((answers[i] || "").trim().toLowerCase() === b.clean) correct++;
    });
    setScore({ correct, total: blanks.length });
    setSubmitted(true);
    setStats((prev) => ({
      correct: prev.correct + correct,
      total: prev.total + blanks.length,
    }));
  };

  const handleNext = () => {
    if (currentIdx + 1 >= sentences.length) {
      setFinished(true);
    } else {
      setCurrentIdx(currentIdx + 1);
      setAnswers({});
      setSubmitted(false);
      setScore(null);
    }
  };

  const restart = () => {
    setCurrentIdx(0);
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setFinished(false);
    setStats({ correct: 0, total: 0 });
  };

  if (!article || !sentences.length) {
    return (
      <div className="p-6 md:p-10 text-text-muted text-sm">
        기사를 찾을 수 없습니다.
      </div>
    );
  }

  if (finished) {
    const pct =
      stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          to={`/articles/${articleId}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> 기사로
        </Link>
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <h3 className="text-xl font-bold mb-2">빈칸 채우기 완료!</h3>
          <p className="text-3xl font-bold text-accent mb-1">{pct}%</p>
          <p className="text-sm text-text-muted mb-6">
            {stats.total}개 중 {stats.correct}개 정답
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

  let blankCounter = 0;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          to={`/articles/${articleId}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={16} /> 기사로
        </Link>
        <select
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value);
            setAnswers({});
            setSubmitted(false);
            setScore(null);
          }}
          className="px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-accent"
        >
          <option value="easy">쉬움 (10%)</option>
          <option value="normal">보통 (20%)</option>
          <option value="hard">어려움 (30%)</option>
        </select>
      </div>

      {/* 진행 표시 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${((currentIdx + 1) / sentences.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-muted shrink-0">
          {currentIdx + 1} / {sentences.length}
        </span>
      </div>

      {/* 한글 힌트 */}
      {translationMap[currentIdx] && (
        <div className="bg-accent/10 rounded-lg px-4 py-2.5 mb-4">
          <p className="text-sm text-accent">{translationMap[currentIdx]}</p>
        </div>
      )}

      {/* 빈칸 문장 */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-4">
        <div className="text-sm leading-[2.5] flex flex-wrap gap-y-2 items-center">
          {cloze.map((token, i) => {
            if (!token.isBlank) {
              return (
                <span key={i} className="mr-1">
                  {token.word}
                </span>
              );
            }

            const blankIdx = blankCounter++;
            const userAnswer = (answers[blankIdx] || "").trim().toLowerCase();
            const isCorrect = userAnswer === token.clean;

            return (
              <span key={i} className="mr-1 inline-flex items-center gap-1">
                <input
                  type="text"
                  value={answers[blankIdx] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [blankIdx]: e.target.value })
                  }
                  disabled={submitted}
                  placeholder="____"
                  className={`w-28 px-2 py-1 text-sm text-center border rounded-md bg-bg focus:outline-none transition-colors ${
                    submitted
                      ? isCorrect
                        ? "border-success text-success"
                        : "border-danger text-danger"
                      : "border-border focus:border-accent"
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !submitted) handleSubmit();
                  }}
                />
                {submitted && !isCorrect && (
                  <span className="text-xs text-success">{token.clean}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* 결과 */}
      {submitted && score && (
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`flex items-center gap-1.5 text-sm font-medium ${
              score.correct === score.total ? "text-success" : "text-warning"
            }`}
          >
            {score.correct === score.total ? (
              <Check size={16} />
            ) : (
              <X size={16} />
            )}
            {score.correct} / {score.total} 정답
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!submitted ? (
          <>
            <button
              onClick={handleSubmit}
              disabled={Object.keys(answers).length === 0}
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
