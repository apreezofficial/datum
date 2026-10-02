"use client";

import * as React from "react";
import {
  Send,
  Code2,
  Copy,
  Check,
  FileCode,
  RefreshCw,
  GitBranch,
  Loader2,
  ArrowDown,
  Menu,
  X,
  Search,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ModelOption } from "@/types/datum";
import type { StackInfo } from "@/lib/stack-detector";
import type { RepoTreeData } from "@/components/datum-app";

interface VibeWorkspaceProps {
  activeItem: string;
  sourceType: "github" | "figma";
  treeData: RepoTreeData | null;
  detectedStack: StackInfo | null;
  activeModel: ModelOption;
  isLoggedIn: boolean;
  onReset: () => void;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg border border-border bg-[#0d1117] text-gray-200 overflow-hidden font-mono text-xs shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-border/40 text-[11px] text-gray-400 select-none">
        <span className="uppercase font-semibold tracking-wider text-[10px] text-gray-400 font-mono">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto whitespace-pre leading-relaxed text-gray-100 text-[12px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-content text-xs sm:text-sm leading-relaxed space-y-2.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isBlock = match || codeString.includes("\n");

            if (!isBlock) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-raised border border-border/60 font-mono text-[11px] text-text"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock code={codeString} lang={match ? match[1] : ""} />;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full text-left text-xs border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-raised/80">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border-b border-border px-3 py-2 font-semibold text-text whitespace-nowrap">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-b border-border/40 px-3 py-2 text-text/90">
                {children}
              </td>
            );
          },
          h1({ children }) {
            return (
              <h1 className="text-base sm:text-lg font-bold text-text mt-4 mb-2 first:mt-0">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-sm sm:text-base font-bold text-text mt-3.5 mb-1.5 border-b border-border/40 pb-1 first:mt-0">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xs sm:text-sm font-semibold text-text mt-3 mb-1 first:mt-0">
                {children}
              </h3>
            );
          },
          ul({ children }) {
            return <ul className="list-disc list-inside space-y-1 my-2 pl-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside space-y-1 my-2 pl-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-accent pl-3 my-2 text-secondary italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline underline-offset-2 hover:opacity-80"
              >
                {children}
              </a>
            );
          },
          hr() {
            return <hr className="my-3 border-border" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function VibeWorkspace({
  activeItem,
  sourceType,
  treeData,
  detectedStack,
  activeModel,
  onReset,
}: VibeWorkspaceProps) {
  // Conversation state
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      createdAt: Date.now(),
      content: `Mounted **${activeItem}** into your workspace.
Repository codebase and environment mapped.

What would you like to vibe code or inspect? You can generate new features matching this codebase, refactor existing files, or ask questions about architecture, security, or implementation details.`,
    },
  ]);

  const [inputPrompt, setInputPrompt] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Mobile sidebar toggle drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  // File browser state & filter
  const [fileSearch, setFileSearch] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<{ path: string; content: string } | null>(null);
  const [isLoadingFile, setIsLoadingFile] = React.useState(false);
  const [sidebarTab, setSidebarTab] = React.useState<"files" | "presets">("files");

  // Scroll container and "Go down" button
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = React.useState(false);
  const isAtBottomRef = React.useRef(true);
  const isProgrammaticScrollRef = React.useRef(false);

  const handleChatScroll = React.useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom <= 80;
    isAtBottomRef.current = atBottom;
    setShowScrollDown(!atBottom);
  }, []);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = chatScrollRef.current;
    if (!el) return;
    isProgrammaticScrollRef.current = true;
    setShowScrollDown(false);
    isAtBottomRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 300);
  }, []);

  // Auto-scroll when messages update, but only if user was already at bottom
  React.useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom("auto");
    }
  }, [messages, isGenerating, scrollToBottom]);

  // Handle selecting a file from the repository tree to mount into context
  const handleSelectFile = async (path: string) => {
    if (selectedFile?.path === path) {
      setSelectedFile(null);
      return;
    }
    setIsLoadingFile(true);
    try {
      const res = await fetch(
        `/api/repo/file?repo=${encodeURIComponent(activeItem)}&path=${encodeURIComponent(path)}&branch=${
          treeData?.branch || "main"
        }`
      );
      const data = (await res.json()) as { success: boolean; data?: { path: string; content: string } };
      if (data.success && data.data) {
        setSelectedFile(data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Send message / vibe code prompt with streaming
  const handleSendPrompt = async (promptText?: string) => {
    const textToSend = (promptText || inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    setInputPrompt("");
    setMobileDrawerOpen(false);

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: textToSend,
      createdAt: Date.now(),
    };

    const assistantMsgId = "a-" + Date.now();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    // Immediately push user message and placeholder assistant message
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setIsGenerating(true);
    isAtBottomRef.current = true;
    scrollToBottom("smooth");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: activeItem,
          sourceType,
          model: activeModel.id,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          fileTreeSample: treeData?.fullTreeSample || treeData?.uiFilesToRead,
          selectedFileContent: selectedFile ? { path: selectedFile.path, content: selectedFile.content } : undefined,
          stackInfo: detectedStack
            ? {
                language: detectedStack.language,
                ecosystem: detectedStack.ecosystem,
                stylingSystem: detectedStack.stylingSystem,
              }
            : undefined,
        }),
      });

      if (!res.ok) {
        let errMessage = "Error communicating with AI model.";
        try {
          const errJson = await res.json();
          if (errJson.error) errMessage = errJson.error;
        } catch {
          // ignore
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: errMessage } : m))
        );
        return;
      }

      if (!res.body) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: "No response body received." } : m))
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error during response generation.";
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, content: errMsg } : m))
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const PRESET_PROMPTS = [
    { label: "Build a pricing card component using this repo's styling" },
    { label: "Explain the architecture and data flow of this codebase" },
    { label: "Build an accessible modal dialog matching existing conventions" },
    { label: "Analyze potential security or performance issues in this codebase" },
  ];

  // Filtered files for the sidebar list
  const allFiles = treeData?.uiFilesToRead || [];
  const filteredFiles = fileSearch.trim()
    ? allFiles.filter((p) => p.toLowerCase().includes(fileSearch.toLowerCase()))
    : allFiles;

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* 1. LEFT PANEL: REPO EXPLORER & ACTIVE CONTEXT (Desktop sidebar + Mobile drawer) */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 sm:w-80 bg-surface border-r border-border flex flex-col shrink-0 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileDrawerOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text truncate">
              <GitBranch size={13} className="text-secondary shrink-0" />
              <span className="truncate">{activeItem}</span>
            </div>
            <div className="text-[10px] text-secondary font-mono mt-0.5">
              {detectedStack ? `${detectedStack.language} · ${detectedStack.stylingSystem}` : "Mounted Codebase"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onReset}
              className="p-1 rounded text-secondary hover:text-text hover:bg-raised transition-colors shrink-0"
              title="Switch codebase"
            >
              <RefreshCw size={13} />
            </button>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="md:hidden p-1 rounded text-secondary hover:text-text hover:bg-raised"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border text-xs font-mono">
          <button
            type="button"
            onClick={() => setSidebarTab("files")}
            className={`flex-1 py-2 text-center border-b-2 font-medium transition-colors ${
              sidebarTab === "files" ? "border-accent text-text" : "border-transparent text-secondary hover:text-text"
            }`}
          >
            Files ({allFiles.length})
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab("presets")}
            className={`flex-1 py-2 text-center border-b-2 font-medium transition-colors ${
              sidebarTab === "presets" ? "border-accent text-text" : "border-transparent text-secondary hover:text-text"
            }`}
          >
            Presets
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sidebarTab === "files" ? (
            <>
              {/* File Search Input */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Filter files..."
                  className="w-full bg-raised/70 border border-border/80 rounded-md pl-7 pr-2.5 py-1 text-[11px] font-mono text-text placeholder:text-muted outline-none focus:border-accent"
                />
              </div>

              <div className="text-[10px] font-mono text-muted uppercase tracking-wider px-1 pt-1">
                Repository Files ({filteredFiles.length})
              </div>

              {filteredFiles.length > 0 ? (
                <div className="space-y-0.5">
                  {filteredFiles.map((path) => {
                    const isSelected = selectedFile?.path === path;
                    return (
                      <button
                        key={path}
                        type="button"
                        onClick={() => handleSelectFile(path)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center justify-between transition-colors ${
                          isSelected
                            ? "bg-accent/15 text-text font-medium border border-accent/30"
                            : "text-secondary hover:text-text hover:bg-raised/70"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileCode size={13} className="text-secondary shrink-0" />
                          <span className="truncate">{path}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[9px] bg-accent/20 text-accent-foreground px-1 py-0.5 rounded font-mono shrink-0 ml-1">
                            Mounted
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-secondary font-mono">
                  {fileSearch ? "No files matching filter." : "No files found."}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 p-1">
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider px-1">Quick Prompts</div>
              {PRESET_PROMPTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendPrompt(preset.label)}
                  className="w-full text-left p-2.5 rounded-lg border border-border bg-surface hover:bg-raised transition-all text-xs text-text flex items-start gap-2 leading-relaxed"
                >
                  <Code2 size={13} className="text-secondary shrink-0 mt-0.5" />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected file preview footer */}
        {selectedFile && (
          <div className="p-2.5 border-t border-border bg-raised/40">
            <div className="flex items-center justify-between text-[11px] font-mono text-text pb-1">
              <span className="truncate font-semibold">{selectedFile.path}</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-secondary hover:text-text px-1"
                title="Unmount file"
              >
                ✕
              </button>
            </div>
            <div className="text-[10px] text-secondary font-mono">
              Mounted in context ({selectedFile.content.length.toLocaleString()} chars)
            </div>
          </div>
        )}
      </div>

      {/* Mobile Backdrop for Sidebar Drawer */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden backdrop-blur-xs"
        />
      )}

      {/* 2. RIGHT PANEL: CHAT & VIBE CODING WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg relative">
        {/* Mobile Header: Files Drawer Button */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-border bg-surface text-xs font-mono">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-raised text-text"
          >
            <Menu size={13} />
            <span>Files ({allFiles.length})</span>
          </button>
          {selectedFile ? (
            <span className="text-[11px] text-secondary truncate max-w-[180px]">
              Mounted: {selectedFile.path.split("/").pop()}
            </span>
          ) : (
            <span className="text-[11px] text-secondary truncate">
              {activeModel.name}
            </span>
          )}
        </div>

        {/* Swipeable File Strip (Mobile & Desktop quick access) */}
        {allFiles.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-3 border-b border-border bg-surface/60 text-xs shrink-0 select-none">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider shrink-0 mr-1">
              Quick Files:
            </span>
            {allFiles.slice(0, 25).map((filePath) => {
              const fileName = filePath.split("/").pop() || filePath;
              const isSelected = selectedFile?.path === filePath;
              return (
                <button
                  key={filePath}
                  type="button"
                  onClick={() => handleSelectFile(filePath)}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all ${
                    isSelected
                      ? "bg-accent text-accent-foreground border-accent font-medium shadow-xs"
                      : "bg-raised/70 text-secondary hover:text-text border-border hover:bg-raised"
                  }`}
                  title={filePath}
                >
                  <FileCode size={11} className={isSelected ? "text-accent-foreground" : "text-secondary"} />
                  <span className="max-w-[140px] truncate">{fileName}</span>
                  {isSelected && <span className="text-[9px] opacity-80">(mounted)</span>}
                </button>
              );
            })}
            {isLoadingFile && (
              <Loader2 size={12} className="animate-spin text-secondary shrink-0 ml-1" />
            )}
          </div>
        )}

        {/* Messages Feed */}
        <div
          ref={chatScrollRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5 relative scroll-smooth"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-2xl sm:max-w-3xl rounded-xl p-3.5 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground font-medium"
                    : "bg-surface border border-border text-text shadow-xs"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <MarkdownMessage content={msg.content || (isGenerating && msg.id === messages[messages.length - 1]?.id ? "Thinking..." : "")} />
                )}
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-center gap-2 text-xs font-mono text-secondary animate-pulse pl-1">
              <Loader2 size={13} className="animate-spin text-accent" />
              <span>Streaming from {activeModel.name}...</span>
            </div>
          )}
        </div>

        {/* Floating "Go down" button for mobile & desktop */}
        {showScrollDown && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border shadow-lg text-xs font-mono text-text hover:bg-raised transition-all active:scale-95"
            >
              <ArrowDown size={12} className="text-secondary" />
              <span>Go down</span>
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-border bg-surface/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-2 max-w-4xl mx-auto rounded-full border border-border bg-surface px-3.5 sm:px-4 py-2 shadow-xs focus-within:border-accent transition-colors"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Ask about ${activeItem} or describe a component to build...`}
              className="flex-1 bg-transparent border-0 outline-none text-xs sm:text-sm text-text placeholder:text-muted"
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isGenerating}
              className="rounded-full p-1.5 bg-accent text-accent-foreground disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
              aria-label="Send prompt"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
