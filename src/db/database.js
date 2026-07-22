import Dexie from "dexie";

export const db = new Dexie("EnglishLearningApp");

db.version(1).stores({
  videos: "id, title, addedAt, isFavorite, status",
  subtitles: "id, videoId, startTime, endTime",
  words: "id, word, videoId, addedAt, nextReview, level",
  studyLogs: "id, videoId, mode, startedAt",
});

db.version(2).stores({
  videos: "id, title, addedAt, isFavorite, status",
  subtitles: "id, videoId, startTime, endTime",
  translations: "id, videoId",
  words: "id, word, videoId, addedAt, nextReview, level",
  studyLogs: "id, videoId, mode, startedAt",
});

db.version(3).stores({
  videos: "id, title, addedAt, isFavorite, status, wordsExtracted",
  subtitles: "id, videoId, startTime, endTime",
  translations: "id, videoId",
  words: "id, word, videoId, isIdiom, addedAt, nextReview, level",
  studyLogs: "id, videoId, mode, startedAt",
});

db.version(4).stores({
  videos: "id, title, addedAt, isFavorite, status, wordsExtracted",
  subtitles: "id, videoId, startTime, endTime",
  translations: "id, videoId",
  words: "id, word, videoId, isIdiom, addedAt, nextReview, level",
  studyLogs: "id, videoId, mode, startedAt",
  articles: "id, title, addedAt, wordsExtracted",
  articleTranslations: "id, articleId, sentenceIndex",
});
