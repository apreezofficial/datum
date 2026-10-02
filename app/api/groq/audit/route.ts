import { NextResponse } from "next/server";
import { auditCodebaseWithGroq } from "@/lib/groq";

export async function POST(req: Request) {
  try {
    let body: {
      url?: string;
      sourceType?: "github" | "figma";
      model?: string;
      sampleFiles?: Array<{ path: string; content: string }>;
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    const targetUrl = body.url || "shadcn/ui";
    const result = await auditCodebaseWithGroq(targetUrl, body.sampleFiles, body.model);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown audit error";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
