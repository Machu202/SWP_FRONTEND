import { useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SeriesPage from "./pages/SeriesPage";
import ChaptersPagesPage from "./pages/ChaptersPagesPage";
import ManuscriptsPage from "./pages/ManuscriptsPage";
import CanvasWorkspacePage from "./pages/CanvasWorkspacePage";
import WorkspacePage from "./pages/WorkspacePage";
import TasksPage from "./pages/TasksPage";
import ResourcesPage from "./pages/ResourcesPage";
import ProfilePage from "./pages/ProfilePage";
import AdminUsersPage from "./pages/AdminUsersPage";
import ReviewPage from "./pages/ReviewPage";
import SchedulePage from "./pages/SchedulePage";
import SystemPage from "./pages/SystemPage";
import MangakaAssistantReviewPage from "./pages/MangakaAssistantReviewPage";
import TantouReviewPage from "./pages/TantouReviewPage";
import EditorialBoardReviewPage from "./pages/EditorialBoardReviewPage";
import AdminReviewPage from "./pages/AdminReviewPage";
import { Layout } from "./components/Layout";
import { EmptyState } from "./components/Status";
import { useAuth } from "./context/AuthContext";
import { matchRoute, navigate, useHashRoute } from "./utils/router";
import { hasRole, roleHome, roleLabel } from "./api/client";

export default function App() {
  const route = useHashRoute();
  const { isAuthenticated, session, profile } = useAuth();
  const role = profile?.roleName || session.role;

  if (!isAuthenticated && route.pathname !== "/login") {
    return <Redirect to="/login" fallback={<LoginPage />} />;
  }

  if (isAuthenticated && (route.pathname === "/" || route.pathname === "/login")) {
    return <Redirect to={roleHome(role)} />;
  }

  if (route.pathname === "/login") return <LoginPage />;

  const page = renderPage(route, role);
  return <Layout route={route}>{page}</Layout>;
}

function reviewRouteForRole(role) {
  if (hasRole(role, ["admin"])) return "/admin-review";
  if (hasRole(role, ["editorial", "board"])) return "/board-review";
  if (hasRole(role, ["tantou"])) return "/tantou-review";
  if (hasRole(role, ["mangaka"])) return "/assistant-review";
  return "/tasks";
}

function seriesRouteForRole(role, seriesId) {
  if (hasRole(role, ["mangaka"])) return `/chapters-pages?seriesId=${seriesId}`;
  if (hasRole(role, ["tantou"])) return `/tantou-review?seriesId=${seriesId}`;
  if (hasRole(role, ["editorial", "board"])) return `/board-review?seriesId=${seriesId}`;
  if (hasRole(role, ["admin"])) return `/admin-review?seriesId=${seriesId}`;
  return `/chapters-pages?seriesId=${seriesId}`;
}

function isAllowed(pathname, role) {
  if (pathname.startsWith("/admin/users") || pathname.startsWith("/admin/system") || pathname.startsWith("/admin-review")) {
    return hasRole(role, ["admin"]);
  }
  if (pathname.startsWith("/board-review")) return hasRole(role, ["editorial", "board"]);
  if (pathname.startsWith("/tantou-review")) return hasRole(role, ["tantou"]);
  if (pathname.startsWith("/assistant-review")) return hasRole(role, ["mangaka"]);
  return true;
}

function renderPage(route, role) {
  if (route.pathname === "/review") {
    return <Redirect to={reviewRouteForRole(role)} />;
  }

  if (!isAllowed(route.pathname, role)) {
    return (
      <EmptyState
        title="This review screen is for another role"
        body={`You are logged in as ${roleLabel(role)}. Use your role-specific review page from the sidebar.`}
      />
    );
  }

  if (route.pathname === "/dashboard" || route.pathname === "/") return <DashboardPage />;
  if (route.pathname === "/series") return <SeriesPage />;
  if (route.pathname === "/manuscripts") return <ManuscriptsPage initialSeriesId={route.params.get("seriesId") || ""} />;
  if (route.pathname === "/chapters-pages") return <ChaptersPagesPage initialSeriesId={route.params.get("seriesId") || ""} />;
  if (route.pathname === "/canvas-workspace") {
    return (
      <CanvasWorkspacePage
        initialSeriesId={route.params.get("seriesId") || ""}
        initialChapterId={route.params.get("chapterId") || ""}
        initialPageId={route.params.get("pageId") || ""}
        initialFeedbackId={route.params.get("feedbackId") || ""}
      />
    );
  }
  if (route.pathname === "/tasks") {
    if (!route.params.get("tab")) return <Redirect to="/tasks?tab=kanban" />;
    return <TasksPage />;
  }
  if (route.pathname === "/resources") return <ResourcesPage />;
  if (route.pathname === "/profile") return <ProfilePage />;
  if (route.pathname === "/admin/users") return <AdminUsersPage />;
  if (route.pathname === "/admin/system") return <SystemPage />;
  if (route.pathname === "/assistant-review") return (
    <MangakaAssistantReviewPage
      initialTab={route.params.get("tab") || "tantou"}
      initialSeriesId={route.params.get("seriesId") || ""}
      initialFeedbackId={route.params.get("feedbackId") || ""}
    />
  );
  if (route.pathname === "/tantou-review") return <TantouReviewPage />;
  if (route.pathname === "/board-review") return <EditorialBoardReviewPage />;
  if (route.pathname === "/admin-review") return <AdminReviewPage />;
  if (route.pathname === "/review-legacy") return <ReviewPage />;
  if (route.pathname === "/schedule") return <SchedulePage initialSeriesId={route.params.get("seriesId") || ""} />;

  const seriesMatch = matchRoute(route.parts, "/series/:seriesId");
  if (seriesMatch) {
    // Mangaka must always use the real Chapters & Pages workspace. The legacy
    // SeriesDetailPage duplicated chapter/page/canvas screens and caused users
    // to enter a second, inconsistent workflow.
    if (hasRole(role, ["mangaka"])) return <Redirect to={`/chapters-pages?seriesId=${seriesMatch.seriesId}`} />;
    return <Redirect to={seriesRouteForRole(role, seriesMatch.seriesId)} />;
  }

  const workspaceMatch = matchRoute(route.parts, "/workspace/:pageId");
  if (workspaceMatch) {
    if (hasRole(role, ["mangaka", "tantou"])) {
      const query = new URLSearchParams();
      query.set("pageId", workspaceMatch.pageId);
      const seriesId = route.params.get("seriesId");
      const chapterId = route.params.get("chapterId");
      if (seriesId) query.set("seriesId", seriesId);
      if (chapterId) query.set("chapterId", chapterId);
      return <Redirect to={`/canvas-workspace?${query.toString()}`} />;
    }
    return <WorkspacePage pageId={workspaceMatch.pageId} query={route.params} />;
  }

  return <EmptyState title="Page not found" body={`No React route exists for ${route.pathname}.`} />;
}

function Redirect({ to, fallback = null }) {
  useEffect(() => { navigate(to); }, [to]);
  return fallback;
}
