import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { Plus, X, Trash2, Play } from "lucide-react";
import { db } from "../db/database";
import { extractVideoId, getThumbnail } from "../utils/youtube";

export default function VideosPage() {
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const videos = useLiveQuery(() =>
    db.videos.orderBy("addedAt").reverse().toArray(),
  );

  const handleAdd = async () => {
    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      setError("유효한 YouTube URL을 입력해주세요.");
      return;
    }

    const exists = await db.videos.get(videoId);
    if (exists) {
      setError("이미 등록된 영상입니다.");
      return;
    }

    await db.videos.put({
      id: videoId,
      title: title.trim() || `영상 ${videoId}`,
      url: url.trim(),
      addedAt: new Date().toISOString(),
      status: "new",
      isFavorite: false,
    });

    setUrl("");
    setTitle("");
    setError("");
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("이 영상을 삭제할까요?")) return;
    await db.videos.delete(id);
    await db.subtitles.where("videoId").equals(id).delete();
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">영상 라이브러리</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "취소" : "영상 추가"}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-3">
          <input
            type="text"
            placeholder="YouTube URL 붙여넣기"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="제목 (선택, 비워두면 자동)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
          />
          {error && <p className="text-danger text-xs">{error}</p>}
          <button
            onClick={handleAdd}
            className="w-full py-2.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
          >
            등록
          </button>
        </div>
      )}

      {!videos?.length ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          등록된 영상이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <div
              key={v.id}
              className="flex gap-4 bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
            >
              <img
                src={getThumbnail(v.id)}
                alt=""
                className="w-40 h-[90px] object-cover rounded-lg shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/videos/${v.id}`}
                  className="font-semibold text-sm hover:text-accent transition-colors line-clamp-2"
                >
                  {v.title}
                </Link>
                <p className="text-xs text-text-muted mt-1">
                  {new Date(v.addedAt).toLocaleDateString("ko-KR")}
                </p>
                <div className="flex gap-2 mt-3">
                  <Link
                    to={`/videos/${v.id}`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-accent/15 text-accent rounded-md hover:bg-accent/25 transition-colors"
                  >
                    <Play size={12} /> 학습하기
                  </Link>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-text-muted hover:text-danger rounded-md hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 size={12} /> 삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
