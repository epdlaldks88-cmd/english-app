import { useState, useCallback } from "react";
import { db } from "../db/database";

// 클라이언트에서 YouTube Innertube API 직접 호출 (CORS 프록시 없이)
async function clientFetchSubtitles(videoId) {
  // 방법 1: YouTube oEmbed로 확인 후 timedtext 직접 시도
  const languages = ["en", "en-US", "en-GB"];

  for (const lang of languages) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      if (!data?.events?.length) continue;

      return data.events
        .filter((e) => e.segs)
        .map((e, i) => ({
          id: `${videoId}_${i}`,
          videoId,
          text: e.segs
            .map((s) => s.utf8 || "")
            .join("")
            .replace(/\n/g, " ")
            .trim(),
          startTime: (e.tStartMs || 0) / 1000,
          duration: (e.dDurationMs || 0) / 1000,
          endTime: ((e.tStartMs || 0) + (e.dDurationMs || 0)) / 1000,
        }))
        .filter((s) => s.text);
    } catch {
      continue;
    }
  }

  return null;
}

export function useSubtitles(videoId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSubtitles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // DB에 이미 있으면 스킵
      const existing = await db.subtitles
        .where("videoId")
        .equals(videoId)
        .count();
      if (existing > 0) {
        setLoading(false);
        return;
      }

      // 1단계: 서버에서 추출 시도
      let subtitles = null;

      try {
        const res = await fetch(`/api/subtitles?videoId=${videoId}`);
        const data = await res.json();

        if (res.ok && data.subtitles?.length > 0) {
          subtitles = data.subtitles;
        }
      } catch {
        console.log("서버 추출 실패, 클라이언트 폴백 시도");
      }

      // 2단계: 서버 실패 시 클라이언트에서 직접 시도
      if (!subtitles) {
        subtitles = await clientFetchSubtitles(videoId);
      }

      if (!subtitles?.length) {
        throw new Error(
          "자막을 가져올 수 없습니다. 자막이 있는 영상인지 확인해주세요.",
        );
      }

      await db.subtitles.bulkPut(subtitles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  return { fetchSubtitles, loading, error };
}
