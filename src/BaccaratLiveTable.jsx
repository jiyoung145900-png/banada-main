// ===================================================================
// 🎰 BANADA VIP BACCARAT · LIVE v4
// ===================================================================
// 혼자: 베팅 확정 → 바로 시작 / 여러 명: 모두 확정하면 시작 (20초 뒤 자동)
// 카드는 자리(PLAYER/BANKER)별 최다 베팅자가 잡고 끌어서 깝니다.
// 모든 진행 상태는 서버(table 문서)가 원천 → 모든 플레이어가 같은 화면.
// ===================================================================

import React, { useState, useRef, useEffect, useMemo } from "react";
import BaccaratDealer from "./BaccaratDealer";
import BaccaratRoadmap, { computeStats } from "./BaccaratRoadmap";
import { speak, setVoiceEnabled, setBgmEnabled, startBGM, stopBGM } from "./BaccaratSound";
import {
  useBaccaratTable, useRoundBets, useBaccaratHistory, useMyBet,
  setBaccaratUser, joinBaccaratTable, heartbeatBaccarat, leaveBaccaratTable,
  placeBaccaratBet, startBaccarat, peekBaccarat, naturalBaccarat, revealMineBaccarat,
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
    @keyframes toastIn { 0% { opacity: 0; transform: translate(-50%, 10px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
  `;
  document.head.appendChild(style);
};

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
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10050, overflow: "hidden" }}>
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

const PIP_LAYOUTS = {
  A: [[50, 50]],
  "2": [[18, 50], [82, 50, true]],
  "3": [[18, 50], [50, 50], [82, 50, true]],
  "4": [[18, 28], [18, 72], [82, 28, true], [82, 72, true]],
  "5": [[18, 28], [18, 72], [50, 50], [82, 28, true], [82, 72, true]],
  "6": [[18, 28], [18, 72], [50, 28], [50, 72], [82, 28, true], [82, 72, true]],
  "7": [[18, 28], [18, 72], [34, 50], [50, 28], [50, 72], [82, 28, true], [82, 72, true]],
  "8": [[18, 28], [18, 72], [34, 50], [50, 28], [50, 72], [66, 50, true], [82, 28, true], [82, 72, true]],
  "9": [[18, 28], [18, 72], [38, 28], [38, 72], [50, 50], [62, 28, true], [62, 72, true], [82, 28, true], [82, 72, true]],
  "10": [[18, 28], [18, 72], [32, 50], [44, 28], [44, 72], [56, 28, true], [56, 72, true], [68, 50, true], [82, 28, true], [82, 72, true]],
};

function CardCenter({ rank, suit, isRed }) {
  if (!rank || !suit) return null;
  const color = isRed ? "#E63975" : "#1F0817";
  if (["J", "Q", "K"].includes(rank))
    return <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 30, fontWeight: 900, fontFamily: "serif", color }}>{rank}</div>;
  if (rank === "A")
    return <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 30 }}>{suit}</div>;
  const pips = PIP_LAYOUTS[rank];
  if (!pips) return null;
  return (
    <>
      {pips.map(([top, left, flipped], i) => (
        <div key={i} style={{ position: "absolute", top: `${top}%`, left: `${left}%`, transform: `translate(-50%, -50%) ${flipped ? "rotate(180deg)" : ""}`, fontSize: 12, lineHeight: 1, fontWeight: 900 }}>
          {suit}
        </div>
      ))}
    </>
  );
}

// 쪼기 모서리: t = 0(뒷면 전체) ~ 4(공개). 정수 단계 사이는 선형 보간 → 드래그와 연속
const PEEL_A = [0, 32, 55, 85, 100];
const PEEL_B = [100, 78, 55, 25, 0];
const LEVEL_OF = { back: 0, peek1: 1, peek2: 2, peek3: 3, revealed: 4 };
function peelClip(t) {
  const i = Math.min(3, Math.floor(t));
  const f = t - i;
  const a = PEEL_A[i] + (PEEL_A[i + 1] - PEEL_A[i]) * f;
  const b = PEEL_B[i] + (PEEL_B[i + 1] - PEEL_B[i]) * f;
  return `polygon(0% 0%, 100% 0%, 100% 100%, ${a}% 100%, 0% ${b}%)`;
}

function Card3D({ card, state, onClick, highlight, fromX = -120, dragT = null, canDrag = false, onDragStart, onDragMove, onDragEnd }) {
  const isRed = card?.suit === "♥" || card?.suit === "♦";
  const clickable = UNREVEALED.includes(state);
  if (state === "empty") return <div style={{ width: 62, height: 87, margin: "0 3px" }} />;

  const isRevealed = state === "revealed";
  const t = dragT !== null ? Math.min(3.99, dragT) : (LEVEL_OF[state] ?? 0);
  const clip = isRevealed ? "polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)" : peelClip(t);
  const dragging = dragT !== null;

  return (
    <div
      onClick={clickable && !canDrag ? onClick : undefined}
      onPointerDown={canDrag ? onDragStart : undefined}
      onPointerMove={canDrag ? onDragMove : undefined}
      onPointerUp={canDrag ? onDragEnd : undefined}
      onPointerCancel={canDrag ? onDragEnd : undefined}
      style={{
        width: 62, height: 87, margin: "0 3px", position: "relative",
        cursor: canDrag ? (dragging ? "grabbing" : "grab") : clickable ? "pointer" : "default",
        touchAction: "none", userSelect: "none",
        animation: state === "back" && !dragging ? "dealIn 0.45s ease-out" : "none",
        "--fx": `${fromX}px`, "--fy": "-130px",
      }}
    >
      {state === "back" && !dragging && <div style={S.peekHint}>{canDrag ? "👆 잡고 끌기" : "👆"}</div>}
      {(state === "peek1" || state === "peek2" || state === "peek3") && !dragging && <div style={{ ...S.peekHint, color: "#FFD700" }}>👁</div>}

      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 8, boxShadow: highlight ? "0 0 20px rgba(255,215,0,0.8), 0 8px 20px rgba(0,0,0,0.6)" : "0 8px 20px rgba(0,0,0,0.6)" }}>
        {/* 앞면 */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "linear-gradient(145deg, #ffffff, #f0f0f0)", color: isRed ? "#E63975" : "#1F0817", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 4, left: 5, fontSize: 13, lineHeight: 1, textAlign: "center", fontFamily: "serif" }}>
            <div style={{ fontWeight: 900 }}>{card?.rank}</div><div style={{ fontSize: 11 }}>{card?.suit}</div>
          </div>
          <CardCenter rank={card?.rank} suit={card?.suit} isRed={isRed} />
          <div style={{ position: "absolute", bottom: 4, right: 5, fontSize: 13, lineHeight: 1, transform: "rotate(180deg)", textAlign: "center", fontFamily: "serif" }}>
            <div style={{ fontWeight: 900 }}>{card?.rank}</div><div style={{ fontSize: 11 }}>{card?.suit}</div>
          </div>
        </div>
        {/* 뒷면 (드래그/단계에 따라 모서리가 들림) */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "linear-gradient(135deg, #4A1033 0%, #2A0520 50%, #1A0512 100%)", border: "2px solid #D4A574", display: "flex", alignItems: "center", justifyContent: "center", clipPath: clip, WebkitClipPath: clip, transition: dragging ? "none" : "clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1)", boxSizing: "border-box" }}>
          <div style={{ border: "1px dashed rgba(212,165,116,0.6)", width: "80%", height: "86%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, color: "#D4A574" }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, opacity: 0.8 }}>VIP</div>
            <div style={{ fontSize: 22 }}>♦</div>
            <div style={{ fontSize: 7, letterSpacing: 2, opacity: 0.6 }}>BACCARAT</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// 베팅 UI 조각
// ────────────────────────────────────────────────────
function PlacedChips({ stack }) {
  if (!stack.length) return null;
  const visible = stack.slice(-3);
  return (
    <div style={S.placedChips}>
      {stack.length > 3 && <span style={S.extraChipCount}>+{stack.length - 3}</span>}
      {visible.map((v, i) => (
        <span key={`${i}-${v}`} style={{ ...S.placedChip, background: chipBg(v) }}>{fmtChip(v)}</span>
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
const LEVEL_STATE = ["back", "peek1", "peek2", "peek3", "revealed"];
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
      arr.push(LEVEL_STATE[peek[side][i] ?? 0]);
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
    if (!resultInit.current) { resultInit.current = true; lastSeenResult.current = r; return; }
    if (lastSeenResult.current === r) return;
    lastSeenResult.current = r;
    const w = table.lastResult?.winner;
    speakDealer(w === "player" ? "Player wins" : w === "banker" ? "Banker wins" : "Tie");
    playSound("win");
    // 내가 이긴 판이면 폭죽: 정산된 내 베팅 기록으로 확인
    const mine = roundBets.find((b) => b.userId === userId && b.round === r);
    if (mine && mine.net > 0) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3200); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.lastResultRound]);

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

  // ── 쪼기 (한 단계씩) / 드래그 / 모두 열기 ──
  const peekPending = useRef({});
  const drag = useRef(null);
  const [dragView, setDragView] = useState(null);
  const DRAG_FULL_PX = 120;

  const squeeze = async (side, idx) => {
    if (!squeezeOpen) return;
    const key = `${side}${idx}`;
    if (peekPending.current[key]) return;
    peekPending.current[key] = true;
    playSound("peek");
    try { await peekBaccarat(tableId, side === "p" ? "player" : "banker", idx); }
    catch (e) { showToast(e.message || "쪼기 실패"); }
    finally { peekPending.current[key] = false; }
  };
  const onDragStart = (side, idx) => (e) => {
    if (phase !== "dealing") { showToast("베팅이 확정되면 카드가 나옵니다"); return; }
    if (!canSqueeze(side)) {
      const o = side === "p" ? ownerP : ownerB;
      showToast(o ? `${names[o] || "상대"} 님이 까는 쪽입니다` : "카드가 나오는 중입니다");
      return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    const d = { side, idx, startX: e.clientX, dx: 0 };
    drag.current = d;
    setDragView({ ...d });
  };
  const onDragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.dx = e.clientX - d.startX;
    setDragView({ ...d });
  };
  const onDragEnd = () => {
    const d = drag.current;
    drag.current = null;
    setDragView(null);
    if (!d) return;
    const progress = Math.min(1, Math.abs(d.dx) / DRAG_FULL_PX);
    if (progress >= 0.5 || Math.abs(d.dx) < 6) squeeze(d.side, d.idx);
  };
  const dragTFor = (side, idx, state) => {
    const d = dragView;
    if (!d || d.side !== side || d.idx !== idx) return null;
    return (LEVEL_OF[state] ?? 0) + Math.min(1, Math.abs(d.dx) / DRAG_FULL_PX);
  };
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
    if (phase === "dealing") return elapsed < NATURAL_WAIT ? "🎴 카드 딜링 중..." : "🎴 카드를 잡고 좌우로 끌어서 열어보세요";
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
  const bettorList = roundBets.map((b) => ({ name: b.nickname || "GUEST", total: b.totalBet || 0, mine: b.userId === userId }));

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
                <Card3D key={`p${i}`} card={pVals[i] || undefined} state={st} fromX={-60}
                  dragT={dragTFor("p", i, st)} canDrag={canSqueeze("p") && UNREVEALED_STATES.includes(st)}
                  onDragStart={onDragStart("p", i)} onDragMove={onDragMove} onDragEnd={onDragEnd}
                  onClick={() => squeeze("p", i)} highlight={fresh && phase === "betting" && lastRes.winner === "player"} />
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
                <Card3D key={`b${i}`} card={bVals[i] || undefined} state={st} fromX={-230}
                  dragT={dragTFor("b", i, st)} canDrag={canSqueeze("b") && UNREVEALED_STATES.includes(st)}
                  onDragStart={onDragStart("b", i)} onDragMove={onDragMove} onDragEnd={onDragEnd}
                  onClick={() => squeeze("b", i)} highlight={fresh && phase === "betting" && lastRes.winner === "banker"} />
              ))}
            </div>
            <div style={{ ...S.scoreBox, color: "#E63975", borderColor: "rgba(230,57,117,0.3)" }}>{displayB}</div>
          </div>
        </div>

        {fresh && phase === "betting" && (
          <div style={S.resultOverlay}>
            <div style={{ ...S.resultBanner, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.9), transparent)" }}>
              <div style={S.resultTitle}>{lastRes.winner === "player" ? "PLAYER WINS" : lastRes.winner === "banker" ? "BANKER WINS" : "TIE"}</div>
            </div>
          </div>
        )}
      </div>

      {bettorList.length > 0 && (
        <div style={S.mySummary}>
          👥 {bettorList.map((b) => `${b.name} ${b.total.toLocaleString()}${b.mine ? " (나)" : ""}`).join(" · ")}
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
            {CHIPS.map((v) => (
              <button key={v} onClick={() => setSelectedChip(v)} disabled={shownPoints < v}
                style={{ ...S.chipBtn, background: chipBg(v),
                  border: selectedChip === v ? "3px solid #FFD700" : "3px dashed rgba(255,255,255,0.65)",
                  boxShadow: selectedChip === v ? "0 0 16px rgba(255,215,0,0.7)" : "0 4px 10px rgba(0,0,0,0.5)",
                  transform: selectedChip === v ? "translateY(-3px) scale(1.06)" : "none",
                  opacity: shownPoints < v ? 0.3 : 1 }}>{fmtChip(v)}</button>
            ))}
          </div>

          <div style={S.boardAreas}>
            <AreaBox label="PLAYER" sub="1 : 1" color="#3B82F6" mine={desired.player} other={serverArea.player} onClick={() => placeChip("player")} disabled={!bettingOpen} />
            <AreaBox label="TIE" sub="8 : 1" color="#10B981" mine={desired.tie} other={serverArea.tie} onClick={() => placeChip("tie")} disabled={!bettingOpen} />
            <AreaBox label="BANKER" sub="0.95 : 1" color="#E63975" mine={desired.banker} other={serverArea.banker} onClick={() => placeChip("banker")} disabled={!bettingOpen} />
          </div>
          <div style={S.boardAreas}>
            <AreaBox compact label="P PAIR" sub="11 : 1" color="#60A5FA" mine={desired.playerPair} other={serverArea.playerPair} onClick={() => placeChip("playerPair")} disabled={!bettingOpen} />
            <AreaBox compact label="PERFECT" sub="25 : 1" color="#D4A574" mine={desired.perfectPair} other={serverArea.perfectPair} onClick={() => placeChip("perfectPair")} disabled={!bettingOpen} />
            <AreaBox compact label="B PAIR" sub="11 : 1" color="#F472B6" mine={desired.bankerPair} other={serverArea.bankerPair} onClick={() => placeChip("bankerPair")} disabled={!bettingOpen} />
          </div>

          <div style={S.infoLine}>
            내 작성 {desiredTotal.toLocaleString()}
            {committedTotal > 0 && ` · 확정 ${committedTotal.toLocaleString()}`}
            {" · 최대 "}{MAX_BET.toLocaleString()}
          </div>

          <div style={S.chipControls}>
            <button onClick={removeLastChip} disabled={desiredTotal === 0} style={{ ...S.chipControlBtn, background: "linear-gradient(135deg, #6B7280, #4B5563)", opacity: desiredTotal === 0 ? 0.4 : 1 }}>↩ 마지막 칩 취소</button>
            <button onClick={clearDesired} disabled={desiredTotal === 0} style={{ ...S.chipControlBtn, background: "linear-gradient(135deg, #DC2626, #991B1B)", opacity: desiredTotal === 0 ? 0.4 : 1 }}>🗑 전체 리셋</button>
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
function AreaBox({ label, sub, color, mine, other, onClick, disabled, compact }) {
  const m = sum(mine);
  const total = m + (other || 0);
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...S.betArea, minHeight: compact ? 84 : 124, opacity: disabled ? 0.6 : 1,
      borderColor: total > 0 ? color : "rgba(255,255,255,0.1)", background: total > 0 ? `${color}1f` : "rgba(255,255,255,0.03)" }}>
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
  chipBtn: { width: 46, height: 46, borderRadius: "50%", color: "#17120A", fontWeight: 900, fontSize: 10, cursor: "pointer", transition: "all 0.2s" },
  boardAreas: { display: "flex", gap: 6, marginBottom: 8 },
  betArea: { flex: 1, minWidth: 0, padding: "10px 4px", border: "2px solid rgba(255,255,255,0.1)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 2, cursor: "pointer", transition: "all 0.2s", color: "#fff" },
  betAreaSub: { fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 1 },
  placedChips: { display: "flex", alignItems: "center", justifyContent: "center", gap: 3, minHeight: 24, marginTop: 6, flexWrap: "wrap", maxWidth: "100%" },
  placedChip: { width: 31, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#17120A", fontWeight: 900, fontSize: 8, border: "2px dashed rgba(255,255,255,0.85)", boxShadow: "0 2px 4px rgba(0,0,0,0.5)", flex: "0 0 auto" },
  extraChipCount: { color: "#fff", fontSize: 9, fontWeight: 800 },
  placedAmount: { fontSize: 11, color: "#F5E9D2", fontWeight: 800, marginTop: 4 },
  infoLine: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "8px 0" },
  chipControls: { display: "flex", gap: 8, marginBottom: 6 },
  chipControlBtn: { flex: 1, height: 42, fontSize: 12, fontWeight: 800, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" },
  actionBtn: { width: "100%", padding: 18, background: "linear-gradient(135deg, #D4A574, #B07D46)", border: "none", color: "#000", borderRadius: 16, fontSize: 15, fontWeight: 900, letterSpacing: 2, cursor: "pointer", boxShadow: "0 8px 20px rgba(212,165,116,0.3)" },

  statusBar: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 16, background: "rgba(212,165,116,0.08)", border: "1px dashed rgba(212,165,116,0.35)", borderRadius: 14, textAlign: "center", color: "#D4A574", fontSize: 13, fontWeight: 700 },
  ownerTag: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: -8, marginBottom: 10, letterSpacing: 0.5 },
  squeezeGuide: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.55)", margin: "4px 0 10px", padding: 6, background: "rgba(255,255,255,0.03)", borderRadius: 8 },
  revealAllBtn: { width: "100%", padding: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(212,165,116,0.4)", color: "#F0D4B8", borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 1 },

  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,25,0.95)", border: "1px solid rgba(212,165,116,0.5)", color: "#F0D4B8", padding: "10px 18px", borderRadius: 24, fontSize: 12, fontWeight: 700, zIndex: 10100, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", animation: "toastIn 0.25s ease-out", maxWidth: "90vw", textAlign: "center" },
};