import { useState, useCallback } from "react";
import { db } from "../db/database";
import { supabase } from "../db/supabase";

const WORKER_URL = import.meta.env.VITE_SUBTITLE_WORKER;

export function useSubtitles(videoId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [needsManual, setNeedsManual] = useState(false);

  const fetchSubtitles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsManual(false);

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

      let subtitles = null;

      // 1순위: Supabase에서 가져오기 (다른 기기에서 이미 추출한 경우)
      if (supabase) {
        try {
          const { data, error: sbError } = await supabase
            .from("subtitles")
            .select("*")
            .eq("video_id", videoId)
            .order("start_time");

          if (!sbError && data?.length > 0) {
            subtitles = data.map((row) => ({
              id: row.id,
              videoId: row.video_id,
              text: row.text,
              startTime: row.start_time,
              duration: row.duration,
              endTime: row.end_time,
            }));
          }
        } catch (err) {
          console.log("Supabase 조회 실패:", err.message);
        }
      }

      // 2순위: 로컬 API (개발 환경, youtube-transcript)
      if (!subtitles) {
        try {
          const res = await fetch(`/api/subtitles?videoId=${videoId}`);
          const data = await res.json();

          if (res.ok && data.subtitles?.length > 0) {
            subtitles = data.subtitles;

            // 로컬 추출 성공 → Supabase에도 업로드
            if (supabase) {
              uploadToSupabase(subtitles).catch((err) =>
                console.log("Supabase 업로드 실패:", err.message),
              );
            }
          }
        } catch (err) {
          console.log("로컬 API 실패:", err.message);
        }
      }

      // 3순위: Worker (배포 환경 폴백)
      if (!subtitles && WORKER_URL) {
        try {
          const res = await fetch(`${WORKER_URL}?videoId=${videoId}`);
          const data = await res.json();

          if (res.ok && data.subtitles?.length > 0) {
            subtitles = data.subtitles;

            if (supabase) {
              uploadToSupabase(subtitles).catch((err) =>
                console.log("Supabase 업로드 실패:", err.message),
              );
            }
          }
        } catch (err) {
          console.log("Worker 실패:", err.message);
        }
      }

      // 모두 실패 → 수동 입력 요청
      if (!subtitles?.length) {
        setNeedsManual(true);
        setLoading(false);
        return;
      }

      await db.subtitles.bulkPut(subtitles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  return { fetchSubtitles, loading, error, needsManual, setNeedsManual };
}

async function uploadToSupabase(subtitles) {
  if (!supabase) return;

  const rows = subtitles.map((s) => ({
    id: s.id,
    video_id: s.videoId,
    text: s.text,
    start_time: s.startTime,
    duration: s.duration,
    end_time: s.endTime,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    await supabase.from("subtitles").upsert(rows.slice(i, i + 500));
  }
}
