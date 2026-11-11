"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  BookOpen,
  CircleAlert,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  SquarePen,
  X,
} from "lucide-react";

import { ChatMarkdown } from "./ChatMarkdown";
import {
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  type ChatErrorCode,
  type ChatMessage,
  type ChatSource,
  type ChatSuccess,
  type FreeModel,
  type ModelsResponse,
} from "@/lib/chat/protocol";
import { cn } from "@/lib/utils";

const MODEL_STORAGE_KEY = "if:chat-model";
/** OpenRouter's own free router, preferred as a default when present because it skips busy models. */
const PREFERRED_DEFAULT_MODEL = "openrouter/free";

type UiMessage = ChatMessage & {
  id: string;
  sources?: ChatSource[];
  grounded?: boolean;
};

type ModelState =
  | { status: "idle" | "loading" }
  | { status: "ready"; models: FreeModel[]; configured: boolean; stale: boolean }
  | { status: "error"; message: string; configured: boolean };

type UiError = { code: ChatErrorCode | "network"; message: string };

const SUGGESTIONS = [
  "What topics does this site cover?",
  "When should I use a sliding window?",
  "How does consistent hashing work?",
];

let nextId = 0;
const newId = () => `m${++nextId}`;

function readSavedModel(): string | null {
  try {
    return window.localStorage.getItem(MODEL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveModel(id: string) {
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, id);
  } catch {
    // Ignore storage failures; the choice still applies for this session.
  }
}

function isLessonPath(path: string) {
  return /^\/[^/]+\/[^/]+$/.test(path) && !path.startsWith("/api/");
}

export function ChatAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [modelState, setModelState] = useState<ModelState>({ status: "idle" });
  const [modelId, setModelId] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadModels() {
    setModelState({ status: "loading" });
    try {
      const response = await fetch("/api/chat/models", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as ModelsResponse | null;

      if (!data) throw new Error("The model list response was unreadable.");
      if ("error" in data) {
        setModelState({ status: "error", message: data.error.message, configured: data.configured });
        return;
      }

      setModelState({
        status: "ready",
        models: data.models,
        configured: data.configured,
        stale: data.stale,
      });
      setModelId((current) => {
        const ids = new Set(data.models.map((m) => m.id));
        const saved = readSavedModel();
        if (current && ids.has(current)) return current;
        if (saved && ids.has(saved)) return saved;
        if (ids.has(PREFERRED_DEFAULT_MODEL)) return PREFERRED_DEFAULT_MODEL;
        return data.models[0]?.id ?? "";
      });
    } catch {
      setModelState({
        status: "error",
        message: "Couldn't reach the server to load models. Check your connection and retry.",
        configured: true,
      });
    }
  }

  function openPanel() {
    setOpen(true);
    if (modelState.status === "idle" || modelState.status === "error") void loadModels();
  }

  function closePanel() {
    setOpen(false);
  }

  function newChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput("");
    setError(null);
    setPending(false);
    inputRef.current?.focus();
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending || !modelId || content.length > MAX_MESSAGE_CHARS) return;

    const userMessage: UiMessage = { id: newId(), role: "user", content };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setError(null);
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const restore = (uiError: UiError) => {
      // Put the question back so it can be resent, e.g. after switching model.
      setMessages((current) => current.filter((m) => m.id !== userMessage.id));
      setInput(content);
      setError(uiError);
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelId,
          path: pathname,
          messages: history
            .slice(-MAX_HISTORY_MESSAGES)
            .map(({ role, content: body }) => ({ role, content: body })),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | ChatSuccess
        | { error: { code: ChatErrorCode; message: string } }
        | null;

      if (!data || !response.ok || "error" in data) {
        const failure =
          data && "error" in data
            ? data.error
            : { code: "upstream_error" as const, message: `The server responded with HTTP ${response.status}.` };
        restore(failure);
        if (failure.code === "model_not_allowed" || failure.code === "model_unavailable") {
          void loadModels();
        }
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          content: data.reply,
          sources: data.sources,
          grounded: data.grounded,
        },
      ]);
    } catch {
      if (controller.signal.aborted) return;
      restore({ code: "network", message: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setPending(false);
      }
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }

  function onNavigate() {
    // On phones the panel covers the page, so get out of the way after a link.
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  }

  // Move focus into the panel on open and back to the launcher on close.
  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      inputRef.current?.focus();
    } else if (hasOpenedRef.current) {
      launcherRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, error]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const configured = modelState.status === "ready" || modelState.status === "error" ? modelState.configured : true;
  const canSend =
    configured && modelState.status === "ready" && Boolean(modelId) && !pending;
  const remaining = MAX_MESSAGE_CHARS - input.length;
  const suggestions = isLessonPath(pathname) ? ["Summarize this lesson", ...SUGGESTIONS] : SUGGESTIONS;

  return (
    <div data-chrome>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={openPanel}
          aria-label="Ask the study assistant"
          title="Ask the study assistant"
          className="fixed right-4 bottom-16 z-40 flex items-center gap-2 rounded-full border border-foreground/15 bg-background/90 px-3.5 py-2.5 text-sm font-medium shadow-lg backdrop-blur transition-colors hover:border-foreground/30 sm:right-6 sm:bottom-6"
        >
          <MessageCircle className="size-4 text-accent" aria-hidden />
          <span className="hidden sm:inline">Ask</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Study assistant"
          onKeyDown={(event) => {
            if (event.key === "Escape") closePanel();
          }}
          className="fixed inset-x-2 top-16 bottom-2 z-50 flex flex-col overflow-hidden rounded-xl border border-foreground/15 bg-background shadow-2xl sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:h-[min(38rem,calc(100vh-6rem))] sm:w-[26rem]"
        >
          <header className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Ask InterviewForge</h2>
              <p className="truncate text-xs text-foreground/50">
                Answers come from this site&apos;s lessons only.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={newChat}
                disabled={messages.length === 0 && !input && !error}
                aria-label="New chat"
                title="New chat"
                className="rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <SquarePen className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close assistant"
                title="Close"
                className="rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </header>

          <ModelPicker
            state={modelState}
            modelId={modelId}
            disabled={pending}
            onChange={(id) => {
              setModelId(id);
              saveModel(id);
              setError(null);
            }}
            onRetry={() => void loadModels()}
          />

          <div ref={scrollRef} className="grow space-y-4 overflow-y-auto px-4 py-4 text-sm" aria-live="polite">
            {!configured && (
              <Notice>
                The assistant isn&apos;t set up on this server yet. The site owner needs to set{" "}
                <code className="font-mono text-xs">OPENROUTER_API_KEY</code> (see README).
              </Notice>
            )}

            {messages.length === 0 && configured && (
              <div className="space-y-3">
                <p className="text-foreground/60">
                  Ask a quick question about anything taught on this site: DSA patterns, system
                  design, LLD, Java, SQL, CS fundamentals or behavioral prep. If the lessons
                  don&apos;t cover it, the assistant will say so.
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={!canSend}
                      onClick={() => void send(suggestion)}
                      className="rounded-full border border-foreground/15 px-3 py-1 text-xs text-foreground/70 transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-accent/15 px-3 py-2">
                    {message.content}
                  </p>
                </div>
              ) : (
                <div key={message.id} className="space-y-2">
                  <ChatMarkdown source={message.content} onNavigate={onNavigate} />
                  {message.sources && message.sources.length > 0 && (
                    <div className="rounded-lg border border-foreground/10 p-2">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground/50">
                        <BookOpen className="size-3" aria-hidden />
                        From the site
                      </p>
                      <ul className="space-y-0.5 text-xs">
                        {message.sources.map((source) => (
                          <li key={source.href}>
                            <Link
                              href={source.href}
                              onClick={onNavigate}
                              className="text-accent hover:underline"
                            >
                              {source.title}
                            </Link>
                            <span className="text-foreground/40"> · {source.topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ),
            )}

            {pending && (
              <p className="flex items-center gap-2 text-foreground/50">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Searching the lessons and asking the model…
              </p>
            )}

            {error && (
              <div role="alert">
                <Notice tone="error">
                  {error.message} Your message is back in the box below.
                </Notice>
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-foreground/10 p-3">
            <div className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">
                Your question
              </label>
              <textarea
                id="chat-input"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_CHARS))}
                onKeyDown={onInputKeyDown}
                maxLength={MAX_MESSAGE_CHARS}
                rows={2}
                placeholder={configured ? "Ask about any lesson…" : "Assistant not configured"}
                disabled={!configured}
                className="max-h-32 min-h-[2.75rem] grow resize-none rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-foreground/40 focus:border-foreground/35 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canSend || !input.trim()}
                aria-label="Send"
                title="Send (Enter)"
                className="rounded-lg bg-accent p-2.5 text-background transition-opacity hover:opacity-90 disabled:opacity-35"
              >
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ArrowUp className="size-4" aria-hidden />
                )}
              </button>
            </div>
            <p className="mt-1.5 flex justify-between text-[11px] text-foreground/40">
              <span>Enter to send · Shift+Enter for a new line</span>
              <span className={cn("tabular-nums", remaining < 100 && "text-amber-600 dark:text-amber-400")}>
                {input.length}/{MAX_MESSAGE_CHARS}
              </span>
            </p>
          </form>
        </section>
      )}
    </div>
  );
}

function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  return (
    <p
      className={cn(
        "flex gap-2 rounded-lg border px-3 py-2 text-xs",
        tone === "error"
          ? "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300"
          : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
      )}
    >
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function ModelPicker({
  state,
  modelId,
  disabled,
  onChange,
  onRetry,
}: {
  state: ModelState;
  modelId: string;
  disabled: boolean;
  onChange: (id: string) => void;
  onRetry: () => void;
}) {
  const retry = (
    <button
      type="button"
      onClick={onRetry}
      aria-label="Reload model list"
      title="Reload model list"
      disabled={state.status === "loading"}
      className="rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
    >
      <RefreshCw className={cn("size-3.5", state.status === "loading" && "animate-spin")} aria-hidden />
    </button>
  );

  return (
    <div className="space-y-1.5 border-b border-foreground/10 px-4 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <label htmlFor="chat-model" className="shrink-0 text-foreground/50">
          Model
        </label>
        {state.status === "ready" && state.models.length > 0 ? (
          <select
            id="chat-model"
            value={modelId}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="min-w-0 grow truncate rounded-md border border-foreground/15 bg-background px-2 py-1 outline-none focus:border-foreground/35"
          >
            {state.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="grow text-foreground/50">
            {state.status === "ready"
              ? "No free models available"
              : state.status === "error"
                ? "Model list unavailable"
                : "Loading free models…"}
          </span>
        )}
        {retry}
      </div>

      {state.status === "ready" && state.models.length === 0 && (
        <p className="text-amber-700 dark:text-amber-300">
          OpenRouter isn&apos;t listing any free models right now, so the assistant can&apos;t answer.
          Try reloading later.
        </p>
      )}
      {state.status === "error" && <p className="text-rose-700 dark:text-rose-300">{state.message}</p>}
      {state.status === "ready" && state.models.length > 0 && (
        <p className="text-foreground/40">
          Free OpenRouter models have rate limits and can be busy or withdrawn at any time
          {state.stale ? "; this list may be out of date" : ""}.
        </p>
      )}
    </div>
  );
}
