import type React from "react";
import type { StackInfo } from "@/lib/stack-detector";

export interface StepItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  status: "pending" | "running" | "done";
}

export interface AuditFinding {
  file: string;
  line: number;
  category: "security" | "todo" | "performance" | "bug" | "architecture";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  snippet?: string;
  suggestedFix?: string;
}

export interface AuditData {
  driftScore?: number;
  healthScore: number;
  totalFilesScanned: number;
  totalFindings: number;
  totalDeviations?: number;
  deviations?: any[];
  summary: string;
  findings: AuditFinding[];
  todosFound: Array<{ file: string; line: number; text: string }>;
  stack?: StackInfo;
}

export interface ModelOption {
  id: string;
  name: string;
  tier: string;
  description: string;
  isDefault?: boolean;
}

export interface HistoryItem {
  id: string;
  name: string;
  type: "github" | "figma";
  summary: string;
  auditData?: AuditData;
}

export interface UserProfile {
  name: string;
  avatar: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  codeBlocks?: Array<{
    language: string;
    filename?: string;
    code: string;
  }>;
}
