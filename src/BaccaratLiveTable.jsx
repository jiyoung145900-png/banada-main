// ===================================================================
// 🎰 BANADA VIP BACCARAT · LIVE v5
// ===================================================================
// 혼자: 베팅 확정 → 바로 시작 / 여러 명: 모두 확정하면 시작 (20초 뒤 자동)
// 카드: 자리(PLAYER/BANKER)별 최다 베팅자가 담당. 카드를 잡고 끄는 대로 접히고,
//       충분히 열린 채 놓으면 활짝 열려 모두에게 공개됩니다. (앞면은 담당자에게만 미리 전달)
// ===================================================================

import React, { useState, useRef, useEffect, useMemo } from "react";
import BaccaratDealer from "./BaccaratDealer";
import { computeStats, BeadPlate, RoadPanel } from "./BaccaratRoadmap";
import { speak, setVoiceEnabled, setBgmEnabled, startBGM, stopBGM } from "./BaccaratSound";
import {
  useBaccaratTable, useRoundBets, useBaccaratHistory, useMyBet,
  setBaccaratUser, joinBaccaratTable, heartbeatBaccarat, leaveBaccaratTable,
  placeBaccaratBet, startBaccarat, sitBaccarat, draftBaccarat, readyBaccarat, nudgeBaccarat, sitOutBaccarat, openBaccarat, myCardsBaccarat, revealMineBaccarat,
  serverNowMs, MIN_BET, MAX_BET,
} from "./BaccaratFirestore";

// ────────────────────────────────────────────────────
// 상수 / 유틸
// ────────────────────────────────────────────────────
const BETTING_DURATION = 20; // 2명 이상일 때만 작동 (초)
const CHIPS = [10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000];
const NEXT_PEEK = { back: "peek1", peek1: "peek2", peek2: "peek3", peek3: "revealed" };
const UNREVEALED = ["back", "peek1", "peek2", "peek3"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emptyStacks = () => ({ player: [], tie: [], banker: [], playerPair: [], bankerPair: [], perfectPair: [] });
const sum = (arr = []) => arr.reduce((s, v) => s + v, 0);

const fmtChip = (v) => (v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}K` : String(v));
const chipBg = (v) =>
  v >= 50000000 ? "linear-gradient(135deg, #F9A8D4, #9D174D)"
  : v >= 10000000 ? "linear-gradient(135deg, #FDBA74, #C2410C)"
  : v >= 5000000 ? "linear-gradient(135deg, #67E8F9, #0E7490)"
  : v >= 1000000 ? "linear-gradient(135deg, #FFF0A8, #C49A2C)"
  : v >= 500000 ? "linear-gradient(135deg, #D8B4FE, #7E22CE)"
  : v >= 100000 ? "linear-gradient(135deg, #FCA5A5, #B91C1C)"
  : v >= 50000 ? "linear-gradient(135deg, #93C5FD, #1D4ED8)"
  : "linear-gradient(135deg, #86EFAC, #15803D)";

const buzz = (pattern) => { try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} };

const injectKeyframes = () => {
  if (document.getElementById("baccarat-animations")) return;
  const style = document.createElement("style");
  style.id = "baccarat-animations";
  style.innerHTML = `
    @keyframes dealIn {
      0% { transform: translate(var(--fx, -120px), var(--fy, -130px)) rotate(-25deg) scale(0.7); opacity: 0; }
      25% { opacity: 1; }
      75% { transform: translate(3px, 3px) rotate(2deg) scale(1.02); }
      100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
    }
    @keyframes bannerSlide { 0% { opacity: 0; transform: translateY(-20px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes peekPulse { 0%, 100% { opacity: 0.7; transform: translateX(-50%) scale(1); } 50% { opacity: 1; transform: translateX(-50%) scale(1.2); } }
    @keyframes confettiFall { 0% { transform: translateY(-30px) rotate(0deg); opacity: 1; } 100% { transform: translateY(700px) rotate(720deg); opacity: 0; } }
    @keyframes shoeShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px) rotate(-1deg); } 75% { transform: translateX(2px) rotate(1deg); } }
    @keyframes shoeGlow { 0%, 100% { box-shadow: 0 0 12px rgba(212,165,116,0.3), inset 0 2px 4px rgba(0,0,0,0.6); } 50% { box-shadow: 0 0 22px rgba(212,165,116,0.7), inset 0 2px 4px rgba(0,0,0,0.6); } }
    @keyframes chipDrop { 0% { transform: translateY(-26px) scale(1.7); opacity: 0; } 70% { transform: translateY(2px) scale(0.95); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes noMoreBets { 0% { opacity: 0; transform: translate(-50%, -50%) scale(1.6); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.96); } }
    @keyframes resultRise { 0% { opacity: 0; transform: translateY(16px) scale(0.94); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes winArea { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,106,0), inset 0 0 0 rgba(255,215,106,0); } 50% { box-shadow: 0 0 22px 2px rgba(255,215,106,0.75), inset 0 0 18px rgba(255,215,106,0.25); } }
    @keyframes nudgeShake { 0%,100% { transform: translateX(0); } 15% { transform: translateX(-6px) rotate(-1deg); } 30% { transform: translateX(6px) rotate(1deg); } 45% { transform: translateX(-4px); } 60% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }
    @keyframes warnPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.0); } 50% { box-shadow: 0 0 0 4px rgba(239,68,68,0.55); } }
    @keyframes seatPulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
    @keyframes toastIn { 0% { opacity: 0; transform: translate(-50%, 10px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
  `;
  document.head.appendChild(style);
};

// ── 리벳 / 더블 / 카운트업 (순수 함수) ──────────────────────────────
// 금액 → 칩 목록 (큰 칩부터). 10K 미만은 만들 수 없으므로 무시.
export function amountToChips(amount) {
  const out = [];
  let rest = Math.max(0, Math.floor(amount));
  for (const v of [...CHIPS].sort((a, b) => b - a)) while (rest >= v) { out.push(v); rest -= v; }
  return out;
}
export const betsToStacks = (bets = {}) => {
  const s = emptyStacks();
  for (const k of Object.keys(s)) s[k] = amountToChips(bets[k] || 0);
  return s;
};
export const stacksToBets = (stacks) => {
  const b = {};
  for (const k of Object.keys(stacks)) b[k] = stacks[k].reduce((x, y) => x + y, 0);
  return b;
};
export const sumBetValues = (bets = {}) => Object.values(bets).reduce((a, b) => a + (b || 0), 0);
// 모든 베팅을 두 배로
export const doubleBets = (bets = {}) => Object.fromEntries(Object.entries(bets).map(([k, v]) => [k, (v || 0) * 2]));
// 숫자가 올라가는 연출: t(0~1) 에서의 값 (끝에서 부드럽게 멈춤)
export const countUpValue = (target, t) => Math.round(target * (1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)));

// ── 입체 칩/칩 더미/슈/테이블/카드 뒷면 (SVG 로 원근·두께·빛·그림자를 직접 그림) ──
// ── 입체감 있는 SVG 그림 (3D 엔진 없이 원근·두께·빛·그림자를 직접 그림) ───────────────────
const T3 = {
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
    <svg viewBox="0 0 400 220" width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, display: "block", borderRadius: 26 }} data-table3d>
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

// 예전 이름 유지: 칩 한 장(또는 count 장 더미)
export function CasinoChip({ value, size = 40, drop = false, count = 1 }) {
  return <ChipStack3D value={value} size={size} drop={drop} count={count} />;
}

// ── 좌석 / 다른 사람 칩 / 시작 대기 계산 (순수 함수: 서버 규칙과 똑같이 계산해야 화면과 서버가 어긋나지 않음) ──
export const MAX_SEATS = 7;
const sumOf = (b) => (b ? Object.values(b).reduce((a, v) => a + (v > 0 ? v : 0), 0) : 0);

// 자리별 정보: [{ seat, userId|null, name, total, status, mine }]  (빈 자리는 userId null)
//   status: "empty" | "thinking"(칩 올리는 중) | "confirmed"(확정, START 전) | "ready"(START 누름) | "idle"(앉아서 베팅 대기 중) | "away"(쉬는 중)
export function buildSeatList({ table, players, myId, now }) {
  const seats = (table && table.seats) || {};
  const roundBets = (table && table.roundBets) || {};
  const drafts = (table && table.drafts) || {};
  const ready = (table && table.ready) || {};
  const names = (table && table.names) || {};
  const byUser = {};
  Object.keys(seats).forEach((u) => { byUser[seats[u]] = u; });
  const list = [];
  for (let n = 1; n <= MAX_SEATS; n++) {
    const u = byUser[n] || null;
    if (!u) { list.push({ seat: n, userId: null, name: "", total: 0, status: "empty", mine: false, here: false }); continue; }
    const here = players.includes(u);                  // 접속 중인지 (자리만 보존되는 중이면 false)
    const confirmed = roundBets[u] > 0;
    const total = confirmed ? roundBets[u] : sumOf(drafts[u] && drafts[u].bets);
    const away = (table && table.sitOut) || {};
    let status = "idle";
    if (confirmed) status = ready[u] ? "ready" : "confirmed";
    else if (away[u]) status = "away";
    else if (total > 0) status = "thinking";
    list.push({ seat: n, userId: u, name: names[u] || "GUEST", total, status, mine: u === myId, here });
  }
  return list;
}

// 확정된 베팅 문서(roundBets 구독) + 아직 확정 전인 실시간 칩(drafts)을 합쳐서 영역별 목록으로
export function collectOthers({ betDocs = [], table, players, myId }) {
  const out = { player: [], banker: [], tie: [], playerPair: [], bankerPair: [], perfectPair: [] };
  const seats = (table && table.seats) || {};
  const drafts = (table && table.drafts) || {};
  const names = (table && table.names) || {};
  const confirmedUsers = new Set();
  for (const b of betDocs) {
    if (!b || b.userId === myId || b.settled) continue;
    confirmedUsers.add(b.userId);
    for (const k of Object.keys(out)) if (b.bets && b.bets[k] > 0) out[k].push({ userId: b.userId, seat: seats[b.userId] || 0, name: b.nickname || names[b.userId] || "GUEST", amount: b.bets[k], confirmed: true });
  }
  for (const u of Object.keys(drafts)) {
    if (u === myId || confirmedUsers.has(u) || !players.includes(u)) continue;      // 확정한 사람은 확정 금액만, 접속 안 한 사람의 칩은 숨김
    const d = drafts[u];
    for (const k of Object.keys(out)) if (d && d.bets && d.bets[k] > 0) out[k].push({ userId: u, seat: seats[u] || 0, name: names[u] || "GUEST", amount: d.bets[k], confirmed: false });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.seat - b.seat);
  return out;
}

// 시작을 막고 있는 사람 (서버 holdingPlayers 와 같은 규칙):
//   참여자 = 접속 중이고 앉아 있고 쉬는 중이 아닌 사람 (+ 이미 확정한 사람). 2명 미만이면 기다림 없음
export function holdingList({ table, players }) {
  const bets = (table && table.roundBets) || {};
  const ready = (table && table.ready) || {};
  const seats = (table && table.seats) || {};
  const away = (table && table.sitOut) || {};
  const required = players.filter((p) => bets[p] > 0 || (seats[p] && !away[p]));
  if (required.length < 2) return { required, confirm: [], ready: [], multi: false };
  return { required, confirm: required.filter((p) => !(bets[p] > 0)), ready: required.filter((p) => bets[p] > 0 && !ready[p]), multi: true };
}

// ── 에볼루션식 콘솔 계산 (순수 함수) ──────────────────────────────────
// 영역별 통계: 확정된 베팅 기준 합계 / 베팅 인원 / 메인 3영역(플레이어·무·뱅커) 안에서의 비율(%)
export function areaStats(betDocs = []) {
  const keys = ["player", "tie", "banker", "playerPair", "bankerPair", "perfectPair"];
  const out = Object.fromEntries(keys.map((k) => [k, { total: 0, count: 0, pct: 0 }]));
  for (const b of betDocs) {
    if (!b || b.settled || !b.bets) continue;
    for (const k of keys) if (b.bets[k] > 0) { out[k].total += b.bets[k]; out[k].count += 1; }
  }
  const main = out.player.total + out.tie.total + out.banker.total;
  if (main > 0) {
    // 합이 정확히 100 이 되도록 가장 큰 항목에 반올림 오차를 몰아줌 (화면에서 99%/101% 로 보이는 일 방지)
    const raw = ["player", "tie", "banker"].map((k) => ({ k, v: (out[k].total / main) * 100 }));
    raw.forEach((r) => { out[r.k].pct = Math.floor(r.v); });
    let rest = 100 - raw.reduce((a, r) => a + out[r.k].pct, 0);
    raw.sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)));
    for (const r of raw) { if (rest <= 0) break; if (out[r.k].total > 0) { out[r.k].pct += 1; rest -= 1; } }
  }
  return out;
}

// 슈의 결과 요약: #(판 번호) / P·B·T 횟수 / 페어 횟수  (기준 화면의 "#48 P25 B20 T3 ●4 ●1")
export function shoeSummary(entries = []) {
  let p = 0, b = 0, t = 0, pp = 0, bp = 0;
  for (const e of entries) {
    if (!e) continue;
    if (e.winner === "player") p++; else if (e.winner === "banker") b++; else if (e.winner === "tie") t++; else continue;
    if (e.sideResults && e.sideResults.playerPair) pp++;
    if (e.sideResults && e.sideResults.bankerPair) bp++;
  }
  return { round: p + b + t, p, b, t, playerPairs: pp, bankerPairs: bp };
}

// 금액 표기: 12,345 → "12.3K", 2,814,800 → "2.8M"  (좁은 칸에 총액을 넣기 위해)
export function shortMoney(n) {
  const v = Math.max(0, Math.round(n || 0));
  if (v >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(1)}K`;
  return String(v);
}

// 컨테이너 폭을 재서 넓으면 3열(에볼루션식), 좁으면 세로 배치. layout 으로 강제 가능 (테스트용)
function useWide(forced, threshold = 720) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.getBoundingClientRect().width || 0);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = forced === "wide" ? true : forced === "narrow" ? false : w >= threshold;
  return { ref, wide, width: w };
}

// 숫자가 0 에서 목표값까지 올라가는 연출
export function CountUp({ value, ms = 1100, prefix = "" }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0, t0 = null;
    const tick = (now) => {
      if (t0 === null) t0 = now;
      const t = (now - t0) / ms;
      setShown(countUpValue(value, t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span data-countup={value}>{prefix}{shown.toLocaleString()}</span>;
}

// 🎆 폭죽
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 2 + Math.random() * 2,
        color: ["#FFD700", "#FF6B9D", "#D4A574", "#10B981", "#3B82F6", "#E63975"][Math.floor(Math.random() * 6)],
        size: 6 + Math.random() * 6,
        shape: Math.random() > 0.5 ? "50%" : "0%",
      })),
    []
  );
  return (
    <div data-confetti style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10050, overflow: "hidden" }}>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute", left: `${p.left}%`, top: 0, width: p.size, height: p.size,
            background: p.color, borderRadius: p.shape,
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────
// 카드
// ────────────────────────────────────────────────────
function cardScore(card) {
  if (["J", "Q", "K", "10"].includes(card.rank)) return 0;
  if (card.rank === "A") return 1;
  return parseInt(card.rank, 10);
}
function handScore(hand) {
  return hand.reduce((s, c) => s + cardScore(c), 0) % 10;
}

// ── 카드 앞면 (벡터) ──────────────────────────────────────────────────
// 무늬/숫자/그림을 전부 SVG 로 그려서 기기·글꼴에 상관없이 똑같이 보이고, 확대해도 선명함.
// 표준 트럼프 배치: 왼쪽 위 숫자+무늬, 오른쪽 아래는 거꾸로, 아래쪽 무늬는 뒤집어 그림.
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

// ── 손으로 까는 카드 ────────────────────────────────────────────────
// 카드를 잡으면 커지고, 끄는 방향으로 접힘(fold)이 손가락을 1:1로 따라감.
// 접히는 선은 끄는 방향에 수직이라, 좌우/대각선으로 흔들면 선도 같이 돌아감.
// 충분히(55%+) 열린 채 놓으면 활짝 열리며 서버에 '열기' 요청, 덜 열렸으면 제자리로 복귀.
const CARD_W = 62;
const CARD_H = 87;
const SQUEEZE_SCALE = 2;      // 잡는 동안 카드 확대 배율 (앞면이 잘 보이게)
const SQUEEZE_GAIN = 1.1;     // 손가락 이동 → 접힘 이동 (1 = 손가락과 정확히 같은 속도)
const COMMIT_FRACTION = 0.55; // 이 비율 이상 열린 채 놓으면 활짝 열림
const FULL_POLY = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
const OPEN_POLY = "polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)";
const CORNERS = [[0, 0], [CARD_W, 0], [CARD_W, CARD_H], [0, CARD_H]];

// 카드 ∩ {(q - A)·n >= s} : 접히지 않고 남아 있는 '뒷면' 영역
export function coverPolygon(A, n, s) {
  const f = (q) => (q[0] - A[0]) * n[0] + (q[1] - A[1]) * n[1] - s;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const p = CORNERS[i];
    const q = CORNERS[(i + 1) % 4];
    const fp = f(p);
    const fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
export const revealFraction = (A, n, s) => 1 - polyArea(coverPolygon(A, n, s)) / (CARD_W * CARD_H);
const toClip = (pts) =>
  pts.length < 3
    ? OPEN_POLY
    : `polygon(${pts.map(([x, y]) => `${((x / CARD_W) * 100).toFixed(2)}% ${((y / CARD_H) * 100).toFixed(2)}%`).join(", ")})`;
// 접힘이 카드 전체를 덮는 거리
const fullFold = (A, n) => Math.max(...CORNERS.map((c) => (c[0] - A[0]) * n[0] + (c[1] - A[1]) * n[1])) + 1;

export function Card3D({ card, state, interactive = false, onCommit, highlight, fromX = -120 }) {
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const foldRef = useRef(null);
  const rafRef = useRef(0);
  const failedRef = useRef(false);
  const [fold, setFold] = useState(null);      // { A, n, s } 접힘 상태 (없으면 null)
  const [pressed, setPressed] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [localOpen, setLocalOpen] = useState(false);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  // 다음 라운드(빈 자리)가 되면 로컬 상태 초기화
  useEffect(() => {
    if (state === "empty") { setLocalOpen(false); setFold(null); foldRef.current = null; }
  }, [state]);

  const setFoldBoth = (f) => { foldRef.current = f; setFold(f); };
  const animate = (from, to, ms, step, done) => {
    cancelAnimationFrame(rafRef.current);
    // 시작 시각은 rAF 가 주는 첫 프레임 시각으로 잡음 (performance.now 와 기준이 달라도 안전)
    let t0 = null;
    const tick = (now) => {
      if (t0 === null) t0 = now;
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      step(from + (to - from) * e);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else if (done) done();
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const canGrab = interactive && state === "back" && !localOpen;

  const onPointerDown = (e) => {
    if (!canGrab) return;
    cancelAnimationFrame(rafRef.current);
    const r = rootRef.current.getBoundingClientRect();
    const lx = (e.clientX - r.left) * (CARD_W / (r.width || CARD_W));
    const ly = (e.clientY - r.top) * (CARD_H / (r.height || CARD_H));
    let A = CORNERS[0];
    let best = Infinity;
    for (const c of CORNERS) {
      const d = Math.hypot(c[0] - lx, c[1] - ly);
      if (d < best) { best = d; A = c; }
    }
    dragRef.current = { x0: e.clientX, y0: e.clientY, A, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    setFoldBoth(null);
    setPressed(true);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (Math.hypot(dx, dy) > 4) d.moved = true;
    const k = SQUEEZE_GAIN / SQUEEZE_SCALE;
    const lx = dx * k;
    const ly = dy * k;
    const len = Math.hypot(lx, ly);
    setTilt(Math.max(-8, Math.min(8, dx / 14)));
    if (len < 0.5) { setFoldBoth(null); return; }
    setFoldBoth({ A: d.A, n: [lx / len, ly / len], s: len });
  };

  const commit = (A, n, s0) => {
    failedRef.current = false;
    // 서버에 즉시 알림 (애니메이션과 동시에). 실패하면 원래대로 되돌림
    Promise.resolve(onCommit && onCommit()).catch(() => {
      failedRef.current = true;
      cancelAnimationFrame(rafRef.current);
      setLocalOpen(false);
      setFoldBoth(null);
    });
    animate(s0, fullFold(A, n), 170, (s) => setFoldBoth({ A, n, s }), () => {
      if (!failedRef.current) { setLocalOpen(true); setFoldBoth(null); }
    });
  };

  const finish = (cancelled) => {
    const d = dragRef.current;
    dragRef.current = null;
    setPressed(false);
    setTilt(0);
    if (!d) return;
    const cur = foldRef.current;
    if (!d.moved && !cancelled) {
      // 살짝 눌렀다 뗌(탭): 잡은 모서리에서 반대쪽으로 활짝 열기
      const opp = [CARD_W - d.A[0], CARD_H - d.A[1]];
      const vx = opp[0] - d.A[0];
      const vy = opp[1] - d.A[1];
      const len = Math.hypot(vx, vy);
      commit(d.A, [vx / len, vy / len], 0);
      return;
    }
    if (cur && !cancelled && revealFraction(cur.A, cur.n, cur.s) >= COMMIT_FRACTION) {
      commit(cur.A, cur.n, cur.s);
    } else if (cur) {
      // 덜 열렸으면 제자리로 복귀
      animate(cur.s, 0, 160, (s) => setFoldBoth({ ...cur, s }), () => setFoldBoth(null));
    }
  };

  if (state === "empty") return <div style={{ width: CARD_W, height: CARD_H, margin: "0 3px" }} />;

  const isOpen = state === "revealed" || localOpen;
  const folding = !!fold && fold.s > 0.5;
  const clip = isOpen ? OPEN_POLY : folding ? toClip(coverPolygon(fold.A, fold.n, fold.s)) : FULL_POLY;

  return (
    <div
      ref={rootRef}
      data-card={isOpen ? "open" : "back"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(false)}
      onPointerCancel={() => finish(true)}
      style={{
        width: CARD_W, height: CARD_H, margin: "0 3px", position: "relative",
        zIndex: pressed ? 100 : 1,
        touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
        cursor: canGrab ? (pressed ? "grabbing" : "grab") : "default",
        animation: state === "back" ? "dealIn 0.45s ease-out" : "none",
        "--fx": `${fromX}px`, "--fy": "-130px",
      }}
    >
      {canGrab && !pressed && <div style={S.peekHint}>👆</div>}

      <div
        style={{
          position: "relative", width: "100%", height: "100%", borderRadius: 6,
          transformOrigin: "center",
          transform: pressed ? `scale(${SQUEEZE_SCALE}) rotate(${tilt}deg)` : "none",
          transition: pressed ? "transform 0.12s ease-out" : "transform 0.22s ease-in",
          boxShadow: pressed
            ? "0 18px 36px rgba(0,0,0,0.7)"
            : highlight ? "0 0 20px rgba(255,215,0,0.8), 0 8px 20px rgba(0,0,0,0.6)" : "0 8px 20px rgba(0,0,0,0.6)",
        }}
      >
        {/* 앞면 (벡터 트럼프) */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: "#FFFFFF", border: "1px solid #1D1D22", boxSizing: "border-box", overflow: "hidden" }}>
          {card ? <PlayingCardFace rank={card.rank} suit={card.suit} /> : null}
        </div>
        {/* 뒷면: 접힌 만큼 잘려 나감 (자른 모서리에 그림자) */}
        <div style={{ position: "absolute", inset: 0, filter: folding ? "drop-shadow(0 3px 5px rgba(0,0,0,0.55))" : "none" }}>
          <div
            data-cover={clip}
            style={{
              position: "absolute", inset: 0, borderRadius: 6, overflow: "hidden",
              boxSizing: "border-box",
              clipPath: clip, WebkitClipPath: clip,
              transition: folding ? "none" : "clip-path 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <CardBack3D />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlacedChips({ stack }) {
  if (!stack.length) return null;
  // 같은 금액이 이어지면 한 더미로 쌓고, 금액이 달라지면 옆에 새 더미 (최대 3더미 · 더미당 최대 5장)
  const groups = [];
  for (const v of stack) { const g = groups[groups.length - 1]; if (g && g.v === v) g.n += 1; else groups.push({ v, n: 1 }); }
  const shown = groups.slice(-3);
  return (
    <div style={S.placedChips} data-placed>
      {groups.length > 3 && <span style={S.extraChipCount}>+{groups.length - 3}</span>}
      {shown.map((g, i) => (
        <span key={`${groups.length - shown.length + i}-${g.v}-${g.n}`} style={{ marginLeft: i ? -8 : 0, display: "inline-block" }}>
          <ChipStack3D value={g.v} count={g.n} size={34} drop={i === shown.length - 1} />
        </span>
      ))}
    </div>
  );
}

function BetBox({ label, sub, color, stack, onClick, disabled, compact }) {
  const total = sum(stack);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...S.betArea,
        minHeight: compact ? 84 : 124,
        borderColor: total > 0 ? color : "rgba(255,255,255,0.1)",
        background: total > 0 ? `${color}1f` : "rgba(255,255,255,0.03)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ color, fontWeight: 900, fontSize: compact ? 11 : 14, letterSpacing: 1 }}>{label}</span>
      <span style={S.betAreaSub}>{sub}</span>
      <PlacedChips stack={stack} />
      {total > 0 && <span style={S.placedAmount}>{total.toLocaleString()}</span>}
    </button>
  );
}




// ====================================================================
// 메인 컴포넌트 v4
//   혼자: 베팅 확정 → 바로 시작 / 여러 명: 모두 확정하면 시작(20초 뒤 자동)
//   카드는 자리별 담당(최다 베팅자)이 잡고 끌어서 까고, '모두 열기' 로 한 번에 열 수도 있음
// ====================================================================
const NATURAL_WAIT = 2000;
const AREA_KEYS = ["player", "banker", "tie", "playerPair", "bankerPair", "perfectPair"];
const UNREVEALED_STATES = ["back", "peek1", "peek2", "peek3"];
const STALE_MS = 30000;

export default function BaccaratLiveTable({ tableId, userId, userName, gamePoints = 0, onLeave = () => {}, onSwitchTable, layout = "auto" }) {
  const { ref: rootRef, wide, width: rootW } = useWide(layout);
  setBaccaratUser(userId, userName);
  useEffect(() => { injectKeyframes(); }, []);

  const { table, loading } = useBaccaratTable(tableId);
  const round = table?.currentRound || 1;
  const phase = table?.phase === "dealing" ? "dealing" : "betting";
  const names = table?.names || {};
  const history = useBaccaratHistory(tableId, 80);
  // 중국점/통계는 현재 슈의 기록만 사용 (새 슈를 섞으면 처음부터). 슈 정보가 없던 옛 기록은 슈 0 으로 취급
  const shoeNo = table?.shoeNo || 0;
  const winners = useMemo(() => history.filter((h) => (h.shoeNo || 0) === shoeNo).map((h) => h.winner), [history, shoeNo]);
  const stats = useMemo(() => computeStats(winners), [winners]);
  const roundBets = useRoundBets(tableId, round);
  const myCommitted = useMyBet(userId, tableId, round);
  const lastBet = useMyBet(userId, tableId, table?.lastResultRound || 0);   // 방금 끝난 판의 내 베팅 (정산 결과 포함)

  // 서버 시각 기준 시계
  const [now, setNow] = useState(serverNowMs());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNowMs()), 250);
    return () => clearInterval(id);
  }, []);

  // 접속 중인 플레이어 (하트비트 30초 끊기면 제외, 나 자신은 항상 포함)
  const players = (table?.players || []).filter(
    (u) => u === userId || (table?.playerSeen?.[u] || 0) >= now - STALE_MS
  );
  if (!players.includes(userId)) players.push(userId);
  const multi = players.length > 1;

  // ── 로컬 UI 상태 ──
  const [selectedChip, setSelectedChip] = useState(CHIPS[0]);
  const [desired, setDesired] = useState(emptyStacks);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [showRoadmap, setShowRoadmap] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [bgmOn, setBgmOn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const toastTimer = useRef(null);
  const audioRef = useRef(null);
  const resultInit = useRef(false);
  const announcedRef = useRef(0);                       // 내 결과를 이미 보여준 라운드
  const joinedAtRound = useRef(null);                   // 입장 시점의 마지막 결과 라운드 (그 이전 판은 발표 대상 아님)
  const [myResult, setMyResult] = useState(null);       // { round, net, payout, total }
  const [sessionNet, setSessionNet] = useState(0);      // 이 테이블에서의 누적 손익
  const [lastBets, setLastBets] = useState(null);       // 직전에 확정한 베팅 (리벳용)
  const lastSeenResult = useRef(0);

  const showToast = (m) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  // ── 사운드 ──
  const playSound = (type) => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const t = ctx.currentTime;
      const tone = (f1, f2, s, d, v, wave = "triangle") => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = wave; o.frequency.setValueAtTime(f1, s);
        if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, s + d);
        g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(0.001, s + d);
        o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + d + 0.02);
      };
      if (type === "deal") tone(520, 180, t, 0.1, 0.12);
      else if (type === "chip") tone(900, 600, t, 0.05, 0.05, "square");
      else if (type === "peek") tone(700, 520, t, 0.07, 0.08, "sine");
      else if (type === "reveal") tone(400, 800, t, 0.16, 0.1);
      else if (type === "win") [523, 659, 784, 1047].forEach((f, i) => tone(f, f, t + i * 0.1, 0.22, 0.1));
    } catch (e) {}
  };
  const speakDealer = (text) => { if (voiceOn) speak(text); };
  useEffect(() => { if (bgmOn) startBGM(); else stopBGM(); return () => stopBGM(); }, [bgmOn]);

  // ── 베팅 집계 ──
  const sum = (a = []) => a.reduce((s, v) => s + v, 0);
  const desiredTotal = AREA_KEYS.reduce((s, k) => s + sum(desired[k]), 0);
  const mainDesired = sum(desired.player) + sum(desired.banker) + sum(desired.tie);
  const committedTotal = myCommitted && !myCommitted.settled ? myCommitted.totalBet || 0 : 0;
  // 화면 포인트 = DB 포인트 - (확정 이후 추가로 올려둔 칩). 확정분은 이미 DB 에서 차감됨
  const shownPoints = gamePoints - Math.max(0, desiredTotal - committedTotal);

  // 다른 플레이어가 확정한 영역별 금액

  // 시작을 막고 있는 사람 (서버의 시작 조건과 같은 규칙으로 계산)
  const confirmedMap = table?.roundBets || {};
  const hold = useMemo(() => holdingList({ table, players }), [table, players.join("|")]);
  const thinking = hold.confirm.filter((u) => u !== userId);               // 확정을 아직 안 한 다른 사람
  const waitingReady = hold.ready;                                         // 확정했지만 START 를 안 누른 사람 (나 포함)
  const iAmReady = !!(table?.ready || {})[userId];
  const needStart = hold.multi && committedTotal > 0;                      // 2명 이상 → 확정 뒤 START 를 눌러야 함
  const seatList = useMemo(() => buildSeatList({ table, players, myId: userId, now }), [table, players.join("|"), userId, Math.floor(now / 1000)]);
  const mySeat = (table?.seats || {})[userId] || 0;
  const iAmAway = !!(table?.sitOut || {})[userId];                          // 쉬는 중 (다른 사람의 시작을 기다리게 하지 않음)
  const stat = useMemo(() => areaStats(roundBets), [roundBets]);           // 영역별 합계/인원/비율 (모든 플레이어의 확정 베팅)
  const shoeEntries = useMemo(() => history.filter((h) => (h.shoeNo || 0) === (table?.shoeNo || 0)), [history, table?.shoeNo]);
  const summary = useMemo(() => shoeSummary(shoeEntries), [shoeEntries]);
  const spectator = !!table && !mySeat;                                    // 자리가 없으면 관전
  const others = useMemo(() => collectOthers({ betDocs: roundBets, table, players, myId: userId }), [roundBets, table, players.join("|"), userId]);
  const endsAt = table?.bettingEndsAt || 0;
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;
  const bettingClosed = !!endsAt && now >= endsAt;
  const iHoldUp = hold.multi && phase === "betting" && (hold.confirm.includes(userId) || hold.ready.includes(userId));   // 내가 시작을 막고 있음
  const warnSeconds = endsAt && !bettingClosed ? Math.ceil((endsAt - now) / 1000) : null;
  const showWarn = iHoldUp && warnSeconds !== null && warnSeconds <= 10;

  // ── 슈(8덱) 상태 ──
  const shoePos = table?.shoePos || 0, shoeCut = table?.shoeCut || 0;
  const shuffleUntil = table?.shuffleUntil || 0;
  // 결과 연출(약 5.5초)이 끝난 뒤부터 셔플 안내를 보여줌. 베팅은 셔플이 끝날 때까지 막힘
  const shuffling = shuffleUntil > 0 && now < shuffleUntil;
  const showShuffle = shuffling && now - (table?.lastActionAt || 0) > 5500;
  const shuffleLeft = shuffling ? Math.max(0, Math.ceil((shuffleUntil - now) / 1000)) : 0;
  const lastHandOfShoe = shoeNo > 0 && shoePos >= shoeCut;          // 컷카드를 넘긴 판 = 이 슈의 마지막 판

  // ── 입장 / 하트비트 / 퇴장 ──
  const engagedRef = useRef(false);
  engagedRef.current = desiredTotal > 0 || committedTotal > 0;
  useEffect(() => {
    if (!tableId || !userId) return;
    joinBaccaratTable(tableId).catch((e) => console.error("[Baccarat] 입장 실패:", e));
    const hb = setInterval(() => heartbeatBaccarat(tableId, engagedRef.current), 10000);
    return () => { clearInterval(hb); leaveBaccaratTable(tableId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, userId]);

  // 실시간 칩: 올려둔 칩이 바뀌면 0.35초 뒤 다른 플레이어 화면에 보이도록 전송 (돈은 확정해야 움직임)
  const draftKey = JSON.stringify(stacksToBets(desired));
  const lastDraftSent = useRef("{}");
  useEffect(() => {
    if (phase !== "betting" || committedTotal > 0 || spectator || shuffling) return;
    if (draftKey === lastDraftSent.current) return;
    const id = setTimeout(() => { lastDraftSent.current = draftKey; draftBaccarat(tableId, JSON.parse(draftKey)); }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, phase, committedTotal, spectator, shuffling, tableId]);
  // 새 판이 시작되면 전송 기록 초기화
  useEffect(() => { lastDraftSent.current = "{}"; }, [round]);

  // 라운드가 바뀌면 작성 중인(미확정) 칩 초기화
  useEffect(() => { setDesired(emptyStacks()); }, [round]);

  // ── 확정 후 시작 대기: 2.5초마다 시작 요청 (서버가 조건을 판단, 여러 번 불러도 안전) ──
  const waitingStart = phase === "betting" && committedTotal > 0;
  useEffect(() => {
    if (!waitingStart) return;
    const id = setInterval(() => { startBaccarat(tableId).catch(() => {}); }, 2500);
    return () => clearInterval(id);
  }, [waitingStart, tableId, round]);

  // ── 딜링 연출 (서버 시각 기준 → 모든 화면이 같은 타이밍) ──
  const dealAt = table?.deal?.dealAt || 0;
  const elapsed = phase === "dealing" && dealAt ? now - dealAt : 0;
  const drawn = table?.drawn || { p: 2, b: 2 };
  const peek = table?.peek || { p: [0, 0, 0], b: [0, 0, 0] };
  const revealV = table?.reveal || { p: [null, null, null], b: [null, null, null] };

  const shownCount = (side) => {
    const th = side === "p" ? [500, 1600] : [1050, 2150];
    const n = elapsed >= th[1] ? 2 : elapsed >= th[0] ? 1 : 0;
    return Math.min(n, drawn[side]);
  };
  const cardStates = (side) => {
    const cnt = shownCount(side);
    const arr = [];
    for (let i = 0; i < 3; i++) {
      if (i >= drawn[side]) { arr.push("empty"); continue; }
      if (i < 2 && i >= cnt) { arr.push("empty"); continue; }
      arr.push((peek[side][i] ?? 0) >= 4 ? "revealed" : "back");
    }
    return arr;
  };

  // 라운드가 끝난 직후 6초 동안은 직전 결과 카드를 보여줌 (그 뒤엔 빈 자리)
  const lastRes = table?.lastResult;
  const fresh = !!lastRes && now - (table?.lastActionAt || 0) < 6000;
  const pStates = phase === "dealing" ? cardStates("p") : fresh ? lastRes.playerCards.map(() => "revealed") : ["empty", "empty", "empty"];
  const bStates = phase === "dealing" ? cardStates("b") : fresh ? lastRes.bankerCards.map(() => "revealed") : ["empty", "empty", "empty"];
  const pVals = phase === "dealing" ? revealV.p : fresh ? lastRes.playerCards : [];
  const bVals = phase === "dealing" ? revealV.b : fresh ? lastRes.bankerCards : [];
  const hasUnrevealed = [...pStates, ...bStates].some((s) => UNREVEALED_STATES.includes(s));

  // 내추럴(처음 두 장이 8·9)도 자동으로 열지 않음: 모든 판에서 담당 플레이어가 직접 카드를 까야 함.
  //   (예전에는 딜링이 끝나는 순간 서버에 '내추럴이면 열어줘' 를 보내서 10판 중 3~4판은 스퀴즈를 못 했음)
  //   내추럴은 양쪽 카드를 다 열면 3번째 카드 없이 바로 끝남.

  // 새 슈 알림: 입장한 뒤 슈 번호가 올라가면 안내
  const seenShoe = useRef(null);
  useEffect(() => {
    if (!table) return;
    const no = table.shoeNo || 0;
    if (seenShoe.current === null) { seenShoe.current = no; return; }
    if (no > seenShoe.current) {
      seenShoe.current = no;
      showToast(`🔀 새 슈 #${no} · 카드를 섞습니다 (중국점 초기화)`);
      speakDealer("Shuffling. New shoe.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.shoeNo]);

  // 재촉 받기: 누군가 나를 재촉하면 흔들림 + 경고 + 진동 (같은 재촉은 한 번만)
  const lastPokeSeen = useRef(0);
  const [shake, setShake] = useState(false);
  const myPoke = (table?.pokes || {})[userId];
  useEffect(() => {
    if (!myPoke || myPoke.at <= lastPokeSeen.current) return;
    if (lastPokeSeen.current === 0 && now - myPoke.at > 15000) { lastPokeSeen.current = myPoke.at; return; }   // 입장 전에 있던 오래된 재촉은 무시
    lastPokeSeen.current = myPoke.at;
    showToast(`⏰ ${myPoke.name} 님이 재촉했어요! ${hold.confirm.includes(userId) ? "베팅을 확정" : "START"}해 주세요`);
    buzz([60, 40, 60]); playSound("peek");
    setShake(true); setTimeout(() => setShake(false), 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPoke && myPoke.at]);

  // 새 판이 딜링을 시작하면 이전 판 결과 패널을 닫음
  useEffect(() => { if (phase === "dealing") setMyResult(null); }, [phase]);

  // 딜링 시작 멘트
  const lastDealVoice = useRef(0);
  useEffect(() => {
    if (phase === "dealing" && dealAt && lastDealVoice.current !== dealAt) {
      lastDealVoice.current = dealAt;
      speakDealer("Dealing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dealAt]);

  // 결과 발표 (입장 시점의 과거 결과는 무음 처리)
  useEffect(() => {
    const r = table?.lastResultRound;
    if (!r) return;
    if (!resultInit.current) { resultInit.current = true; lastSeenResult.current = r; joinedAtRound.current = r; return; }
    if (lastSeenResult.current === r) return;
    lastSeenResult.current = r;
    const w = table.lastResult?.winner;
    speakDealer(w === "player" ? "Player wins" : w === "banker" ? "Banker wins" : "Tie");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.lastResultRound]);

  // 내 결과: 서버가 정산을 마친 내 베팅 기록이 도착하면 한 번만 발표 (이겼을 때만 사운드/폭죽/진동)
  useEffect(() => {
    const r = table?.lastResultRound;
    if (!r || !resultInit.current || !lastBet || lastBet.round !== r || !lastBet.settled) return;
    if (joinedAtRound.current !== null && r <= joinedAtRound.current) return;   // 입장하기 전에 끝난 판
    if (announcedRef.current === r) return;
    announcedRef.current = r;
    const net = lastBet.net || 0;
    setMyResult({ round: r, net, payout: lastBet.payout || 0, total: lastBet.totalBet || 0 });
    setSessionNet((v) => v + net);
    if (net > 0) {
      playSound("win");
      buzz([30, 40, 30, 40, 60]);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3200);
    } else if (net < 0) { playSound("peek"); }
    const id = setTimeout(() => setMyResult((cur) => (cur && cur.round === r ? null : cur)), 9000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastBet, table?.lastResultRound]);

  // ── 카드 담당 (서버와 같은 규칙: 자리별 최다 베팅자, 없으면 누구나) ──
  const ownerOf = (k) => {
    const own = (table?.areaOwn || {})[k] || {};
    const order = table?.betOrder || {};
    const list = Object.keys(own)
      .filter((u) => own[u] > 0 && players.includes(u))
      .sort((a, b) => own[b] - own[a] || (order[a] || 0) - (order[b] || 0));
    return list.length ? list[0] : null;
  };
  const ownerP = ownerOf("p");
  const ownerB = ownerOf("b");
  const squeezeOpen = phase === "dealing" && elapsed >= NATURAL_WAIT;
  const canSqueeze = (side) => {
    if (!squeezeOpen) return false;
    const o = side === "p" ? ownerP : ownerB;
    return o === userId || o === null;
  };
  const ownerLabel = (side) => {
    const o = side === "p" ? ownerP : ownerB;
    if (!o) return "누구나 깔 수 있음";
    return o === userId ? "👉 내가 깝니다" : `🫴 ${names[o] || "플레이어"} 님이 깝니다`;
  };
  const sideHasUnrevealed = (side) => (side === "p" ? pStates : bStates).some((s) => UNREVEALED_STATES.includes(s));
  const canRevealMine = squeezeOpen && ((canSqueeze("p") && sideHasUnrevealed("p")) || (canSqueeze("b") && sideHasUnrevealed("b")));

  // ── 카드 열기 ──
  //   끄는 동작은 Card3D 안에서 손가락을 1:1 로 따라가고, 충분히 열린 채 놓으면 onCommit → 서버에 '열기'
  const openCard = async (side, idx) => {
    playSound("reveal");
    try { await openBaccarat(tableId, side === "p" ? "player" : "banker", idx); }
    catch (e) { showToast(e.message || "열기 실패"); throw e; }
  };

  // 내가 깔 수 있는 카드의 실제 앞면 (서버가 담당자에게만 내려줌 → 다른 사람은 열기 전까지 못 봄)
  const [faces, setFaces] = useState({ round: 0, p: null, b: null });
  useEffect(() => {
    if (phase !== "dealing" || !dealAt) { setFaces({ round: 0, p: null, b: null }); return; }
    let dead = false;
    myCardsBaccarat(tableId)
      .then((r) => { if (!dead && r && r.round === round) setFaces({ round: r.round, p: r.p, b: r.b }); })
      .catch(() => {});
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dealAt, drawn.p, drawn.b, ownerP, ownerB, tableId]);
  // 공개된 카드는 모두에게 보이는 값, 아직 안 열린 카드는 내가 담당일 때만 내 앞면
  const faceOf = (side, i) => (revealV[side][i] || (faces[side] && faces[side][i])) || undefined;

  const revealMine = async () => {
    if (!canRevealMine) return;
    playSound("reveal");
    try { await revealMineBaccarat(tableId); }
    catch (e) { showToast(e.message || "공개 실패"); }
  };

  // ── 칩 조작 (작성 중인 것만 - 확정 전까지 서버에 없음) ──
  const placeChip = (target) => {
    if (phase !== "betting" || busy || bettingClosed) return;
    if (desiredTotal + selectedChip > MAX_BET) return showToast(`최대 베팅 ${MAX_BET.toLocaleString()}`);
    if (shownPoints < selectedChip) return showToast("포인트가 부족합니다");
    playSound("chip");
    buzz(8);
    if (desiredTotal === 0 && committedTotal === 0) heartbeatBaccarat(tableId, true); // "칩 만지는 중" 즉시 알림
    setDesired((prev) => ({ ...prev, [target]: [...prev[target], selectedChip] }));
  };
  const removeLastChip = () => {
    setDesired((prev) => {
      const next = { ...prev };
      for (const k of [...AREA_KEYS].reverse()) if (next[k].length) { next[k] = next[k].slice(0, -1); break; }
      return next;
    });
  };
  // 리벳: 직전에 확정한 베팅 그대로 다시 올림 (확정은 따로 눌러야 서버에 들어감)
  const rebet = () => {
    if (phase !== "betting" || busy || bettingClosed || !lastBets) return;
    const total = sumBetValues(lastBets);
    if (total > MAX_BET) return showToast(`최대 베팅 ${MAX_BET.toLocaleString()}`);
    if (total - committedTotal > gamePoints) return showToast("포인트가 부족합니다");
    playSound("chip"); buzz(12);
    if (desiredTotal === 0 && committedTotal === 0) heartbeatBaccarat(tableId, true);
    setDesired(betsToStacks(lastBets));
  };
  // 더블: 지금 올려둔 베팅을 전부 두 배로
  const doubleDesired = () => {
    if (phase !== "betting" || busy || bettingClosed || desiredTotal === 0) return;
    const doubled = doubleBets(stacksToBets(desired));
    const total = sumBetValues(doubled);
    if (total > MAX_BET) return showToast(`최대 베팅 ${MAX_BET.toLocaleString()}`);
    if (total - committedTotal > gamePoints) return showToast("포인트가 부족합니다");
    playSound("chip"); buzz(12);
    setDesired(betsToStacks(doubled));
  };
  const clearDesired = () => {
    setDesired(emptyStacks());
    if (committedTotal === 0) heartbeatBaccarat(tableId, false);
  };

  // ── 베팅 확정: 서버가 한도·잔액·마감 검증 → 곧바로 시작 요청 ──
  //   혼자이거나 칩 만지는 사람 전원이 확정했으면 서버가 바로 시작, 아니면 기다림
  const confirmBet = async () => {
    if (busy) return;
    const bets = {}; AREA_KEYS.forEach((k) => (bets[k] = sum(desired[k])));
    const total = AREA_KEYS.reduce((s, k) => s + bets[k], 0);
    if (bets.player + bets.banker + bets.tie <= 0) return showToast("PLAYER / BANKER / TIE 중 한 곳에 베팅하세요");
    if (total < MIN_BET) return showToast(`최소 베팅 ${MIN_BET.toLocaleString()}`);
    setBusy(true);
    try {
      await placeBaccaratBet({ tableId, bets });
      setLastBets({ ...bets });
    } catch (err) {
      showToast(err.message || "베팅 실패");
      setBusy(false);
      return;
    }
    try {
      const r = await startBaccarat(tableId);
      if (r && r.waiting) showToast("다른 플레이어의 확정을 기다리는 중...");
    } catch (e) { /* 2.5초 후 자동 재시도 */ }
    setBusy(false);
  };

  // START(준비): 2명 이상이면 모두 눌러야 시작. 다시 누르면 취소
  const toggleReady = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const on = !iAmReady;
      await readyBaccarat(tableId, on);
      if (on) { const r = await startBaccarat(tableId).catch(() => null); if (r && r.waiting) showToast(r.waitingFor?.length ? `다른 플레이어를 기다리는 중 (${hold.required.length - r.waitingFor.length}/${hold.required.length} 준비)` : "기다리는 중"); }
    } catch (e) { showToast(e.message || "실패"); }
    setBusy(false);
  };
  const toggleSitOut = async () => {
    try {
      await sitOutBaccarat(tableId, !iAmAway);
      showToast(!iAmAway ? "☕ 쉬는 중 · 다른 플레이어가 기다리지 않아요 (칩을 올리면 복귀)" : "복귀했어요");
    } catch (e) { showToast(e.message || "실패"); }
  };
  const nudge = async (targetId) => {
    try { await nudgeBaccarat(tableId, targetId); showToast(`⏰ ${(table?.names || {})[targetId] || "플레이어"} 님을 재촉했어요`); playSound("chip"); }
    catch (e) { showToast(e.message || "재촉 실패"); }
  };
  const sitAt = async (n) => {
    try { await sitBaccarat(tableId, n); showToast(`${n}번 자리에 앉았어요`); playSound("chip"); }
    catch (e) { showToast(e.message || "자리 이동 실패"); }
  };

  // 지금 시작 (자동 시작이 안 됐을 때를 위한 수동 버튼)
  const startNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await startBaccarat(tableId);
      if (r && r.waiting) showToast(r.reason || "아직 시작할 수 없습니다");
    } catch (e) { showToast(e.message || "시작 실패"); }
    setBusy(false);
  };

  // ── 표시용 값 ──
  const revealedScore = (side) => {
    const vals = [0, 1, 2].filter((i) => (peek[side][i] ?? 0) === 4 && revealV[side][i]).map((i) => revealV[side][i]);
    return vals.length ? handScore(vals) : "-";
  };
  const displayP = phase === "dealing" ? revealedScore("p") : fresh ? lastRes.playerValue : "-";
  const displayB = phase === "dealing" ? revealedScore("b") : fresh ? lastRes.bankerValue : "-";
  const roundLabel = `${tableId === "table1" ? "T1" : "T2"}-#${round}`;

  const dealerMessage = (() => {
    if (shuffling && phase === "betting" && showShuffle) return "SHUFFLING...";
    if (phase === "dealing") return hasUnrevealed ? "SQUEEZE YOUR CARDS!" : "DEALING...";
    if (committedTotal > 0) return thinking.length ? "WAITING FOR OTHERS" : "BET PLACED";
    if (fresh) return lastRes.winner === "player" ? "PLAYER WINS" : lastRes.winner === "banker" ? "BANKER WINS" : "TIE";
    return "PLACE YOUR BETS";
  })();

  const statusLine = (() => {
    if (shuffling && phase === "betting") return `🔀 새 슈를 섞는 중 · ${shuffleLeft}초 뒤 베팅할 수 있어요`;
    if (phase === "dealing") return elapsed < NATURAL_WAIT ? "🎴 카드 딜링 중..." : "🎴 카드를 잡고 원하는 방향으로 끌어서 열어보세요";
    if (committedTotal > 0 && thinking.length) {
      return `⏳ ${thinking.map((u) => names[u] || "플레이어").join(", ")} 님의 베팅 확정을 기다리는 중${secondsLeft !== null ? ` · ${secondsLeft}초` : ""}`;
    }
    if (needStart) {
      const others2 = waitingReady.filter((u) => u !== userId);
      if (!iAmReady) return `▶ START 를 눌러주세요 · ${hold.required.length - waitingReady.length}/${hold.required.length} 준비${secondsLeft !== null ? ` · ${secondsLeft}초` : ""}`;
      return `✅ 준비 완료 · ${others2.map((u) => names[u] || "플레이어").join(", ")} 님의 START 를 기다리는 중${secondsLeft !== null ? ` · ${secondsLeft}초` : ""}`;
    }
    if (committedTotal > 0) return "✅ 베팅 확정 · 곧 시작합니다";
    if (endsAt) return `⏰ 다른 플레이어가 베팅 확정함 · ${secondsLeft}초 안에 베팅하세요`;
    return multi ? "💭 칩을 놓고 베팅 확정을 누르세요 · 모두 확정하면 바로 시작" : "💭 칩을 놓고 베팅 확정을 누르면 바로 시작합니다";
  })();

  if (loading) {
    return (
      <div style={{ ...S.container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎰</div>
        <div style={{ color: "#D4A574", fontSize: 13, letterSpacing: 2 }}>테이블 입장 중...</div>
      </div>
    );
  }

  const bettingOpen = phase === "betting" && !bettingClosed && !shuffling;
  // 방금 끝난 판의 당첨 자리 (6초간 강조)
  const winAreas = fresh && lastRes ? new Set([lastRes.winner, lastRes.sideResults?.playerPair && "playerPair", lastRes.sideResults?.bankerPair && "bankerPair", lastRes.sideResults?.perfectPair && "perfectPair"].filter(Boolean)) : new Set();

  // ── 영역별 조각 (넓은 화면 / 좁은 화면에서 같은 조각을 다른 위치에 놓음) ──
  const topBar = (
    <div style={S.topBar} data-topbar>
      <button onClick={() => onLeave()} style={S.topBack} aria-label="lobby">←</button>
      <div style={S.topTitleBox}>
        <div style={S.topTitle}>스퀴즈 바카라</div>
        <div style={S.topSub}>
          <span style={S.tableTag}><span style={S.liveDot}>●</span> {tableId === "table1" ? "TABLE 1" : "TABLE 2"} · LIVE · {players.length}명</span>
          <span style={{ opacity: 0.7 }} title={`${MIN_BET.toLocaleString()} ~ ${MAX_BET.toLocaleString()}`}>💎 {shortMoney(MIN_BET)}~{shortMoney(MAX_BET)}</span>
        </div>
      </div>
      <div style={S.topRight}>
        {sessionNet !== 0 && (
          <span data-session style={{ ...S.sessionChip, color: sessionNet > 0 ? "#86EFAC" : "#FCA5A5", borderColor: sessionNet > 0 ? "rgba(134,239,172,0.4)" : "rgba(252,165,165,0.4)" }}>
            {sessionNet > 0 ? "+" : "-"}{Math.abs(sessionNet).toLocaleString()}
          </span>
        )}
        {onSwitchTable && (
          <button onClick={() => onSwitchTable(tableId === "table1" ? "table2" : "table1")} data-switch style={S.toggleBtn} title="다른 테이블로">⇄</button>
        )}
        <button onClick={() => { setVoiceOn((v) => !v); setVoiceEnabled(!voiceOn); }} style={S.toggleBtn}>{voiceOn ? "🔊" : "🔇"}</button>
        <button onClick={() => { setBgmOn((v) => !v); setBgmEnabled(!bgmOn); }} style={S.toggleBtn}>{bgmOn ? "🎵" : "🎶"}</button>
        <div style={S.points}>💎 {shownPoints.toLocaleString()}</div>
      </div>
    </div>
  );

  const dealerEl = (
    <BaccaratDealer phase={phase} message={dealerMessage} roundNumber={roundLabel} playerCount={players.length}
        speaking={phase === "dealing"} noMoreBets={bettingClosed} />
  );
  const statusEl = (
    <>
      {showWarn && (
        <div data-warn style={S.warnBanner}>
          ⏰ {warnSeconds}초 뒤 자동으로 시작돼요 · {hold.confirm.includes(userId) ? "베팅을 확정하지 않으면 이번 판에서 제외돼요" : "START 를 눌러주세요"}
        </div>
      )}
      <div style={S.timerBar}>
        <div style={{ ...S.timerFill, width: phase === "betting" && endsAt ? `${Math.max(0, Math.min(100, ((endsAt - now) / 20000) * 100))}%` : "100%" }} />
        <div style={S.timerText}>{statusLine}</div>
      </div>
    </>
  );
  // 남은 카드 수·컷카드·번 카드는 보여주지 않음. 슈의 마지막 판일 때만 작은 안내 뱃지
  const shoeEl = lastHandOfShoe ? (
    <div data-shoe data-last-hand style={S.lastHandBadge}>🔔 LAST HAND · 이 판이 끝나면 새 슈를 섞어요</div>
  ) : null;
  const stageEl = (
    <>
      <div style={S.tableArea}>
        <div style={S.shoe3d}>
          <Shoe3D width={104} shaking={(phase === "dealing" && elapsed < 2200) || showShuffle} />
        </div>

        <div style={S.tableFelt3d}>
          <TableBackdrop3D />
          <div style={{ ...S.playerSide, position: "relative", zIndex: 2 }}>
            <div style={S.sideTitle}>PLAYER</div>
            {phase === "dealing" && <div style={S.ownerTag}>{ownerLabel("p")}</div>}
            <div style={S.cardsContainer}>
              {pStates.map((st, i) => (
                <Card3D key={`p${i}`} state={st} fromX={-60}
                  card={phase === "dealing" ? faceOf("p", i) : pVals[i]}
                  interactive={canSqueeze("p") && st === "back" && !!faceOf("p", i)}
                  onCommit={() => openCard("p", i)}
                  highlight={fresh && phase === "betting" && lastRes.winner === "player"} />
              ))}
            </div>
            <div style={S.scoreBox}>{displayP}</div>
          </div>
          <div style={{ ...S.vsText, position: "relative", zIndex: 2 }}>VS</div>
          <div style={{ ...S.bankerSide, position: "relative", zIndex: 2 }}>
            <div style={{ ...S.sideTitle, color: "#E63975" }}>BANKER</div>
            {phase === "dealing" && <div style={S.ownerTag}>{ownerLabel("b")}</div>}
            <div style={S.cardsContainer}>
              {bStates.map((st, i) => (
                <Card3D key={`b${i}`} state={st} fromX={-230}
                  card={phase === "dealing" ? faceOf("b", i) : bVals[i]}
                  interactive={canSqueeze("b") && st === "back" && !!faceOf("b", i)}
                  onCommit={() => openCard("b", i)}
                  highlight={fresh && phase === "betting" && lastRes.winner === "banker"} />
              ))}
            </div>
            <div style={{ ...S.scoreBox, color: "#E63975", borderColor: "rgba(230,57,117,0.3)" }}>{displayB}</div>
          </div>
        </div>

        {phase === "dealing" && elapsed < 1600 && (
          <div data-nomore style={S.noMoreBets}>NO MORE BETS</div>
        )}
        {showShuffle && phase === "betting" && (
          <div data-shuffle style={S.shuffleBanner}>
            <div style={{ fontSize: 22, letterSpacing: 4 }}>🔀 SHUFFLING</div>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginTop: 4 }}>새 슈 #{shoeNo} · 8덱 · {shuffleLeft}초 뒤 베팅 시작</div>
          </div>
        )}

        {fresh && phase === "betting" && (
          <div style={S.resultOverlay}>
            <div style={{ ...S.resultBanner, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.9), transparent)" }}>
              <div style={S.resultTitle}>{lastRes.winner === "player" ? "PLAYER WINS" : lastRes.winner === "banker" ? "BANKER WINS" : "TIE"}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
  const seatsEl = (
    <>
      {/* ── 좌석 (실제 바카라 테이블처럼 7자리) ── */}
      <div style={S.seatBar} data-seatbar>
        {seatList.map((st) => {
          const color = st.status === "ready" ? "#34D399" : st.status === "confirmed" ? "#FFD76A" : st.status === "thinking" ? "#F59E0B" : st.status === "idle" && st.here && hold.multi ? "#F87171" : "rgba(255,255,255,0.25)";
          const label = st.status === "ready" ? "READY" : st.status === "confirmed" ? "확정" : st.status === "thinking" ? "베팅중…" : st.status === "away" ? "쉬는 중" : st.userId ? (st.here ? (hold.multi && !st.mine ? "베팅 대기" : "대기") : "자리비움") : "빈 자리";
          const canNudge = st.userId && !st.mine && st.here && phase === "betting" && committedTotal > 0 && (hold.confirm.includes(st.userId) || hold.ready.includes(st.userId));
          const arc = [10, 4, 0, 0, 0, 4, 10][st.seat - 1];
          return (
            <div key={st.seat} data-seat-pod={st.seat} data-status={st.status} style={{ ...S.seatPod, marginTop: arc }}>
              {st.userId ? (
                <div style={{ ...S.seatAvatarBig, borderColor: st.mine ? "#FFD76A" : color, boxShadow: st.mine ? "0 0 10px rgba(255,215,106,0.6)" : "none", opacity: st.here && st.status !== "away" ? 1 : 0.45,
                  background: st.mine ? "linear-gradient(135deg,#FFD76A,#B8860B)" : "linear-gradient(135deg,#4B5563,#1F2937)", color: st.mine ? "#1b1204" : "#fff",
                  animation: st.status === "thinking" ? "seatPulse 1s ease-in-out infinite" : "none" }}>
                  {(st.name || "G").slice(0, 1).toUpperCase()}
                  <span style={S.seatNo}>{st.seat}</span>
                </div>
              ) : (
                <button onClick={() => sitAt(st.seat)} disabled={phase !== "betting" || committedTotal > 0} data-sit={st.seat} style={S.seatEmpty} title={`${st.seat}번 자리에 앉기`}>{st.seat}</button>
              )}
              <div style={{ ...S.seatName, color: st.mine ? "#FFD76A" : "rgba(255,255,255,0.8)" }}>{st.userId ? `${st.name}${st.mine ? " (나)" : ""}` : ""}</div>
              <div style={{ ...S.seatStatus, color }} data-seat-status>{st.userId && st.total > 0 ? `${fmtChip(st.total)} · ${label}` : label}</div>
              {canNudge && <button onClick={() => nudge(st.userId)} data-nudge={st.userId} style={S.nudgeBtn}>⏰ 재촉</button>}
            </div>
          );
        })}
      </div>
      {spectator && <div data-spectator style={S.spectatorNote}>👀 자리가 가득 차서 관전 중이에요 · 빈 자리가 생기면 눌러서 앉으세요</div>}
    </>
  );
  const resultEl = (
    <>
      {/* ── 내 결과 (카운트업) ── */}
      {myResult && phase === "betting" && (
        <div data-myresult onClick={() => setMyResult(null)} style={{ ...S.myResult, borderColor: myResult.net > 0 ? "#FFD76A" : myResult.net < 0 ? "rgba(252,165,165,0.5)" : "rgba(255,255,255,0.3)",
          background: myResult.net > 0 ? "linear-gradient(135deg, rgba(255,215,106,0.18), rgba(184,134,11,0.1))" : "rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 30 }}>{myResult.net > 0 ? "🏆" : myResult.net < 0 ? "💸" : "⚖️"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.6)", fontWeight: 800 }}>
              {myResult.net > 0 ? "YOU WON" : myResult.net < 0 ? "BETTER LUCK NEXT" : "PUSH · 원금 반환"}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "'Playfair Display', serif", color: myResult.net > 0 ? "#FFD76A" : myResult.net < 0 ? "#FCA5A5" : "#fff" }}>
              {myResult.net > 0 ? <CountUp value={myResult.net} prefix="+" /> : myResult.net < 0 ? <>-{Math.abs(myResult.net).toLocaleString()}</> : "±0"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>베팅 {myResult.total.toLocaleString()} → 지급 {myResult.payout.toLocaleString()}</div>
          </div>
        </div>
      )}
    </>
  );
  const dealingEl = (
    <>
      {/* ── 딜링 중: 모두 열기 ── */}
      {phase === "dealing" && (
        <div>
          {canRevealMine && <button onClick={revealMine} style={S.revealAllBtn}>👁 내 카드 모두 열기 (SKIP)</button>}
          {!canRevealMine && hasUnrevealed && squeezeOpen && (
            <div style={S.squeezeGuide}>다른 플레이어가 카드를 열고 있어요 · 모든 화면에 똑같이 보입니다</div>
          )}
        </div>
      )}
    </>
  );
  const consoleEl = (
    <>
      {/* ── 베팅 콘솔 (에볼루션식): 영역 한 줄 + 칩 줄 + 버튼 줄 ── */}
      {phase === "betting" && (
        <div style={S.bettingUI} data-console>
          {/* 영역 5개 한 줄: P PAIR | PLAYER | TIE | BANKER | B PAIR */}
          <div style={S.areaRow} data-area-row>
            <AreaBox variant="row" area="playerPair" label="P PAIR" sub="11:1" color="#60A5FA" mine={desired.playerPair} others={others.playerPair} stat={stat.playerPair} onClick={() => placeChip("playerPair")} disabled={!bettingOpen} win={winAreas.has("playerPair")} />
            <AreaBox variant="row" wide area="player" label="PLAYER" sub="1:1" color="#3B82F6" mine={desired.player} others={others.player} stat={stat.player} onClick={() => placeChip("player")} disabled={!bettingOpen} win={winAreas.has("player")} />
            <AreaBox variant="row" area="tie" label="TIE" sub="8:1" color="#10B981" mine={desired.tie} others={others.tie} stat={stat.tie} onClick={() => placeChip("tie")} disabled={!bettingOpen} win={winAreas.has("tie")} />
            <AreaBox variant="row" wide area="banker" label="BANKER" sub="0.95:1" color="#E63975" mine={desired.banker} others={others.banker} stat={stat.banker} onClick={() => placeChip("banker")} disabled={!bettingOpen} win={winAreas.has("banker")} />
            <AreaBox variant="row" area="bankerPair" label="B PAIR" sub="11:1" color="#F472B6" mine={desired.bankerPair} others={others.bankerPair} stat={stat.bankerPair} onClick={() => placeChip("bankerPair")} disabled={!bettingOpen} win={winAreas.has("bankerPair")} />
          </div>
          <button onClick={() => placeChip("perfectPair")} disabled={!bettingOpen} data-area="perfectPair" data-area-win={winAreas.has("perfectPair") ? "1" : "0"}
            style={{ ...S.perfectBar, opacity: !bettingOpen ? 0.6 : 1, borderColor: winAreas.has("perfectPair") ? "#FFD76A" : "rgba(212,165,116,0.4)", animation: winAreas.has("perfectPair") ? "winArea 1.1s ease-in-out infinite" : "none" }}>
            <span style={{ color: "#D4A574", fontWeight: 900, fontSize: 11, letterSpacing: 1 }}>PERFECT PAIR</span>
            <span style={{ opacity: 0.7, fontSize: 9 }}>25:1</span>
            <PlacedChips stack={desired.perfectPair} />
            {(sum(desired.perfectPair) + (stat.perfectPair.total || 0)) > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "#D4A574" }}>{(sum(desired.perfectPair) + (stat.perfectPair.total || 0)).toLocaleString()}</span>}
          </button>

          <div style={S.infoLine}>
            내 작성 {desiredTotal.toLocaleString()}
            {committedTotal > 0 && ` · 확정 ${committedTotal.toLocaleString()}`}
            {" · 최대 "}{MAX_BET.toLocaleString()}
          </div>

          <div style={S.chipSelector}>
            {CHIPS.map((v) => {
              const sel = selectedChip === v;
              const dis = shownPoints < v;
              return (
                <button key={v} onClick={() => setSelectedChip(v)} disabled={dis} data-chip-btn={v}
                  style={{ ...S.chipBtn, opacity: dis ? 0.3 : 1, transform: sel ? "translateY(-5px) scale(1.12)" : "none",
                    filter: sel ? "drop-shadow(0 0 10px rgba(255,215,0,0.85))" : "none", transition: "all 0.18s" }}>
                  <CasinoChip value={v} size={40} />
                  {sel && <span style={S.chipSelRing} />}
                </button>
              );
            })}
          </div>

          {/* 버튼 한 줄: 취소 | 리셋 | 리벳 | ×2 */}
          <div style={S.ctrlRow}>
            <button onClick={removeLastChip} disabled={desiredTotal === 0} data-act="undo" style={{ ...S.ctrlBtn, background: "linear-gradient(135deg, #6B7280, #4B5563)", opacity: desiredTotal === 0 ? 0.4 : 1 }}>↩ 취소</button>
            <button onClick={clearDesired} disabled={desiredTotal === 0} data-act="clear" style={{ ...S.ctrlBtn, background: "linear-gradient(135deg, #DC2626, #991B1B)", opacity: desiredTotal === 0 ? 0.4 : 1 }}>🗑 리셋</button>
            <button onClick={rebet} disabled={!lastBets || busy || bettingClosed} data-act="rebet" style={{ ...S.ctrlBtn, background: "linear-gradient(135deg, #0EA5E9, #0369A1)", opacity: !lastBets || busy || bettingClosed ? 0.4 : 1 }}>⟲ REBET{lastBets ? ` ${fmtChip(sumBetValues(lastBets))}` : ""}</button>
            <button onClick={doubleDesired} disabled={desiredTotal === 0 || busy || bettingClosed} data-act="double" style={{ ...S.ctrlBtn, background: "linear-gradient(135deg, #D4A574, #B07D46)", color: "#1b1204", opacity: desiredTotal === 0 || busy || bettingClosed ? 0.4 : 1 }}>×2</button>
          </div>

          <button onClick={confirmBet} disabled={busy || !bettingOpen || mainDesired === 0 || desiredTotal === committedTotal}
            style={{ ...S.actionBtn, marginTop: 8, opacity: busy || !bettingOpen || mainDesired === 0 || desiredTotal === committedTotal ? 0.5 : 1 }}>
            {busy ? "⏳ 처리 중..."
              : committedTotal > 0 && desiredTotal === committedTotal ? "✅ 베팅 확정됨"
              : committedTotal > 0 ? `✏️ 베팅 수정 (${desiredTotal.toLocaleString()})`
              : multi ? `✅ 베팅 확정 (${desiredTotal.toLocaleString()})` : `🎲 베팅 확정 · 바로 시작 (${desiredTotal.toLocaleString()})`}
          </button>

          {needStart && (
            <button onClick={toggleReady} disabled={busy} data-act="ready"
              style={{ ...S.readyBtn, background: iAmReady ? "linear-gradient(135deg, #065F46, #047857)" : "linear-gradient(135deg, #10B981, #059669)", animation: shake ? "nudgeShake 0.7s" : (!iAmReady ? "warnPulse 1.4s ease-in-out infinite" : "none") }}>
              {iAmReady ? `✅ READY · ${hold.required.length - waitingReady.length}/${hold.required.length} 준비 (누르면 취소)` : `▶ START · ${hold.required.length - waitingReady.length}/${hold.required.length} 준비`}
            </button>
          )}
          {committedTotal > 0 && !busy && !needStart && (
            <button onClick={startNow} style={{ ...S.revealAllBtn, marginTop: 8 }}>▶ 지금 시작</button>
          )}

          {/* 쉬기: 이번 판에 베팅하지 않을 때 다른 플레이어를 기다리게 하지 않음 */}
          {committedTotal === 0 && !spectator && (
            <button onClick={toggleSitOut} data-act="sitout" style={{ ...S.sitOutBtn, ...(iAmAway ? S.sitOutBtnOn : null) }}>
              {iAmAway ? "☕ 쉬는 중 · 눌러서 복귀 (칩을 올려도 복귀)" : "☕ 이번엔 쉬기 · 다른 플레이어를 기다리게 하지 않아요"}
            </button>
          )}
        </div>
      )}
    </>
  );

  // 구슬판 + 잔액/총베팅 (에볼루션 화면 왼쪽 아래)
  const beadsEl = (
    <div style={S.beadsBox} data-beads-box>
      <div style={S.beadsWhite}><BeadPlate history={winners} cell={wide ? 15 : 14} minCols={wide ? 8 : Math.max(10, Math.floor(((rootW || 520) - 30) / 14))} bare rows={6} /></div>
      <div style={S.balanceRow}>
        <div style={S.balanceBox}><div style={S.balanceLabel}>잔액</div><div data-balance style={S.balanceVal}>{shownPoints.toLocaleString()}</div></div>
        <div style={S.balanceBox}><div style={S.balanceLabel}>총 베팅금</div><div data-total-bet style={S.balanceVal}>{(committedTotal || desiredTotal).toLocaleString()}</div></div>
      </div>
    </div>
  );

  // 요약 줄 (#판수 · P/B/T · 페어) + 대로/큰눈이/작은눈이/바퀴벌레 + P?/B?  (에볼루션 화면 오른쪽)
  const roadsEl = (
    <div style={S.roadsBox} data-records>
      <div style={S.summaryRow} data-summary>
        <span style={S.summaryNo}>#{summary.round}</span>
        <span style={{ ...S.summaryChip, background: "#2563EB" }}>P {summary.p}</span>
        <span style={{ ...S.summaryChip, background: "#DC2626" }}>B {summary.b}</span>
        <span style={{ ...S.summaryChip, background: "#059669" }}>T {summary.t}</span>
        <span style={S.summaryPair} title="플레이어 페어">● {summary.playerPairs}</span>
        <span style={{ ...S.summaryPair, color: "#F87171" }} title="뱅커 페어">● {summary.bankerPairs}</span>
        <span style={S.summaryShoe}>SHOE #{shoeNo || 1}</span>
      </div>
      {winners.length ? <RoadPanel history={winners} width={wide ? 236 : Math.max(200, (rootW || 520) - 24)} /> : <div style={S.roadmapEmpty}>{shoeNo > 1 ? "새 슈가 시작됐어요 · 첫 결과가 나오면 로드맵이 쌓입니다" : "첫 라운드 결과가 나오면 로드맵이 쌓입니다"}</div>}
    </div>
  );

  return (
    <div style={S.container} ref={rootRef} data-layout={wide ? "wide" : "narrow"}>
      {showConfetti && <Confetti />}
      {toast && <div style={S.toast}>{toast}</div>}
      {topBar}
      {shoeEl}
      {dealerEl}
      {stageEl}
      {statusEl}
      {seatsEl}
      {resultEl}
      {dealingEl}
      {wide ? (
        <div style={S.wideGrid} data-wide-grid>
          <div style={S.wideLeft}>{beadsEl}</div>
          <div style={S.wideCenter}>{consoleEl}</div>
          <div style={S.wideRight}>{roadsEl}</div>
        </div>
      ) : (
        <>
          {consoleEl}
          <div style={S.records}>{beadsEl}{roadsEl}</div>
        </>
      )}
    </div>
  );
}

// 베팅 영역 (내 작성분 + 다른 플레이어 확정분)
// 칩의 금액 → 가장 가까운 칩 종류 (작은 칩 표시용)
const chipForAmount = (amt) => [...CHIPS].reverse().find((v) => amt >= v) || CHIPS[0];

function AreaBox({ label, sub, color, mine, others = [], onClick, disabled, compact, win, area, stat, variant = "grid", wide }) {
  const m = sum(mine);
  const otherTotal = others.reduce((a, o) => a + o.amount, 0);
  const total = m + otherTotal;
  const shown = others.slice(0, variant === "row" ? 3 : 4);
  const isRow = variant === "row";
  const big = isRow && variant === "row" && wide;                       // 플레이어/뱅커 같은 큰 영역
  const base = isRow ? { ...S.rowArea, flex: wide ? 2.1 : area === "tie" ? 1.3 : 1.05, minHeight: wide ? 132 : area === "tie" ? 132 : 108 } : { ...S.betArea, minHeight: compact ? 84 : 124 };
  return (
    <button onClick={onClick} disabled={disabled} data-area-win={win ? "1" : "0"} data-area={area} style={{ ...base, opacity: disabled ? 0.6 : 1,
      borderColor: win ? "#FFD76A" : total > 0 ? color : isRow ? `${color}88` : "rgba(255,255,255,0.1)",
      background: isRow ? `linear-gradient(180deg, ${color}${total > 0 ? "55" : "33"}, ${color}${total > 0 ? "26" : "14"})` : total > 0 ? `${color}1f` : "rgba(255,255,255,0.03)",
      animation: win ? "winArea 1.1s ease-in-out infinite" : "none" }}>
      <span style={{ color: isRow ? "#fff" : color, fontWeight: 900, fontSize: isRow ? (wide ? 15 : 11) : compact ? 11 : 14, letterSpacing: isRow ? 0.5 : 1, textShadow: isRow ? "0 1px 3px rgba(0,0,0,0.6)" : "none", lineHeight: 1.1 }}>{label}</span>
      <span style={{ ...S.betAreaSub, fontSize: isRow ? 9 : undefined, opacity: isRow ? 0.85 : undefined }}>{sub}</span>
      {stat && stat.total > 0 && (
        <span data-area-stat style={S.areaStat}>
          {(area === "player" || area === "tie" || area === "banker") && <b style={{ color }}>{stat.pct}%</b>}
          <span>{shortMoney(stat.total)}</span>
          <span style={{ opacity: 0.75 }}>👤{stat.count}</span>
        </span>
      )}
      <PlacedChips stack={mine} />
      {shown.length > 0 && (
        <div style={S.otherChips} data-others>
          {shown.map((o) => (
            <span key={o.userId} data-other-chip={o.confirmed ? "confirmed" : "draft"} title={`${o.seat}번 ${o.name}`} style={{ ...S.otherChip, opacity: o.confirmed ? 1 : 0.5 }}>
              <CasinoChip value={chipForAmount(o.amount)} size={isRow ? 18 : compact ? 20 : 24} />
              <span style={S.seatBadge}>{o.seat || "?"}</span>
            </span>
          ))}
          {others.length > shown.length && <span style={S.otherMore}>+{others.length - shown.length}</span>}
        </div>
      )}
      {total > 0 && <span style={S.placedAmount}>{total.toLocaleString()}</span>}
      {!isRow && others.length > 0 && (
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {others.map((o) => `${o.seat}번 ${fmtChip(o.amount)}${o.confirmed ? "" : "…"}`).join(" · ")}
        </span>
      )}
    </button>
  );
}


const S = {
  container: { fontFamily: "'Inter', sans-serif", padding: "16px 14px 24px", color: "#fff", position: "relative", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, paddingRight: 44 },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 14px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 700 },
  title: { margin: 0, fontSize: 17, fontWeight: 900, background: "linear-gradient(135deg, #D4A574, #FFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2, fontFamily: "'Playfair Display', serif" },
  points: { background: "linear-gradient(135deg, #FFD700, #D4A574)", color: "#000", padding: "6px 14px", borderRadius: 20, fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" },
  subHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  tableTag: { fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "rgba(212,165,116,0.85)" },
  liveDot: { color: "#EF4444", fontSize: 9 },
  toggleBtn: { width: 32, height: 28, borderRadius: 8, border: "1px solid rgba(212,165,116,0.3)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 13 },

  statsBar: { display: "flex", gap: 6, marginBottom: 10 },
  statChip: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: 800, color: "#fff", padding: "6px 4px", background: "rgba(255,255,255,0.04)", borderRadius: 6 },
  pctText: { fontSize: 9, color: "rgba(255,255,255,0.45)", marginLeft: 2 },
  statChipTotal: { flex: 1.2, textAlign: "center", fontSize: 10, fontWeight: 800, color: "#D4A574", padding: "6px 4px", background: "rgba(212,165,116,0.1)", borderRadius: 6, letterSpacing: 1 },

  timerBar: { position: "relative", height: 30, borderRadius: 10, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(212,165,116,0.3)", marginBottom: 10, overflow: "hidden" },
  timerFill: { position: "absolute", top: 0, left: 0, bottom: 0, transition: "width 1s linear", opacity: 0.45 },
  timerText: { position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 900 },

  roadmapWrap: { marginBottom: 12 },
  roadmapHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px" },
  roadmapHeaderTitle: { fontSize: 11, fontWeight: 900, color: "#D4A574", letterSpacing: 2 },
  roadmapToggleBtn: { background: "transparent", border: "none", color: "rgba(212,165,116,0.7)", fontSize: 10, cursor: "pointer" },
  roadmapEmpty: { padding: 18, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 11, fontStyle: "italic", background: "rgba(0,0,0,0.3)", borderRadius: 10, border: "1px dashed rgba(212,165,116,0.2)" },

  tableArea: { position: "relative", marginBottom: 16, paddingTop: 44 },
  shoe: { position: "absolute", top: 0, left: 14, zIndex: 20, display: "flex", alignItems: "center", gap: 6 },
  shoeLabel: { fontSize: 8, letterSpacing: 2, color: "#D4A574", fontWeight: 900 },
  shoeBox: { position: "relative", width: 50, height: 58, background: "linear-gradient(135deg, #4a2818, #2a1810)", border: "2px solid #D4A574", borderRadius: "6px 6px 10px 10px", boxShadow: "0 6px 15px rgba(0,0,0,0.5)", animation: "shoeGlow 3s ease-in-out infinite", padding: "6px 5px 3px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", overflow: "hidden" },
  shoeCards: { position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" },
  shoeCard: { width: 32, height: 42, background: "linear-gradient(135deg, #8B0000, #5a0000)", border: "1.5px solid #D4A574", borderRadius: 3 },
  shoeDeckCount: { fontSize: 6, color: "rgba(212,165,116,0.9)", fontWeight: 900, letterSpacing: 1, fontFamily: "'Courier New', monospace" },

  tableFelt3d: { position: "relative", borderRadius: 26, padding: "46px 14px 34px", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 230, boxShadow: "0 22px 40px rgba(0,0,0,0.65)" },
  shoe3d: { position: "absolute", top: -16, left: 8, zIndex: 20 },
  tableFelt: { background: "radial-gradient(ellipse at top, #1a4f36 0%, #061c12 100%)", borderRadius: 24, border: "4px solid #D4A574", padding: "26px 6px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.5)", minHeight: 220 },
  playerSide: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  bankerSide: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  sideTitle: { fontSize: 13, fontWeight: 900, letterSpacing: 4, color: "#3B82F6", marginBottom: 14, textShadow: "0 2px 4px rgba(0,0,0,0.5)" },
  cardsContainer: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: 90, marginBottom: 14, flexWrap: "nowrap" },
  scoreBox: { background: "rgba(0,0,0,0.4)", border: "2px solid rgba(59,130,246,0.3)", color: "#3B82F6", fontSize: 24, fontWeight: 900, width: 50, height: 50, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  vsText: { color: "rgba(255,255,255,0.2)", fontSize: 18, fontWeight: 900, fontStyle: "italic", padding: "0 2px" },
  peekHint: { position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", fontSize: 14, zIndex: 5, animation: "peekPulse 1.5s ease-in-out infinite" },

  resultOverlay: { position: "absolute", top: 44, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 },
  resultBanner: { width: "100%", textAlign: "center", padding: "14px 0", color: "#fff", textShadow: "0 4px 10px rgba(0,0,0,0.8)", animation: "bannerSlide 0.5s ease-out" },
  resultTitle: { fontSize: 26, fontWeight: 900, letterSpacing: 3 },
  resultSub: { fontSize: 15, fontWeight: 800, marginTop: 4, letterSpacing: 1 },

  mySummary: { textAlign: "center", fontSize: 11, color: "#F5E9D2", background: "rgba(212,165,116,0.08)", border: "1px dashed rgba(212,165,116,0.3)", borderRadius: 10, padding: "8px 10px", marginBottom: 10 },

  bettingUI: { background: "rgba(255,255,255,0.02)", borderRadius: 20, padding: 12 },
  chipSelector: { display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 },
  chipBtn: { position: "relative", width: 46, height: 46, padding: 0, background: "transparent", border: "none", borderRadius: "50%", cursor: "pointer" },
  boardAreas: { display: "flex", gap: 6, marginBottom: 8 },
  betArea: { flex: 1, minWidth: 0, padding: "10px 4px", border: "2px solid rgba(255,255,255,0.1)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 2, cursor: "pointer", transition: "all 0.2s", color: "#fff" },
  betAreaSub: { fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 1 },
  placedChips: { display: "flex", alignItems: "center", justifyContent: "center", gap: 3, minHeight: 24, marginTop: 6, flexWrap: "wrap", maxWidth: "100%" },
  placedChip: { width: 31, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#17120A", fontWeight: 900, fontSize: 8, border: "2px dashed rgba(255,255,255,0.85)", boxShadow: "0 2px 4px rgba(0,0,0,0.5)", flex: "0 0 auto" },
  extraChipCount: { color: "#fff", fontSize: 9, fontWeight: 800 },
  placedAmount: { fontSize: 11, color: "#F5E9D2", fontWeight: 800, marginTop: 4 },
  infoLine: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "8px 0" },
  lastHandBadge: { margin: "0 0 8px", padding: "5px 12px", borderRadius: 14, textAlign: "center", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: "#FCA5A5", background: "rgba(220,38,38,0.14)", border: "1px solid rgba(248,113,113,0.5)" },
  shoeBar: { margin: "0 0 8px", padding: "6px 10px", borderRadius: 10, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(212,165,116,0.22)" },
  shoeBarTop: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 6, gap: 8 },
  shoeBarBottom: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 5, gap: 8, flexWrap: "wrap" },
  shoeTrack: { position: "relative", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "visible" },
  shoeFill: { height: "100%", borderRadius: 4, transition: "width 0.5s" },
  shoeCutMark: { position: "absolute", top: -3, width: 3, height: 14, borderRadius: 2, background: "#EF4444", boxShadow: "0 0 6px rgba(239,68,68,0.8)", transform: "translateX(-1px)" },
  shuffleBanner: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 30, textAlign: "center", color: "#fff", fontWeight: 900, padding: "14px 26px", borderRadius: 16, background: "linear-gradient(135deg, rgba(30,58,138,0.94), rgba(17,24,39,0.94))", border: "1.5px solid rgba(147,197,253,0.6)", boxShadow: "0 12px 40px rgba(59,130,246,0.45)", pointerEvents: "none", fontFamily: "'Playfair Display', serif", whiteSpace: "nowrap" },
  sessionChip: { fontSize: 10, fontWeight: 900, letterSpacing: 1.2, padding: "3px 10px", borderRadius: 12, border: "1px solid", background: "rgba(0,0,0,0.35)" },
  noMoreBets: { position: "absolute", top: "50%", left: "50%", zIndex: 30, fontSize: 24, fontWeight: 900, letterSpacing: 5, color: "#fff", padding: "10px 24px", borderRadius: 14, background: "linear-gradient(135deg, rgba(220,38,38,0.92), rgba(127,29,29,0.92))", border: "1.5px solid rgba(255,255,255,0.5)", boxShadow: "0 10px 36px rgba(220,38,38,0.5)", animation: "noMoreBets 1.6s ease-out forwards", pointerEvents: "none", whiteSpace: "nowrap", fontFamily: "'Playfair Display', serif" },
  topBar: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0 8px", marginBottom: 4, paddingRight: 40 },
  topBack: { width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 16, cursor: "pointer", flexShrink: 0 },
  topTitleBox: { flex: 1, minWidth: 0, overflow: "hidden" },
  topTitle: { fontSize: 15, fontWeight: 900, letterSpacing: 1, fontFamily: "'Playfair Display', Georgia, serif", color: "#E8C676", whiteSpace: "nowrap" },
  topSub: { display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden" },
  topRight: { display: "flex", alignItems: "center", gap: 5, flexShrink: 0 },
  wideGrid: { display: "grid", gridTemplateColumns: "190px minmax(0, 1fr) 252px", gap: 12, alignItems: "start", marginTop: 8 },
  wideLeft: { minWidth: 0 },
  wideCenter: { minWidth: 0 },
  wideRight: { minWidth: 0 },
  records: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12, paddingBottom: 12 },
  beadsBox: { display: "flex", flexDirection: "column", gap: 6 },
  beadsWhite: { background: "rgba(255,255,255,0.96)", borderRadius: 6, padding: 3, overflow: "hidden" },
  balanceRow: { display: "flex", gap: 6 },
  balanceBox: { flex: 1, minWidth: 0, padding: "6px 8px", borderRadius: 8, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(212,165,116,0.25)" },
  balanceLabel: { fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 },
  balanceVal: { fontSize: 13, fontWeight: 900, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  roadsBox: { display: "flex", flexDirection: "column", gap: 6 },
  summaryRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, fontSize: 11, fontWeight: 800, color: "#fff" },
  summaryNo: { fontSize: 12, fontWeight: 900, color: "#E3B23C", marginRight: 2 },
  summaryChip: { padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 900 },
  summaryPair: { fontSize: 10, color: "#60A5FA", fontWeight: 900 },
  summaryShoe: { marginLeft: "auto", fontSize: 9, letterSpacing: 1, color: "rgba(255,255,255,0.45)" },
  areaRow: { display: "flex", gap: 4, alignItems: "stretch", marginBottom: 6 },
  perfectBar: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "5px 10px", marginBottom: 4, borderRadius: 12, border: "1.5px solid", background: "rgba(212,165,116,0.08)", color: "#fff", cursor: "pointer" },
  ctrlRow: { display: "flex", gap: 6 },
  ctrlBtn: { flex: 1, minWidth: 0, padding: "10px 4px", borderRadius: 10, border: "none", color: "#fff", fontSize: 11, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  sitOutBtn: { width: "100%", marginTop: 8, padding: "8px 10px", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.25)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  sitOutBtnOn: { border: "1px solid rgba(251,191,36,0.6)", background: "rgba(251,191,36,0.12)", color: "#FBBF24" },
  rowArea: { position: "relative", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 2, padding: "8px 2px 6px", border: "2px solid", borderRadius: 14, cursor: "pointer", color: "#fff" },
  areaStat: { display: "flex", flexDirection: "column", alignItems: "center", gap: 0, fontSize: 9, fontWeight: 800, lineHeight: 1.25, color: "rgba(255,255,255,0.9)" },
  seatBar: { display: "flex", justifyContent: "space-between", gap: 2, margin: "4px 0 12px", padding: "8px 4px 6px", borderRadius: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(212,165,116,0.18)" },
  seatPod: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  seatAvatarBig: { position: "relative", width: 36, height: 36, borderRadius: "50%", border: "2.5px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 },
  seatNo: { position: "absolute", bottom: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7, background: "#111827", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" },
  seatEmpty: { width: 36, height: 36, borderRadius: "50%", border: "2px dashed rgba(255,255,255,0.25)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 800, cursor: "pointer" },
  seatName: { fontSize: 9, fontWeight: 800, width: "100%", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minHeight: 11 },
  seatStatus: { fontSize: 8, fontWeight: 800, letterSpacing: 0.3, textAlign: "center", lineHeight: 1.2, minHeight: 10, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  nudgeBtn: { marginTop: 2, padding: "2px 6px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.6)", background: "rgba(251,191,36,0.15)", color: "#FBBF24", fontSize: 9, fontWeight: 800, cursor: "pointer" },
  spectatorNote: { margin: "-6px 0 10px", padding: "6px 10px", borderRadius: 10, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", color: "#93C5FD", fontSize: 11, fontWeight: 700, textAlign: "center" },
  warnBanner: { margin: "0 0 8px", padding: "8px 12px", borderRadius: 12, background: "linear-gradient(135deg, rgba(220,38,38,0.35), rgba(127,29,29,0.35))", border: "1.5px solid rgba(239,68,68,0.7)", color: "#FECACA", fontSize: 12, fontWeight: 800, textAlign: "center", animation: "warnPulse 1s ease-in-out infinite" },
  readyBtn: { width: "100%", marginTop: 8, padding: 14, borderRadius: 14, border: "none", color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: 1, cursor: "pointer" },
  otherChips: { display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 2, margin: "2px 0", pointerEvents: "none" },
  otherChip: { position: "relative", display: "inline-block" },
  seatBadge: { position: "absolute", top: -3, right: -3, minWidth: 11, height: 11, borderRadius: 6, background: "#111827", border: "1px solid rgba(255,255,255,0.5)", color: "#fff", fontSize: 7, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" },
  otherMore: { fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 800 },
  seatRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  seatPill: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: 20, border: "1px solid" },
  seatAvatar: { width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 },
  myResult: { display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 18, border: "1.5px solid", marginBottom: 12, cursor: "pointer", animation: "resultRise 0.45s ease-out" },
  chipSelRing: { position: "absolute", inset: -3, borderRadius: "50%", border: "2px solid #FFD76A", pointerEvents: "none" },
  chipControls: { display: "flex", gap: 8, marginBottom: 6 },
  chipControlBtn: { flex: 1, height: 42, fontSize: 12, fontWeight: 800, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" },
  actionBtn: { width: "100%", padding: 18, background: "linear-gradient(135deg, #D4A574, #B07D46)", border: "none", color: "#000", borderRadius: 16, fontSize: 15, fontWeight: 900, letterSpacing: 2, cursor: "pointer", boxShadow: "0 8px 20px rgba(212,165,116,0.3)" },

  statusBar: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 16, background: "rgba(212,165,116,0.08)", border: "1px dashed rgba(212,165,116,0.35)", borderRadius: 14, textAlign: "center", color: "#D4A574", fontSize: 13, fontWeight: 700 },
  ownerTag: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: -8, marginBottom: 10, letterSpacing: 0.5 },
  squeezeGuide: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.55)", margin: "4px 0 10px", padding: 6, background: "rgba(255,255,255,0.03)", borderRadius: 8 },
  revealAllBtn: { width: "100%", padding: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(212,165,116,0.4)", color: "#F0D4B8", borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 1 },

  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,25,0.95)", border: "1px solid rgba(212,165,116,0.5)", color: "#F0D4B8", padding: "10px 18px", borderRadius: 24, fontSize: 12, fontWeight: 700, zIndex: 10100, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", animation: "toastIn 0.25s ease-out", maxWidth: "90vw", textAlign: "center" },
};