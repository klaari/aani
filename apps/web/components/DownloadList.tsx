"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type {
  DownloadJob,
  DownloadJobStatus,
  WsJobStatusMessage,
} from "@aani/types";
import {
  Button,
  Divider,
  HStack,
  IconButton,
  Surface,
  Text,
  VStack,
} from "./ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000";

type IconTone = "muted" | "accent" | "warning" | "critical";

const STATUS_ICON: Record<
  DownloadJobStatus,
  { symbol: string; tone: IconTone }
> = {
  queued: { symbol: "◷", tone: "muted" },
  downloading: { symbol: "↓", tone: "accent" },
  uploading: { symbol: "↑", tone: "warning" },
  completed: { symbol: "✓", tone: "muted" },
  failed: { symbol: "✕", tone: "critical" },
};

interface Props {
  jobs: DownloadJob[];
  setJobs: React.Dispatch<React.SetStateAction<DownloadJob[]>>;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DownloadList({ jobs, setJobs }: Props) {
  const { getToken } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pendingUpdates = useRef<Map<string, Partial<DownloadJob>>>(new Map());

  const fetchJobs = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as DownloadJob[];
      data.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setJobs(data);
    } catch {
      /* silently fail */
    }
  }, [getToken, setJobs]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    mountedRef.current = true;

    const connect = async () => {
      if (!mountedRef.current) return;
      const token = await getToken();
      if (!token || !mountedRef.current) return;

      const base = WS_URL.replace(/\/+$/, "");
      const url = base.endsWith("/ws") ? base : `${base}/ws`;
      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsJobStatusMessage;
          if (msg.type !== "job:status") return;

          setJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === msg.jobId);
            if (idx === -1) {
              pendingUpdates.current.set(msg.jobId, {
                status: msg.status,
                title: msg.title ?? undefined,
                artist: msg.artist ?? undefined,
                duration: msg.duration ?? undefined,
                trackId: msg.trackId ?? undefined,
                error: msg.error ?? undefined,
              });
              return prev;
            }
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              status: msg.status,
              title: msg.title,
              artist: msg.artist,
              duration: msg.duration,
              trackId: msg.trackId,
              error: msg.error,
            };
            return updated;
          });
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [getToken, setJobs]);

  useEffect(() => {
    if (pendingUpdates.current.size === 0) return;
    const snapshot = new Map(pendingUpdates.current);
    pendingUpdates.current.clear();
    setJobs((prev) => {
      let changed = false;
      const updated = prev.map((j) => {
        const pending = snapshot.get(j.id);
        if (!pending) return j;
        changed = true;
        return { ...j, ...pending };
      });
      return changed ? updated : prev;
    });
  }, [jobs, setJobs]);

  const hasActiveJobs = jobs.some(
    (j) =>
      j.status === "queued" ||
      j.status === "downloading" ||
      j.status === "uploading",
  );
  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = setInterval(fetchJobs, 3000);
    return () => clearInterval(id);
  }, [hasActiveJobs, fetchJobs]);

  const handleRetry = async (job: DownloadJob) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: job.url }),
      });
      if (!res.ok) return;
      await fetchJobs();
    } catch {
      /* silently fail */
    }
  };

  const handleDismiss = async (job: DownloadJob) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch {
      /* silently fail */
    }
  };

  const expiredJobs = jobs.filter((j) =>
    j.error?.includes("YouTube session expired"),
  );
  const [retrying, setRetrying] = useState(false);

  const handleRetryExpired = async () => {
    setRetrying(true);
    try {
      const token = await getToken();
      for (const job of expiredJobs) {
        await fetch(`${API_URL}/downloads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: job.url }),
        });
      }
      await fetchJobs();
    } catch {
      /* silently fail */
    }
    setRetrying(false);
  };

  if (jobs.length === 0) return null;

  return (
    <VStack gap="md">
      {expiredJobs.length > 0 ? (
        <Surface tone="raised" rounded="lg" pad="md" bordered>
          <HStack gap="sm" align="center">
            <Text tone="warning">⚠</Text>
            <Text variant="caption" tone="warning" className="flex-1">
              {expiredJobs.length} download
              {expiredJobs.length > 1 ? "s" : ""} failed — cookies were expired
            </Text>
            <Button
              label={retrying ? "Retrying…" : "Retry all"}
              variant="ghost"
              size="sm"
              onClick={handleRetryExpired}
              disabled={retrying}
            />
          </HStack>
        </Surface>
      ) : null}

      <VStack gap="xs">
        <Text variant="eyebrow" tone="muted">
          Recent
        </Text>
        <VStack>
          {jobs.map((job, idx) => {
            const icon = STATUS_ICON[job.status];
            const isActive =
              job.status === "downloading" ||
              job.status === "uploading" ||
              job.status === "queued";
            const isFailed = job.status === "failed";

            return (
              <Fragment key={job.id}>
                {idx > 0 ? <Divider /> : null}
                <HStack gap="md" padY="sm">
                  {isActive ? (
                    <Text
                      variant="bodyLg"
                      tone={icon.tone}
                      align="center"
                      className="w-5 shrink-0"
                    >
                      {icon.symbol}
                    </Text>
                  ) : null}
                  <VStack className="flex-1 min-w-0">
                    <Text variant="body" numberOfLines={1}>
                      {job.title ?? job.url}
                    </Text>
                    {job.artist ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {job.artist}
                      </Text>
                    ) : null}
                    {job.error ? (
                      <Text variant="caption" tone="critical" numberOfLines={2}>
                        {job.error}
                      </Text>
                    ) : null}
                  </VStack>
                  {job.duration ? (
                    <Text variant="caption" tone="muted" numeric>
                      {formatDuration(job.duration)}
                    </Text>
                  ) : null}
                  {isFailed ? (
                    <HStack gap="xs">
                      <IconButton
                        aria-label="Retry"
                        title="Retry"
                        onClick={() => handleRetry(job)}
                      >
                        ↺
                      </IconButton>
                      <IconButton
                        aria-label="Dismiss"
                        title="Dismiss"
                        onClick={() => handleDismiss(job)}
                      >
                        ✕
                      </IconButton>
                    </HStack>
                  ) : null}
                </HStack>
              </Fragment>
            );
          })}
        </VStack>
      </VStack>
    </VStack>
  );
}
