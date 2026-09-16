import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./lib/ThemeContext";
import { ToastProvider } from "./lib/ToastContext";
import { Toaster } from "./components/ui/toaster";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./routes/auth/LoginPage";
import { SignupPage } from "./routes/auth/SignupPage";
import { HomePage } from "./routes/home/HomePage";
import { SpaceDetailPage } from "./routes/spaces/SpaceDetailPage";
import { ProjectsListPage } from "./routes/projects/ProjectsListPage";
import { ProjectLayout } from "./routes/projects/ProjectLayout";
import { MaterialsTab } from "./routes/projects/tabs/MaterialsTab";
import { TutorTab } from "./routes/projects/tabs/TutorTab";
import { QuizTab } from "./routes/projects/tabs/QuizTab";
import { GrowthTab } from "./routes/projects/tabs/GrowthTab";
import { AnalyticsTab } from "./routes/projects/tabs/AnalyticsTab";
import { GlobalAnalyticsPage } from "./routes/analytics/GlobalAnalyticsPage";
import { ActivityLogPage } from "./routes/activity/ActivityLogPage";
import { AdminLayout } from "./routes/admin/AdminLayout";
import { UsersTab } from "./routes/admin/tabs/UsersTab";
import { SpacesProjectsTab } from "./routes/admin/tabs/SpacesProjectsTab";
import { ActivityTab } from "./routes/admin/tabs/ActivityTab";
import { EngagementTab } from "./routes/admin/tabs/EngagementTab";
import { AiSystemTab } from "./routes/admin/tabs/AiSystemTab";

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<HomePage />} />
              <Route path="/spaces/:spaceId" element={<SpaceDetailPage />} />
              <Route path="/analytics" element={<GlobalAnalyticsPage />} />
              <Route path="/projects" element={<ProjectsListPage />} />
              <Route path="/activity" element={<ActivityLogPage />} />
              <Route path="/projects/:projectId" element={<ProjectLayout />}>
                <Route index element={<Navigate to="materials" replace />} />
                <Route path="materials" element={<MaterialsTab />} />
                <Route path="tutor" element={<TutorTab />} />
                <Route path="quiz" element={<QuizTab />} />
                <Route path="growth" element={<GrowthTab />} />
                <Route path="analytics" element={<AnalyticsTab />} />
              </Route>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={<UsersTab />} />
                <Route path="spaces-projects" element={<SpacesProjectsTab />} />
                <Route path="activity" element={<ActivityTab />} />
                <Route path="engagement" element={<EngagementTab />} />
                <Route path="ai-system" element={<AiSystemTab />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
