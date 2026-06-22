import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  History,
  ClipboardCheck,
  Vote,
  Inbox,
  CheckCircle2,
} from "lucide-react";

const tantouLinks = [
  {
    label: "Tantou Dashboard",
    path: "/app/tantou",
    icon: LayoutDashboard,
  },
  {
    label: "Chapter Review",
    path: "/app/tantou/chapters/chapter-001",
    icon: FileText,
  },
  {
    label: "Annotation Feedback",
    path: "/app/tantou/chapters/chapter-001/annotations",
    icon: MessageSquare,
  },
  {
    label: "Revision Tracking",
    path: "/app/tantou/chapters/chapter-001/revisions",
    icon: History,
  },
  {
    label: "Editorial Report",
    path: "/app/tantou/chapters/chapter-001/report",
    icon: ClipboardCheck,
  },
];

const boardLinks = [
  {
    label: "Board Dashboard",
    path: "/app/board",
    icon: Inbox,
  },
  {
    label: "Board Voting",
    path: "/app/board/submissions/series-001/vote",
    icon: Vote,
  },
  {
    label: "Final Result",
    path: "/app/board/submissions/series-001/result",
    icon: CheckCircle2,
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <h1 className="logo">Manga Studio</h1>
      <p className="sidebar-subtitle">Tantou & Editorial Board</p>

      <div className="nav-section">
        <p className="nav-title">Tantou Editor</p>

        {tantouLinks.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path} className="nav-link">
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="nav-section">
        <p className="nav-title">Editorial Board</p>

        {boardLinks.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path} className="nav-link">
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
