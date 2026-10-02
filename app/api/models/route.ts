import { NextResponse } from "next/server";
import { fetchAuditModels } from "@/lib/groq";

export async function GET() {
  try {
    const models = await fetchAuditModels();
    return NextResponse.json({
      success: true,
      data: models,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve models";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
