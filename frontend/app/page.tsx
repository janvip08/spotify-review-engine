"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860";

const SUGGESTED_QUESTIONS = [
  "Why do users struggle to discover new music?",
  "What are the most common frustrations with recommendations?",
  "What causes users to repeat-listen?",
  "Which user segments face discovery challenges?",
  "What unmet needs emerge consistently?",
  "What listening behaviors are users trying to achieve?",
];

const EMPTY_STATE_QUESTIONS = SUGGESTED_QUESTIONS.slice(0, 3);

const SOURCE_BREAKDOWN = [
  { name: "Play Store", key: "play_store", count: 366, color: "#1db954" },
  { name: "Spotify Community", key: "spotify_community", count: 86, color: "#5865f2" },
  { name: "App Store", key: "app_store", count: 90, color: "#007aff" },
  { name: "Trustpilot", key: "trustpilot", count: 37, color: "#00b67a" },
  { name: "YouTube", key: "youtube", count: 16, color: "#ff0000" },
  { name: "Reddit", key: "reddit", count: 11, color: "#ff6314" },
];

const SOURCE_COLORS: Record<string, string> = {
  play_store: "#1db954",
  reddit: "#ff6314",
  spotify_community: "#5865f2",
  trustpilot: "#00b67a",
  youtube: "#ff0000",
  app_store: "#007aff",
};

const SOURCE_DISPLAY: Record<string, string> = {
  play_store: "Play Store",
  reddit: "Reddit",
  spotify_community: "Spotify Community",
  trustpilot: "Trustpilot",
  youtube: "YouTube",
  app_store: "App Store",
};

const THEME_INTERPRETATIONS = [
  "Users want agency over what they hear, not just what the algorithm decides",
  "The more you listen, the more stuck you get — familiarity becomes a trap",
  "Autoplay breaks intentional listening and disrupts user control",
  "Discover Weekly loses its ability to surprise within weeks of use",
  "Recent algorithm changes made recommendations feel less personal",
  "Users build playlists with intent — algorithm overrides feel like an intrusion",
];

const CITATION_PATTERN = /\[(?:[a-z0-9_]+|\d+),\s*\d{4}-\d{2}-\d{2}\]/gi;

type Tab = "chat" | "themes";

type Source = {
  source: string;
  date: string;
  text: string;
  url?: string | null;
  score: number;
};

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; sources: Source[] };

type Theme = {
  theme_name: string;
  count: number;
  top_quotes: { text: string; source: string; date: string }[];
};

function SpotifyLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-spotify-black" aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function sourceLabel(source: string) {
  return SOURCE_DISPLAY[source] || source.replace(/_/g, " ");
}

function formatDateShort(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatCitationPill(source: string, date: string, score: number) {
  return `${sourceLabel(source)} · ${formatDateShort(date)} · ${score.toFixed(2)}`;
}

function stripInlineCitations(text: string) {
  return text
    .replace(CITATION_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}

function splitIntoParagraphs(text: string) {
  const cleaned = stripInlineCitations(text);
  const parts = cleaned.split(/\n\n+/).filter(Boolean);
  if (parts.length > 0) return parts;
  return cleaned ? [cleaned] : [];
}

function truncateQuote(text: string, maxLen = 100) {
  const cleaned = text.replace(/^["']|["']$/g, "").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).trim()}...`;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border-l-[3px] border-spotify-green bg-[#1a1a1a] px-4 py-3 w-fit">
      <span className="h-2 w-2 rounded-full bg-spotify-green animate-bounce-dot" />
      <span className="h-2 w-2 rounded-full bg-spotify-green animate-bounce-dot animate-bounce-dot-delay-1" />
      <span className="h-2 w-2 rounded-full bg-spotify-green animate-bounce-dot animate-bounce-dot-delay-2" />
    </div>
  );
}

function SourcePill({ source, date, score }: { source: string; date: string; score: number }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: SOURCE_COLORS[source] || "#555555" }}
    >
      {formatCitationPill(source, date, score)}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md px-2 py-1 text-xs text-spotify-muted transition-colors hover:bg-white/5 hover:text-spotify-text"
      title="Copy answer"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function AssistantMessage({ content, sources }: { content: string; sources: Source[] }) {
  const paragraphs = splitIntoParagraphs(content);
  const plainText = paragraphs.join("\n\n");

  return (
    <div className="group relative max-w-[85%] rounded-2xl rounded-bl-sm border-l-[3px] border-spotify-green bg-[#1a1a1a] px-4 py-3">
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton text={plainText} />
      </div>
      <div className="space-y-3 pr-12">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-sm text-spotify-text" style={{ lineHeight: 1.7 }}>
            {para}
          </p>
        ))}
      </div>
      {sources.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-spotify-border pt-3">
          {sources.map((src, j) => (
            <SourcePill key={j} source={src.source} date={src.date} score={src.score} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeCard({ theme, index }: { theme: Theme; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const interpretation = THEME_INTERPRETATIONS[index] || "";
  const previewQuote = theme.top_quotes[0];

  return (
    <div
      className="rounded-lg bg-[#111111] p-4 transition-all duration-300"
      style={{ borderLeft: "3px solid #1db954" }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex-1 font-bold leading-snug text-spotify-text">{theme.theme_name}</h3>
        <span className="shrink-0 rounded-full bg-spotify-green/15 px-2.5 py-0.5 text-xs font-semibold text-spotify-green">
          {theme.count}
        </span>
      </div>

      {interpretation && (
        <p className="mt-2 text-sm italic text-spotify-muted">
          What this means: {interpretation}
        </p>
      )}

      {previewQuote && (
        <div className="mt-3 rounded-md bg-spotify-black/50 p-3">
          <p className="text-sm leading-relaxed text-spotify-text">
            &ldquo;{truncateQuote(previewQuote.text)}&rdquo;
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: SOURCE_COLORS[previewQuote.source] || "#555" }}
            >
              {sourceLabel(previewQuote.source)}
            </span>
            <span className="text-xs text-spotify-muted">{previewQuote.date}</span>
          </div>
        </div>
      )}

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? "800px" : "0px", opacity: expanded ? 1 : 0 }}
      >
        {theme.top_quotes.slice(1).map((quote, i) => (
          <div key={i} className="mt-3 rounded-md bg-spotify-black/50 p-3">
            <p className="text-sm leading-relaxed text-spotify-text">
              &ldquo;{truncateQuote(quote.text)}&rdquo;
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: SOURCE_COLORS[quote.source] || "#555" }}
              >
                {sourceLabel(quote.source)}
              </span>
              <span className="text-xs text-spotify-muted">{quote.date}</span>
            </div>
          </div>
        ))}
      </div>

      {theme.top_quotes.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-medium text-spotify-green transition-colors hover:text-white"
        >
          {expanded ? "Hide ↑" : "See quotes ↓"}
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrievedSources, setRetrievedSources] = useState<Source[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [themes, setThemes] = useState<Theme[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themesError, setThemesError] = useState<string | null>(null);
  const [themesLoaded, setThemesLoaded] = useState(false);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 22;
    const maxHeight = lineHeight * 4 + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const fetchThemes = useCallback(async () => {
    if (themesLoaded) return;
    setThemesLoading(true);
    setThemesError(null);
    try {
      const res = await fetch(`${API_URL}/themes`);
      if (!res.ok) throw new Error(`Failed to load themes (${res.status})`);
      const data: Theme[] = await res.json();
      setThemes(data);
      setThemesLoaded(true);
    } catch (err) {
      setThemesError(err instanceof Error ? err.message : "Failed to load themes");
    } finally {
      setThemesLoading(false);
    }
  }, [themesLoaded]);

  useEffect(() => {
    if (activeTab === "themes") {
      fetchThemes();
    }
  }, [activeTab, fetchThemes]);

  const handleSubmit = async (e?: FormEvent, questionOverride?: string) => {
    e?.preventDefault();
    const question = (questionOverride ?? input).trim();
    if (!question || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, k: 5 }),
      });
      if (!res.ok) throw new Error(`Query failed (${res.status})`);
      const data: { answer: string; sources: Source[] } = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
      setRetrievedSources(data.sources);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}`, sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setRetrievedSources([]);
    setError(null);
    setInput("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-spotify-black">
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ background: "linear-gradient(135deg, #0a1a0a, #0d2d0d)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-spotify-green">
            <SpotifyLogo />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-spotify-text">
              Spotify Review Discovery Engine
            </h1>
            <p className="text-xs text-spotify-green">
              AI-powered insights from 2,054 real Spotify user reviews
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              activeTab === "chat"
                ? "bg-spotify-green text-spotify-black"
                : "border border-spotify-border text-spotify-muted hover:border-spotify-green/50 hover:text-spotify-text"
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("themes")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              activeTab === "themes"
                ? "bg-spotify-green text-spotify-black"
                : "border border-spotify-border text-spotify-muted hover:border-spotify-green/50 hover:text-spotify-text"
            }`}
          >
            Theme Analysis
          </button>
        </div>
      </header>

      {/* Chat tab */}
      {activeTab === "chat" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-[70%] flex-col border-r border-spotify-border">
            {/* Chat header with clear button */}
            <div className="flex items-center justify-end border-b border-spotify-border px-4 py-2">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-xs text-spotify-muted transition-colors hover:text-spotify-text"
                >
                  Clear chat
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && !loading && (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-4">
                  <span className="mb-4 text-[48px] leading-none">🎵</span>
                  <h2 className="text-center text-2xl font-bold text-white">
                    Ask anything about Spotify user feedback
                  </h2>
                  <p className="mt-2 text-center text-sm text-spotify-muted">
                    Every answer is grounded in real reviews and cited by source
                  </p>
                  <div className="mt-8 w-full max-w-lg space-y-3">
                    {EMPTY_STATE_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSubmit(undefined, q)}
                        className="w-full rounded-lg bg-spotify-panel px-4 py-3 text-left text-sm text-spotify-text transition-colors hover:bg-spotify-card"
                        style={{ borderLeft: "3px solid #1db954" }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-spotify-green px-4 py-3 text-sm text-spotify-black">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <AssistantMessage content={msg.content} sources={msg.sources} />
                  </div>
                ),
              )}

              {loading && (
                <div className="flex justify-start">
                  <TypingIndicator />
                </div>
              )}
            </div>

            <div className="border-t border-spotify-border p-4">
              {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
              <form onSubmit={(e) => handleSubmit(e)} className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  rows={1}
                  placeholder="Ask a question about Spotify reviews..."
                  className="flex-1 resize-none overflow-y-auto rounded-lg border border-spotify-border bg-spotify-panel px-4 py-2.5 text-sm text-spotify-text placeholder:text-spotify-muted focus:border-spotify-green focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="shrink-0 rounded-lg bg-spotify-green px-6 py-2.5 text-sm font-semibold text-spotify-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Right sidebar */}
          <aside className="w-[30%] overflow-y-auto bg-spotify-panel p-5 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total reviews", value: "2,054" },
                { label: "Relevant records", value: "606" },
                { label: "Relevance rate", value: "29.5%" },
                { label: "Date range", value: "4 mo" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-spotify-border bg-spotify-card p-3"
                >
                  <p className="text-xl font-bold text-spotify-text">{stat.value}</p>
                  <p className="text-xs text-spotify-muted">{stat.label}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-spotify-green">Try asking:</h3>
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSubmit(undefined, q)}
                    disabled={loading}
                    className="w-full rounded-lg bg-spotify-black px-3 py-2.5 text-left text-xs text-spotify-text transition-colors hover:bg-spotify-card disabled:opacity-50"
                    style={{ borderLeft: "3px solid #1db954" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-spotify-text">
                Sources retrieved
              </h3>
              {retrievedSources.length === 0 ? (
                <p className="text-xs text-spotify-muted">
                  Submit a query to see which sources were used.
                </p>
              ) : (
                <div className="space-y-2">
                  {retrievedSources.map((src, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-spotify-border bg-spotify-card px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: SOURCE_COLORS[src.source] || "#555",
                          }}
                        />
                        <span className="text-xs text-spotify-text">
                          {sourceLabel(src.source)}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-spotify-green">
                        {src.score.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-spotify-text">
                Source breakdown
              </h3>
              <div className="space-y-2">
                {SOURCE_BREAKDOWN.map((src) => (
                  <div
                    key={src.key}
                    className="flex items-center justify-between rounded-lg border border-spotify-border bg-spotify-card px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: src.color }}
                      />
                      <span className="text-xs text-spotify-text">{src.name}</span>
                    </div>
                    <span className="text-xs text-spotify-muted">{src.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Theme Analysis tab */}
      {activeTab === "themes" && (
        <div className="flex-1 overflow-y-auto p-6">
          {themesLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-spotify-green border-t-transparent" />
            </div>
          )}

          {themesError && (
            <p className="py-10 text-center text-red-400">{themesError}</p>
          )}

          {!themesLoading && !themesError && themes.length > 0 && (
            <>
              <p className="mb-6 text-sm text-spotify-muted">
                Discovery Mode analyzed 606 reviews and found these recurring patterns:
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {themes.map((theme, i) => (
                  <ThemeCard key={theme.theme_name} theme={theme} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
