import { useState, useCallback } from "react";
import { db } from "../db/database";

export function useSubtitles(videoId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSubtitles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 이미 DB에 있으면 스킵
      const existing = await db.subtitles
        .where("videoId")
        .equals(videoId)
        .count();
      if (existing > 0) {
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/subtitles?videoId=${videoId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "자막 추출 실패");
      }

      const { subtitles } = await res.json();
      await db.subtitles.bulkPut(subtitles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  return { fetchSubtitles, loading, error };
}
