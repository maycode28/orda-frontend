import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SplashPage from "./pages/splash/SplashPage";
import HikingRecordPage from "./pages/hiking/HikingRecordPage";
import LoginPage from "./pages/auth/LoginPage";
import PageLoader from "./components/ui/PageLoader";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicOnlyRoute from "./components/auth/PublicOnlyRoute";

const HikingSessionDetailPage = lazy(
  () => import("./pages/hiking/HikingSessionDetailPage")
);
const HikingSessionReplayPage = lazy(
  () => import("./pages/hiking/HikingSessionReplayPage")
);
const SignupPage = lazy(() => import("./pages/auth/SignupPage"));
const MyPage = lazy(() => import("./pages/mypage/MyPage"));
const EditProfilePage = lazy(() => import("./pages/mypage/EditProfilePage"));
const RecommendationsPage = lazy(
  () => import("./pages/recommendations/RecommendationsPage")
);
const KakaoCallbackPage = lazy(
  () => import("./pages/auth/KakaoCallbackPage")
);
const GuidePage = lazy(() => import("./pages/guide/GuidePage"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route
            path="/hiking"
            element={
              <ProtectedRoute>
                <HikingRecordPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/guide" element={<GuidePage />} />
          <Route
            path="/hiking/sessions/:sessionId"
            element={
              <ProtectedRoute>
                <HikingSessionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hiking/sessions/:sessionId/replay"
            element={
              <ProtectedRoute>
                <HikingSessionReplayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/mypage"
            element={
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mypage/edit-profile"
            element={
              <ProtectedRoute>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recommendations"
            element={
              <ProtectedRoute>
                <RecommendationsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
