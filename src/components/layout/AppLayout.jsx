import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar />
        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
