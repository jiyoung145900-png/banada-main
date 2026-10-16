// ===================================================================
// 카지노 그림 모음 (SVG): 입체 칩/칩 더미 · 슈 상자 · 카드 뒷면 · 52장 벡터 카드 앞면
//   바카라(BaccaratLiveTable) 와 같은 그림을 블랙잭에서도 쓰기 위해 따로 뽑아 둔 파일
// ===================================================================
import React from "react";

// ── 입체 칩/칩 더미/슈/테이블/카드 뒷면 (SVG 로 원근·두께·빛·그림자를 직접 그림) ──
// ── 입체감 있는 SVG 그림 (3D 엔진 없이 원근·두께·빛·그림자를 직접 그림) ───────────────────
const T3 = {
  1000:     { top: "#f3f4f6", mid: "#9ca3af", low: "#4b5563", rim: "#ffffff", ink: "#111827" },
  5000:     { top: "#fdba74", mid: "#ea580c", low: "#7c2d12", rim: "#ffedd5", ink: "#fff" },
  10000:    { top: "#4ade80", mid: "#16a34a", low: "#14532d", rim: "#dcfce7", ink: "#fff" },
  50000:    { top: "#60a5fa", mid: "#2563eb", low: "#1e3a8a", rim: "#dbeafe", ink: "#fff" },
  100000:   { top: "#f87171", mid: "#dc2626", low: "#7f1d1d", rim: "#fee2e2", ink: "#fff" },
  500000:   { top: "#c084fc", mid: "#9333ea", low: "#4c1d95", rim: "#f3e8ff", ink: "#fff" },
  1000000:  { top: "#fde68a", mid: "#d4a017", low: "#78350f", rim: "#fffbeb", ink: "#3b2300" },
  5000000:  { top: "#67e8f9", mid: "#0891b2", low: "#164e63", rim: "#cffafe", ink: "#fff" },
  10000000: { top: "#fdba74", mid: "#ea580c", low: "#7c2d12", rim: "#ffedd5", ink: "#fff" },
  50000000: { top: "#f9a8d4", mid: "#db2777", low: "#500724", rim: "#fce7f3", ink: "#fff" },
};
export const themeOf3D = (v) => T3[v] || T3[10000];
const lbl = (v) => (v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}K` : String(v));

// 원통형 칩 한 장 (위에서 비스듬히 본 모습). 중심 (cx, cy), 가로 반지름 rx, 두께 th
function ChipDisc({ cx, cy, rx, th, t, label, top = true, uid }) {
  const ry = rx * 0.6;                        // 비스듬히 본 타원 비율 (작은 크기에서도 입체로 보이도록 넉넉하게)
  const notch = 12;
  return (
    <g>
      {/* 옆면(두께): 위 타원과 아래 타원을 잇는 면 + 가장자리 줄무늬 */}
      <path d={`M${cx - rx} ${cy} L${cx - rx} ${cy + th} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + th} L${cx + rx} ${cy} Z`} fill={`url(#side${uid})`} />
      {Array.from({ length: notch }).map((_, i) => {
        const a0 = Math.PI * (i / notch), a1 = Math.PI * ((i + 0.5) / notch);
        const x0 = cx - rx * Math.cos(a0), x1 = cx - rx * Math.cos(a1);
        const y0 = cy + ry * Math.sin(a0), y1 = cy + ry * Math.sin(a1);
        return <path key={i} d={`M${x0} ${y0} L${x1} ${y1} L${x1} ${y1 + th} L${x0} ${y0 + th} Z`} fill={t.rim} opacity="0.85" />;
      })}
      <path d={`M${cx - rx} ${cy + th} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + th}`} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" />
      {/* 윗면 */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#top${uid})`} stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
      {top && (
        <>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (Math.PI * 2 * i) / 8;
            const px = cx + rx * 0.9 * Math.cos(a), py = cy + ry * 0.9 * Math.sin(a);
            return <ellipse key={i} cx={px} cy={py} rx={rx * 0.085} ry={ry * 0.16} fill={t.rim} opacity="0.9" transform={`rotate(${(Math.atan2(Math.sin(a) * ry, Math.cos(a) * rx) * 180) / Math.PI} ${px} ${py})`} />;
          })}
          <ellipse cx={cx} cy={cy} rx={rx * 0.74} ry={ry * 0.74} fill="none" stroke={t.rim} strokeWidth="1" strokeDasharray="3 2.4" opacity="0.85" />
          <ellipse cx={cx} cy={cy} rx={rx * 0.62} ry={ry * 0.62} fill={t.low} opacity="0.55" />
          <text x={cx} y={cy + ry * 0.2} textAnchor="middle" fontSize={rx * (label.length > 3 ? 0.34 : 0.43)} fontWeight="900" fill={t.ink} style={{ fontFamily: "Inter, Arial, sans-serif" }}>{label}</text>
          <ellipse cx={cx - rx * 0.2} cy={cy - ry * 0.35} rx={rx * 0.5} ry={ry * 0.22} fill="#fff" opacity="0.2" />
        </>
      )}
    </g>
  );
}

// 칩 더미: count 장을 위로 쌓음. value 는 맨 위 칩에 표시. size = 전체 가로 폭(px)
export function ChipStack3D({ value, count = 1, size = 40, drop = false }) {
  const t = themeOf3D(value);
  const uid = `${value}`;
  const n = Math.max(1, Math.min(5, count));
  const rx = 47, th = 11, gap = 8;
  const h = 100 + (n - 1) * 0;                 // viewBox 높이는 고정 (칩 개수가 늘면 위로 쌓이되 박스 안에 들어가도록 간격 축소)
  const step = Math.min(gap, 36 / Math.max(1, n - 1));
  const baseY = 60;
  return (
    <svg width={size} height={size} viewBox={`0 0 100 100`} data-casino-chip={value} data-stack={n}
      style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 4px 3px rgba(0,0,0,0.55))", animation: drop ? "chipDrop 0.28s cubic-bezier(.2,.9,.3,1.2)" : "none" }}>
      <defs>
        <radialGradient id={`top${uid}`} cx="38%" cy="30%" r="85%"><stop offset="0%" stopColor={t.top} /><stop offset="100%" stopColor={t.mid} /></radialGradient>
        <linearGradient id={`side${uid}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={t.low} /><stop offset="45%" stopColor={t.mid} /><stop offset="100%" stopColor={t.low} /></linearGradient>
      </defs>
      <ellipse cx="50" cy={baseY + th + 5} rx={rx * 0.98} ry={rx * 0.26} fill="rgba(0,0,0,0.4)" />
      {Array.from({ length: n }).map((_, i) => (
        <ChipDisc key={i} cx={50} cy={baseY - i * step} rx={rx} th={th} t={t} label={lbl(value)} top={i === n - 1} uid={uid} />
      ))}
    </svg>
  );
}
export const Chip3D = (p) => <ChipStack3D {...p} count={1} />;

// 슈(카드 보관 상자): 원근감 있는 상자 + 비스듬히 꽂힌 카드 더미
export function Shoe3D({ width = 120, shaking = false }) {
  return (
    <svg width={width} height={width * 0.78} viewBox="0 0 150 117" style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 8px 6px rgba(0,0,0,0.6))", animation: shaking ? "shoeShake 0.5s ease-in-out infinite" : "none" }} data-shoe3d>
      <defs>
        <linearGradient id="shoeTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7a6252" /><stop offset="100%" stopColor="#3a2c22" /></linearGradient>
        <linearGradient id="shoeFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5a463a" /><stop offset="100%" stopColor="#2a1f18" /></linearGradient>
        <linearGradient id="shoeSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#2a1f18" /><stop offset="100%" stopColor="#6a5444" /></linearGradient>
        <linearGradient id="cardEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" /><stop offset="100%" stopColor="#cfc7b8" /></linearGradient>
        <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#8a5a14" /><stop offset="50%" stopColor="#FFE08A" /><stop offset="100%" stopColor="#8a5a14" /></linearGradient>
      </defs>
      {/* 아래 그림자 */}
      <ellipse cx="78" cy="108" rx="64" ry="7" fill="rgba(0,0,0,0.5)" />
      {/* 상자 옆면 / 앞면 / 윗면 */}
      <path d="M18 52 L18 98 L110 98 L110 52 Z" fill="url(#shoeFront)" stroke="#000" strokeOpacity=".5" />
      <path d="M110 52 L138 38 L138 84 L110 98 Z" fill="url(#shoeSide)" stroke="#000" strokeOpacity=".5" />
      <path d="M18 52 L46 38 L138 38 L110 52 Z" fill="url(#shoeTop)" stroke="#000" strokeOpacity=".5" />
      {/* 금장 라인 */}
      <path d="M18 60 L110 60" stroke="url(#goldLine)" strokeWidth="1.6" />
      <path d="M110 60 L138 46" stroke="url(#goldLine)" strokeWidth="1.2" opacity="0.8" />
      {/* 카드 더미: 윗면의 홈에서 앞쪽으로 비스듬히 기울어 꽂힘 (상자 안에서 시작) */}
      <path d="M52 44 L70 31 L112 31 L94 44 Z" fill="#14100c" opacity="0.85" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${52 + i * 2.4} ${44 - i * 1.2} L${70 + i * 2.4} ${31 - i * 1.2 - 8} L${112 + i * 2.4} ${31 - i * 1.2 - 8} L${94 + i * 2.4} ${44 - i * 1.2} Z`} fill="url(#cardEdge)" stroke="#8d8576" strokeWidth="0.5" />
      ))}
      <path d="M59 43 L76 22 L118 22 L101 43 Z" fill="#7a1230" stroke="#D4A574" strokeWidth="1.1" />
      <path d="M65 40 L79 26 L110 26 L96 40 Z" fill="none" stroke="#D4A574" strokeWidth="0.7" strokeDasharray="2.5 2" opacity="0.8" />
      {/* 하이라이트 */}
      <path d="M22 54 L106 54" stroke="#fff" strokeOpacity=".12" strokeWidth="1.2" />
      <text x="64" y="84" textAnchor="middle" fontSize="9" fontWeight="900" letterSpacing="2" fill="#D4A574" style={{ fontFamily: "Georgia, serif" }}>8 DECKS</text>
    </svg>
  );
}

// 카드 뒷면: 금장 테두리 + 마름모 격자 + 가운데 문양
export function CardBack3D() {
  return (
    <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }} data-cardback>
      <defs>
        <linearGradient id="cbBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6a1638" /><stop offset="55%" stopColor="#3a0b24" /><stop offset="100%" stopColor="#1f0615" /></linearGradient>
        <pattern id="cbLattice" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 L12 0 M0 0 L0 12" stroke="#D4A574" strokeOpacity="0.28" strokeWidth="0.8" /></pattern>
        <radialGradient id="cbGloss" cx="25%" cy="15%" r="75%"><stop offset="0%" stopColor="#fff" stopOpacity="0.22" /><stop offset="60%" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#cbBg)" />
      <rect x="6" y="6" width="88" height="128" rx="5" fill="url(#cbLattice)" stroke="#D4A574" strokeWidth="1.6" />
      <rect x="11" y="11" width="78" height="118" rx="3" fill="none" stroke="#D4A574" strokeOpacity="0.55" strokeWidth="0.8" strokeDasharray="3 2.5" />
      <g transform="translate(50 70)">
        <path d="M0 -24 L16 0 L0 24 L-16 0 Z" fill="#2a0a1c" stroke="#E3B23C" strokeWidth="1.6" />
        <path d="M0 -15 L9 0 L0 15 L-9 0 Z" fill="none" stroke="#E3B23C" strokeWidth="0.9" opacity="0.8" />
        <text y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#E3B23C" style={{ fontFamily: "Georgia, serif" }}>♦</text>
      </g>
      <text x="50" y="26" textAnchor="middle" fontSize="7.5" fontWeight="900" letterSpacing="2" fill="#E3B23C" opacity="0.9" style={{ fontFamily: "Georgia, serif" }}>VIP</text>
      <text x="50" y="121" textAnchor="middle" fontSize="6" fontWeight="800" letterSpacing="2.4" fill="#E3B23C" opacity="0.75" style={{ fontFamily: "Georgia, serif" }}>BACCARAT</text>
      <rect width="100" height="140" fill="url(#cbGloss)" />
    </svg>
  );
}

// 테이블 바탕: 원근감 있는 펠트 + 나무 테두리 + 조명. 박스 크기에 맞춰 늘어나는 배경 (카드 등은 그 위에 HTML 로 올림)
export function TableBackdrop3D() {
  return (
    <svg viewBox="0 0 400 220" width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "block", borderRadius: 26 }} data-table3d>
      <defs>
        <linearGradient id="tbRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0cf85" /><stop offset="12%" stopColor="#c9993f" /><stop offset="55%" stopColor="#7a4f16" /><stop offset="100%" stopColor="#3b2308" /></linearGradient>
        <radialGradient id="tbFeltG" cx="50%" cy="38%" r="75%"><stop offset="0%" stopColor="#1f8a56" /><stop offset="55%" stopColor="#0d5a37" /><stop offset="100%" stopColor="#05301d" /></radialGradient>
        <linearGradient id="tbDepth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#000" stopOpacity="0.55" /><stop offset="14%" stopColor="#000" stopOpacity="0" /><stop offset="82%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.45" /></linearGradient>
        <radialGradient id="tbSpot" cx="50%" cy="30%" r="55%"><stop offset="0%" stopColor="#fff7c2" stopOpacity="0.32" /><stop offset="100%" stopColor="#fff7c2" stopOpacity="0" /></radialGradient>
        <pattern id="tbWeave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0 L6 6 M6 0 L0 6" stroke="#000" strokeOpacity="0.07" strokeWidth="0.6" /></pattern>
        <filter id="tbInner"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      {/* 나무 테두리 (두께감: 위가 밝고 아래가 어둡게) */}
      <rect x="0" y="0" width="400" height="220" rx="26" fill="url(#tbRail)" />
      <rect x="2" y="2" width="396" height="216" rx="24" fill="none" stroke="#fff3c4" strokeOpacity="0.5" strokeWidth="1.2" />
      {/* 펠트 */}
      <rect x="14" y="14" width="372" height="192" rx="16" fill="url(#tbFeltG)" />
      <rect x="14" y="14" width="372" height="192" rx="16" fill="url(#tbWeave)" />
      <rect x="14" y="14" width="372" height="192" rx="16" fill="url(#tbDepth)" />
      <ellipse cx="200" cy="70" rx="190" ry="90" fill="url(#tbSpot)" />
      {/* 펠트 안쪽 오목한 그림자 */}
      <rect x="14" y="14" width="372" height="192" rx="16" fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="5" filter="url(#tbInner)" />
      <rect x="14.5" y="14.5" width="371" height="191" rx="15.5" fill="none" stroke="#E3B23C" strokeOpacity="0.6" strokeWidth="1" />
      {/* 인쇄된 금색 곡선 문양 */}
      <path d="M44 168 Q200 128 356 168" fill="none" stroke="#E3B23C" strokeOpacity="0.35" strokeWidth="1.2" />
      <path d="M60 182 Q200 148 340 182" fill="none" stroke="#E3B23C" strokeOpacity="0.2" strokeWidth="1" />
    </svg>
  );
}


const FACE_RED = "#D41F26";
const FACE_BLACK = "#14141A";
const COURT_GOLD = "#E3B23C";
const COURT_SKIN = "#F6D7B8";
const COURT_INK = "#1B1B1F";

// 무늬 모양 (24x24 안에 그린 윤곽)
function SuitShape({ suit, x, y, size, flip = false, color, pip = false }) {
  const k = size / 24;
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${flip ? 180 : 0}) scale(${k}) translate(-12 -12)`}
      fill={color}
      {...(pip ? { "data-pip": suit, "data-flip": flip ? "1" : "0" } : {})}
    >
      {suit === "♥" && <path d="M12 22 C12 22 2 15.2 2 8.4 C2 5 4.5 2.6 7.6 2.6 C9.6 2.6 11.2 3.7 12 5.4 C12.8 3.7 14.4 2.6 16.4 2.6 C19.5 2.6 22 5 22 8.4 C22 15.2 12 22 12 22 Z" />}
      {suit === "♦" && <path d="M12 1 L21.5 12 L12 23 L2.5 12 Z" />}
      {suit === "♠" && <path d="M12 1.5 C12 1.5 2 9.2 2 14.6 C2 17.6 4.5 19.4 7.2 19.4 C8.9 19.4 10.4 18.7 11.3 17.4 C11.2 19.8 10.3 21.4 8.3 22.6 L15.7 22.6 C13.7 21.4 12.8 19.8 12.7 17.4 C13.6 18.7 15.1 19.4 16.8 19.4 C19.5 19.4 22 17.6 22 14.6 C22 9.2 12 1.5 12 1.5 Z" />}
      {suit === "♣" && (
        <>
          <circle cx="12" cy="7.2" r="5.2" />
          <circle cx="6.2" cy="15.2" r="5.2" />
          <circle cx="17.8" cy="15.2" r="5.2" />
          <path d="M12 12 C12.2 17.5 10.8 20.6 8.2 22.8 L15.8 22.8 C13.2 20.6 11.8 17.5 12 12 Z" />
        </>
      )}
    </g>
  );
}

// 숫자 카드 무늬 배치 (100x140 카드 기준). 세 번째 값 1 = 뒤집어 그림(아래쪽 절반)
const PL = 31, PC = 50, PR = 69;
const PIP_POS = {
  A: [[PC, 70]],
  "2": [[PC, 28], [PC, 112, 1]],
  "3": [[PC, 28], [PC, 70], [PC, 112, 1]],
  "4": [[PL, 28], [PR, 28], [PL, 112, 1], [PR, 112, 1]],
  "5": [[PL, 28], [PR, 28], [PC, 70], [PL, 112, 1], [PR, 112, 1]],
  "6": [[PL, 28], [PR, 28], [PL, 70], [PR, 70], [PL, 112, 1], [PR, 112, 1]],
  "7": [[PL, 28], [PR, 28], [PC, 49], [PL, 70], [PR, 70], [PL, 112, 1], [PR, 112, 1]],
  "8": [[PL, 28], [PR, 28], [PC, 49], [PL, 70], [PR, 70], [PC, 91, 1], [PL, 112, 1], [PR, 112, 1]],
  "9": [[PL, 28], [PR, 28], [PL, 56], [PR, 56], [PC, 70], [PL, 84, 1], [PR, 84, 1], [PL, 112, 1], [PR, 112, 1]],
  "10": [[PL, 28], [PR, 28], [PC, 42], [PL, 56], [PR, 56], [PL, 84, 1], [PR, 84, 1], [PC, 98, 1], [PL, 112, 1], [PR, 112, 1]],
};

// 그림 카드(J/Q/K) 위쪽 절반 인물 (아래쪽은 180° 돌려서 한 번 더 그림). 직접 그린 오리지널 디자인.
// 프레임(x 17~83, y 15~125)을 꽉 채우도록 크게 그리고, 가운데(y=70)에서 몸통이 자연스럽게 이어짐.
function CourtHalf({ rank, suit, robe }) {
  return (
    <g transform="translate(54 0) scale(0.84 1) translate(-50 0)">
      {/* 몸통: 가운데에서 폭이 가장 넓게 */}
      <path d="M19 70 L22 62 Q26 54 36 52 L64 52 Q74 54 78 62 L81 70 Z" fill={robe} stroke={COURT_INK} strokeWidth="0.9" />
      <path d="M22 62 Q26 54 36 52 L64 52 Q74 54 78 62" fill="none" stroke={COURT_GOLD} strokeWidth="2.6" />
      <path d="M19.5 69 L80.5 69" stroke={COURT_GOLD} strokeWidth="2.4" />
      <path d="M40 53 L50 64 L60 53" fill="none" stroke={COURT_GOLD} strokeWidth="2" />
      <SuitShape suit={suit} x={50} y={65} size={10} color={COURT_GOLD} />
      <SuitShape suit={suit} x={29} y={63} size={7} color={COURT_GOLD} />
      <SuitShape suit={suit} x={71} y={63} size={7} color={COURT_GOLD} />
      {/* 목 + 얼굴 (프레임 크기에 맞게 크게) */}
      <path d="M44 44 Q44 52 40 54 L60 54 Q56 52 56 44 Z" fill={COURT_SKIN} stroke={COURT_INK} strokeWidth="0.8" />
      <circle cx="50" cy="35" r="13" fill={COURT_SKIN} stroke={COURT_INK} strokeWidth="1" />
      {/* 머리/수염 */}
      {rank === "K" && <path d="M37.2 38 Q37.6 54 50 57.5 Q62.4 54 62.8 38 Q57 47 50 47 Q43 47 37.2 38 Z" fill="#EFEFEF" stroke={COURT_INK} strokeWidth="0.8" />}
      {rank === "Q" && <path d="M36.6 34 Q36.2 20 50 20 Q63.8 20 63.4 34 L67 52 Q61 46 60.5 37 Q50 31.5 39.5 37 Q39 46 33 52 Z" fill="#6B3F1D" stroke={COURT_INK} strokeWidth="0.8" />}
      {rank === "J" && <path d="M37 33 Q37.6 21.5 50 21.5 Q62.4 21.5 63 33 Q57 27.5 50 28.8 Q43 27.5 37 33 Z" fill="#2B1B10" stroke={COURT_INK} strokeWidth="0.8" />}
      {/* 눈/입 */}
      <circle cx="44.6" cy="35.4" r="1.4" fill={COURT_INK} />
      <circle cx="55.4" cy="35.4" r="1.4" fill={COURT_INK} />
      <path d="M41.8 32 Q44.6 30.6 47.4 32" fill="none" stroke={COURT_INK} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M52.6 32 Q55.4 30.6 58.2 32" fill="none" stroke={COURT_INK} strokeWidth="0.9" strokeLinecap="round" />
      {rank !== "K" && <path d="M46 41.2 Q50 44 54 41.2" fill="none" stroke="#8B3A3A" strokeWidth="1.1" strokeLinecap="round" />}
      {rank === "K" && <path d="M45 41.5 Q50 39.5 55 41.5" fill="none" stroke="#C9C9C9" strokeWidth="1.4" strokeLinecap="round" />}
      {/* 왕관 / 모자 */}
      {rank === "K" && (
        <>
          <polygon points="36.5,26 35,14.5 42.5,20.5 50,12 57.5,20.5 65,14.5 63.5,26" fill={COURT_GOLD} stroke={COURT_INK} strokeWidth="1" />
          <circle cx="50" cy="19.5" r="2" fill={FACE_RED} />
          <circle cx="40" cy="22.2" r="1.2" fill="#2B4C9B" />
          <circle cx="60" cy="22.2" r="1.2" fill="#2B4C9B" />
        </>
      )}
      {rank === "Q" && (
        <>
          <polygon points="38,27 36.5,18 43,22.5 50,13.5 57,22.5 63.5,18 62,27" fill={COURT_GOLD} stroke={COURT_INK} strokeWidth="1" />
          <circle cx="50" cy="18.8" r="1.9" fill={FACE_RED} />
          <circle cx="43.2" cy="24.2" r="1.3" fill="#2B4C9B" />
          <circle cx="56.8" cy="24.2" r="1.3" fill="#2B4C9B" />
        </>
      )}
      {rank === "J" && (
        <>
          <path d="M36.2 28 Q38.5 14.5 52 14.5 Q64 14.5 63.8 28 Z" fill={robe} stroke={COURT_INK} strokeWidth="1" />
          <path d="M35.6 28 L64.4 28" stroke={COURT_GOLD} strokeWidth="2.2" />
          <path d="M60 19 Q75 11 71 29" fill="none" stroke={COURT_GOLD} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

// 카드 한 장의 앞면 (rank: A,2..10,J,Q,K / suit: ♠♥♦♣)
export function PlayingCardFace({ rank, suit }) {
  if (!rank || !suit) return null;
  const red = suit === "♥" || suit === "♦";
  const color = red ? FACE_RED : FACE_BLACK;
  const robe = red ? "#C8102E" : "#24418F";
  const court = rank === "J" || rank === "Q" || rank === "K";
  const idx = (
    <g fill={color}>
      <text
        x="11" y="19" fontSize={rank === "10" ? 15 : 18} fontWeight="700"
        fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle"
        {...(rank === "10" ? { textLength: 14, lengthAdjust: "spacingAndGlyphs" } : {})}
      >{rank}</text>
      <SuitShape suit={suit} x={11} y={30} size={11} color={color} />
    </g>
  );
  return (
    <svg viewBox="0 0 100 140" width="100%" height="100%" style={{ display: "block" }} data-face={`${rank}${suit}`}>
      {idx}
      <g transform="rotate(180 50 70)">{idx}</g>
      {court ? (
        <g data-court={rank}>
          <rect x="22" y="12" width="64" height="116" rx="2.5" fill="#FFFBEF" stroke={color} strokeWidth="1.2" />
          <CourtHalf rank={rank} suit={suit} robe={robe} />
          <g transform="rotate(180 54 70)"><CourtHalf rank={rank} suit={suit} robe={robe} /></g>
        </g>
      ) : (
        (PIP_POS[rank] || []).map(([x, y, flip], i) => (
          <SuitShape key={i} suit={suit} x={x} y={y} size={rank === "A" ? 46 : 22} flip={!!flip} color={color} pip />
        ))
      )}
    </svg>
  );
}

export const fmtK = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(n));
