// ===================================================================
// 🎰 BANADA VIP BACCARAT · LIVE v5
// ===================================================================
// 혼자: 베팅 확정 → 바로 시작 / 여러 명: 모두 확정하면 시작 (20초 뒤 자동)
// 카드: 자리(PLAYER/BANKER)별 최다 베팅자가 담당. 카드를 잡고 끄는 대로 접히고,
//       충분히 열린 채 놓으면 활짝 열려 모두에게 공개됩니다. (앞면은 담당자에게만 미리 전달)
// ===================================================================

import React, { useState, useRef, useEffect, useMemo } from "react";
import BaccaratDealer from "./BaccaratDealer";
import BaccaratRoadmap, { computeStats } from "./BaccaratRoadmap";
import { speak, setVoiceEnabled, setBgmEnabled, startBGM, stopBGM } from "./BaccaratSound";
import {
  useBaccaratTable, useRoundBets, useBaccaratHistory, useMyBet,
  setBaccaratUser, joinBaccaratTable, heartbeatBaccarat, leaveBaccaratTable,
  placeBaccaratBet, startBaccarat, openBaccarat, myCardsBaccarat, naturalBaccarat, revealMineBaccarat,
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

// ── 카지노 칩 (SVG) ──────────────────────────────────────────────────
// 가장자리 홈(8개) + 안쪽 점선 링 + 중앙 원. 금액별 색. 선택/놓기 연출에 같은 컴포넌트를 씀.
const CHIP_THEME = {
  10000:    { a: "#4ade80", b: "#15803d", ring: "#dcfce7", inner: "#166534", text: "#fff" },
  50000:    { a: "#60a5fa", b: "#1d4ed8", ring: "#dbeafe", inner: "#1e3a8a", text: "#fff" },
  100000:   { a: "#f87171", b: "#b91c1c", ring: "#fee2e2", inner: "#7f1d1d", text: "#fff" },
  500000:   { a: "#c084fc", b: "#7e22ce", ring: "#f3e8ff", inner: "#581c87", text: "#fff" },
  1000000:  { a: "#fde68a", b: "#b8860b", ring: "#fffbeb", inner: "#78350f", text: "#fff7d6" },
  5000000:  { a: "#67e8f9", b: "#0e7490", ring: "#cffafe", inner: "#164e63", text: "#fff" },
  10000000: { a: "#fdba74", b: "#c2410c", ring: "#ffedd5", inner: "#7c2d12", text: "#fff" },
  50000000: { a: "#f9a8d4", b: "#9d174d", ring: "#fce7f3", inner: "#500724", text: "#fff" },
};
const chipThemeOf = (v) => CHIP_THEME[v] || CHIP_THEME[10000];

export function CasinoChip({ value, size = 40, drop = false }) {
  const t = chipThemeOf(value);
  const id = `bcChip${value}`;
  const label = fmtChip(value);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" data-casino-chip={value}
      style={{ display: "block", filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.55))", animation: drop ? "chipDrop 0.28s cubic-bezier(.2,.9,.3,1.2)" : "none" }}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="85%"><stop offset="0%" stopColor={t.a} /><stop offset="100%" stopColor={t.b} /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id})`} stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="43" y="2.5" width="14" height="15" rx="2.5" fill={t.ring} opacity="0.95" transform={`rotate(${i * 45} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="31" fill="none" stroke={t.ring} strokeWidth="2.2" strokeDasharray="6 4.5" opacity="0.9" />
      <circle cx="50" cy="50" r="26" fill={t.inner} opacity="0.55" />
      <ellipse cx="38" cy="30" rx="18" ry="9" fill="#fff" opacity="0.16" transform="rotate(-25 38 30)" />
      <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontSize={label.length > 3 ? 21 : 26} fontWeight="900" fill={t.text}
        style={{ fontFamily: "Inter, Arial, sans-serif" }}>{label}</text>
    </svg>
  );
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
              position: "absolute", inset: 0, borderRadius: 6,
              background: "linear-gradient(135deg, #4A1033 0%, #2A0520 50%, #1A0512 100%)",
              border: "2px solid #D4A574", boxSizing: "border-box",
              display: "flex", alignItems: "center", justifyContent: "center",
              clipPath: clip, WebkitClipPath: clip,
              transition: folding ? "none" : "clip-path 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <div style={{ border: "1px dashed rgba(212,165,116,0.6)", width: "80%", height: "86%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, color: "#D4A574" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, opacity: 0.8 }}>VIP</div>
              <div style={{ fontSize: 22 }}>♦</div>
              <div style={{ fontSize: 7, letterSpacing: 2, opacity: 0.6 }}>BACCARAT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlacedChips({ stack }) {
  if (!stack.length) return null;
  const visible = stack.slice(-3);
  const base = stack.length - visible.length;
  return (
    <div style={S.placedChips}>
      {stack.length > 3 && <span style={S.extraChipCount}>+{stack.length - 3}</span>}
      {visible.map((v, i) => (
        <span key={`${base + i}-${v}`} style={{ marginLeft: i ? -12 : 0, display: "inline-block" }}>
          <CasinoChip value={v} size={30} drop={i === visible.length - 1} />
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

export default function BaccaratLiveTable({ tableId, userId, userName, gamePoints = 0, onLeave = () => {} }) {
  setBaccaratUser(userId, userName);
  useEffect(() => { injectKeyframes(); }, []);

  const { table, loading } = useBaccaratTable(tableId);
  const round = table?.currentRound || 1;
  const phase = table?.phase === "dealing" ? "dealing" : "betting";
  const names = table?.names || {};
  const history = useBaccaratHistory(tableId, 80);
  const winners = useMemo(() => history.map((h) => h.winner), [history]);
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
  const serverArea = useMemo(() => {
    const out = {}; AREA_KEYS.forEach((k) => (out[k] = 0));
    roundBets.forEach((b) => {
      if (b.userId === userId) return;
      AREA_KEYS.forEach((k) => (out[k] += (b.bets && b.bets[k]) || 0));
    });
    return out;
  }, [roundBets, userId]);

  // 확정 안 했지만 칩을 만지는 중인 사람 (시작을 기다리게 만드는 사람)
  const confirmedMap = table?.roundBets || {};
  const thinking = Object.keys(table?.engagedSeen || {}).filter(
    (u) => u !== userId && players.includes(u) && !(confirmedMap[u] > 0)
  );
  const endsAt = table?.bettingEndsAt || 0;
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;
  const bettingClosed = !!endsAt && now >= endsAt;

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

  // 내추럴 자동 공개 (딜링이 끝나면 한 번 요청 → 서버가 내추럴일 때만 공개)
  const naturalSent = useRef(0);
  const naturalReady = phase === "dealing" && !!dealAt && elapsed >= NATURAL_WAIT + 150;
  useEffect(() => {
    if (!naturalReady || naturalSent.current === dealAt) return;
    naturalSent.current = dealAt;
    naturalBaccarat(tableId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalReady, dealAt]);

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
    if (phase === "dealing") return hasUnrevealed ? "SQUEEZE YOUR CARDS!" : "DEALING...";
    if (committedTotal > 0) return thinking.length ? "WAITING FOR OTHERS" : "BET PLACED";
    if (fresh) return lastRes.winner === "player" ? "PLAYER WINS" : lastRes.winner === "banker" ? "BANKER WINS" : "TIE";
    return "PLACE YOUR BETS";
  })();

  const statusLine = (() => {
    if (phase === "dealing") return elapsed < NATURAL_WAIT ? "🎴 카드 딜링 중..." : "🎴 카드를 잡고 원하는 방향으로 끌어서 열어보세요";
    if (committedTotal > 0 && thinking.length) {
      return `⏳ ${thinking.map((u) => names[u] || "플레이어").join(", ")} 님의 베팅 확정을 기다리는 중${secondsLeft !== null ? ` · ${secondsLeft}초` : ""}`;
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

  const bettingOpen = phase === "betting" && !bettingClosed;
  // 방금 끝난 판의 당첨 자리 (6초간 강조)
  const winAreas = fresh && lastRes ? new Set([lastRes.winner, lastRes.sideResults?.playerPair && "playerPair", lastRes.sideResults?.bankerPair && "bankerPair", lastRes.sideResults?.perfectPair && "perfectPair"].filter(Boolean)) : new Set();

  return (
    <div style={S.container}>
      {showConfetti && <Confetti />}
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.header}>
        <button onClick={() => onLeave()} style={S.backBtn}>← LOBBY</button>
        <h2 style={S.title}>VIP BACCARAT</h2>
        <div style={S.points}>💎 {shownPoints.toLocaleString()}</div>
      </div>

      <div style={S.subHeader}>
        <span style={S.tableTag}><span style={S.liveDot}>●</span> {tableId === "table1" ? "TABLE 1" : "TABLE 2"} · LIVE · {players.length}명</span>
        {sessionNet !== 0 && (
          <span data-session style={{ ...S.sessionChip, color: sessionNet > 0 ? "#86EFAC" : "#FCA5A5", borderColor: sessionNet > 0 ? "rgba(134,239,172,0.4)" : "rgba(252,165,165,0.4)" }}>
            SESSION {sessionNet > 0 ? "+" : "-"}{Math.abs(sessionNet).toLocaleString()}
          </span>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => { setVoiceOn((v) => !v); setVoiceEnabled(!voiceOn); }} style={S.toggleBtn}>{voiceOn ? "🔊" : "🔇"}</button>
          <button onClick={() => { setBgmOn((v) => !v); setBgmEnabled(!bgmOn); }} style={S.toggleBtn}>{bgmOn ? "🎵" : "🎶"}</button>
        </div>
      </div>

      <BaccaratDealer phase={phase} message={dealerMessage} roundNumber={roundLabel} playerCount={players.length}
        speaking={phase === "dealing"} noMoreBets={bettingClosed} />

      <div style={S.timerBar}>
        <div style={{ ...S.timerFill, width: phase === "betting" && endsAt ? `${Math.max(0, Math.min(100, ((endsAt - now) / 20000) * 100))}%` : "100%" }} />
        <div style={S.timerText}>{statusLine}</div>
      </div>

      {stats.total > 0 && (
        <div style={S.statsBar}>
          <div style={S.statChip}><span style={{ color: "#3B82F6" }}>P</span> {stats.p} <span style={S.pctText}>{Math.round((stats.p / stats.total) * 100)}%</span></div>
          <div style={S.statChip}><span style={{ color: "#E63975" }}>B</span> {stats.b} <span style={S.pctText}>{Math.round((stats.b / stats.total) * 100)}%</span></div>
          <div style={S.statChip}><span style={{ color: "#10B981" }}>T</span> {stats.t} <span style={S.pctText}>{Math.round((stats.t / stats.total) * 100)}%</span></div>
          <div style={S.statChipTotal}>TOTAL {stats.total}</div>
        </div>
      )}

      <div style={S.roadmapWrap}>
        <div style={S.roadmapHeader}>
          <span style={S.roadmapHeaderTitle}>🀄 중국매 · ROADMAP</span>
          <button onClick={() => setShowRoadmap((v) => !v)} style={S.roadmapToggleBtn}>{showRoadmap ? "접기 ▲" : "펼치기 ▼"}</button>
        </div>
        {showRoadmap && (winners.length ? <BaccaratRoadmap history={winners} /> : <div style={S.roadmapEmpty}>첫 라운드 결과가 나오면 로드맵이 쌓입니다</div>)}
      </div>

      <div style={S.tableArea}>
        <div style={{ ...S.shoe, animation: phase === "dealing" && elapsed < 2200 ? "shoeShake 0.5s ease-in-out infinite" : "none" }}>
          <div style={S.shoeLabel}>SHOE</div>
          <div style={S.shoeBox}>
            <div style={S.shoeCards}>
              <div style={S.shoeCard} /><div style={{ ...S.shoeCard, marginTop: -44 }} /><div style={{ ...S.shoeCard, marginTop: -44 }} />
            </div>
            <div style={S.shoeDeckCount}>6 DECKS</div>
          </div>
        </div>

        <div style={S.tableFelt}>
          <div style={S.playerSide}>
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
          <div style={S.vsText}>VS</div>
          <div style={S.bankerSide}>
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

        {fresh && phase === "betting" && (
          <div style={S.resultOverlay}>
            <div style={{ ...S.resultBanner, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.9), transparent)" }}>
              <div style={S.resultTitle}>{lastRes.winner === "player" ? "PLAYER WINS" : lastRes.winner === "banker" ? "BANKER WINS" : "TIE"}</div>
            </div>
          </div>
        )}
      </div>

      {roundBets.length > 0 && (
        <div style={S.seatRow}>
          {roundBets.map((b) => {
            const mine = b.userId === userId;
            const parts = [["P", b.bets?.player, "#3B82F6"], ["B", b.bets?.banker, "#E63975"], ["T", b.bets?.tie, "#10B981"]].filter((x) => x[1] > 0);
            return (
              <div key={b.id || b.userId} data-seat style={{ ...S.seatPill, borderColor: mine ? "rgba(255,215,106,0.7)" : "rgba(255,255,255,0.14)", background: mine ? "rgba(255,215,106,0.1)" : "rgba(255,255,255,0.04)" }}>
                <span style={{ ...S.seatAvatar, background: mine ? "linear-gradient(135deg,#FFD76A,#B8860B)" : "linear-gradient(135deg,#6B7280,#374151)", color: mine ? "#1b1204" : "#fff" }}>{(b.nickname || "G").slice(0, 1).toUpperCase()}</span>
                <span style={{ fontWeight: 800, fontSize: 11 }}>{b.nickname || "GUEST"}{mine ? " (나)" : ""}</span>
                {parts.map(([k, v, c]) => <span key={k} style={{ fontSize: 10, fontWeight: 800, color: c }}>{k} {fmtChip(v)}</span>)}
              </div>
            );
          })}
        </div>
      )}

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

      {/* ── 딜링 중: 모두 열기 ── */}
      {phase === "dealing" && (
        <div>
          {canRevealMine && <button onClick={revealMine} style={S.revealAllBtn}>👁 내 카드 모두 열기 (SKIP)</button>}
          {!canRevealMine && hasUnrevealed && squeezeOpen && (
            <div style={S.squeezeGuide}>다른 플레이어가 카드를 열고 있어요 · 모든 화면에 똑같이 보입니다</div>
          )}
        </div>
      )}

      {/* ── 베팅 ── */}
      {phase === "betting" && (
        <div style={S.bettingUI}>
          <div style={S.chipSelector}>
            {CHIPS.map((v) => {
              const sel = selectedChip === v;
              const dis = shownPoints < v;
              return (
                <button key={v} onClick={() => setSelectedChip(v)} disabled={dis} data-chip-btn={v}
                  style={{ ...S.chipBtn, opacity: dis ? 0.3 : 1, transform: sel ? "translateY(-5px) scale(1.12)" : "none",
                    filter: sel ? "drop-shadow(0 0 10px rgba(255,215,0,0.85))" : "none", transition: "all 0.18s" }}>
                  <CasinoChip value={v} size={46} />
                  {sel && <span style={S.chipSelRing} />}
                </button>
              );
            })}
          </div>

          <div style={S.boardAreas}>
            <AreaBox label="PLAYER" sub="1 : 1" color="#3B82F6" mine={desired.player} other={serverArea.player} onClick={() => placeChip("player")} disabled={!bettingOpen} win={winAreas.has("player")} />
            <AreaBox label="TIE" sub="8 : 1" color="#10B981" mine={desired.tie} other={serverArea.tie} onClick={() => placeChip("tie")} disabled={!bettingOpen} win={winAreas.has("tie")} />
            <AreaBox label="BANKER" sub="0.95 : 1" color="#E63975" mine={desired.banker} other={serverArea.banker} onClick={() => placeChip("banker")} disabled={!bettingOpen} win={winAreas.has("banker")} />
          </div>
          <div style={S.boardAreas}>
            <AreaBox compact label="P PAIR" sub="11 : 1" color="#60A5FA" mine={desired.playerPair} other={serverArea.playerPair} onClick={() => placeChip("playerPair")} disabled={!bettingOpen} win={winAreas.has("playerPair")} />
            <AreaBox compact label="PERFECT" sub="25 : 1" color="#D4A574" mine={desired.perfectPair} other={serverArea.perfectPair} onClick={() => placeChip("perfectPair")} disabled={!bettingOpen} win={winAreas.has("perfectPair")} />
            <AreaBox compact label="B PAIR" sub="11 : 1" color="#F472B6" mine={desired.bankerPair} other={serverArea.bankerPair} onClick={() => placeChip("bankerPair")} disabled={!bettingOpen} win={winAreas.has("bankerPair")} />
          </div>

          <div style={S.infoLine}>
            내 작성 {desiredTotal.toLocaleString()}
            {committedTotal > 0 && ` · 확정 ${committedTotal.toLocaleString()}`}
            {" · 최대 "}{MAX_BET.toLocaleString()}
          </div>

          <div style={S.chipControls}>
            <button onClick={removeLastChip} disabled={desiredTotal === 0} data-act="undo" style={{ ...S.chipControlBtn, background: "linear-gradient(135deg, #6B7280, #4B5563)", opacity: desiredTotal === 0 ? 0.4 : 1 }}>↩ 마지막 칩 취소</button>
            <button onClick={clearDesired} disabled={desiredTotal === 0} data-act="clear" style={{ ...S.chipControlBtn, background: "linear-gradient(135deg, #DC2626, #991B1B)", opacity: desiredTotal === 0 ? 0.4 : 1 }}>🗑 전체 리셋</button>
          </div>
          <div style={S.chipControls}>
            <button onClick={rebet} disabled={!lastBets || busy || bettingClosed} data-act="rebet" style={{ ...S.chipControlBtn, background: "linear-gradient(135deg, #0EA5E9, #0369A1)", opacity: !lastBets || busy || bettingClosed ? 0.4 : 1 }}>⟲ REBET{lastBets ? ` ${fmtChip(sumBetValues(lastBets))}` : ""}</button>
            <button onClick={doubleDesired} disabled={desiredTotal === 0 || busy || bettingClosed} data-act="double" style={{ ...S.chipControlBtn, background: "linear-gradient(135deg, #D4A574, #B07D46)", color: "#1b1204", opacity: desiredTotal === 0 || busy || bettingClosed ? 0.4 : 1 }}>×2 DOUBLE</button>
          </div>

          <button onClick={confirmBet} disabled={busy || !bettingOpen || mainDesired === 0 || desiredTotal === committedTotal}
            style={{ ...S.actionBtn, marginTop: 8, opacity: busy || !bettingOpen || mainDesired === 0 || desiredTotal === committedTotal ? 0.5 : 1 }}>
            {busy ? "⏳ 처리 중..."
              : committedTotal > 0 && desiredTotal === committedTotal ? "✅ 베팅 확정됨"
              : committedTotal > 0 ? `✏️ 베팅 수정 (${desiredTotal.toLocaleString()})`
              : multi ? `✅ 베팅 확정 (${desiredTotal.toLocaleString()})` : `🎲 베팅 확정 · 바로 시작 (${desiredTotal.toLocaleString()})`}
          </button>

          {committedTotal > 0 && !busy && (
            <button onClick={startNow} style={{ ...S.revealAllBtn, marginTop: 8 }}>▶ 지금 시작</button>
          )}
        </div>
      )}
    </div>
  );
}

// 베팅 영역 (내 작성분 + 다른 플레이어 확정분)
function AreaBox({ label, sub, color, mine, other, onClick, disabled, compact, win }) {
  const m = sum(mine);
  const total = m + (other || 0);
  return (
    <button onClick={onClick} disabled={disabled} data-area-win={win ? "1" : "0"} style={{ ...S.betArea, minHeight: compact ? 84 : 124, opacity: disabled ? 0.6 : 1,
      borderColor: win ? "#FFD76A" : total > 0 ? color : "rgba(255,255,255,0.1)", background: total > 0 ? `${color}1f` : "rgba(255,255,255,0.03)",
      animation: win ? "winArea 1.1s ease-in-out infinite" : "none" }}>
      <span style={{ color, fontWeight: 900, fontSize: compact ? 11 : 14, letterSpacing: 1 }}>{label}</span>
      <span style={S.betAreaSub}>{sub}</span>
      <PlacedChips stack={mine} />
      {total > 0 && <span style={S.placedAmount}>{total.toLocaleString()}</span>}
      {other > 0 && m > 0 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>다른 플레이어 {other.toLocaleString()}</span>}
      {other > 0 && m === 0 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>다른 플레이어</span>}
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
  sessionChip: { fontSize: 10, fontWeight: 900, letterSpacing: 1.2, padding: "3px 10px", borderRadius: 12, border: "1px solid", background: "rgba(0,0,0,0.35)" },
  noMoreBets: { position: "absolute", top: "50%", left: "50%", zIndex: 30, fontSize: 24, fontWeight: 900, letterSpacing: 5, color: "#fff", padding: "10px 24px", borderRadius: 14, background: "linear-gradient(135deg, rgba(220,38,38,0.92), rgba(127,29,29,0.92))", border: "1.5px solid rgba(255,255,255,0.5)", boxShadow: "0 10px 36px rgba(220,38,38,0.5)", animation: "noMoreBets 1.6s ease-out forwards", pointerEvents: "none", whiteSpace: "nowrap", fontFamily: "'Playfair Display', serif" },
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