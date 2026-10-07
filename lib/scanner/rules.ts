import type { AuditFinding } from "@/types/datum";

export interface Rule {
  id: string;
  category: AuditFinding["category"];
  severity: AuditFinding["severity"];
  title: string;
  description: string;
  suggestedFix: string;
  pattern: RegExp;
  /** Only apply to files whose path matches. */
  appliesTo?: RegExp;
}

const CODE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|py|rb|php|go|rs|java|kt|cs)$/i;
const JS = /\.(tsx?|jsx?|mjs|cjs|vue|svelte)$/i;

export const SECURITY_RULES: Rule[] = [
  {
    id: "aws-access-key",
    category: "security",
    severity: "high",
    title: "AWS access key committed",
    description: "A string matching the AWS access key ID format is hardcoded in source.",
    suggestedFix: "Revoke the key and load credentials from the environment or a secrets manager.",
    pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    id: "private-key",
    category: "security",
    severity: "high",
    title: "Private key committed",
    description: "A PEM private key block is present in the repository.",
    suggestedFix: "Remove it from history, rotate the key, and load it from a secret store.",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    id: "github-token",
    category: "security",
    severity: "high",
    title: "GitHub token committed",
    description: "A string matching a GitHub personal access or app token is hardcoded.",
    suggestedFix: "Revoke the token on GitHub and read it from an environment variable.",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{30,}\b/,
  },
  {
    id: "api-secret-key",
    category: "security",
    severity: "high",
    title: "API secret key committed",
    description: "A string matching a provider secret key (Stripe, Groq, OpenAI, Slack) is hardcoded.",
    suggestedFix: "Rotate the key and move it to environment configuration.",
    pattern: /\b(?:sk_live_[0-9a-zA-Z]{20,}|gsk_[0-9a-zA-Z]{30,}|sk-[A-Za-z0-9]{32,}|xox[baprs]-[0-9A-Za-z-]{20,})\b/,
  },
  {
    id: "hardcoded-credential",
    category: "security",
    severity: "high",
    title: "Hardcoded credential",
    description: "A password, secret or token variable is assigned a string literal.",
    suggestedFix: "Read the value from the environment instead of committing it.",
    pattern: /\b(?:password|passwd|secret|api[_-]?key|auth[_-]?token|access[_-]?token)\b["']?\s*[:=]\s*["'][^"'\s${}]{8,}["']/i,
    appliesTo: CODE,
  },
  {
    id: "eval",
    category: "security",
    severity: "high",
    title: "Use of eval / new Function",
    description: "Dynamic code evaluation can execute attacker-controlled input.",
    suggestedFix: "Replace with a parser, a lookup table, or JSON.parse.",
    pattern: /(?<![\w.$])(?:eval\s*\(|new\s+Function\s*\()/,
    appliesTo: JS,
  },
  {
    id: "dangerous-html",
    category: "security",
    severity: "medium",
    title: "Unsanitised HTML injection",
    description:
      "dangerouslySetInnerHTML / innerHTML / v-html renders raw HTML and enables XSS if the value is user-controlled.",
    suggestedFix: "Render text normally, or sanitise with a library such as DOMPurify first.",
    pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=|\bv-html\b/,
    appliesTo: /\.(tsx?|jsx?|vue|svelte|html)$/i,
  },
  {
    id: "shell-exec",
    category: "security",
    severity: "medium",
    title: "Shell command execution with dynamic input",
    description: "Spawning a shell with interpolated strings risks command injection.",
    suggestedFix: "Use execFile / spawn with an argument array and validate inputs.",
    pattern:
      /\bexec(?:Sync)?\s*\(\s*(?:`[^`]*\$\{|["'][^"']*["']\s*\+)|\bos\.system\s*\(|subprocess\.[a-z_]+\([^)]*shell\s*=\s*True/,
    appliesTo: CODE,
  },
  {
    id: "sql-concat",
    category: "security",
    severity: "high",
    title: "SQL built from string interpolation",
    description: "Queries assembled with template strings or concatenation are open to SQL injection.",
    suggestedFix: "Use parameterised queries / prepared statements.",
    pattern: /\b(?:SELECT\b[^;\n]{0,80}\bFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^;\n]{0,120}(?:\$\{|["']\s*\+\s*\w)/i,
    appliesTo: CODE,
  },
  {
    id: "tls-disabled",
    category: "security",
    severity: "medium",
    title: "TLS verification disabled",
    description: "Certificate validation is turned off, allowing man-in-the-middle attacks.",
    suggestedFix: "Remove the override and trust the proper CA instead.",
    pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|verify\s*=\s*False/,
    appliesTo: CODE,
  },
  {
    id: "weak-hash",
    category: "security",
    severity: "low",
    title: "Weak hash algorithm",
    description: "MD5 and SHA-1 are broken for security purposes such as passwords or signatures.",
    suggestedFix: "Use SHA-256+, or argon2/bcrypt/scrypt for passwords.",
    pattern: /createHash\(\s*["'](?:md5|sha1)["']\s*\)|hashlib\.(?:md5|sha1)\(/i,
    appliesTo: CODE,
  },
  {
    id: "insecure-random",
    category: "security",
    severity: "low",
    title: "Math.random used for a secret",
    description: "Math.random is predictable and unsuitable for tokens, ids or secrets.",
    suggestedFix: "Use crypto.randomUUID() or crypto.getRandomValues().",
    pattern: /(?:token|secret|password|session|nonce)\w*\s*=.*Math\.random\(\)/i,
    appliesTo: CODE,
  },
  {
    id: "cors-wildcard",
    category: "security",
    severity: "low",
    title: "Wildcard CORS origin",
    description: "Access-Control-Allow-Origin: * lets any site read responses.",
    suggestedFix: "Restrict to an explicit allowlist of origins.",
    pattern: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/i,
    appliesTo: CODE,
  },
];

export const BUG_RULES: Rule[] = [
  {
    id: "empty-catch",
    category: "bug",
    severity: "low",
    title: "Empty catch block swallows errors",
    description: "Errors are caught and silently discarded, hiding failures.",
    suggestedFix: "Log or handle the error, or rethrow it.",
    pattern: /catch\s*(?:\([^)]*\))?\s*\{\s*\}/,
    appliesTo: /\.(tsx?|jsx?|mjs|cjs|java|kt|cs|php)$/i,
  },
  {
    id: "debugger",
    category: "bug",
    severity: "low",
    title: "debugger statement left in code",
    description: "A debugger statement will pause execution in dev tools.",
    suggestedFix: "Remove it.",
    pattern: /^\s*debugger\s*;?\s*$/,
    appliesTo: JS,
  },
  {
    id: "ts-ignore",
    category: "bug",
    severity: "low",
    title: "Type checking suppressed",
    description: "@ts-ignore / @ts-nocheck hides real type errors.",
    suggestedFix: "Fix the type, or use @ts-expect-error with an explanation.",
    pattern: /@ts-(?:ignore|nocheck)\b/,
    appliesTo: /\.(tsx?|jsx?)$/i,
  },
];

export const ALL_RULES: Rule[] = [...SECURITY_RULES, ...BUG_RULES];
