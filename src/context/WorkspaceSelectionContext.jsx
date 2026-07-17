import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getWorkspaceSelection, normalizeRole, setWorkspaceSelection } from "../api/client";
import { useAuth } from "./AuthContext";

const EMPTY_SELECTION = { seriesId: "", chapterId: "", pageId: "" };
const WorkspaceSelectionContext = createContext(null);

export function WorkspaceSelectionProvider({ children }) {
  const { isAuthenticated, profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const identity = `${profile?.id || session.id || "anonymous"}:${normalizeRole(role) || "user"}`;
  const [selection, setSelection] = useState(() => isAuthenticated ? getWorkspaceSelection() : EMPTY_SELECTION);

  useEffect(() => {
    setSelection(isAuthenticated ? getWorkspaceSelection() : EMPTY_SELECTION);
  }, [identity, isAuthenticated]);

  const updateSelection = useCallback((next = {}) => {
    const saved = setWorkspaceSelection(next);
    setSelection(saved);
    return saved;
  }, [identity]);

  const selectSeries = useCallback((seriesId) => updateSelection({
    seriesId: String(seriesId || ""),
    chapterId: "",
    pageId: ""
  }), [updateSelection]);

  const value = useMemo(() => ({
    selection,
    updateSelection,
    selectSeries
  }), [selection, updateSelection, selectSeries]);

  return <WorkspaceSelectionContext.Provider value={value}>{children}</WorkspaceSelectionContext.Provider>;
}

export function useWorkspaceSelection() {
  const context = useContext(WorkspaceSelectionContext);
  if (!context) throw new Error("useWorkspaceSelection must be used inside WorkspaceSelectionProvider");
  return context;
}
