import { NextRequest, NextResponse } from "next/server";
import { listFacts, upsertFact } from "@/lib/repo";
import { requireProject } from "@/lib/owner";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireProject(params.id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ facts: listFacts(params.id) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireProject(params.id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  const facts = body.facts as { field: string; value: string; source_url?: string }[];
  if (!Array.isArray(facts)) return NextResponse.json({ error: "facts array required" }, { status: 400 });
  for (const f of facts) {
    if (f.value && f.value.trim()) {
      upsertFact(params.id, f.field, f.value.trim(), f.source_url || null);
    }
  }
  return NextResponse.json({ facts: listFacts(params.id) });
}
