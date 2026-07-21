import { STOP_WORDS, COMMON_IDIOMS } from "./stopWords";
import { db } from "../db/database";

// 자막 텍스트에서 단어 + 숙어 추출
export async function extractNewWords(mergedSubtitles, videoId) {
  const fullText = mergedSubtitles.map((s) => s.text).join(" ");
  const fullTextLower = fullText.toLowerCase();

  // 1) 숙어 추출 (유연한 매칭: 중간에 단어 끼어도 매칭)
  const foundIdioms = [];
  for (const idiom of COMMON_IDIOMS) {
    const words = idiom.split(" ");

    if (words.length === 2) {
      // 2단어 숙어: 중간에 0~2단어까지 허용 (예: "carry it out")
      const pattern = new RegExp(
        `\\b${words[0]}\\b(?:\\s+\\w+){0,2}\\s+\\b${words[1]}\\b`,
        "i",
      );
      if (pattern.test(fullText)) {
        foundIdioms.push(idiom);
      }
    } else if (words.length === 3) {
      // 3단어: 단어 사이 0~1단어 허용
      const pattern = new RegExp(
        `\\b${words[0]}\\b(?:\\s+\\w+){0,1}\\s+\\b${words[1]}\\b(?:\\s+\\w+){0,1}\\s+\\b${words[2]}\\b`,
        "i",
      );
      if (pattern.test(fullText)) {
        foundIdioms.push(idiom);
      }
    } else {
      // 4단어 이상: 정확 매칭
      if (fullTextLower.includes(idiom)) {
        foundIdioms.push(idiom);
      }
    }
  }

  // 2) 단어 추출 (4글자 이상, 불용어 제외, 숫자 제외)
  const wordSet = new Set();
  const tokens = fullTextLower.replace(/[^a-z'-]/g, " ").split(/\s+/);
  for (const token of tokens) {
    const clean = token.replace(/^['-]+|['-]+$/g, "");
    if (
      clean.length >= 4 &&
      !STOP_WORDS.has(clean) &&
      !/^\d+$/.test(clean) &&
      /[a-z]/.test(clean)
    ) {
      wordSet.add(clean);
    }
  }

  // 3) 이미 단어장에 있는 단어/숙어 제외
  const existingWords = await db.words.toArray();
  const existingSet = new Set(existingWords.map((w) => w.word.toLowerCase()));

  const newWords = [...wordSet].filter((w) => !existingSet.has(w));
  const newIdioms = [...new Set(foundIdioms)].filter(
    (w) => !existingSet.has(w),
  );

  return { words: newWords, idioms: newIdioms };
}

// Free Dictionary API 조회
async function lookupWord(word) {
  // 숙어는 사전 조회 스킵 (보통 없음)
  if (word.includes(" ")) return null;
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

  // 숙어 먼저, 그 다음 단어
  const allItems = [...idioms, ...words];

  if (allItems.length === 0) return { added: 0, words: 0, idioms: 0 };

  const results = [];
  const batchSize = 10;

  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);

    if (onProgress) {
      onProgress(Math.round(((i + batch.length) / allItems.length) * 100));
    }

    // 사전 조회 (병렬, 숙어는 스킵)
    const lookups = await Promise.all(batch.map((w) => lookupWord(w)));

    // 영어 정의 수집 → 한글 번역
    const defsToTranslate = [];
    const defMapping = [];

    // 숙어 자체도 번역 대상에 추가
    batch.forEach((item, bi) => {
      const isIdiom = idioms.includes(item);
      if (isIdiom) {
        defMapping.push({ bi, type: "idiom" });
        defsToTranslate.push(item);
      }
    });

    lookups.forEach((dictData, bi) => {
      if (!dictData?.meanings) return;
      dictData.meanings.slice(0, 2).forEach((m, mi) => {
        m.definitions.slice(0, 2).forEach((d, di) => {
          defMapping.push({ bi, mi, di, type: "def" });
          defsToTranslate.push(d.definition);
        });
      });
    });

    const koreanDefs = await translateBatch(defsToTranslate);

    // 결과 조합 + 저장
    for (let bi = 0; bi < batch.length; bi++) {
      const word = batch[bi];
      const isIdiom = idioms.includes(word);
      const dictData = lookups[bi];

      let meanings = [];
      let koreanWord = "";

      // 숙어 한글 번역 가져오기
      if (isIdiom) {
        const idiomMapIdx = defMapping.findIndex(
          (e) => e.bi === bi && e.type === "idiom",
        );
        if (idiomMapIdx >= 0) {
          koreanWord = koreanDefs[idiomMapIdx] || "";
        }
      }

      if (dictData?.meanings) {
        meanings = dictData.meanings.slice(0, 2).map((m, mi) => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions.slice(0, 2).map((d, di) => {
            const mapEntry = defMapping.find(
              (e) =>
                e.bi === bi && e.mi === mi && e.di === di && e.type === "def",
            );
            const korIdx = mapEntry ? defMapping.indexOf(mapEntry) : -1;
            return {
              english: d.definition,
              korean: korIdx >= 0 ? koreanDefs[korIdx] : "",
              example: d.example || "",
            };
          }),
        }));
      } else if (isIdiom && koreanWord) {
        // 사전에 없는 숙어: 한글 번역만 표시
        meanings = [
          {
            partOfSpeech: "idiom",
            definitions: [{ english: word, korean: koreanWord, example: "" }],
          },
        ];
      }

      const record = {
        id: `${word.replace(/\s+/g, "_")}_${videoId}`,
        word,
        videoId,
        isIdiom,
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

  const idiomCount = results.filter((r) => r.isIdiom).length;
  return {
    added: results.length,
    words: results.length - idiomCount,
    idioms: idiomCount,
  };
}
