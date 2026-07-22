import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  BookOpen,
  Loader2,
  Link as LinkIcon,
  Globe,
} from "lucide-react";
import { db } from "../db/database";

const TOPICS = [
  { id: "world", label: "World" },
  { id: "business", label: "Business" },
  { id: "technology", label: "Tech" },
  { id: "science", label: "Science" },
  { id: "health", label: "Health" },
  { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Entertainment" },
];

export default function ArticlesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("browse"); // browse, add
  const [topic, setTopic] = useState("world");
  const [newsList, setNewsList] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");

  // 추가 폼
  const [mode, setMode] = useState("url");
  const [inputUrl, setInputUrl] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(null); // 뉴스 목록에서 가져오기 중인 인덱스

  const articles = useLiveQuery(() =>
    db.articles.orderBy("addedAt").reverse().toArray(),
  );

  // 토픽별 뉴스 가져오기
  const fetchNews = async (t) => {
    setTopic(t);
    setNewsLoading(true);
    setNewsError("");
    setNewsList([]);

    try {
      const res = await fetch(`/api/news?topic=${t}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "뉴스를 가져올 수 없습니다.");

      setNewsList(data.articles || []);
    } catch (err) {
      setNewsError(err.message);
    } finally {
      setNewsLoading(false);
    }
  };

  // 뉴스 목록에서 기사 가져오기
  const handleImportNews = async (news, index) => {
    setImporting(index);

    try {
      const res = await fetch(
        `/api/fetch-article?url=${encodeURIComponent(news.url)}`,
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "기사를 가져올 수 없습니다.");

      const id = `article_${Date.now()}`;

      await db.articles.put({
        id,
        title: data.title || news.title,
        sourceUrl: news.url,
        content: data.content,
        addedAt: new Date().toISOString(),
        wordsExtracted: false,
      });

      navigate(`/articles/${id}`);
    } catch (err) {
      alert(
        `가져오기 실패: ${err.message}\n직접 추가 탭에서 URL을 입력해주세요.`,
      );
    } finally {
      setImporting(null);
    }
  };

  // URL로 기사 가져오기
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

      if (!res.ok) throw new Error(data.error || "기사를 가져올 수 없습니다.");

      setTitle(data.title);
      setSourceUrl(inputUrl.trim());
      setContent(data.content);
      setMode("manual");
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

    navigate(`/articles/${id}`);
  };

  const handleDelete = async (id) => {
    if (!confirm("이 기사를 삭제할까요?")) return;
    await db.articles.delete(id);
    await db.articleTranslations.where("articleId").equals(id).delete();
    await db.words.where("videoId").equals(id).delete();
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">기사</h2>
      </div>

      {/* 상단 탭 */}
      <div className="flex gap-1 mb-6 bg-surface rounded-lg p-1 w-fit">
        <button
          onClick={() => {
            setTab("browse");
            if (newsList.length === 0) fetchNews(topic);
          }}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "browse"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Globe size={14} className="inline mr-1.5 -mt-0.5" />
          뉴스 탐색
        </button>
        <button
          onClick={() => setTab("add")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "add"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Plus size={14} className="inline mr-1.5 -mt-0.5" />
          직접 추가
        </button>
        <button
          onClick={() => setTab("library")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "library"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          <BookOpen size={14} className="inline mr-1.5 -mt-0.5" />내 기사{" "}
          {articles?.length ? `(${articles.length})` : ""}
        </button>
      </div>

      {/* 뉴스 탐색 탭 */}
      {tab === "browse" && (
        <>
          {/* 토픽 선택 */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                onClick={() => fetchNews(t.id)}
                className={`shrink-0 px-4 py-2 text-xs rounded-lg border transition-colors ${
                  topic === t.id
                    ? "bg-accent text-white border-accent"
                    : "border-border text-text-muted hover:text-text hover:border-text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {newsLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-text-muted text-sm">
              <Loader2 size={16} className="animate-spin" />
              뉴스 가져오는 중...
            </div>
          ) : newsError ? (
            <div className="bg-surface border border-border rounded-xl p-8 text-center">
              <p className="text-danger text-sm mb-3">{newsError}</p>
              <button
                onClick={() => fetchNews(topic)}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : newsList.length > 0 ? (
            <div className="space-y-3">
              {newsList.map((news, i) => (
                <div
                  key={i}
                  className="flex gap-4 bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
                >
                  {news.thumbnail && (
                    <img
                      src={news.thumbnail}
                      alt=""
                      className="w-28 h-20 object-cover rounded-lg shrink-0"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold line-clamp-2 leading-snug">
                      {news.title}
                    </h3>
                    <p className="text-[10px] text-text-muted mt-1">
                      {news.source}
                      {news.pubDate && ` · ${formatDate(news.pubDate)}`}
                    </p>
                    <button
                      onClick={() => handleImportNews(news, i)}
                      disabled={importing !== null}
                      className="flex items-center gap-1.5 mt-2.5 px-3 py-1.5 text-xs bg-accent/15 text-accent rounded-md hover:bg-accent/25 transition-colors disabled:opacity-40"
                    >
                      {importing === i ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />{" "}
                          가져오는 중...
                        </>
                      ) : (
                        <>
                          <BookOpen size={12} /> 학습하기
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-sm">
              토픽을 선택하면 최신 영어 뉴스가 표시됩니다.
            </div>
          )}
        </>
      )}

      {/* 직접 추가 탭 */}
      {tab === "add" && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
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
                  placeholder="영어 뉴스 URL 붙여넣기"
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
              {mode === "manual" && !sourceUrl && (
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

      {/* 내 기사 탭 */}
      {tab === "library" && (
        <>
          {!articles?.length ? (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-sm">
              등록된 기사가 없습니다. 뉴스 탐색에서 기사를 추가해보세요.
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
        </>
      )}
    </div>
  );
}
