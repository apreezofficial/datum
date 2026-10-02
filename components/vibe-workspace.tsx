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
  HelpCircle,
  Layers,
  ArrowDown,
  Menu,
  X,
} from "lucide-react";
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

// Clean inline Markdown parser for bold, inline code, and paragraphs
function renderFormattedText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    // Empty line = spacer
    if (!line.trim()) {
      return <div key={lineIdx} className="h-2" />;
    }

    // Bullet points
    const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ");
    const content = isBullet ? line.trim().slice(2) : line;

    // Split by inline code `...`
    const parts = content.split(/(`[^`]+`)/g);

    const renderedLine = parts.map((part, pIdx) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={pIdx}
            className="px-1.5 py-0.5 rounded bg-raised border border-border/60 font-mono text-[11px] text-text"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Parse bold **...**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith("**") && bPart.endsWith("**")) {
          return (
            <strong key={bIdx} className="font-semibold text-text">
              {bPart.slice(2, -2)}
            </strong>
          );
        }
        return <span key={bIdx}>{bPart}</span>;
      });
    });

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex items-start gap-2 pl-2">
          <span className="text-secondary select-none">•</span>
          <span className="flex-1">{renderedLine}</span>
        </div>
      );
    }

    return (
      <div key={lineIdx} className="leading-relaxed">
        {renderedLine}
      </div>
    );
  });
}

export function VibeWorkspace({
  activeItem,
  sourceType,
  treeData,
  detectedStack,
  activeModel,
  isLoggedIn,
  onReset,
}: VibeWorkspaceProps) {
  // Conversation state
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      createdAt: Date.now(),
      content: `Mounted **${activeItem}** into your workspace.
I have parsed the UI component tree and design tokens.

What would you like to build or inspect? You can generate new components matching this repository, refactor existing files, or ask questions about how this codebase is structured.`,
    },
  ]);

  const [inputPrompt, setInputPrompt] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Mobile sidebar toggle drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  // File browser state
  const [selectedFile, setSelectedFile] = React.useState<{ path: string; content: string } | null>(null);
  const [isLoadingFile, setIsLoadingFile] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = React.useState<"files" | "presets">("files");

  // Scroll container and "Go down" button
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = React.useState(false);
  const isProgrammaticScrollRef = React.useRef(false);

  const handleChatScroll = React.useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distFromBottom > 80);
  }, []);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = chatScrollRef.current;
    if (!el) return;
    isProgrammaticScrollRef.current = true;
    setShowScrollDown(false);
    el.scrollTo({ top: el.scrollHeight, behavior });
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 400);
  }, []);

  // Auto-scroll on new message
  React.useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, isGenerating, scrollToBottom]);

  // Handle selecting a file from the repository tree to mount into context
  const handleSelectFile = async (path: string) => {
    if (selectedFile?.path === path) {
      setSelectedFile(null);
      return;
    }
    setIsLoadingFile(true);
    setMobileDrawerOpen(false); // Close mobile drawer when file selected
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

  // Send message / vibe code prompt
  const handleSendPrompt = async (promptText?: string) => {
    const textToSend = (promptText || inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    setInputPrompt("");
    setMobileDrawerOpen(false);

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: textToSend,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

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

      const json = (await res.json()) as { success: boolean; data?: { reply: string } };

      if (json.success && json.data) {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            role: "assistant",
            content: json.data?.reply || "Done.",
            createdAt: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            role: "assistant",
            content: "Encountered an error processing that prompt. Please try again.",
            createdAt: Date.now(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: "Network error communicating with the model.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const PRESET_PROMPTS = [
    { label: "Build a pricing card component using this repo's tokens" },
    { label: "Explain the architecture and data flow of this codebase" },
    { label: "Build an accessible modal dialog matching existing styles" },
    { label: "Analyze potential performance bottlenecks or styling inconsistencies" },
  ];

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
            Files ({treeData?.uiFilesToRead?.length || 0})
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
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sidebarTab === "files" ? (
            <>
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider px-2 py-1">
                UI & Component Files
              </div>
              {treeData?.uiFilesToRead && treeData.uiFilesToRead.length > 0 ? (
                treeData.uiFilesToRead.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleSelectFile(path)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center justify-between transition-colors ${
                      selectedFile?.path === path
                        ? "bg-accent/15 text-text font-medium border border-accent/30"
                        : "text-secondary hover:text-text hover:bg-raised/70"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileCode size={13} className="text-secondary shrink-0" />
                      <span className="truncate">{path}</span>
                    </div>
                    {selectedFile?.path === path && (
                      <span className="text-[9px] bg-accent/20 text-accent-foreground px-1 py-0.5 rounded font-mono">
                        Mounted
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-secondary font-mono">No component files found.</div>
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
              <button type="button" onClick={() => setSelectedFile(null)} className="text-secondary hover:text-text">
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
        {/* Mobile Sub-Header: Files toggle button */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-border bg-surface text-xs font-mono">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-raised text-text"
          >
            <Menu size={13} />
            <span>Files ({treeData?.uiFilesToRead?.length || 0})</span>
          </button>
          {selectedFile && (
            <span className="text-[11px] text-secondary truncate max-w-[180px]">
              Active: {selectedFile.path.split("/").pop()}
            </span>
          )}
        </div>

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
                    : "bg-surface border border-border text-text space-y-3"
                }`}
              >
                {/* Clean, robust Markdown parsing */}
                <div className="leading-relaxed">
                  {msg.content.split("```").map((chunk, idx) => {
                    // Even index = prose text
                    if (idx % 2 === 0) {
                      return <div key={idx}>{renderFormattedText(chunk)}</div>;
                    }

                    // Odd index = code block
                    const firstNewline = chunk.indexOf("\n");
                    const lang = firstNewline > -1 ? chunk.substring(0, firstNewline).trim() : "";
                    const code = firstNewline > -1 ? chunk.substring(firstNewline + 1) : chunk;
                    const codeBlockId = `${msg.id}-${idx}`;

                    return (
                      <div
                        key={idx}
                        className="my-3 rounded-lg border border-border bg-[#0d1117] text-gray-200 overflow-hidden font-mono text-xs"
                      >
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-border/40 text-[11px] text-gray-400">
                          <span className="uppercase font-semibold tracking-wider">{lang || "code"}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(code, codeBlockId)}
                            className="inline-flex items-center gap-1 hover:text-white transition-colors"
                          >
                            {copiedId === codeBlockId ? (
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
                        <pre className="p-3 overflow-x-auto whitespace-pre leading-normal">
                          <code>{code}</code>
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-center gap-2 text-xs font-mono text-secondary animate-pulse pl-1">
              <Loader2 size={13} className="animate-spin text-tide" />
              <span>Generating response with {activeModel.name}...</span>
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
