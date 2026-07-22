import { useState } from "react";
import { Upload, Download, Loader2, Trash2 } from "lucide-react";
import { syncToCloud, syncFromCloud } from "../db/sync";
import { db } from "../db/database";
import { supabase } from "../db/supabase";

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    setSyncing(true);
    setMessage("");
    try {
      await syncToCloud();
      setMessage("클라우드에 업로드 완료");
    } catch (err) {
      setMessage("업로드 실패: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDownload = async () => {
    setSyncing(true);
    setMessage("");
    try {
      await syncFromCloud();
      setMessage("클라우드에서 동기화 완료");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      setMessage("동기화 실패: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleResetLocal = async () => {
    if (!confirm("로컬 데이터를 모두 삭제합니다. 진행할까요?")) return;
    await db.delete();
    location.reload();
  };

  const handleResetAll = async () => {
    if (
      !confirm(
        "로컬 + 클라우드 데이터를 모두 삭제합니다. 복구할 수 없습니다. 진행할까요?",
      )
    )
      return;
    if (!confirm("정말로 전체 초기화할까요?")) return;

    try {
      // Supabase 전체 삭제
      if (supabase) {
        await supabase.from("words").delete().neq("id", "");
        await supabase.from("translations").delete().neq("id", "");
        await supabase.from("article_translations").delete().neq("id", "");
        await supabase.from("subtitles").delete().neq("id", "");
        await supabase.from("articles").delete().neq("id", "");
        await supabase.from("videos").delete().neq("id", "");
      }

      // 로컬 삭제
      await db.delete();
      location.reload();
    } catch (err) {
      alert("초기화 실패: " + err.message);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <h2 className="text-xl font-bold mb-6">설정</h2>

      {/* 클라우드 동기화 */}
      <section className="bg-surface border border-border rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold mb-3">클라우드 동기화</h3>
        <p className="text-xs text-text-muted mb-4">
          영상, 자막, 번역, 단어 데이터를 Supabase와 동기화합니다. PC에서 업로드
          → 모바일에서 다운로드하면 데이터를 공유할 수 있습니다.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleUpload}
            disabled={syncing}
            className="flex items-center justify-center gap-1.5 py-2.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            로컬 → 클라우드 업로드
          </button>
          <button
            onClick={handleDownload}
            disabled={syncing}
            className="flex items-center justify-center gap-1.5 py-2.5 border border-accent text-accent text-sm rounded-lg hover:bg-accent/10 transition-colors disabled:opacity-40"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            클라우드 → 로컬 다운로드
          </button>
          <button
            onClick={handleResetAll}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-danger text-white text-sm rounded-lg hover:bg-danger/80 transition-colors mt-2"
          >
            <Trash2 size={14} /> 전체 초기화 (로컬 + 클라우드)
          </button>
          <p className="text-[10px] text-danger/60 mt-2">
            모든 영상, 기사, 단어, 자막 데이터가 영구 삭제됩니다.
          </p>
        </div>

        {message && (
          <p
            className={`text-xs mt-3 ${message.includes("실패") ? "text-danger" : "text-success"}`}
          >
            {message}
          </p>
        )}
      </section>

      {/* 데이터 관리 */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3">데이터 관리</h3>
        <button
          onClick={handleResetLocal}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 border border-danger/30 text-danger text-sm rounded-lg hover:bg-danger/10 transition-colors"
        >
          <Trash2 size={14} /> 로컬 데이터 전체 삭제
        </button>
        <p className="text-[10px] text-text-muted mt-2">
          클라우드 데이터는 유지됩니다. 다운로드로 복구할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
