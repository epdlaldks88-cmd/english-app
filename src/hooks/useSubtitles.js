import { useState, useCallback } from "react";
import { db } from "../db/database";

const WORKER_URL = import.meta.env.VITE_SUBTITLE_WORKER;

export function useSubtitles(videoId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSubtitles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const existing = await db.subtitles
        .where("videoId")
        .equals(videoId)
        .count();
      if (existing > 0) {
        setLoading(false);
        return;
      }

      let subtitles = null;

      // 1순위: Cloudflare Worker (배포 환경)
      if (WORKER_URL) {
        try {
          const res = await fetch(`${WORKER_URL}?videoId=${videoId}`);
          const data = await res.json();
          if (res.ok && data.subtitles?.length > 0) {
            subtitles = data.subtitles;
          }
        } catch (err) {
          console.log("Worker 실패:", err.message);
        }
      }

      // 2순위: 로컬 API (개발 환경)
      if (!subtitles) {
        try {
          const res = await fetch(`/api/subtitles?videoId=${videoId}`);
          const data = await res.json();
          if (res.ok && data.subtitles?.length > 0) {
            subtitles = data.subtitles;
          }
        } catch (err) {
          console.log("로컬 API 실패:", err.message);
        }
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
