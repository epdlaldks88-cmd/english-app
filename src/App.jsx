import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import VideosPage from "./pages/VideosPage";
import VideoDetailPage from "./pages/VideoDetailPage";
import VocabularyPage from "./pages/VocabularyPage";
import FlashcardPage from "./pages/FlashcardPage";
import StudyPage from "./pages/StudyPage";
import ClozePage from "./pages/ClozePage";
import DictationPage from "./pages/DictationPage";
import ShadowingPage from "./pages/ShadowingPage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";
import { syncFromCloud, syncToCloud } from "./db/sync";

export default function App() {
  // 앱 시작 시 클라우드에서 동기화
  useEffect(() => {
    syncFromCloud();
  }, []);

  // 페이지 떠날 때 클라우드로 업로드
  useEffect(() => {
    const handleBeforeUnload = () => {
      syncToCloud();
    };

    // 주기적 싱크 (5분마다)
    const interval = setInterval(
      () => {
        syncToCloud();
      },
      5 * 60 * 1000,
    );

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(interval);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/videos/:videoId" element={<VideoDetailPage />} />
          <Route path="/vocabulary" element={<VocabularyPage />} />
          <Route path="/vocabulary/flashcard" element={<FlashcardPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/study/cloze/:videoId" element={<ClozePage />} />
          <Route path="/study/dictation/:videoId" element={<DictationPage />} />
          <Route path="/study/shadowing/:videoId" element={<ShadowingPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
