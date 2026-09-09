import { NextRequest, NextResponse } from "next/server";
import { addAsset, deleteAsset, listAssets } from "@/lib/repo";
import { requireProject } from "@/lib/owner";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireProject(params.id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ assets: listAssets(params.id) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireProject(params.id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  if (!body.url || !body.platform) {
    return NextResponse.json({ error: "url, platform은 필수입니다." }, { status: 400 });
  }
  const asset = addAsset(params.id, body.url, body.platform);
  return NextResponse.json({ asset });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireProject(params.id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  // 내 진단의 자산만 지운다. 다른 진단의 id 를 넣어도 통하지 않는다.
  if (!listAssets(params.id).some((a) => a.id === assetId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  deleteAsset(assetId);
  return NextResponse.json({ ok: true });
}
