"use client";

import * as React from "react";
import {
  Send,
  Sparkles,
  Code2,
  Copy,
  Check,
  FileCode,
  FolderTree,
  FileText,
  ChevronRight,
  ChevronDown,
  Terminal,
  RefreshCw,
  ExternalLink,
  GitBranch,
  ShieldAlert,
  Loader2,
  HelpCircle,
  Lightbulb,
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
      content: `I've mounted **${activeItem}** into your workspace.
I know the file structure, UI components, and design system. 

What do you want to build or ask? You can vibe code a new component, refactor an existing one, or ask architectural questions!`,
    },
  ]);

  const [inputPrompt, setInputPrompt] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);

  // File browser state
  const [selectedFile, setSelectedFile] = React.useState<{ path: string; content: string } | null>(null);
  const [isLoadingFile, setIsLoadingFile] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = React.useState<"files" | "presets">("files");

  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Handle selecting a file from the repository tree to mount into context
  const handleSelectFile = async (path: string) => {
    if (selectedFile?.path === path) {
      setSelectedFile(null);
      return;
    }
    setIsLoadingFile(true);
    try {
      const res = await fetch(`/api/repo/file?repo=${encodeURIComponent(activeItem)}&path=${encodeURIComponent(path)}&branch=${treeData?.branch || "main"}`);
      const data = await res.json() as { success: boolean; data?: { path: string; content: string } };
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
          stackInfo: detectedStack ? {
            language: detectedStack.language,
            ecosystem: detectedStack.ecosystem,
            stylingSystem: detectedStack.stylingSystem,
          } : undefined,
        }),
      });

      const json = await res.json() as { success: boolean; data?: { reply: string } };

      if (json.success && json.data) {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            role: "assistant",
            content: json.data?.reply || "Done!",
            createdAt: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            role: "assistant",
            content: "Sorry, I hit an error processing that prompt. Please try again.",
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
          content: "Network error communicating with the vibe model.",
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
    { label: "Build a modern pricing card component using this repo's tokens", icon: <Sparkles size={13} className="text-tide" /> },
    { label: "Explain the architecture and data flow of this codebase", icon: <HelpCircle size={13} className="text-secondary" /> },
    { label: "Build an accessible modal dialog matching existing styles", icon: <Code2 size={13} className="text-emerald-500" /> },
    { label: "Analyze potential performance bottlenecks or styling inconsistencies", icon: <Lightbulb size={13} className="text-ochre" /> },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 1. LEFT PANEL: REPO EXPLORER & ACTIVE CONTEXT */}
      <div className="w-72 sm:w-80 border-r border-border bg-surface/50 flex flex-col shrink-0 overflow-hidden">
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
          <button
            type="button"
            onClick={onReset}
            className="p-1 rounded text-secondary hover:text-text hover:bg-raised transition-colors shrink-0"
            title="Switch codebase"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border text-xs font-mono">
          <button
            type="button"
            onClick={() => setSidebarTab("files")}
            className={`flex-1 py-2 text-center border-b-2 font-medium transition-colors ${
              sidebarTab === "files"
                ? "border-accent text-text"
                : "border-transparent text-secondary hover:text-text"
            }`}
          >
            Files ({treeData?.uiFilesToRead?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab("presets")}
            className={`flex-1 py-2 text-center border-b-2 font-medium transition-colors ${
              sidebarTab === "presets"
                ? "border-accent text-text"
                : "border-transparent text-secondary hover:text-text"
            }`}
          >
            Vibe Presets
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
                      <span className="text-[9px] bg-accent/20 text-accent-foreground px-1 py-0.5 rounded uppercase">
                        Mounted
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-secondary">
                  No component files found.
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 p-1">
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider px-1">
                Quick Actions
              </div>
              {PRESET_PROMPTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendPrompt(preset.label)}
                  className="w-full text-left p-2.5 rounded-lg border border-border bg-surface hover:bg-raised transition-all text-xs text-text flex items-start gap-2"
                >
                  <span className="mt-0.5 shrink-0">{preset.icon}</span>
                  <span className="leading-snug">{preset.label}</span>
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
                className="text-secondary hover:text-text"
              >
                ✕
              </button>
            </div>
            <div className="text-[10px] text-secondary font-mono">
              Injected into Vibe context ({selectedFile.content.length.toLocaleString()} chars)
            </div>
          </div>
        )}
      </div>

      {/* 2. RIGHT PANEL: CHAT & VIBE CODING WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-3xl rounded-xl p-4 sm:p-5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground font-medium"
                    : "bg-surface border border-border text-text space-y-3"
                }`}
              >
                {/* Render Markdown-like content and code blocks */}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content.split("```").map((chunk, idx) => {
                    // Even index = prose text
                    if (idx % 2 === 0) {
                      return <span key={idx}>{chunk}</span>;
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
            <div className="flex items-center gap-2 text-xs font-mono text-secondary animate-pulse pl-2">
              <Loader2 size={14} className="animate-spin text-tide" />
              <span>Vibing with {activeModel.name}...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-surface/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-2 max-w-4xl mx-auto rounded-full border border-border bg-surface px-4 py-2 shadow-xs focus-within:border-accent transition-colors"
          >
            <Sparkles size={16} className="text-tide shrink-0" />
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Ask anything about ${activeItem} or vibe code a component...`}
              className="flex-1 bg-transparent border-0 outline-none text-xs sm:text-sm text-text placeholder:text-muted"
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isGenerating}
              className="rounded-full p-1.5 bg-accent text-accent-foreground disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
