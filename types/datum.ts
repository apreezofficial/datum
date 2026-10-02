import type React from "react";
import type { StackInfo } from "@/lib/stack-detector";

export interface StepItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  status: "pending" | "running" | "done";
}

export interface AuditDeviation {
  file: string;
  line: number;
  currentValue: string;
  suggestedToken: string;
  suggestedValue: string;
  delta: string | number;
  confidence: number;
}

export interface AuditData {
  driftScore: number;
  totalFilesScanned: number;
  totalDeviations: number;
  summary: string;
  deviations: AuditDeviation[];
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
