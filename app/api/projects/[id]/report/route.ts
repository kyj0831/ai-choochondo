import { NextRequest, NextResponse } from "next/server";
import { listReports } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const reports = listReports(params.id);
  return NextResponse.json({ reports });
}
