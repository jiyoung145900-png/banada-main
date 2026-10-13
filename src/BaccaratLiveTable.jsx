// ===================================================================
// 🎰 BANADA VIP BACCARAT · LIVE v3
// ===================================================================
// 서버(table 문서)가 진행 상태의 원천 → 모든 플레이어가 같은 화면.
// 딜러 = 이번 라운드 최다 베팅자 (서버가 최종 판단).
// ===================================================================

import React, { useState, useRef, useEffect, useMemo } from "react";
import BaccaratDealer from "./BaccaratDealer";
import BaccaratRoadmap, { computeStats } from "./BaccaratRoadmap";
import { speak, setVoiceEnabled, setBgmEnabled, startBGM, stopBGM } from "./BaccaratSound";
import {
  useBaccaratTable, useRoundBets, useBaccaratHistory, useMyBet,
  joinBaccaratTable, heartbeatBaccarat, leaveBaccaratTable,
  placeBaccaratBet, dealBaccarat, peekBaccarat, naturalBaccarat, revealSideBaccarat,
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
// 메인 컴포넌트 v3 - 서버 상태를 그대로 그림 (모든 플레이어 동일 화면)
// ====================================================================
const NATURAL_WAIT = 2000;
const LEVEL_STATE = ["back", "peek1", "peek2", "peek3", "revealed"];
const AREA_KEYS = ["player", "banker", "tie", "playerPair", "bankerPair", "perfectPair"];

// 서버와 동일한 딜러 규칙 (표시용)
function dealerInfo(table, now) {
  const bets = table.roundBets || {};
  const order = table.betOrder || {};
  const present = table.players || [];
  const cands = Object.keys(bets)
    .filter((u) => bets[u] > 0 && present.includes(u))
    .sort((a, b) => bets[b] - bets[a] || (order[a] || 0) - (order[b] || 0));
  if (!cands.length) return { cands, status: "none" };
  if (!table.bettingEndsAt) return { cands, status: "open", dealer: cands[0], remain: 0 };
  if (now < table.bettingEndsAt) return { cands, status: "betting", remain: table.bettingEndsAt - now };
  const idx = Math.floor((now - table.bettingEndsAt) / 8000);
  if (idx < cands.length) {
    return { cands, status: "open", dealer: cands[idx], remain: table.bettingEndsAt + (idx + 1) * 8000 - now, idx };
  }
  return { cands, status: "auto" };
}

export default function BaccaratLiveTable({ tableId, userId, userName, gamePoints = 0, onLeave = () => {} }) {
  useEffect(() => { injectKeyframes(); }, []);

  const { table, loading } = useBaccaratTable(tableId);
  const round = table?.currentRound || 1;
  // 예전 버전의 phase(waiting/result)도 베팅 가능 상태로 취급
  const phase = table?.phase === "dealing" ? "dealing" : "betting";
  // 접속이 끊긴(하트비트 30초 이상) 플레이어는 목록에서 제외 → 담당/딜러 계산이 막히지 않음
  const players = (table?.players || []).filter(
    (u) => (table?.playerSeen?.[u] || 0) >= serverNowMs() - 30000
  );
  const multi = players.length > 1;
  const names = table?.names || {};
  const roundBets = useRoundBets(tableId, round);
  const myCommitted = useMyBet(userId, tableId, round);
  const history = useBaccaratHistory(tableId, 80);
  const winners = useMemo(() => history.map((h) => h.winner), [history]);
  const stats = useMemo(() => computeStats(winners), [winners]);

  // 시계 (서버 시각 기준으로 500ms 마다 갱신)
  const [now, setNow] = useState(serverNowMs());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNowMs()), 250);
    return () => clearInterval(id);
  }, []);

  // 입장 / 하트비트 / 퇴장
  useEffect(() => {
    if (!tableId || !userId) return;
    joinBaccaratTable(tableId, userName).catch((e) => console.error("[Baccarat] 입장 실패:", e));
    const hb = setInterval(() => heartbeatBaccarat(tableId), 10000);
    return () => { clearInterval(hb); leaveBaccaratTable(tableId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, userId]);

  // 로컬 UI 상태
  const [selectedChip, setSelectedChip] = useState(CHIPS[0]);
  const [desired, setDesired] = useState(emptyStacks);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [showRoadmap, setShowRoadmap] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [bgmOn, setBgmOn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [resultShown, setResultShown] = useState(null);
  const resultInit = useRef(false);
  const toastTimer = useRef(null);
  useEffect(() => { setDesired(emptyStacks()); }, [round]);
  const audioRef = useRef(null);

  const showToast = (m) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  // 사운드
  const playSound = (type) => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
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

  // 내 칩(작성 중) 합계 / 서버에 확정된 합계
  const sum = (a = []) => a.reduce((s, v) => s + v, 0);
  const desiredTotal = AREA_KEYS.reduce((s, k) => s + sum(desired[k]), 0);
  const committedTotal = myCommitted && !myCommitted.settled ? myCommitted.totalBet || 0 : 0;
  const mainDesired = sum(desired.player) + sum(desired.banker) + sum(desired.tie);
  const shownPoints = gamePoints - (desiredTotal - committedTotal);

  // 다른 플레이어 포함 영역별 합계 (내 작성분 제외한 서버 확정분)
  const serverArea = useMemo(() => {
    const out = {}; AREA_KEYS.forEach((k) => (out[k] = 0));
    roundBets.forEach((b) => {
      if (b.userId === userId) return;
      AREA_KEYS.forEach((k) => (out[k] += (b.bets && b.bets[k]) || 0));
    });
    return out;
  }, [roundBets, userId]);
  const bettorList = roundBets.map((b) => ({ name: b.nickname || "GUEST", total: b.totalBet || 0, mine: b.userId === userId }));

  // 딜러 상태 (서버 규칙 미러링)
  const dealer = table ? dealerInfo(table, now) : { status: "none", cands: [] };
  const amDealer = dealer.status === "open" && dealer.dealer === userId;
  const amAuto = dealer.status === "auto" && players.includes(userId);
  const canDeal = phase === "betting" && (amDealer || amAuto);

  // ── 딜링 연출: 서버 시각 기준 (모든 화면이 같은 타이밍) ──
  const dealAt = table?.deal?.dealAt || 0;
  const elapsed = phase === "dealing" || phase === "betting" && dealAt ? now - dealAt : 0;
  const drawn = table?.drawn || { p: 2, b: 2 };
  const peek = table?.peek || { p: [0, 0, 0], b: [0, 0, 0] };
  const revealV = table?.reveal || { p: [null, null, null], b: [null, null, null] };
  const shownCount = (side) => {
    if (phase !== "dealing") return drawn[side];
    const thresholds = side === "p" ? [500, 1600] : [1050, 2150];
    const n = elapsed >= thresholds[1] ? 2 : elapsed >= thresholds[0] ? 1 : 0;
    return Math.min(n, drawn[side]);
  };
  const cardStates = (side) => {
    const cnt = shownCount(side);
    const arr = [];
    for (let i = 0; i < 3; i++) {
      if (i >= drawn[side]) { arr.push("empty"); continue; }
      if (i >= cnt && i < 2) { arr.push("empty"); continue; }
      if (i === 2 && phase === "dealing" && peek[side][i] === 0 && drawn[side] === 3) { arr.push("back"); continue; }
      arr.push(LEVEL_STATE[peek[side][i] ?? 0]);
    }
    return arr;
  };
  const lastCards = table?.lastResult;
  const fresh = !!lastCards && serverNowMs() - (table?.lastActionAt || 0) < 6000;
  const pStates = phase === "dealing" ? cardStates("p")
    : fresh ? lastCards.playerCards.map(() => "revealed")
    : ["empty", "empty", "empty"];
  const bStates = phase === "dealing" ? cardStates("b")
    : fresh ? lastCards.bankerCards.map(() => "revealed")
    : ["empty", "empty", "empty"];
  const pVals = phase === "dealing" ? revealV.p : (fresh ? lastCards.playerCards : []);
  const bVals = phase === "dealing" ? revealV.b : (fresh ? lastCards.bankerCards : []);

  // 자동 내추럴 공개 (딜링 끝나면 누구나 한 번 호출 → 서버가 내추럴일 때만 공개)
  const naturalSent = useRef(0);
  const naturalReady = phase === "dealing" && !!dealAt && now - dealAt >= NATURAL_WAIT + 150;
  useEffect(() => {
    if (!naturalReady || naturalSent.current === dealAt) return;
    naturalSent.current = dealAt;
    naturalBaccarat(tableId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalReady, dealAt]);

  // 연출 사운드 (딜 시점)
  const lastDealSound = useRef(0);
  useEffect(() => {
    if (phase === "dealing" && dealAt && lastDealSound.current !== dealAt) {
      lastDealSound.current = dealAt;
      speakDealer("Dealing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dealAt]);

  // 결과 발표: 라운드가 끝나 lastResultRound 가 바뀌면
  useEffect(() => {
    const r = table?.lastResultRound;
    if (!r) return;
    if (!resultInit.current) { resultInit.current = true; setResultShown(r); return; }
    if (resultShown === r) return;
    setResultShown(r);
    if (!table.lastResult) return;
    const w = table.lastResult.winner;
    speakDealer(w === "player" ? "Player wins" : w === "banker" ? "Banker wins" : "Tie");
    playSound("win");
    if (myCommitted && myCommitted.round === r && myCommitted.net > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.lastResultRound]);


  // 칩 조작 (작성 중인 것만 - 확정 전까지 서버에 없음)
  const canEdit = phase === "betting" && !busy && !(dealer.status === "betting" ? false : dealer.status === "auto" && false);
  const placeChip = (target) => {
    if (!canEdit) return;
    if (desiredTotal + selectedChip > MAX_BET) return showToast(`최대 베팅 ${MAX_BET.toLocaleString()}`);
    if (shownPoints < selectedChip) return showToast("포인트가 부족합니다");
    if (table?.bettingEndsAt && now >= table.bettingEndsAt) return showToast("베팅이 마감되었습니다");
    playSound("chip");
    setDesired((prev) => ({ ...prev, [target]: [...prev[target], selectedChip] }));
  };
  const removeLastChip = () => {
    // 가장 최근에 놓은 칩 위치는 알 수 없으므로 전체 중 마지막 비어있지 않은 영역에서 제거
    setDesired((prev) => {
      const next = { ...prev };
      for (const k of [...AREA_KEYS].reverse()) if (next[k].length) { next[k] = next[k].slice(0, -1); break; }
      return next;
    });
  };
  const clearDesired = () => setDesired(emptyStacks());

  // 베팅 확정 (서버가 한도·잔액·마감 검증, 차액만 차감)
  const confirmBet = async () => {
    if (busy) return;
    const bets = {}; AREA_KEYS.forEach((k) => (bets[k] = sum(desired[k])));
    const total = AREA_KEYS.reduce((s, k) => s + bets[k], 0);
    if (bets.player + bets.banker + bets.tie <= 0) return showToast("PLAYER / BANKER / TIE 중 한 곳에 베팅하세요");
    if (total < MIN_BET) return showToast(`최소 베팅 ${MIN_BET.toLocaleString()}`);
    setBusy(true);
    try {
      await placeBaccaratBet({ userId, nickname: userName, tableId, bets });
      // 혼자 있을 때는 확정과 동시에 바로 딜 (여러 명이면 딜러가 DEAL)
      if (players.length <= 1 && phase === "betting") {
        await dealBaccarat(tableId);
      }
      showToast(`베팅 확정 · ${total.toLocaleString()}`);
    } catch (err) {
      showToast(err.message || "베팅 실패");
    } finally { setBusy(false); }
  };

  // DEAL (딜러 권한은 서버가 최종 판단)
  const deal = async () => {
    if (busy) return;
    setBusy(true);
    try { await dealBaccarat(tableId); }
    catch (err) { showToast(err.message || "딜 실패"); }
    finally { setBusy(false); }
  };

  // 쪼기 (공유): 서버에 한 단계 요청 → 모든 화면에 같이 반영
  const peekPending = useRef({});
  const drag = useRef(null);
  const [dragView, setDragView] = useState(null);
  const squeeze = async (side, idx) => {
    if (phase !== "dealing" || elapsed < NATURAL_WAIT) return;
    const key = `${side}${idx}`;
    if (peekPending.current[key]) return;
    peekPending.current[key] = true;
    playSound("peek");
    try { await peekBaccarat(tableId, side === "p" ? "player" : "banker", idx); }
    catch (e) { showToast(e.message || "쪼기 실패"); }
    finally { peekPending.current[key] = false; }
  };

  // 자리별 카드 담당 = 그 자리에 가장 많이 건 접속 중 플레이어 (서버와 동일 규칙)
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
  const iOwn = (k) => (k === "p" ? ownerP : ownerB) === userId;
  const canSqueeze = (side) => {
    if (phase !== "dealing" || elapsed < NATURAL_WAIT) return false;
    const owner = side === "p" ? ownerP : ownerB;
    return owner === userId || (owner === null && players.includes(userId));
  };
  const ownerLabel = (k) => {
    const o = k === "p" ? ownerP : ownerB;
    if (!o) return "누구나 깔 수 있음";
    return o === userId ? "👉 내가 깝니다" : `🫴 ${names[o] || "플레이어"} 님이 깝니다`;
  };

  // 드래그 쪼기: 잡고 좌우로 끌면 모서리가 같이 들림. 60% 이상 끌거나 가볍게 누르면 한 단계 공개
  const DRAG_FULL_PX = 120;
  const onDragStart = (side, idx) => (e) => {
    if (phase !== "dealing") { showToast("카드는 딜러가 DEAL 한 뒤에 열 수 있어요"); return; }
    if (!canSqueeze(side)) {
      const o = side === "p" ? ownerP : ownerB;
      showToast(o ? `${names[o] || "상대"} 님이 까는 쪽입니다` : "지금은 쪼갤 수 없습니다");
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
    const tap = Math.abs(d.dx) < 6;
    if (progress >= 0.5 || tap) squeeze(d.side, d.idx);
  };
  // 드래그 중인 카드의 진행도 (현재 단계 + 끈 정도) — 뒤집힌 단계부터 이어서
  const dragTFor = (side, idx, state) => {
    const d = dragView;
    if (!d || d.side !== side || d.idx !== idx) return null;
    const base = LEVEL_OF[state] ?? 0;
    return base + Math.min(1, Math.abs(d.dx) / DRAG_FULL_PX);
  };

  // 내 쪽 전체 공개 (자기 쪽 소유자만)
  const revealMySide = async (k) => {
    if (phase !== "dealing" || elapsed < NATURAL_WAIT) return;
    playSound("reveal");
    try { await revealSideBaccarat(tableId, k === "p" ? "player" : "banker"); }
    catch (e) { showToast(e.message || "공개 실패"); }
  };
  const hasUnrevealed = [...pStates, ...bStates].some((s) => ["back", "peek1", "peek2", "peek3"].includes(s));
  const mySideOpen = (k) => iOwn(k) && phase === "dealing" && elapsed >= NATURAL_WAIT
    && (k === "p" ? pStates : bStates).some((s) => ["back", "peek1", "peek2", "peek3"].includes(s));

  // 표시 값
  const revealedScore = (side) => {
    const vals = (side === "p" ? [0, 1, 2] : [0, 1, 2]).filter((i) => (table?.peek?.[side]?.[i] ?? 0) === 4 && revealV[side][i]).map((i) => revealV[side][i]);
    return vals.length ? handScore(vals) : "-";
  };
  const lastRes = table?.lastResult;
  const displayP = phase === "result" || (phase === "betting" && lastRes) ? (lastRes ? lastRes.playerValue : "-") : revealedScore("p");
  const displayB = phase === "result" || (phase === "betting" && lastRes) ? (lastRes ? lastRes.bankerValue : "-") : revealedScore("b");
  const showResultBanner = phase === "betting" && lastRes && table?.lastResultRound === resultShown && now - (table?.lastActionAt || 0) < 6000;

  const roundLabel = `${tableId === "table1" ? "T1" : "T2"}-#${round}`;
  const dealerMessage = (() => {
    if (phase === "dealing") return hasUnrevealed ? "SQUEEZE YOUR CARDS!" : "DEALING...";
    if (dealer.status === "betting") return "PLACE YOUR BETS";
    if (dealer.status === "open") return amDealer ? "YOU DEAL!" : `DEALER: ${names[dealer.dealer] || "..."}`;
    if (dealer.status === "auto") return "ANYONE CAN DEAL";
    if (phase === "betting" && lastRes) {
      const w = lastRes.winner === "player" ? "PLAYER" : lastRes.winner === "banker" ? "BANKER" : "TIE";
      return `${w} WINS`;
    }
    return "PLACE YOUR BETS";
  })();

  if (loading) {
    return (
      <div style={{ ...S.container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎰</div>
        <div style={{ color: "#D4A574", fontSize: 13, letterSpacing: 2 }}>테이블 입장 중...</div>
      </div>
    );
  }

  const bettingOpen = phase === "betting" && !(table?.bettingEndsAt && now >= table.bettingEndsAt);

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
        speaking={phase === "dealing"} noMoreBets={dealer.status === "auto"} />

      {/* 베팅 타이머 / 딜러 대기 */}
      <div style={S.timerBar}>
        <div style={{ ...S.timerFill, width: dealer.status === "betting" && table?.bettingEndsAt ? `${Math.max(0, Math.min(100, (dealer.remain / 20000) * 100))}%` : "100%" }} />
        <div style={S.timerText}>
          {dealer.status === "betting" && `⏰ 베팅 마감까지 ${Math.ceil(dealer.remain / 1000)}초`}
          {dealer.status === "open" && `🎴 ${amDealer ? "당신이 딜러입니다 · DEAL 을 누르세요" : `${names[dealer.dealer] || "딜러"} 차례 · ${Math.ceil(dealer.remain / 1000)}초`}`}
          {dealer.status === "auto" && "🎴 누구나 DEAL 가능"}
          {dealer.status === "none" && (phase === "dealing" ? "🎴 진행 중" : "💭 베팅을 기다리는 중")}
        </div>
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
                  dragT={dragTFor("p", i, st)}
                  canDrag={canSqueeze("p") && ["back", "peek1", "peek2", "peek3"].includes(st)}
                  onDragStart={onDragStart("p", i)} onDragMove={onDragMove} onDragEnd={onDragEnd}
                  onClick={() => squeeze("p", i)} highlight={!!lastRes && lastRes.winner === "player" && phase === "betting"} />
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
                  dragT={dragTFor("b", i, st)}
                  canDrag={canSqueeze("b") && ["back", "peek1", "peek2", "peek3"].includes(st)}
                  onDragStart={onDragStart("b", i)} onDragMove={onDragMove} onDragEnd={onDragEnd}
                  onClick={() => squeeze("b", i)} highlight={!!lastRes && lastRes.winner === "banker" && phase === "betting"} />
              ))}
            </div>
            <div style={{ ...S.scoreBox, color: "#E63975", borderColor: "rgba(230,57,117,0.3)" }}>{displayB}</div>
          </div>
        </div>

        {showResultBanner && (
          <div style={S.resultOverlay}>
            <div style={{ ...S.resultBanner, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.9), transparent)" }}>
              <div style={S.resultTitle}>{lastRes.winner === "player" ? "PLAYER WINS" : lastRes.winner === "banker" ? "BANKER WINS" : "TIE"}</div>
            </div>
          </div>
        )}
      </div>

      {/* 같은 테이블 참가자 베팅 현황 (모두 동일하게 보임) */}
      {bettorList.length > 0 && (
        <div style={S.mySummary}>
          👥 {bettorList.map((b) => `${b.name} ${b.total.toLocaleString()}${b.mine ? " (나)" : ""}`).join(" · ")}
        </div>
      )}

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
            style={{ ...S.actionBtn, marginTop: 8, opacity: busy || mainDesired === 0 || desiredTotal === committedTotal ? 0.5 : 1 }}>
            {busy ? "⏳ 처리 중..." : committedTotal > 0 && desiredTotal === committedTotal ? "✅ 베팅 확정됨" : committedTotal > 0 ? `✏️ 베팅 수정 (${desiredTotal.toLocaleString()})` : `✅ 베팅 확정 (${desiredTotal.toLocaleString()})`}
          </button>

          {canDeal && (
            <button onClick={deal} disabled={busy} style={{ ...S.actionBtn, marginTop: 10, background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff" }}>
              🎴 DEAL {amDealer ? "(딜러)" : amAuto ? "(누구나)" : ""}
            </button>
          )}
          {!canDeal && multi && dealer.status === "betting" && (
            <div style={S.infoLine}>💭 베팅 마감 후 가장 많이 건 사람이 딜러가 됩니다</div>
          )}
        </div>
      )}

      {phase === "dealing" && (
        <div style={S.statusBar}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{elapsed < NATURAL_WAIT ? "🎴 카드 딜링 중..." : hasUnrevealed ? "카드를 터치해서 열어보세요 👆" : "마무리 중..."}</div>
        </div>
      )}
      {phase === "dealing" && elapsed >= NATURAL_WAIT && hasUnrevealed && !mySideOpen("p") && !mySideOpen("b") && (
        <div style={S.squeezeGuide}>카드를 잡고 좌우로 끌어서 여세요 (살짝 누르면 한 단계씩 열려요)</div>
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