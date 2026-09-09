import { NextRequest, NextResponse } from "next/server";
import { listReports } from "@/lib/repo";
import { requireProject } from "@/lib/owner";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireProject(params.id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const reports = listReports(params.id);
  return NextResponse.json({ reports });
}
