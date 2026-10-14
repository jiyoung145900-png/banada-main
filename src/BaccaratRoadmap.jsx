// ===================================================================
// 🀄 BaccaratRoadmap v2 - 구슬판 / 대로 / 중국점(큰눈이·작은눈이·바퀴벌레) / 다음 예측
// ===================================================================
// Props: history = ["player" | "banker" | "tie", ...]  (오래된 → 최신)
// 규칙: 표준 중국점 (큰눈이 ○ / 작은눈이 ● / 바퀴벌레 /).  빨강 = 앞 흐름을 따라감, 파랑 = 흐름이 바뀜
// ===================================================================

import React, { useMemo, useRef, useEffect } from "react";

export const MAX_ROWS = 6;

// ── 대로(Big Road) 논리 열: 같은 결과가 이어지는 묶음. 길이 제한 없음(파생 로드 계산용) ──
// 반환: { columns: [[{r:"P"|"B", ties}, ...], ...], leadingTies }
export function buildBigRoad(history) {
  const columns = [];
  let last = null;
  let leadingTies = 0;
  for (const h of history) {
    if (h === "tie") {
      if (!columns.length) leadingTies++;
      else { const col = columns[columns.length - 1]; col[col.length - 1].ties++; }
      continue;
    }
    const r = h === "player" ? "P" : h === "banker" ? "B" : null;
    if (!r) continue;
    if (r !== last) { columns.push([{ r, ties: columns.length ? 0 : leadingTies }]); last = r; }
    else columns[columns.length - 1].push({ r, ties: 0 });
  }
  return { columns, leadingTies };
}

// ── 파생 로드(큰눈이 d=1 / 작은눈이 d=2 / 바퀴벌레 d=3)의 칸 하나 ──
//   lens[c] = c 번째 열의 길이, (c, r) = 새로 생긴 대로 칸의 (열, 줄) (0부터)
//   반환: "red" | "blue" | null(아직 시작 전)
export function derivedMark(lens, c, r, d) {
  if (r === 0) {
    if (c < d + 1) return null;                         // 새 열의 첫 칸: (d+1)번째 열부터 시작
    return lens[c - 1] === lens[c - 1 - d] ? "red" : "blue";   // 바로 앞 열 vs 그보다 d 열 앞
  }
  if (c < d) return null;                               // 두 번째 줄부터는 d번째 열(0부터 d)에서 시작
  const ref = lens[c - d];                              // d 열 앞의 열
  if (ref >= r + 1) return "red";                       // 같은 줄에 칸이 있음
  if (ref === r) return "blue";                         // 바로 윗줄까지만 있음
  return "red";                                         // 2칸 이상 짧음
}

// 대로 전체를 훑어 파생 로드의 색 목록(대로가 늘어난 순서대로) 만들기
export function buildDerived(columns, d) {
  const lens = columns.map((c) => c.length);
  const out = [];
  for (let c = 0; c < columns.length; c++) for (let r = 0; r < columns[c].length; r++) {
    // 이 칸이 생길 시점에는 아직 뒤 열이 없으므로, 그 시점의 길이만 사용 (현재 열은 r+1 까지)
    const snap = lens.slice(0, c + 1); snap[c] = r + 1;
    const m = derivedMark(snap, c, r, d);
    if (m) out.push(m);
  }
  return out;
}

// ── 같은 색/결과가 이어지면 아래로, 바뀌면 새 열. 6줄을 넘으면(또는 아래가 막히면) 오른쪽으로 꺾음 ──
// items: 종류(type) 배열. 반환: { cells:[{x,y,type,idx}], cols }
export function layoutStreaks(types, rows = MAX_ROWS) {
  const occ = new Set(); const key = (x, y) => `${x},${y}`;
  const cells = [];
  let startCol = -1, x = 0, y = 0, last = null;
  types.forEach((t, idx) => {
    if (idx === 0 || t !== last) {              // 새 묶음: 이전 묶음이 시작한 열의 오른쪽 열, 맨 윗줄
      startCol += 1; x = startCol; y = 0;
      while (occ.has(key(x, 0))) x += 1;          // (정상적으로는 일어나지 않음) 안전장치
      if (x > startCol) startCol = x;
    } else if (y + 1 < rows && !occ.has(key(x, y + 1))) { y += 1; }
    else { x += 1; while (occ.has(key(x, y))) x += 1; }   // 드래곤 테일: 오른쪽으로 꺾음
    occ.add(key(x, y)); cells.push({ x, y, type: t, idx }); last = t;
  });
  const cols = cells.length ? Math.max(...cells.map((c) => c.x)) + 1 : 0;
  return { cells, cols };
}

// ── 구슬판: 모든 결과(무승부 포함)를 위→아래, 왼→오 로 채움 ──
export function buildBeadPlate(history, rows = MAX_ROWS) {
  return history.filter((h) => h === "player" || h === "banker" || h === "tie").map((h, i) => ({ x: Math.floor(i / rows), y: i % rows, type: h === "player" ? "P" : h === "banker" ? "B" : "T" }));
}

// ── 다음 예측: 다음에 P / B 가 나오면 각 파생 로드에 어떤 색이 찍히는지 ──
export function predictNext(columns) {
  const out = { P: { eye: null, small: null, roach: null }, B: { eye: null, small: null, roach: null } };
  if (!columns.length) return out;
  const lens = columns.map((c) => c.length);
  const last = columns[columns.length - 1][0].r;
  for (const next of ["P", "B"]) {
    const sim = [...lens];
    let c, r;
    if (next === last) { c = sim.length - 1; r = sim[c]; sim[c] = r + 1; }     // 같은 결과 → 이어짐
    else { c = sim.length; r = 0; sim.push(1); }                                // 다른 결과 → 새 열
    out[next] = { eye: derivedMark(sim, c, r, 1), small: derivedMark(sim, c, r, 2), roach: derivedMark(sim, c, r, 3) };
  }
  return out;
}

export function computeStats(history) {
  let p = 0, b = 0, t = 0;
  for (const h of history) { if (h === "player") p++; else if (h === "banker") b++; else if (h === "tie") t++; }
  return { p, b, t, total: p + b + t };
}

// ────────────────────────────────────────────────────
// 🎨 화면
// ────────────────────────────────────────────────────
const COLOR = { P: "#3B82F6", B: "#E63975", T: "#10B981", red: "#EF4444", blue: "#3B82F6" };
const GRID = "rgba(212,165,116,0.16)";

// 한 장의 판 (SVG). 오른쪽 끝(최신)이 보이도록 자동 스크롤
function Board({ title, sub, cols, cell, minCols, children, height = MAX_ROWS }) {
  const ref = useRef(null);
  const n = Math.max(cols, minCols);
  useEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; });
  const w = n * cell, h = height * cell;
  return (
    <div style={R.panel} data-road={title}>
      <div style={R.panelHead}><span style={R.panelTitle}>{title}</span>{sub && <span style={R.panelSub}>{sub}</span>}</div>
      <div ref={ref} style={R.scroll}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
          <rect width={w} height={h} fill="rgba(255,255,255,0.025)" />
          {Array.from({ length: n + 1 }, (_, i) => <line key={`v${i}`} x1={i * cell} y1="0" x2={i * cell} y2={h} stroke={GRID} strokeWidth="1" />)}
          {Array.from({ length: height + 1 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * cell} x2={w} y2={i * cell} stroke={GRID} strokeWidth="1" />)}
          {children}
        </svg>
      </div>
    </div>
  );
}

// 중국점 마크: 큰눈이 ○ / 작은눈이 ● / 바퀴벌레 /
function Mark({ kind, color, x, y, cell }) {
  const cx = x * cell + cell / 2, cy = y * cell + cell / 2, c = COLOR[color];
  if (kind === "eye") return <circle cx={cx} cy={cy} r={cell * 0.34} fill="none" stroke={c} strokeWidth={Math.max(1.4, cell * 0.14)} data-mark={`eye-${color}`} />;
  if (kind === "small") return <circle cx={cx} cy={cy} r={cell * 0.3} fill={c} data-mark={`small-${color}`} />;
  const k = cell * 0.34;
  return <line x1={cx - k} y1={cy + k} x2={cx + k} y2={cy - k} stroke={c} strokeWidth={Math.max(1.6, cell * 0.16)} strokeLinecap="round" data-mark={`roach-${color}`} />;
}

function BeadPlate({ history }) {
  const cells = useMemo(() => buildBeadPlate(history), [history]);
  const cols = cells.length ? cells[cells.length - 1].x + 1 : 0;
  const cell = 17;
  return (
    <Board title="구슬판 · BEAD PLATE" cols={cols} cell={cell} minCols={24}>
      {cells.map((c, i) => (
        <g key={i} data-bead={c.type}>
          <circle cx={c.x * cell + cell / 2} cy={c.y * cell + cell / 2} r={cell * 0.4} fill={COLOR[c.type]} />
          <text x={c.x * cell + cell / 2} y={c.y * cell + cell / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={cell * 0.42} fontWeight="900" fill="#fff" style={{ fontFamily: "Inter, Arial, sans-serif" }}>{c.type}</text>
        </g>
      ))}
    </Board>
  );
}

function BigRoad({ columns }) {
  const types = useMemo(() => columns.flatMap((col) => col.map((x) => x.r)), [columns]);
  const flat = useMemo(() => columns.flat(), [columns]);
  const { cells, cols } = useMemo(() => layoutStreaks(types), [types]);
  const cell = 17;
  return (
    <Board title="대로 · BIG ROAD" cols={cols} cell={cell} minCols={24}>
      {cells.map((c) => {
        const item = flat[c.idx], cx = c.x * cell + cell / 2, cy = c.y * cell + cell / 2;
        return (
          <g key={c.idx} data-big={c.type}>
            <circle cx={cx} cy={cy} r={cell * 0.36} fill="none" stroke={COLOR[c.type]} strokeWidth="2" />
            {item.ties > 0 && (
              <>
                <line x1={cx - cell * 0.3} y1={cy + cell * 0.3} x2={cx + cell * 0.3} y2={cy - cell * 0.3} stroke={COLOR.T} strokeWidth="2" strokeLinecap="round" />
                {item.ties > 1 && <text x={cx + cell * 0.28} y={cy + cell * 0.34} fontSize={cell * 0.38} fontWeight="900" fill={COLOR.T} style={{ fontFamily: "Inter, Arial, sans-serif" }}>{item.ties}</text>}
              </>
            )}
          </g>
        );
      })}
    </Board>
  );
}

function DerivedRoad({ columns, d, kind, title, sub }) {
  const marks = useMemo(() => buildDerived(columns, d), [columns, d]);
  const { cells, cols } = useMemo(() => layoutStreaks(marks), [marks]);
  const cell = 13;
  return (
    <Board title={title} sub={sub} cols={cols} cell={cell} minCols={34}>
      {cells.map((c) => <Mark key={c.idx} kind={kind} color={c.type} x={c.x} y={c.y} cell={cell} />)}
    </Board>
  );
}

// 다음 예측: 기준 이미지의  "P - ○ ● /   B - ○ ● /"
function Prediction({ pred }) {
  const row = (label, color, p) => (
    <div style={{ ...R.predBox, borderColor: `${color}66` }} data-pred={label}>
      <span style={{ ...R.predLabel, color }}>{label}</span>
      <span style={R.predDash}>-</span>
      {p.eye ? <svg width="18" height="18"><Mark kind="eye" color={p.eye} x={0} y={0} cell={18} /></svg> : <span style={R.predNone}>·</span>}
      {p.small ? <svg width="18" height="18"><Mark kind="small" color={p.small} x={0} y={0} cell={18} /></svg> : <span style={R.predNone}>·</span>}
      {p.roach ? <svg width="18" height="18"><Mark kind="roach" color={p.roach} x={0} y={0} cell={18} /></svg> : <span style={R.predNone}>·</span>}
    </div>
  );
  return (
    <div style={R.predRow}>
      {row("P", COLOR.P, pred.P)}
      {row("B", COLOR.B, pred.B)}
    </div>
  );
}

export default function BaccaratRoadmap({ history = [] }) {
  const { columns } = useMemo(() => buildBigRoad(history), [history]);
  const pred = useMemo(() => predictNext(columns), [columns]);
  return (
    <div style={R.wrap} data-roadmap>
      <BeadPlate history={history} />
      <BigRoad columns={columns} />
      <DerivedRoad columns={columns} d={1} kind="eye" title="큰눈이 ○" sub="BIG EYE" />
      <DerivedRoad columns={columns} d={2} kind="small" title="작은눈이 ●" sub="SMALL" />
      <DerivedRoad columns={columns} d={3} kind="roach" title="바퀴벌레 /" sub="COCKROACH" />
      <div style={R.predHead}>다음 예측 · 이어서 P / B 가 나오면</div>
      <Prediction pred={pred} />
      <div style={R.legend}>
        <span><span style={{ color: COLOR.red }}>●</span> 빨강 = 앞 흐름을 따라감</span>
        <span><span style={{ color: COLOR.blue }}>●</span> 파랑 = 흐름이 바뀜</span>
        <span><span style={{ color: COLOR.T }}>╱</span> 무승부</span>
      </div>
    </div>
  );
}

const R = {
  wrap: { marginTop: 10, padding: 10, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(212,165,116,0.2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 },
  panel: { borderRadius: 8, overflow: "hidden", border: "1px solid rgba(212,165,116,0.18)" },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 8px", background: "rgba(212,165,116,0.08)" },
  panelTitle: { fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#D4A574" },
  panelSub: { fontSize: 8, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)" },
  scroll: { overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" },
  predHead: { fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "rgba(212,165,116,0.85)", marginTop: 2 },
  predRow: { display: "flex", gap: 10 },
  predBox: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "6px 8px", border: "2px solid", borderRadius: 18, background: "rgba(255,255,255,0.03)" },
  predLabel: { fontSize: 16, fontWeight: 900, fontFamily: "Georgia, serif" },
  predDash: { color: "rgba(255,255,255,0.4)", fontWeight: 700 },
  predNone: { width: 18, textAlign: "center", color: "rgba(255,255,255,0.25)", fontWeight: 900 },
  legend: { display: "flex", flexWrap: "wrap", gap: "4px 14px", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.55)", paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)" },
};