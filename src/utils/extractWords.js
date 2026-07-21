import { STOP_WORDS, COMMON_IDIOMS } from "./stopWords";
import { db } from "../db/database";

// 자막 텍스트에서 단어 + 숙어 추출
export async function extractNewWords(mergedSubtitles, videoId) {
  const fullText = mergedSubtitles
    .map((s) => s.text)
    .join(" ")
    .toLowerCase();

  // 1) 숙어 추출
  const foundIdioms = [];
  for (const idiom of COMMON_IDIOMS) {
    if (fullText.includes(idiom)) {
      foundIdioms.push(idiom);
    }
  }

  // 2) 단어 추출 (3글자 이상, 불용어 제외)
  const wordSet = new Set();
  const tokens = fullText.replace(/[^a-z'-]/g, " ").split(/\s+/);
  for (const token of tokens) {
    const clean = token.replace(/^['-]+|['-]+$/g, "");
    if (clean.length >= 3 && !STOP_WORDS.has(clean)) {
      wordSet.add(clean);
    }
  }

  // 3) 이미 단어장에 있는 단어/숙어 제외
  const existingWords = await db.words.toArray();
  const existingSet = new Set(existingWords.map((w) => w.word.toLowerCase()));

  const newWords = [...wordSet].filter((w) => !existingSet.has(w));
  const newIdioms = foundIdioms.filter((w) => !existingSet.has(w));

  return { words: newWords, idioms: newIdioms };
}

// Free Dictionary API 조회 (속도 제한 대응)
async function lookupWord(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data[0] || null;
  } catch {
    return null;
  }
}

// 배치 번역
async function translateBatch(texts) {
  if (!texts.length) return [];
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    if (!res.ok) return texts.map(() => "");
    const { translations } = await res.json();
    return translations;
  } catch {
    return texts.map(() => "");
  }
}

// 단어 자동 추출 + 사전 조회 + 번역 + 저장
export async function autoExtractAndSave(mergedSubtitles, videoId, onProgress) {
  const { words, idioms } = await extractNewWords(mergedSubtitles, videoId);
  const allItems = [...idioms, ...words];

  if (allItems.length === 0) return { added: 0 };

  const results = [];
  const batchSize = 10;

  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);

    if (onProgress) {
      onProgress(Math.round(((i + batch.length) / allItems.length) * 100));
    }

    // 사전 조회 (병렬, 배치당)
    const lookups = await Promise.all(batch.map((w) => lookupWord(w)));

    // 영어 정의 수집 → 한글 번역
    const defsToTranslate = [];
    const defMapping = []; // { batchIdx, meaningIdx, defIdx }

    lookups.forEach((dictData, bi) => {
      if (!dictData?.meanings) return;
      dictData.meanings.slice(0, 2).forEach((m, mi) => {
        m.definitions.slice(0, 2).forEach((d, di) => {
          defMapping.push({ bi, mi, di });
          defsToTranslate.push(d.definition);
        });
      });
    });

    const koreanDefs = await translateBatch(defsToTranslate);

    // 결과 조합 + 저장
    for (let bi = 0; bi < batch.length; bi++) {
      const word = batch[bi];
      const dictData = lookups[bi];

      let meanings = [];
      if (dictData?.meanings) {
        meanings = dictData.meanings.slice(0, 2).map((m, mi) => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions.slice(0, 2).map((d, di) => {
            const mapEntry = defMapping.find(
              (e) => e.bi === bi && e.mi === mi && e.di === di,
            );
            const korIdx = mapEntry ? defMapping.indexOf(mapEntry) : -1;
            return {
              english: d.definition,
              korean: korIdx >= 0 ? koreanDefs[korIdx] : "",
              example: d.example || "",
            };
          }),
        }));
      }

      const record = {
        id: `${word.replace(/\s+/g, "_")}_${videoId}`,
        word,
        videoId,
        isIdiom: idioms.includes(word),
        meanings,
        phonetic: dictData?.phonetic || "",
        addedAt: new Date().toISOString(),
        nextReview: new Date().toISOString(),
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        level: 0,
      };

      results.push(record);
    }

    // API 과부하 방지
    await new Promise((r) => setTimeout(r, 300));
  }

  // 한꺼번에 저장
  await db.words.bulkPut(results);

  return { added: results.length };
}
