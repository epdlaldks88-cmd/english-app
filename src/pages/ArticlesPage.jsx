import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  Plus,
  X,
  Trash2,
  BookOpen,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { db } from "../db/database";

export default function ArticlesPage() {
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState("url"); // url or manual
  const [inputUrl, setInputUrl] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);

  const articles = useLiveQuery(() =>
    db.articles.orderBy("addedAt").reverse().toArray(),
  );

  const handleFetchUrl = async () => {
    if (!inputUrl.trim()) {
      setError("URL을 입력해주세요.");
      return;
    }

    setFetching(true);
    setError("");

    try {
      const res = await fetch(
        `/api/fetch-article?url=${encodeURIComponent(inputUrl.trim())}`,
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "기사를 가져올 수 없습니다.");
      }

      setTitle(data.title);
      setSourceUrl(inputUrl.trim());
      setContent(data.content);
      setMode("manual"); // 내용 확인 후 저장하도록
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = async () => {
    if (!content.trim()) {
      setError("기사 본문을 입력해주세요.");
      return;
    }

    const id = `article_${Date.now()}`;

    await db.articles.put({
      id,
      title: title.trim() || "제목 없음",
      sourceUrl: sourceUrl.trim(),
      content: content.trim(),
      addedAt: new Date().toISOString(),
      wordsExtracted: false,
    });

    setTitle("");
    setSourceUrl("");
    setContent("");
    setInputUrl("");
    setError("");
    setShowForm(false);
    setMode("url");
  };

  const handleDelete = async (id) => {
    if (!confirm("이 기사를 삭제할까요?")) return;
    await db.articles.delete(id);
    await db.articleTranslations.where("articleId").equals(id).delete();
    await db.words.where("videoId").equals(id).delete();
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">기사 라이브러리</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setMode("url");
            setError("");
            setContent("");
            setTitle("");
            setInputUrl("");
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "취소" : "기사 추가"}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-3">
          {/* 모드 탭 */}
          <div className="flex gap-1 bg-bg rounded-lg p-1 w-fit">
            <button
              onClick={() => setMode("url")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                mode === "url"
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text"
              }`}
            >
              URL로 가져오기
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                mode === "manual"
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text"
              }`}
            >
              직접 입력
            </button>
          </div>

          {mode === "url" && (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="BBC, CNN 등 영어 뉴스 URL 붙여넣기"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    setError("");
                  }}
                  className="flex-1 px-3 py-2.5 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleFetchUrl}
                  disabled={fetching || !inputUrl.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40 shrink-0"
                >
                  {fetching ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <LinkIcon size={14} />
                  )}
                  가져오기
                </button>
              </div>
              <p className="text-[10px] text-text-muted">
                기사 URL을 입력하면 제목과 본문을 자동으로 추출합니다.
              </p>
            </>
          )}

          {(mode === "manual" || content) && (
            <>
              <input
                type="text"
                placeholder="기사 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
              {mode === "manual" && (
                <input
                  type="text"
                  placeholder="출처 URL (선택)"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                />
              )}
              <textarea
                placeholder="기사 본문을 붙여넣기 하세요..."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setError("");
                }}
                rows={10}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleAdd}
                className="w-full py-2.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
              >
                등록
              </button>
            </>
          )}

          {error && <p className="text-danger text-xs">{error}</p>}
        </div>
      )}

      {!articles?.length ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          등록된 기사가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <div
              key={a.id}
              className="bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/articles/${a.id}`}
                    className="font-semibold text-sm hover:text-accent transition-colors line-clamp-2"
                  >
                    {a.title}
                  </Link>
                  <p className="text-xs text-text-muted mt-1">
                    {new Date(a.addedAt).toLocaleDateString("ko-KR")}
                    {a.sourceUrl && (
                      <span className="ml-2">
                        ·{" "}
                        <a
                          href={a.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          원문
                        </a>
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted mt-1 line-clamp-2">
                    {a.content.slice(0, 120)}...
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Link
                      to={`/articles/${a.id}`}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-accent/15 text-accent rounded-md hover:bg-accent/25 transition-colors"
                    >
                      <BookOpen size={12} /> 학습하기
                    </Link>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-text-muted hover:text-danger rounded-md hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
