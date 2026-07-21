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
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
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
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
