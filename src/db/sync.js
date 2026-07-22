import { db } from "./database";
import { supabase } from "./supabase";

export async function syncToCloud() {
  if (!supabase) return;

  try {
    // 영상 업로드
    const videos = await db.videos.toArray();
    if (videos.length > 0) {
      const rows = videos.map((v) => ({
        id: v.id,
        title: v.title,
        url: v.url || "",
        added_at: v.addedAt,
        status: v.status || "new",
        is_favorite: v.isFavorite || false,
        words_extracted: v.wordsExtracted || false,
      }));
      await supabase.from("videos").upsert(rows);
    }

    // 번역 업로드
    const translations = await db.translations.toArray();
    if (translations.length > 0) {
      for (let i = 0; i < translations.length; i += 500) {
        const batch = translations.slice(i, i + 500).map((t) => ({
          id: t.id,
          video_id: t.videoId,
          korean: t.korean,
        }));
        await supabase.from("translations").upsert(batch);
      }
    }

    // 단어 업로드
    const words = await db.words.toArray();
    if (words.length > 0) {
      for (let i = 0; i < words.length; i += 500) {
        const batch = words.slice(i, i + 500).map((w) => ({
          id: w.id,
          word: w.word,
          video_id: w.videoId,
          is_idiom: w.isIdiom || false,
          meanings: w.meanings || [],
          phonetic: w.phonetic || "",
          added_at: w.addedAt,
          next_review: w.nextReview,
          interval_days: w.interval || 1,
          ease_factor: w.easeFactor || 2.5,
          repetitions: w.repetitions || 0,
          level: w.level || 0,
        }));
        await supabase.from("words").upsert(batch);
      }
    }

    console.log("클라우드 싱크 완료");
  } catch (err) {
    console.error("클라우드 싱크 실패:", err);
  }
}

export async function syncFromCloud() {
  if (!supabase) return;

  try {
    // 영상 다운로드
    const { data: videos } = await supabase.from("videos").select("*");
    if (videos?.length > 0) {
      const rows = videos.map((v) => ({
        id: v.id,
        title: v.title,
        url: v.url,
        addedAt: v.added_at,
        status: v.status,
        isFavorite: v.is_favorite,
        wordsExtracted: v.words_extracted,
      }));
      await db.videos.bulkPut(rows);
    }

    // 자막 다운로드
    const { data: subtitles } = await supabase.from("subtitles").select("*");
    if (subtitles?.length > 0) {
      const rows = subtitles.map((s) => ({
        id: s.id,
        videoId: s.video_id,
        text: s.text,
        startTime: s.start_time,
        duration: s.duration,
        endTime: s.end_time,
      }));
      await db.subtitles.bulkPut(rows);
    }

    // 번역 다운로드
    const { data: translations } = await supabase
      .from("translations")
      .select("*");
    if (translations?.length > 0) {
      const rows = translations.map((t) => ({
        id: t.id,
        videoId: t.video_id,
        korean: t.korean,
      }));
      await db.translations.bulkPut(rows);
    }

    // 단어 다운로드
    const { data: words } = await supabase.from("words").select("*");
    if (words?.length > 0) {
      const rows = words.map((w) => ({
        id: w.id,
        word: w.word,
        videoId: w.video_id,
        isIdiom: w.is_idiom,
        meanings: w.meanings,
        phonetic: w.phonetic,
        addedAt: w.added_at,
        nextReview: w.next_review,
        interval: w.interval_days,
        easeFactor: w.ease_factor,
        repetitions: w.repetitions,
        level: w.level,
      }));
      await db.words.bulkPut(rows);
    }

    console.log("클라우드에서 동기화 완료");
  } catch (err) {
    console.error("클라우드 동기화 실패:", err);
  }
}
