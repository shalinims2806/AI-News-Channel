"use client";
import { useEffect } from "react";

export function ViewTracker({ id }: { id: string }) {
  useEffect(() => {
    try {
      const key = `viewed:${id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* storage blocked: server-side dedupe still applies */ }
    fetch("/api/news/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
