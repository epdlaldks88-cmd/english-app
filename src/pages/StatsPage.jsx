import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Video, Brain, TrendingUp } from "lucide-react";
import { db } from "../db/database";

export default function StatsPage() {
  const videos = useLiveQuery(() => db.videos.toArray());
  const words = useLiveQuery(() => db.words.toArray());

  const stats = useMemo(() => {
    if (!words?.length) return null;

    const total = words.length;
    const idioms = words.filter((w) => w.isIdiom).length;
    const reviewed = words.filter((w) => w.repetitions > 0).length;
    const mastered = words.filter(
      (w) => w.repetitions >= 3 && w.interval >= 6,
    ).length;
    const dueToday = words.filter(
      (w) => new Date(w.nextReview) <= new Date(),
    ).length;

    // 난이도 분포
    const beginner = words.filter((w) => w.repetitions === 0).length;
    const learning = words.filter(
      (w) => w.repetitions > 0 && w.repetitions < 3,
    ).length;
    const familiar = words.filter(
      (w) => w.repetitions >= 3 && w.interval < 6,
    ).length;

    // 영상별 단어 수
    const byVideo = {};
    words.forEach((w) => {
      byVideo[w.videoId] = (byVideo[w.videoId] || 0) + 1;
    });

    // 일별 추가 (최근 14일)
    const dailyAdded = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyAdded[key] = 0;
    }
    words.forEach((w) => {
      const key = w.addedAt?.split("T")[0];
      if (key && dailyAdded.hasOwnProperty(key)) {
        dailyAdded[key]++;
      }
    });

    return {
      total,
      idioms,
      reviewed,
      mastered,
      dueToday,
      beginner,
      learning,
      familiar,
      byVideo,
      dailyAdded,
    };
  }, [words]);

  if (!stats) {
    return (
      <div className="p-6 md:p-10 max-w-4xl">
        <h2 className="text-xl font-bold mb-6">학습 통계</h2>
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          아직 학습 데이터가 없습니다.
        </div>
      </div>
    );
  }

  const maxDaily = Math.max(...Object.values(stats.dailyAdded), 1);

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <h2 className="text-xl font-bold mb-6">학습 통계</h2>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-accent" />
            <span className="text-xs text-text-muted">전체 단어</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            숙어 {stats.idioms}개 포함
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={16} className="text-success" />
            <span className="text-xs text-text-muted">습득 완료</span>
          </div>
          <p className="text-2xl font-bold text-success">{stats.mastered}</p>
          <p className="text-[10px] text-text-muted mt-0.5">3회 이상 반복</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-warning" />
            <span className="text-xs text-text-muted">오늘 복습</span>
          </div>
          <p className="text-2xl font-bold text-warning">{stats.dueToday}</p>
          <p className="text-[10px] text-text-muted mt-0.5">복습 대상</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Video size={16} className="text-accent" />
            <span className="text-xs text-text-muted">등록 영상</span>
          </div>
          <p className="text-2xl font-bold">{videos?.length || 0}</p>
        </div>
      </div>

      {/* 학습 단계 분포 */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold mb-3">학습 단계 분포</h3>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex h-8 rounded-lg overflow-hidden mb-3">
            {stats.beginner > 0 && (
              <div
                className="bg-danger/60 transition-all"
                style={{ width: `${(stats.beginner / stats.total) * 100}%` }}
              />
            )}
            {stats.learning > 0 && (
              <div
                className="bg-warning/60 transition-all"
                style={{ width: `${(stats.learning / stats.total) * 100}%` }}
              />
            )}
            {stats.familiar > 0 && (
              <div
                className="bg-accent/60 transition-all"
                style={{ width: `${(stats.familiar / stats.total) * 100}%` }}
              />
            )}
            {stats.mastered > 0 && (
              <div
                className="bg-success/60 transition-all"
                style={{ width: `${(stats.mastered / stats.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-danger/60" />새 단어{" "}
              {stats.beginner}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-warning/60" />
              학습 중 {stats.learning}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-accent/60" />
              익숙함 {stats.familiar}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-success/60" />
              습득 {stats.mastered}
            </span>
          </div>
        </div>
      </section>

      {/* 최근 14일 추가 단어 */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold mb-3">최근 2주 단어 추가</h3>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-end gap-1 h-24">
            {Object.entries(stats.dailyAdded).map(([date, count]) => (
              <div
                key={date}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full bg-accent/60 rounded-sm transition-all min-h-[2px]"
                  style={{ height: `${(count / maxDaily) * 80}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {Object.entries(stats.dailyAdded).map(([date], i) => (
              <div key={date} className="flex-1 text-center">
                {i % 2 === 0 && (
                  <span className="text-[9px] text-text-muted">
                    {date.slice(5)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 영상별 단어 수 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">영상별 추출 단어</h3>
        <div className="bg-surface border border-border rounded-xl divide-y divide-border">
          {videos?.map((v) => {
            const count = stats.byVideo[v.id] || 0;
            return (
              <div
                key={v.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <span className="text-sm line-clamp-1 flex-1 mr-4">
                  {v.title}
                </span>
                <span className="text-sm font-medium text-accent shrink-0">
                  {count}단어
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
