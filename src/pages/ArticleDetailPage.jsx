import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { db } from "../db/database";
import { autoExtractAndSave } from "../utils/extractWords";
import ClickableText from "../components/ClickableText";
import DictionaryPopup from "../components/DictionaryPopup";

function splitSentences(text) {
  // 약어 보호: Mr. Mrs. Dr. U.S. St. vs. etc. 등
  const protected_ = text
    .replace(/Mr\./g, "Mr\u200B")
    .replace(/Mrs\./g, "Mrs\u200B")
    .replace(/Ms\./g, "Ms\u200B")
    .replace(/Dr\./g, "Dr\u200B")
    .replace(/Prof\./g, "Prof\u200B")
    .replace(/Sr\./g, "Sr\u200B")
    .replace(/Jr\./g, "Jr\u200B")
    .replace(/St\./g, "St\u200B")
    .replace(/Gen\./g, "Gen\u200B")
    .replace(/Gov\./g, "Gov\u200B")
    .replace(/Sen\./g, "Sen\u200B")
    .replace(/Rep\./g, "Rep\u200B")
    .replace(/Sgt\./g, "Sgt\u200B")
    .replace(/Lt\./g, "Lt\u200B")
    .replace(/Col\./g, "Col\u200B")
    .replace(/Capt\./g, "Capt\u200B")
    .replace(/U\.S\./g, "U\u200BS\u200B")
    .replace(/U\.K\./g, "U\u200BK\u200B")
    .replace(/U\.N\./g, "U\u200BN\u200B")
    .replace(/E\.U\./g, "E\u200BU\u200B")
    .replace(/vs\./g, "vs\u200B")
    .replace(/etc\./g, "etc\u200B")
    .replace(/i\.e\./g, "i\u200Be\u200B")
    .replace(/e\.g\./g, "e\u200Bg\u200B")
    .replace(/No\./g, "No\u200B")
    .replace(/Inc\./g, "Inc\u200B")
    .replace(/Corp\./g, "Corp\u200B")
    .replace(/Ltd\./g, "Ltd\u200B")
    .replace(/Co\./g, "Co\u200B")
    .replace(/Jan\./g, "Jan\u200B")
    .replace(/Feb\./g, "Feb\u200B")
    .replace(/Mar\./g, "Mar\u200B")
    .replace(/Apr\./g, "Apr\u200B")
    .replace(/Aug\./g, "Aug\u200B")
    .replace(/Sep\./g, "Sep\u200B")
    .replace(/Sept\./g, "Sept\u200B")
    .replace(/Oct\./g, "Oct\u200B")
    .replace(/Nov\./g, "Nov\u200B")
    .replace(/Dec\./g, "Dec\u200B");

  // 문장 분리: .?! 뒤에 공백+대문자 또는 따옴표
  const raw = protected_.split(/([.?!])\s+(?=[A-Z"\u201C])/);

  // 분리된 조각 재조합
  const sentences = [];
  let current = "";
  for (let i = 0; i < raw.length; i++) {
    current += raw[i];
    // 구두점 조각이면 다음으로
    if (/^[.?!]$/.test(raw[i])) continue;
    // 의미 있는 문장이면 저장
    const restored = current.replace(/\u200B/g, ".").trim();
    if (restored.length > 0) {
      sentences.push(restored);
    }
    current = "";
  }
  if (current.trim()) {
    sentences.push(current.replace(/\u200B/g, ".").trim());
  }

  return sentences;
}

export default function ArticleDetailPage() {
  const { articleId } = useParams();
  const [showKorean, setShowKorean] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

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

  // 자동 번역
  const handleTranslate = useCallback(async () => {
    if (!sentences.length) return;

    const untranslated = sentences
      .map((s, i) => ({ text: s, index: i }))
      .filter((s) => !translationMap[s.index]);

    if (untranslated.length === 0) return;

    setTranslating(true);

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

        if (!res.ok) continue;

        const { translations: translated } = await res.json();

        const records = batch.map((s, j) => ({
          id: `${articleId}_sent_${s.index}`,
          articleId,
          sentenceIndex: s.index,
          english: s.text,
          korean: translated[j],
        }));

        await db.articleTranslations.bulkPut(records);
      }
    } catch (err) {
      console.error("번역 실패:", err);
    } finally {
      setTranslating(false);
    }
  }, [sentences, translationMap, articleId]);

  // 자동 번역 실행
  useEffect(() => {
    if (
      sentences.length > 0 &&
      translations !== undefined &&
      translations.length === 0 &&
      !translating
    ) {
      handleTranslate();
    }
  }, [sentences, translations, translating, handleTranslate]);

  // 단어 자동 추출
  useEffect(() => {
    if (
      sentences.length > 0 &&
      translations?.length > 0 &&
      article &&
      !article.wordsExtracted &&
      !extracting &&
      !translating
    ) {
      handleAutoExtract();
    }
  }, [sentences, translations, article, extracting, translating]);

  const handleAutoExtract = async () => {
    if (!sentences.length) return;

    setExtracting(true);
    setExtractProgress(0);

    try {
      // 문장을 자막과 같은 형태로 변환
      const fakeSubs = sentences.map((text, i) => ({
        id: `${articleId}_${i}`,
        videoId: articleId,
        text,
      }));

      await autoExtractAndSave(fakeSubs, articleId, (progress) => {
        setExtractProgress(progress);
      });

      await db.articles.update(articleId, { wordsExtracted: true });
    } catch (err) {
      console.error("단어 추출 실패:", err);
    } finally {
      setExtracting(false);
    }
  };

  const handleReprocess = async () => {
    if (!confirm("번역과 단어를 다시 추출합니다. 진행할까요?")) return;
    await db.articleTranslations.where("articleId").equals(articleId).delete();
    await db.words.where("videoId").equals(articleId).delete();
    await db.articles.update(articleId, { wordsExtracted: false });
    window.location.reload();
  };

  if (!article) {
    return (
      <div className="p-6 md:p-10 text-text-muted text-sm">
        기사를 찾을 수 없습니다.
      </div>
    );
  }

  const hasTranslations = translations?.length > 0;

  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <Link
        to="/articles"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> 목록으로
      </Link>

      <h2 className="text-lg font-bold mb-2 leading-snug">{article.title}</h2>

      {article.sourceUrl && (
        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent hover:underline mb-4 inline-block"
        >
          원문 보기 →
        </a>
      )}

      {/* 관리 버튼 */}
      <div className="flex flex-wrap gap-2 mb-4 mt-2">
        <button
          onClick={handleReprocess}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
        >
          <RefreshCw size={12} /> 번역·단어 재처리
        </button>
        {hasTranslations && (
          <button
            onClick={() => setShowKorean(!showKorean)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
          >
            {showKorean ? <EyeOff size={12} /> : <Eye size={12} />}
            {showKorean ? "한글 숨기기" : "한글 보기"}
          </button>
        )}
        {article.wordsExtracted && (
          <Link
            to="/vocabulary"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            <BookOpen size={12} /> 단어장 보기
          </Link>
        )}
      </div>

      {/* 추출 진행 */}
      {extracting && (
        <div className="bg-surface border border-border rounded-xl px-5 py-3 mb-4 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-accent shrink-0" />
          <div className="flex-1">
            <p className="text-sm">단어·숙어 추출 중... {extractProgress}%</p>
            <div className="h-1 bg-border rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${extractProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 번역 진행 */}
      {translating && (
        <div className="flex items-center gap-2 mb-4 text-text-muted text-sm">
          <Loader2 size={14} className="animate-spin" />
          번역 중...
        </div>
      )}

      {/* 기사 본문 */}
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {sentences.map((sentence, i) => (
          <div key={i} className="px-5 py-4">
            <p className="text-sm leading-relaxed">
              <ClickableText text={sentence} onWordClick={setSelectedWord} />
            </p>
            {showKorean && translationMap[i] && (
              <p className="text-xs text-text-muted leading-relaxed mt-1.5">
                {translationMap[i]}
              </p>
            )}
          </div>
        ))}
      </div>

      {selectedWord && (
        <DictionaryPopup
          word={selectedWord}
          videoId={articleId}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
