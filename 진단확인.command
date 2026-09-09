#!/bin/zsh
# AI 추천도 진단 — 내 진단이 진짜였는지 확인 (더블클릭 실행용, macOS)
#
# "왜 뭘 넣어도 60점대인가"를 추측 대신 데이터로 확인한다.
# 저장된 진단을 열어 (1) 데모 데이터였는지 (2) 어떤 엔진이 쓰였는지
# (3) AI가 실제로 뭐라고 답했는지를 그대로 보여준다.

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "❌ 먼저 start.command 를 한 번 실행해 설치를 끝내주세요."
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

node -e '
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "app.sqlite");

if (!fs.existsSync(dbPath)) {
  console.log("\n❌ 진단 데이터가 없습니다: " + dbPath);
  console.log("   아직 진단을 만들지 않았거나, 다른 폴더에서 실행 중입니다.\n");
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true });

const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
if (!projects.length) {
  console.log("\n진단이 아직 없습니다.\n");
  process.exit(0);
}

console.log("\n═══════════════════════════════════════════════════════");
console.log("  저장된 진단 목록");
console.log("═══════════════════════════════════════════════════════");

for (const p of projects.slice(0, 10)) {
  const ev = db.prepare("SELECT * FROM evidence WHERE project_id = ?").all(p.id);
  const judged = ev.filter((e) => e.judged_at);
  const sampleCount = ev.filter((e) => e.is_sample === 1).length;
  const report = db
    .prepare("SELECT * FROM reports WHERE project_id = ? ORDER BY run_number DESC LIMIT 1")
    .get(p.id);

  const engines = [...new Set(ev.map((e) => e.engine_label))];
  const mentions = {};
  for (const e of judged) mentions[e.mention_type || "미판정"] = (mentions[e.mention_type || "미판정"] || 0) + 1;

  console.log("\n───────────────────────────────────────────────────────");
  console.log("브랜드: " + p.brand_name + "   (" + p.entity_type + ")");
  console.log("점수:   " + (report ? report.score_total + "점 / " + report.grade + "등급" : "리포트 없음"));
  console.log("증거:   " + judged.length + "건 판정됨 / 엔진: " + (engines.join(", ") || "없음"));
  console.log("판정분포: " + JSON.stringify(mentions));

  if (sampleCount > 0) {
    console.log("");
    console.log("🚨 데모(가짜) 데이터입니다 — " + sampleCount + "/" + ev.length + "건이 샘플");
    console.log("   \"샘플 답변으로 체험하기\" 버튼으로 만든 진단이라 점수가 의미 없습니다.");
    console.log("   → 브랜드가 뭐든 항상 68.6점 근처가 나옵니다.");
  } else if (judged.length > 0) {
    console.log("");
    console.log("✅ 진짜 AI 답변으로 만든 진단입니다.");
    console.log("");
    console.log("   AI가 실제로 뭐라고 답했는지 (앞 2건):");
    for (const e of judged.slice(0, 2)) {
      const q = db.prepare("SELECT text FROM queries WHERE id = ?").get(e.query_id);
      const txt = (e.response_text || "").replace(/\s+/g, " ").slice(0, 160);
      console.log("");
      console.log("   Q(" + e.engine_label + "): " + (q ? q.text : "?"));
      console.log("   A: " + txt);
      console.log("   → 판정: " + e.mention_type + " (이 판정이 답변 내용과 맞는지 보세요)");
    }
  }
}

console.log("\n═══════════════════════════════════════════════════════");
console.log("  읽는 법");
console.log("═══════════════════════════════════════════════════════");
console.log("");
console.log("  🚨 가 떴다면 → 데모 데이터. 실제 진단을 새로 돌리세요.");
console.log("  ✅ 인데 점수가 이상하다면 → 위 \"A:\" 답변과 \"판정\"을 비교하세요.");
console.log("     답변에 브랜드가 분명히 추천됐는데 판정이 미노출이면 판정 오류입니다.");
console.log("     그 부분을 캡처해서 알려주시면 판정 로직을 고치겠습니다.");
console.log("");
'

read -r "?엔터를 누르면 창이 닫힙니다..."
