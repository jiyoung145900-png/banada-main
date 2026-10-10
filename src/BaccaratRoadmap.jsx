// ===================================================================
// 🀄 BaccaratRoadmap - 중국매 로드맵 (Big Road + Bead + 중국점 1,2,3군)
// ===================================================================
// Props:
//   history: ["player"|"banker"|"tie", ...] 전체 라운드 결과 (오래된 → 최신)
// ===================================================================

import React from "react";

const MAX_ROWS = 6;

// ────────────────────────────────────────────────────
// 📊 로드맵 계산 로직
// ────────────────────────────────────────────────────

// 🎯 Big Road: 메인 로드맵 (큰 원, 연속 결과 세로 쌓임)
export function buildBigRoad(history) {
  const columns = [];
  let lastResult = null;

  for (const h of history) {
    if (h === "tie") {
      // 가장 최근 셀에 tie 카운트 추가
      if (columns.length > 0) {
        const col = columns[columns.length - 1];
        if (col.length > 0) {
          col[col.length - 1].ties = (col[col.length - 1].ties || 0) + 1;
        }
      }
      continue;
    }
    const r = h === "player" ? "P" : "B";
    if (r !== lastResult) {
      columns.push([{ result: r, ties: 0 }]);
      lastResult = r;
    } else {
      const col = columns[columns.length - 1];
      col.push({ result: r, ties: 0 });
    }
  }
  return columns;
}

// 🎯 파생 로드맵 (중국점 1,2,3군)
// offset: Big Eye=1, Small=2, Cockroach=3
export function buildDerivedRoad(bigRoad, offset) {
  const colors = [];
  for (let col = offset; col < bigRoad.length; col++) {
    for (let row = 0; row < bigRoad[col].length; row++) {
      let color;
      if (row === 0) {
        if (col < offset + 1) continue;
        const a = bigRoad[col - offset]?.length || 0;
        const b = bigRoad[col - offset - 1]?.length || 0;
        color = a === b ? "red" : "blue";
      } else {
        const prevLen = bigRoad[col - offset]?.length || 0;
        color = row < prevLen ? "red" : "blue";
      }
      colors.push(color);
    }
  }
  return colors;
}

// 색상 배열을 2D 그리드로 변환
export function colorsToGrid(colors) {
  const columns = [];
  let lastColor = null;
  for (const c of colors) {
    if (c !== lastColor) {
      columns.push([c]);
      lastColor = c;
    } else {
      const col = columns[columns.length - 1];
      col.push(c);
    }
  }
  return columns;
}

// 🎯 Bead Plate: 단순 격자 (6행 x N열)
export function buildBeadPlate(history, maxRows = MAX_ROWS) {
  const columns = [];
  let currentCol = [];
  for (const h of history) {
    currentCol.push(h);
    if (currentCol.length >= maxRows) {
      columns.push(currentCol);
      currentCol = [];
    }
  }
  if (currentCol.length > 0) columns.push(currentCol);
  return columns;
}

// 🎯 통계
export function computeStats(history) {
  let p = 0, b = 0, t = 0;
  for (const h of history) {
    if (h === "player") p++;
    else if (h === "banker") b++;
    else if (h === "tie") t++;
  }
  const total = p + b + t;
  return { p, b, t, total };
}

// ────────────────────────────────────────────────────
// 🎨 로드맵 UI 컴포넌트
// ────────────────────────────────────────────────────

export function RoadCell({ cell, type }) {
  if (type === "bead") {
    const color = cell === "player" ? "#3B82F6" : cell === "banker" ? "#E63975" : "#10B981";
    const label = cell === "player" ? "P" : cell === "banker" ? "B" : "T";
    return (
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 8, fontWeight: 900,
      }}>{label}</div>
    );
  }

  if (type === "big") {
    const isP = cell.result === "P";
    const color = isP ? "#3B82F6" : "#E63975";
    return (
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        border: `2px solid ${color}`, background: "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        {cell.ties > 0 && (
          <div style={{
            position: "absolute", width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#10B981", fontSize: 10, fontWeight: 900,
          }}>/</div>
        )}
      </div>
    );
  }

  if (type === "derived") {
    const color = cell === "red" ? "#E63975" : "#3B82F6";
    return (
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        border: `2px solid ${color}`, background: "transparent",
      }} />
    );
  }

  return null;
}

export function RoadmapView({ title, type, data }) {
  return (
    <div style={{marginBottom: 12}}>
      <div style={{fontSize: 10, color: "#D4A574", fontWeight: 700, letterSpacing: 1, marginBottom: 4}}>
        {title}
      </div>
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(212,165,116,0.2)",
        borderRadius: 6,
        padding: 6,
        overflowX: "auto",
        overflowY: "hidden",
      }}>
        <div style={{display: "flex", gap: 1, minHeight: 90}}>
          {data.length === 0 ? (
            <div style={{color: "rgba(255,255,255,0.3)", fontSize: 11, padding: "30px 10px", width: "100%", textAlign: "center"}}>
              {type === "derived" ? "데이터 쌓이는 중..." : "아직 기록 없음"}
            </div>
          ) : data.map((col, ci) => (
            <div key={ci} style={{display: "flex", flexDirection: "column", gap: 1}}>
              {col.map((cell, ri) => (
                <RoadCell key={ri} cell={cell} type={type} />
              ))}
              {Array.from({length: Math.max(0, 6 - col.length)}).map((_, i) => (
                <div key={`e-${i}`} style={{width: 14, height: 14}} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// 📦 메인 로드맵 섹션 (모든 로드맵 + 범례)
// ────────────────────────────────────────────────────

export default function BaccaratRoadmap({ history }) {
  const bigRoad = React.useMemo(() => buildBigRoad(history), [history]);
  const beadPlate = React.useMemo(() => buildBeadPlate(history), [history]);
  const bigEyeGrid = React.useMemo(() => colorsToGrid(buildDerivedRoad(bigRoad, 1)), [bigRoad]);
  const smallGrid = React.useMemo(() => colorsToGrid(buildDerivedRoad(bigRoad, 2)), [bigRoad]);
  const cockroachGrid = React.useMemo(() => colorsToGrid(buildDerivedRoad(bigRoad, 3)), [bigRoad]);

  return (
    <div style={S.roadmapSection}>
      <RoadmapView title="BEAD PLATE · 비드플레이트" type="bead" data={beadPlate} />
      <RoadmapView title="BIG ROAD · 큰 로드맵" type="big" data={bigRoad} />
      <RoadmapView title="중국점 1군 · BIG EYE ROAD" type="derived" data={bigEyeGrid} />
      <RoadmapView title="중국점 2군 · SMALL ROAD" type="derived" data={smallGrid} />
      <RoadmapView title="중국점 3군 · COCKROACH ROAD" type="derived" data={cockroachGrid} />
      <div style={S.legend}>
        <span><span style={{color:"#3B82F6"}}>●</span> P</span>
        <span><span style={{color:"#E63975"}}>●</span> B</span>
        <span><span style={{color:"#10B981"}}>●</span> T</span>
        <span style={{opacity: 0.3}}>|</span>
        <span><span style={{color:"#E63975"}}>○</span> 패턴 유지</span>
        <span><span style={{color:"#3B82F6"}}>○</span> 패턴 변화</span>
      </div>
    </div>
  );
}

const S = {
  roadmapSection: {
    marginTop: 10, padding: 12,
    background: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(212,165,116,0.2)",
    borderRadius: 12,
  },
  legend: {
    display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center",
    fontSize: 10, color: "rgba(255,255,255,0.6)",
    paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 4,
  },
};
