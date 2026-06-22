import { createBrowserRouter, Navigate } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";

import LoginPage from "../features/auth/LoginPage";

import TantouDashboardPage from "../features/tantou/TantouDashboardPage";
import ChapterReviewPage from "../features/tantou/ChapterReviewPage";
import MangaDraftReaderPage from "../features/tantou/MangaDraftReaderPage";
import AnnotationFeedbackPage from "../features/tantou/AnnotationFeedbackPage";
import RevisionTrackingPage from "../features/tantou/RevisionTrackingPage";
import EditorialReportPage from "../features/tantou/EditorialReportPage";

import BoardDashboardPage from "../features/board/BoardDashboardPage";
import BoardSubmissionPage from "../features/board/BoardSubmissionPage";
import BoardVotingPage from "../features/board/BoardVotingPage";
import FinalResultPage from "../features/board/FinalResultPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/app/tantou" replace />,
      },
      {
        path: "tantou",
        element: <TantouDashboardPage />,
      },
      {
        path: "tantou/chapters/:chapterId",
        element: <ChapterReviewPage />,
      },
      {
        path: "tantou/chapters/:chapterId/read",
        element: <MangaDraftReaderPage />,
      },
      {
        path: "tantou/chapters/:chapterId/annotations",
        element: <AnnotationFeedbackPage />,
      },
      {
        path: "tantou/chapters/:chapterId/revisions",
        element: <RevisionTrackingPage />,
      },
      {
        path: "tantou/chapters/:chapterId/report",
        element: <EditorialReportPage />,
      },
      {
        path: "board",
        element: <BoardDashboardPage />,
      },
      {
        path: "board/submissions/:seriesId",
        element: <BoardSubmissionPage />,
      },
      {
        path: "board/submissions/:seriesId/vote",
        element: <BoardVotingPage />,
      },
      {
        path: "board/submissions/:seriesId/result",
        element: <FinalResultPage />,
      },
    ],
  },
]);
