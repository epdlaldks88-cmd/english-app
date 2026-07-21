import { Link } from 'react-router-dom';
import { Video, BookOpen, PenTool, BarChart3 } from 'lucide-react';

const quickActions = [
  {
    to: '/videos',
    icon: Video,
    title: '영상 등록',
    desc: 'YouTube 뉴스 영상 추가',
    color: 'text-accent',
  },
  {
    to: '/vocabulary',
    icon: BookOpen,
    title: '단어 복습',
    desc: '플래시카드 · SRS',
    color: 'text-success',
  },
  {
    to: '/study',
    icon: PenTool,
    title: '학습 모드',
    desc: '빈칸 · 받아쓰기 · 쉐도잉',
    color: 'text-warning',
  },
  {
    to: '/stats',
    icon: BarChart3,
    title: '학습 통계',
    desc: '진도 · 정답률 · 약한 단어',
    color: 'text-danger',
  },
];

export default function HomePage() {
  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <div className="mb-10">
        <h2 className="text-2xl font-bold tracking-tight">
          오늘도 한 걸음 더
        </h2>
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

      {/* 복습 예정 섹션 - 추후 SRS 데이터 연동 */}
      <section className="mt-10">
        <h3 className="text-sm font-semibold text-text-muted mb-3">
          오늘의 복습
        </h3>
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted text-sm">
          아직 등록된 영상이 없습니다.<br />
          <Link to="/videos" className="text-accent hover:underline mt-2 inline-block">
            첫 영상 등록하기 →
          </Link>
        </div>
      </section>
    </div>
  );
}
