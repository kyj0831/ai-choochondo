import { NextRequest, NextResponse } from "next/server";
import { deleteEvidence } from "@/lib/repo";

export async function DELETE(_req: NextRequest, { params }: { params: { eid: string } }) {
  deleteEvidence(params.eid);
  return NextResponse.json({ ok: true });
}
