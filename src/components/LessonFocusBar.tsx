"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Focus, Minimize2, Pause, Play, RotateCcw } from "lucide-react";

import {
  getCompletedServerSnapshot,
  getCompletedSnapshot,
  setCompleted,
  subscribeCompleted,
} from "@/lib/progress";
import { cn } from "@/lib/utils";

const FOCUS_STORAGE_KEY = "if:focus";
const DEFAULT_GOAL_MINUTES = 10;

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function LessonFocusBar({
  lessonKey,
  estimatedMinutes,
}: {
  lessonKey: string;
  estimatedMinutes?: number;
}) {
  const completedList = useSyncExternalStore(
    subscribeCompleted,
    getCompletedSnapshot,
    getCompletedServerSnapshot,
  );
  const isCompleted = completedList.includes(lessonKey);

  const [focus, setFocus] = useState(false);
  const [scrolled, setScrolled] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  const goalSeconds = (estimatedMinutes || DEFAULT_GOAL_MINUTES) * 60;
  const goalReached = elapsed >= goalSeconds;

  // Restore the saved focus preference and mirror it onto <html> for the CSS.
  useEffect(() => {
    let saved = false;
    try {
      saved = window.localStorage.getItem(FOCUS_STORAGE_KEY) === "on";
    } catch {
      saved = false;
    }
    setFocus(saved);
    return () => {
      delete document.documentElement.dataset.focus;
    };
  }, []);

  useEffect(() => {
    if (focus) document.documentElement.dataset.focus = "on";
    else delete document.documentElement.dataset.focus;
  }, [focus]);

  const toggleFocus = useCallback(() => {
    setFocus((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(FOCUS_STORAGE_KEY, next ? "on" : "off");
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }, []);

  // Reading progress.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [lessonKey]);

  // Session timer, paused while the tab is hidden so idle time is not counted.
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    setElapsed(0);
    setRunning(true);
  }, [lessonKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (runningRef.current && document.visibilityState === "visible") {
        setElapsed((value) => value + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Guard against wandering off mid-lesson while focus mode is on.
  const guard = focus && !isCompleted;

  useEffect(() => {
    if (!guard) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.dataset.focusAllow === "true") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      const leave = window.confirm(
        "Focus mode is on and this lesson isn't marked complete yet. Leave anyway?",
      );
      if (!leave) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [guard]);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent"
        aria-hidden
        data-focus-allow="true"
      >
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${scrolled}%` }}
        />
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-full border border-foreground/15 bg-background/90 px-2 py-1.5 text-xs shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={toggleFocus}
            aria-pressed={focus}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
              focus
                ? "bg-accent/15 text-accent"
                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {focus ? (
              <Minimize2 className="size-3.5" aria-hidden />
            ) : (
              <Focus className="size-3.5" aria-hidden />
            )}
            {focus ? "Exit focus" : "Focus mode"}
          </button>

          <span className="h-4 w-px bg-foreground/10" aria-hidden />

          <span
            className="px-2 tabular-nums text-foreground/55"
            title="How far down the lesson you have read"
          >
            {scrolled}%
          </span>

          <span className="h-4 w-px bg-foreground/10" aria-hidden />

          <span
            className={cn(
              "px-2 tabular-nums",
              goalReached ? "text-accent" : "text-foreground/55",
            )}
            title={goalReached ? "Target reading time reached" : "Time on this lesson"}
          >
            {formatClock(elapsed)}
            <span className="text-foreground/35">
              {" / "}
              {formatClock(goalSeconds)}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setRunning((value) => !value)}
            aria-label={running ? "Pause timer" : "Resume timer"}
            title={running ? "Pause timer" : "Resume timer"}
            className="rounded-full p-1.5 text-foreground/45 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            {running ? (
              <Pause className="size-3.5" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
          </button>

          <button
            type="button"
            onClick={() => setElapsed(0)}
            aria-label="Reset timer"
            title="Reset timer"
            className="rounded-full p-1.5 text-foreground/45 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>

          <span className="h-4 w-px bg-foreground/10" aria-hidden />

          <button
            type="button"
            onClick={() => setCompleted(lessonKey, !isCompleted)}
            aria-pressed={isCompleted}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
              isCompleted
                ? "bg-accent/15 text-accent"
                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <Check className="size-3.5" aria-hidden />
            {isCompleted ? "Completed" : "Mark complete"}
          </button>
        </div>
      </div>
    </>
  );
}
