import { NextResponse } from "next/server";
import { callGroqChatStream, getAllApiKeys, DEFAULT_MODEL } from "@/lib/groq";

export async function POST(req: Request) {
  try {
    const keys = getAllApiKeys();
    if (keys.length === 0) {
      return NextResponse.json(
        { success: false, error: "No Groq API key configured." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
      targetUrl?: string;
      sourceType?: "github" | "figma";
      model?: string;
      fileTreeSample?: string[];
      selectedFileContent?: { path: string; content: string };
      stackInfo?: { language?: string; ecosystem?: string; stylingSystem?: string };
    };

    const targetUrl = body.targetUrl || "Repository";
    const modelToUse = body.model || DEFAULT_MODEL;

    // Context system prompt
    let contextPrompt = `You are Datum, an elite AI Vibe Coder and software engineer.
You are currently mounted in the context of the repository/project: "${targetUrl}".
Stack detected: ${body.stackInfo?.language || "TypeScript"} · ${body.stackInfo?.ecosystem || "React"} · ${body.stackInfo?.stylingSystem || "Tailwind CSS"}.`;

    if (body.fileTreeSample && body.fileTreeSample.length > 0) {
      contextPrompt += `\n\nRepository File Structure (${body.fileTreeSample.length} key files):\n${body.fileTreeSample.slice(0, 50).join("\n")}`;
    }

    if (body.selectedFileContent) {
      contextPrompt += `\n\nActive / Referenced File (${body.selectedFileContent.path}):\n\`\`\`\n${body.selectedFileContent.content.slice(0, 3000)}\n\`\`\``;
    }

    contextPrompt += `\n\nYour capabilities:
1. Vibe code brand new components, features, hooks, or pages strictly matching the styling and conventions of this repository.
2. Answer deep architectural questions about this codebase (routing, auth, state management, design tokens).
3. Refactor, fix, or enhance existing components in the repository.
4. Output clean, production-ready, beautiful code blocks formatted with the correct language and filename comment at the top if applicable (e.g. \`// components/PricingCard.tsx\`).
5. Be concise, punchy, modern, and helpful. Always give code that works directly.`;

    const chatMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      { role: "system", content: contextPrompt },
      ...body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const { stream, modelUsed } = await callGroqChatStream(chatMessages, {
      model: modelToUse,
      temperature: 0.3,
      maxTokens: 3000,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "x-model-used": modelUsed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
