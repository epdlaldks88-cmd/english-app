import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Play,
  Mic,
  MicOff,
  SkipForward,
  RotateCcw,
} from "lucide-react";
import { db } from "../db/database";
import { mergeSubtitles } from "../utils/mergeSubtitles";

function compareWords(original, spoken) {
  const origWords = original
    .replace(/[^a-zA-Z0-9\s'-]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const spokenWords = spoken.toLowerCase().split(/\s+/).filter(Boolean);

  return origWords.map((word, i) => {
    const match = spokenWords.some(
      (sw) => sw === word || sw.includes(word) || word.includes(sw),
    );
    return { word, match };
  });
}

function calcAccuracy(results) {
  if (!results.length) return 0;
  const matched = results.filter((r) => r.match).length;
  return Math.round((matched / results.length) * 100);
}

export default function ShadowingPage() {
  const { videoId } = useParams();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [wordResults, setWordResults] = useState(null);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState({ totalAcc: 0, count: 0 });
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const iframeRef = useRef(null);

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

  // Web Speech API 초기화
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSpokenText(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("음성 인식 오류:", event.error);
      setIsListening(false);
      if (event.error === "no-speech") {
        setSpokenText("(음성이 감지되지 않았습니다)");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  // 음성 인식 결과 → 단어별 비교
  useEffect(() => {
    if (spokenText && currentSentence && !spokenText.startsWith("(")) {
      const results = compareWords(currentSentence.text, spokenText);
      setWordResults(results);

      const accuracy = calcAccuracy(results);
      setStats((prev) => ({
        totalAcc: prev.totalAcc + accuracy,
        count: prev.count + 1,
      }));
    }
  }, [spokenText, currentSentence]);

  const playCurrent = useCallback(() => {
    if (!currentSentence || !iframeRef.current) return;
    const start = Math.floor(currentSentence.startTime);
    iframeRef.current.src = `https://www.youtube.com/embed/${videoId}?rel=0&start=${start}&autoplay=1`;
  }, [currentSentence, videoId]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setSpokenText("");
    setWordResults(null);
    setIsListening(true);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  };

  const handleNext = () => {
    if (currentIdx + 1 >= merged.length) {
      setFinished(true);
    } else {
      setCurrentIdx(currentIdx + 1);
      setSpokenText("");
      setWordResults(null);
    }
  };

  const restart = () => {
    setCurrentIdx(0);
    setSpokenText("");
    setWordResults(null);
    setFinished(false);
    setStats({ totalAcc: 0, count: 0 });
  };

  if (!video || !merged?.length) {
    return (
      <div className="p-6 md:p-10 text-text-muted text-sm">
        영상을 찾을 수 없습니다.
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          to={`/videos/${videoId}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> 영상으로
        </Link>
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-danger text-sm mb-2">
            이 브라우저는 음성 인식을 지원하지 않습니다.
          </p>
          <p className="text-xs text-text-muted">
            Chrome, Edge, 또는 Safari를 사용해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (finished) {
    const avgAcc =
      stats.count > 0 ? Math.round(stats.totalAcc / stats.count) : 0;
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          to={`/videos/${videoId}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> 영상으로
        </Link>
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <h3 className="text-xl font-bold mb-2">쉐도잉 완료!</h3>
          <p className="text-3xl font-bold text-accent mb-1">{avgAcc}%</p>
          <p className="text-sm text-text-muted mb-6">
            평균 정확도 ({stats.count}문장)
          </p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            <RotateCcw size={14} /> 다시 연습
          </button>
        </div>
      </div>
    );
  }

  const accuracy = wordResults ? calcAccuracy(wordResults) : null;

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

      {/* 영상 플레이어 */}
      <div className="relative w-full pb-[30%] bg-black rounded-xl overflow-hidden mb-4">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* 원문 표시 */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-4">
        <p className="text-sm leading-relaxed font-medium">
          {currentSentence.text}
        </p>
        {translationMap[currentSentence.id] && (
          <p className="text-xs text-text-muted mt-1.5">
            {translationMap[currentSentence.id]}
          </p>
        )}
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={playCurrent}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
        >
          <Play size={14} /> 듣기
        </button>

        {!isListening ? (
          <button
            onClick={startListening}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            <Mic size={14} /> 따라 말하기
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors animate-pulse"
          >
            <MicOff size={14} /> 녹음 중... (탭하여 중지)
          </button>
        )}
      </div>

      {/* 인식 결과 */}
      {spokenText && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-text-muted">내 발음</p>
            {accuracy !== null && (
              <span
                className={`text-sm font-bold ${
                  accuracy >= 80
                    ? "text-success"
                    : accuracy >= 50
                      ? "text-warning"
                      : "text-danger"
                }`}
              >
                {accuracy}%
              </span>
            )}
          </div>

          {wordResults ? (
            <div className="flex flex-wrap gap-1.5">
              {wordResults.map((r, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 text-sm rounded-md ${
                    r.match
                      ? "bg-success/15 text-success"
                      : "bg-danger/15 text-danger"
                  }`}
                >
                  {r.word}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">{spokenText}</p>
          )}
        </div>
      )}

      {/* 다음 버튼 */}
      {wordResults && (
        <button
          onClick={handleNext}
          className="w-full py-2.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
        >
          다음 문장 →
        </button>
      )}

      {!wordResults && !isListening && (
        <button
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-text-muted border border-border rounded-lg hover:bg-surface-hover transition-colors"
        >
          <SkipForward size={14} /> 건너뛰기
        </button>
      )}
    </div>
  );
}
