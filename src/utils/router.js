import { useEffect, useMemo, useState } from "react";

function currentHash() {
  const raw = window.location.hash.replace(/^#/, "");
  return raw || "/dashboard";
}

export function navigate(path) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}

export function useHashRoute() {
  const [hash, setHash] = useState(currentHash);

  useEffect(() => {
    const onHashChange = () => setHash(currentHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return useMemo(() => {
    const [pathname, queryString = ""] = hash.split("?");
    const params = new URLSearchParams(queryString);
    const parts = pathname.split("/").filter(Boolean);
    return { hash, pathname, parts, params };
  }, [hash]);
}

export function matchRoute(parts, pattern) {
  const routeParts = pattern.split("/").filter(Boolean);
  if (routeParts.length !== parts.length) return null;
  const params = {};
  for (let i = 0; i < routeParts.length; i += 1) {
    const routePart = routeParts[i];
    const part = parts[i];
    if (routePart.startsWith(":")) params[routePart.slice(1)] = decodeURIComponent(part);
    else if (routePart !== part) return null;
  }
  return params;
}
