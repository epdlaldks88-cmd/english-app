import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { PenTool, Headphones, Mic, BookOpen } from "lucide-react";
import { db } from "../db/database";
import { getThumbnail } from "../utils/youtube";

export default function StudyPage() {
  const videos = useLiveQuery(() =>
    db.videos.orderBy("addedAt").reverse().toArray(),
  );
  const articles = useLiveQuery(() =>
    db.articles?.orderBy("addedAt").reverse().toArray(),
  );

  const hasContent = videos?.length > 0 || articles?.length > 0;

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <h2 className="text-xl font-bold mb-6">학습 모드</h2>

      {!hasContent ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          등록된 콘텐츠가 없습니다.
          <br />
          <Link
            to="/videos"
            className="text-accent hover:underline mt-2 inline-block"
          >
            영상 등록하기 →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 영상 */}
          {videos?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text-muted mb-3">
                영상
              </h3>
              <div className="space-y-3">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
                  >
                    <div className="flex gap-4">
                      <img
                        src={getThumbnail(v.id)}
                        alt=""
                        className="w-32 h-[72px] object-cover rounded-lg shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-1 mb-3">
                          {v.title}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/study/cloze/${v.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent/15 text-accent rounded-md hover:bg-accent/25 transition-colors"
                          >
                            <PenTool size={12} /> 빈칸 채우기
                          </Link>
                          <Link
                            to={`/study/dictation/${v.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-success/15 text-success rounded-md hover:bg-success/25 transition-colors"
                          >
                            <Headphones size={12} /> 받아쓰기
                          </Link>
                          <Link
                            to={`/study/shadowing/${v.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-warning/15 text-warning rounded-md hover:bg-warning/25 transition-colors"
                          >
                            <Mic size={12} /> 쉐도잉
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 기사 */}
          {articles?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text-muted mb-3">
                기사
              </h3>
              <div className="space-y-3">
                {articles.map((a) => (
                  <div
                    key={a.id}
                    className="bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
                  >
                    <p className="font-semibold text-sm line-clamp-2 mb-3">
                      {a.title}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/articles/${a.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent/15 text-accent rounded-md hover:bg-accent/25 transition-colors"
                      >
                        <BookOpen size={12} /> 읽기 학습
                      </Link>
                      <Link
                        to={`/study/article-cloze/${a.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-warning/15 text-warning rounded-md hover:bg-warning/25 transition-colors"
                      >
                        <PenTool size={12} /> 빈칸 채우기
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
