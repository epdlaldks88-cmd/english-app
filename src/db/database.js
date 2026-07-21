import Dexie from 'dexie';

export const db = new Dexie('EnglishLearningApp');

db.version(1).stores({
  // 영상 라이브러리
  videos: 'id, title, addedAt, isFavorite, status',
  // 자막 (영상별)
  subtitles: 'id, videoId, startTime, endTime',
  // 단어장
  words: 'id, word, videoId, addedAt, nextReview, level',
  // 학습 기록
  studyLogs: 'id, videoId, mode, startedAt',
});
