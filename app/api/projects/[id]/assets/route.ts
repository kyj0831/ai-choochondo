import { NextRequest, NextResponse } from "next/server";
import { addAsset, deleteAsset, listAssets } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ assets: listAssets(params.id) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (!body.url || !body.platform) {
    return NextResponse.json({ error: "url, platform은 필수입니다." }, { status: 400 });
  }
  const asset = addAsset(params.id, body.url, body.platform);
  return NextResponse.json({ asset });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  deleteAsset(assetId);
  return NextResponse.json({ ok: true });
}
