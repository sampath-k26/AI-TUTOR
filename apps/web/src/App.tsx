import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./routes/auth/LoginPage";
import { SignupPage } from "./routes/auth/SignupPage";
import { HomePage } from "./routes/home/HomePage";
import { SpaceDetailPage } from "./routes/spaces/SpaceDetailPage";
import { ProjectLayout } from "./routes/projects/ProjectLayout";
import { MaterialsTab } from "./routes/projects/tabs/MaterialsTab";
import { TutorTab } from "./routes/projects/tabs/TutorTab";
import { QuizTab } from "./routes/projects/tabs/QuizTab";
import { GrowthTab } from "./routes/projects/tabs/GrowthTab";
import { AnalyticsTab } from "./routes/projects/tabs/AnalyticsTab";
import { GlobalAnalyticsPage } from "./routes/analytics/GlobalAnalyticsPage";
import { AdminLayout } from "./routes/admin/AdminLayout";
import { UsersTab } from "./routes/admin/tabs/UsersTab";
import { SpacesProjectsTab } from "./routes/admin/tabs/SpacesProjectsTab";
import { ActivityTab } from "./routes/admin/tabs/ActivityTab";
import { EngagementTab } from "./routes/admin/tabs/EngagementTab";
import { AiSystemTab } from "./routes/admin/tabs/AiSystemTab";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/spaces/:spaceId"
          element={
            <ProtectedRoute>
              <SpaceDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <GlobalAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <ProjectLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="materials" replace />} />
          <Route path="materials" element={<MaterialsTab />} />
          <Route path="tutor" element={<TutorTab />} />
          <Route path="quiz" element={<QuizTab />} />
          <Route path="growth" element={<GrowthTab />} />
          <Route path="analytics" element={<AnalyticsTab />} />
        </Route>
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<UsersTab />} />
          <Route path="spaces-projects" element={<SpacesProjectsTab />} />
          <Route path="activity" element={<ActivityTab />} />
          <Route path="engagement" element={<EngagementTab />} />
          <Route path="ai-system" element={<AiSystemTab />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
