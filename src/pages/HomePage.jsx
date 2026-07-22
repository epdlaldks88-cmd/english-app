import { Link } from "react-router-dom";
import { Video, FileText, BookOpen, PenTool, BarChart3 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";

const quickActions = [
  {
    to: "/videos",
    icon: Video,
    title: "영상 등록",
    desc: "YouTube 뉴스 영상 추가",
    color: "text-accent",
  },
  {
    to: "/articles",
    icon: FileText,
    title: "기사 학습",
    desc: "영어 뉴스 기사 읽기 · 번역",
    color: "text-warning",
  },
  {
    to: "/vocabulary",
    icon: BookOpen,
    title: "단어 복습",
    desc: "플래시카드 · SRS",
    color: "text-success",
  },
  {
    to: "/study",
    icon: PenTool,
    title: "학습 모드",
    desc: "빈칸 · 받아쓰기 · 쉐도잉",
    color: "text-warning",
  },
  {
    to: "/stats",
    icon: BarChart3,
    title: "학습 통계",
    desc: "진도 · 정답률 · 약한 단어",
    color: "text-danger",
  },
];

function ReviewSection() {
  const words = useLiveQuery(() => db.words.toArray());
  const dueCount =
    words?.filter((w) => new Date(w.nextReview) <= new Date()).length || 0;
  const totalCount = words?.length || 0;

  return (
    <section className="mt-10">
      <h3 className="text-sm font-semibold text-text-muted mb-3">
        오늘의 복습
      </h3>
      {totalCount === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted text-sm">
          아직 등록된 영상이 없습니다.
          <br />
          <Link
            to="/videos"
            className="text-accent hover:underline mt-2 inline-block"
          >
            첫 영상 등록하기 →
          </Link>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm">
                복습 대상{" "}
                <span className="text-accent font-bold">{dueCount}</span>개
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                전체 {totalCount}단어
              </p>
            </div>
            {dueCount > 0 && (
              <Link
                to="/vocabulary/flashcard"
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
              >
                복습 시작
              </Link>
            )}
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all"
              style={{
                width: `${((totalCount - dueCount) / totalCount) * 100}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-text-muted mt-1.5">
            {totalCount - dueCount}개 학습 완료
          </p>
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <div className="mb-10">
        <h2 className="text-2xl font-bold tracking-tight">오늘도 한 걸음 더</h2>
        <p className="text-text-muted mt-1">
          영어 뉴스 영상으로 듣기·읽기·쓰기·말하기를 한번에
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions.map(({ to, icon: Icon, title, desc, color }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-4 p-5 bg-surface rounded-xl border border-border hover:border-accent/30 hover:bg-surface-hover transition-all group"
          >
            <div
              className={`mt-0.5 ${color} opacity-80 group-hover:opacity-100 transition-opacity`}
            >
              <Icon size={22} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-text-muted mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <ReviewSection />
    </div>
  );
}
