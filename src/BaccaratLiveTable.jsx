// ===================================================================
// 🎰 BANADA VIP BACCARAT · LIVE MULTI-TABLE
// ===================================================================
// 흐름: 입장 → 칩 베팅(즉시 차감) → READY/DEAL → 서버 결과 수신
//       → 슈통에서 1장씩 딜링 → 쪼기(내추럴이면 자동 공개)
//       → 서드카드 1장씩 추가 → 결과
// 포인트: 칩은 화면에서만 들고 있다가 READY/DEAL 시 서버가 한도·잔액 검증 후
//         차감(트랜잭션) → 결과 정산 지급도 서버. 클라이언트는 포인트를 직접 쓰지 않음
// ===================================================================

import React, { useState, useRef, useEffect, useMemo } from "react";
import BaccaratDealer from "./BaccaratDealer";
import BaccaratRoadmap, { computeStats } from "./BaccaratRoadmap";
import { speak, setVoiceEnabled, setBgmEnabled, startBGM, stopBGM } from "./BaccaratSound";
import {
  useBaccaratTable,
  useBaccaratHistory,
  useMyLatestBet,
  placeBaccaratBet,
  joinBaccaratTable,
  leaveBaccaratTable,
  sendReady,
  sendHeartbeat,
  MIN_BET,
  MAX_BET,
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

function Card3D({ card, state, onClick, highlight, fromX = -120 }) {
  const isRed = card?.suit === "♥" || card?.suit === "♦";
  const clickable = UNREVEALED.includes(state);
  if (state === "empty") return <div style={{ width: 62, height: 87, margin: "0 3px" }} />;

  const clip = {
    back: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
    peek1: "polygon(0% 0%, 100% 0%, 100% 100%, 32% 100%, 0% 78%)",
    peek2: "polygon(0% 0%, 100% 0%, 100% 100%, 55% 100%, 0% 55%)",
    peek3: "polygon(0% 0%, 100% 0%, 100% 100%, 85% 100%, 0% 25%)",
    revealed: "polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)",
  }[state] || "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        width: 62, height: 87, margin: "0 3px", position: "relative",
        cursor: clickable ? "pointer" : "default",
        animation: state === "back" ? "dealIn 0.45s ease-out" : "none",
        "--fx": `${fromX}px`, "--fy": "-130px",
      }}
    >
      {state === "back" && <div style={S.peekHint}>👆</div>}
      {(state === "peek1" || state === "peek2" || state === "peek3") && <div style={{ ...S.peekHint, color: "#FFD700" }}>👁</div>}

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
        {/* 뒷면 (쪼기 clip-path) */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "linear-gradient(135deg, #4A1033 0%, #2A0520 50%, #1A0512 100%)", border: "2px solid #D4A574", display: "flex", alignItems: "center", justifyContent: "center", clipPath: clip, WebkitClipPath: clip, transition: "clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)", boxSizing: "border-box" }}>
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
// 메인 컴포넌트
// ====================================================================
export default function BaccaratLiveTable({
  tableId,
  userId,
  userName,
  gamePoints = 0, // 서버(DB) 실시간 포인트
  onLeave = () => {},
}) {
  useEffect(() => { injectKeyframes(); }, []);

  // ── 서버 상태 ──
  const { table, loading: tableLoading } = useBaccaratTable(tableId);
  const serverCurrentRound = table?.currentRound || 1;
  const serverPlayers = table?.players || [];
  const serverReadyPlayers = table?.readyPlayers || [];
  const playerCount = serverPlayers.length;
  const multi = playerCount > 1;
  const points = gamePoints;

  const serverHistory = useBaccaratHistory(tableId, 80);

  // ── 로컬 상태 ──
  const [phase, setPhase] = useState("betting"); // betting | waiting_ready | dealing | squeezing | result
  const [selectedChip, setSelectedChip] = useState(CHIPS[0]);
  const [betStacks, setBetStacks] = useState(emptyStacks);
  const [betHistory, setBetHistory] = useState([]);
  const [gameData, setGameData] = useState(null);
  const [pCards, setPCards] = useState(["empty", "empty"]);
  const [bCards, setBCards] = useState(["empty", "empty"]);
  const [result, setResult] = useState(null);
  const [activeRound, setActiveRound] = useState(0); // 현재 연출 중인 라운드
  const [betRound, setBetRound] = useState(0); // 내가 베팅 제출한 라운드
  const [bettingTimeLeft, setBettingTimeLeft] = useState(BETTING_DURATION);
  const [isSendingReady, setIsSendingReady] = useState(false);
  const [readyError, setReadyError] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [bgmOn, setBgmOn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [noMoreBetsFlash, setNoMoreBetsFlash] = useState(false);
  const [dealerSpeaking, setDealerSpeaking] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(true);
  const [toast, setToast] = useState("");
  const [lockedBase, setLockedBase] = useState(null); // 베팅 제출 시점 잔액 (연출 중 표시용)
  const [waitSeconds, setWaitSeconds] = useState(0);

  // ── 내 베팅 (서버 정산 상태) ──
  const myBet = useMyLatestBet(userId, tableId, betRound);

  // ── 베팅 합계 ──
  const mainBets = { player: sum(betStacks.player), tie: sum(betStacks.tie), banker: sum(betStacks.banker) };
  const sideBets = { playerPair: sum(betStacks.playerPair), bankerPair: sum(betStacks.bankerPair), perfectPair: sum(betStacks.perfectPair) };
  const totalMainBet = mainBets.player + mainBets.tie + mainBets.banker;
  const totalSideBet = sideBets.playerPair + sideBets.bankerPair + sideBets.perfectPair;
  const totalBet = totalMainBet + totalSideBet;

  // ── refs (stale closure 방지) ──
  const aliveRef = useRef(true);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const totalBetRef = useRef(0); totalBetRef.current = totalBet;
  const totalMainBetRef = useRef(0); totalMainBetRef.current = totalMainBet;
  const voiceRef = useRef(true); voiceRef.current = voiceOn;
  const timersRef = useRef([]);
  const nextTimerRef = useRef(null);
  const speakTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const initRef = useRef(false);
  const processedRoundRef = useRef(0);
  const mySubmittedRoundRef = useRef(0);
  const sendingRef = useRef(false);
  const thirdLockRef = useRef(false);
  const finalizedRoundRef = useRef(0);
  const activeRoundRef = useRef(0);
  const handleReadyRef = useRef(null);
  const finalizeRef = useRef(null);

  // ── 연출 중엔 해당 라운드 결과를 로드맵/통계에서 숨김 (스포일러 방지) ──
  const hideRound = phase === "waiting_ready" ? betRound : phase === "dealing" || phase === "squeezing" ? activeRound : 0;
  const visibleHistory = useMemo(
    () => (hideRound ? serverHistory.filter((h) => h.round < hideRound) : serverHistory),
    [serverHistory, hideRound]
  );
  const historyWinners = useMemo(() => visibleHistory.map((h) => h.winner), [visibleHistory]);
  const stats = useMemo(() => computeStats(historyWinners), [historyWinners]);

  // ── 표시 포인트 ──
  // 베팅 전: DB 포인트 - 화면에 올려둔 칩 / 제출 후: 제출 시점 잔액 - 베팅 (+ 결과 공개 후 당첨금)
  // → 서버가 정산을 먼저 지급해도 카드를 다 열기 전엔 포인트가 먼저 변하지 않음
  const shownPoints =
    lockedBase !== null
      ? lockedBase - totalBet + (phase === "result" && result ? result.payout : 0)
      : points - (phase === "betting" ? totalBet : 0);

  // ────────────────────────────────────────────────
  // 헬퍼: 토스트 / 사운드 / 딜러 음성
  // ────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 2200);
  };

  const getCtx = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const c = audioCtxRef.current;
      if (c.state === "suspended") c.resume();
      return c;
    } catch (e) { return null; }
  };

  const tone = (ctx, type, f1, f2, start, dur, vol) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, start);
    if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(f2, start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  };

  const playSound = (type) => {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      if (type === "deal") tone(ctx, "triangle", 520, 180, t, 0.1, 0.12);
      else if (type === "chip") tone(ctx, "square", 900, 600, t, 0.05, 0.05);
      else if (type === "peek") tone(ctx, "sine", 700, 520, t, 0.07, 0.08);
      else if (type === "reveal") tone(ctx, "triangle", 400, 800, t, 0.16, 0.1);
      else if (type === "win") [523, 659, 784, 1047].forEach((f, i) => tone(ctx, "triangle", f, f, t + i * 0.1, 0.22, 0.1));
    } catch (e) {}
  };

  const speakDealer = (text) => {
    setDealerSpeaking(true);
    clearTimeout(speakTimerRef.current);
    speakTimerRef.current = setTimeout(() => setDealerSpeaking(false), 2000);
    if (voiceRef.current) speak(text);
  };

  const toggleVoice = () => { const v = !voiceOn; setVoiceOn(v); setVoiceEnabled(v); };
  const toggleBgm = () => { const v = !bgmOn; setBgmOn(v); setBgmEnabled(v); };

  // ────────────────────────────────────────────────
  // 라이프사이클
  // ────────────────────────────────────────────────
  // 언마운트: 타이머 정리 (칩은 화면에만 있어 환불 불필요)
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      timersRef.current.forEach(clearTimeout);
      clearTimeout(nextTimerRef.current);
      clearTimeout(speakTimerRef.current);
      clearTimeout(toastTimerRef.current);
      stopBGM();
    };
  }, []);

  // 테이블 입장 / 퇴장
  const joinedRef = useRef(false);
  useEffect(() => {
    if (!tableId || !userId || joinedRef.current) return;
    joinedRef.current = true;
    joinBaccaratTable(tableId).catch((err) => {
      console.error("[Baccarat] 입장 실패:", err);
      showToast("테이블 입장 실패: " + (err.message || err.code || ""));
    });
    return () => {
      leaveBaccaratTable(tableId);
      joinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, userId]);

  // 하트비트: 10초마다 접속 유지 + "칩을 만지는 중" 신호 (끊기면 서버가 자동으로 정리)
  const engagedRef = useRef(false);
  engagedRef.current = phase !== "betting" || totalBet > 0;
  useEffect(() => {
    if (!tableId || !userId) return;
    const id = setInterval(() => sendHeartbeat(tableId, engagedRef.current), 10000);
    return () => clearInterval(id);
  }, [tableId, userId]);

  // READY 후 대기: 1초 카운트 + 5초마다 READY 재전송 (서버가 20초 경과/유령 정리 후 진행시킴)
  useEffect(() => {
    if (phase !== "waiting_ready") { setWaitSeconds(0); return; }
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setWaitSeconds(n);
      if (n % 5 === 0 && !sendingRef.current) sendReady(tableId).catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, [phase, tableId]);

  // BGM
  useEffect(() => { if (bgmOn) startBGM(); else stopBGM(); }, [bgmOn]);

  // 라운드 시작 멘트
  useEffect(() => {
    if (phase === "betting" && !tableLoading) speakDealer("Place your bets, please");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, serverCurrentRound, tableLoading]);

  // ────────────────────────────────────────────────
  // 딜링 시퀀스 (슈통에서 1장씩)
  // ────────────────────────────────────────────────
  const dealSequence = async (data) => {
    const ok = async (ms) => { await sleep(ms); return aliveRef.current; };
    setPhase("dealing");
    setPCards(["empty", "empty"]);
    setBCards(["empty", "empty"]);
    speakDealer("Dealing");

    if (!(await ok(500))) return;
    playSound("deal"); setPCards(["back", "empty"]);
    if (!(await ok(550))) return;
    playSound("deal"); setBCards(["back", "empty"]);
    if (!(await ok(550))) return;
    playSound("deal"); setPCards(["back", "back"]);
    if (!(await ok(550))) return;
    playSound("deal"); setBCards(["back", "back"]);
    if (!(await ok(500))) return;

    const natural =
      (data.player.length === 2 && data.pScore >= 8) ||
      (data.banker.length === 2 && data.bScore >= 8);

    if (natural) {
      speakDealer("Natural");
      if (!(await ok(500))) return;
      playSound("reveal");
      setPCards(["revealed", "revealed"]);
      setBCards(["revealed", "revealed"]);
      setPhase("squeezing");
    } else {
      setPhase("squeezing");
      speakDealer("Please squeeze your cards");
    }
  };

  // ────────────────────────────────────────────────
  // 서버 결과 수신
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (tableLoading || !table) return;

    // 최초 로드: 이미 있던 과거 결과는 재생하지 않음
    if (!initRef.current) {
      initRef.current = true;
      processedRoundRef.current = table.lastResultRound || 0;
      return;
    }

    const round = table.lastResultRound;
    if (!table.lastResult || !round || round <= processedRoundRef.current) return;
    processedRoundRef.current = round;

    // 아직 베팅 중(미제출)인 사람은 이번 결과 연출 제외 → 다음 라운드로 계속
    const iSubmitted = mySubmittedRoundRef.current === round;
    if (!iSubmitted && totalBetRef.current > 0) return;
    // 이미 다른 연출 진행 중이면 스킵 (구경꾼만 해당)
    if (["dealing", "squeezing", "result"].includes(phaseRef.current)) return;

    const r = table.lastResult;
    const data = {
      player: r.playerCards || [],
      banker: r.bankerCards || [],
      pScore: r.playerValue ?? 0,
      bScore: r.bankerValue ?? 0,
      winner: r.winner,
      sideResults: r.sideResults || {},
    };
    activeRoundRef.current = round;
    setActiveRound(round);
    setGameData(data);
    setResult(null);
    thirdLockRef.current = false;
    dealSequence(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableLoading, table?.lastResultRound]);

  // ────────────────────────────────────────────────
  // 쪼기 / 서드카드 / 정산
  // ────────────────────────────────────────────────
  const peekCard = (side, idx) => {
    if (phase !== "squeezing") return;
    const cards = side === "player" ? pCards : bCards;
    const setter = side === "player" ? setPCards : setBCards;
    const next = NEXT_PEEK[cards[idx]];
    if (!next) return;
    playSound(next === "revealed" ? "reveal" : "peek");
    setter((prev) => {
      const n = [...prev];
      if (NEXT_PEEK[n[idx]]) n[idx] = next;
      return n;
    });
  };

  const revealAll = () => {
    playSound("reveal");
    setPCards((prev) => prev.map((s) => (UNREVEALED.includes(s) ? "revealed" : s)));
    setBCards((prev) => prev.map((s) => (UNREVEALED.includes(s) ? "revealed" : s)));
  };

  const hasUnrevealed = pCards.some((s) => UNREVEALED.includes(s)) || bCards.some((s) => UNREVEALED.includes(s));

  const finalizeGame = () => {
    const game = gameData;
    if (!game) return;
    const winner = game.winner;

    // 서버 정산 공식과 동일 (표시용 - 포인트는 서버가 이미 지급)
    let mainPayout = 0;
    if (winner === "player") mainPayout = mainBets.player * 2;
    else if (winner === "banker") mainPayout = Math.floor(mainBets.banker * 1.95);
    else mainPayout = mainBets.tie * 9 + mainBets.player + mainBets.banker;

    const sr = game.sideResults || {};
    let sidePayout = 0;
    if (sr.playerPair) sidePayout += sideBets.playerPair * 12;
    if (sr.bankerPair) sidePayout += sideBets.bankerPair * 12;
    if (sr.perfectPair) sidePayout += sideBets.perfectPair * 26;

    const payout = mainPayout + sidePayout;
    const hadBet = totalBet > 0;
    const net = payout - totalBet;
    const won = hadBet && net > 0;

    setResult({ ...game, payout, net, won, hadBet });
    setPhase("result");

    speakDealer(winner === "player" ? "Player wins" : winner === "banker" ? "Banker wins" : "Tie");
    if (won) {
      playSound("win");
      setShowConfetti(true);
      timersRef.current.push(setTimeout(() => setShowConfetti(false), 3200));
    }
    clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => autoNextRound(), 5000);
  };
  finalizeRef.current = finalizeGame;

  const autoNextRound = () => {
    clearTimeout(nextTimerRef.current);
    setResult(null);
    setGameData(null);
    setBetStacks(emptyStacks());
    setBetHistory([]);
    setPCards(["empty", "empty"]);
    setBCards(["empty", "empty"]);
    setReadyError(false);
    setLockedBase(null);
    thirdLockRef.current = false;
    setPhase("betting");
  };

  // 모든 카드 공개 → 서드카드(1장씩) → 정산
  useEffect(() => {
    if (phase !== "squeezing" || !gameData) return;
    const allRevealed =
      pCards.every((s) => s === "revealed" || s === "empty") &&
      bCards.every((s) => s === "revealed" || s === "empty");
    if (!allRevealed) return;

    const needP3 = gameData.player.length === 3 && pCards.length < 3;
    const needB3 = gameData.banker.length === 3 && bCards.length < 3;

    if (needP3 || needB3) {
      if (thirdLockRef.current) return;
      thirdLockRef.current = true;
      (async () => {
        await sleep(650);
        if (!aliveRef.current) return;
        if (needP3) {
          speakDealer("Player draws a card");
          playSound("deal");
          setPCards((p) => (p.length < 3 ? [...p, "back"] : p));
        } else {
          speakDealer("Banker draws a card");
          playSound("deal");
          setBCards((p) => (p.length < 3 ? [...p, "back"] : p));
        }
        thirdLockRef.current = false;
      })();
      return;
    }

    if (finalizedRoundRef.current === activeRoundRef.current) return;
    finalizedRoundRef.current = activeRoundRef.current;
    timersRef.current.push(setTimeout(() => finalizeRef.current && finalizeRef.current(), 600));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pCards, bCards, phase, gameData]);

  // ────────────────────────────────────────────────
  // 베팅 액션
  // ────────────────────────────────────────────────
  const placeChip = (target) => {
    if (phase !== "betting" || isSendingReady) return;
    if (points - totalBet < selectedChip) return showToast("포인트가 부족합니다");
    if (totalBet + selectedChip > MAX_BET) return showToast(`최대 베팅 ${MAX_BET.toLocaleString()}`);
    playSound("chip");
    // 첫 칩 → 즉시 "베팅 준비 중" 신호 (다른 플레이어가 READY 해도 잠깐 기다려줌)
    if (totalBet === 0) sendHeartbeat(tableId, true);
    setBetStacks((prev) => ({ ...prev, [target]: [...prev[target], selectedChip] }));
    setBetHistory((prev) => [...prev, { target, amount: selectedChip }]);
  };

  const removeLastChip = () => {
    if (phase !== "betting" || isSendingReady || betHistory.length === 0) return;
    const last = betHistory[betHistory.length - 1];
    setBetStacks((prev) => {
      const n = [...prev[last.target]];
      n.pop();
      return { ...prev, [last.target]: n };
    });
    setBetHistory((prev) => prev.slice(0, -1));
  };

  const clearBets = () => {
    if (phase !== "betting" || isSendingReady || totalBet === 0) return;
    setBetStacks(emptyStacks());
    setBetHistory([]);
    sendHeartbeat(tableId, false);
  };

  // READY / DEAL : 서버가 한도·잔액 검증 → 포인트 차감 → 베팅 기록 → READY
  const handleReady = async () => {
    if (phase !== "betting" || sendingRef.current) return;
    if (totalMainBet === 0) return showToast("PLAYER / BANKER / TIE 중 한 곳에 베팅하세요");
    if (totalBet < MIN_BET) return showToast(`최소 베팅 ${MIN_BET.toLocaleString()}`);
    if (totalBet > MAX_BET) return showToast(`최대 베팅 ${MAX_BET.toLocaleString()}`);
    if (points < totalBet) return showToast("포인트가 부족합니다");

    sendingRef.current = true;
    setIsSendingReady(true);
    setReadyError(false);
    setLockedBase(points);
    let betDone = false;

    try {
      const res = await placeBaccaratBet({
        userId,
        nickname: userName,
        tableId,
        bets: {
          player: mainBets.player, banker: mainBets.banker, tie: mainBets.tie,
          playerPair: sideBets.playerPair, bankerPair: sideBets.bankerPair, perfectPair: sideBets.perfectPair,
        },
      });
      betDone = true;
      mySubmittedRoundRef.current = res.round; // 라운드는 서버가 결정
      setBetRound(res.round);
      setPhase("waiting_ready");
      speakDealer("Ready");
      await sendReady(tableId);
    } catch (err) {
      console.error("[Baccarat] READY 실패:", err);
      if (betDone) {
        // 베팅은 서버에 저장됨 → 재시도는 READY 만 (중복 차감 불가)
        setReadyError(true);
        showToast("서버 연결 실패 · 재시도를 눌러주세요");
      } else {
        setLockedBase(null);
        showToast(err.message || "베팅 실패");
      }
    } finally {
      sendingRef.current = false;
      setIsSendingReady(false);
    }
  };
  handleReadyRef.current = handleReady;

  const retryReady = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setReadyError(false);
    try { await sendReady(tableId); }
    catch (e) { setReadyError(true); }
    finally { sendingRef.current = false; }
  };

  // 2명 이상일 때만 베팅 타이머 (끝나면 베팅 있는 사람 자동 READY)
  useEffect(() => {
    if (phase !== "betting" || !multi) return;
    let left = BETTING_DURATION;
    setBettingTimeLeft(left);
    const id = setInterval(() => {
      left -= 1;
      setBettingTimeLeft(Math.max(left, 0));
      if (left === 10) speakDealer("10 seconds, final bets");
      if (left <= 0) {
        clearInterval(id);
        if (totalMainBetRef.current > 0) {
          setNoMoreBetsFlash(true);
          speakDealer("No more bets");
          timersRef.current.push(
            setTimeout(() => {
              setNoMoreBetsFlash(false);
              handleReadyRef.current && handleReadyRef.current();
            }, 1200)
          );
        }
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, serverCurrentRound, multi]);

  // 로비 복귀 (칩은 화면에만 있으므로 환불 불필요 / 제출된 베팅은 서버가 정산)
  const handleBack = () => {
    if (phase === "betting" || phase === "result") { onLeave(); return; }
    const settled = myBet && myBet.round === betRound && myBet.settled;
    if (phase === "waiting_ready" && !readyError && waitSeconds < 45) {
      showToast("READY 후에는 결과가 나올 때까지 나갈 수 없습니다");
      return;
    }
    if ((phase === "dealing" || phase === "squeezing") && totalBet > 0 && !settled) {
      showToast("정산 중입니다. 잠시만요");
      return;
    }
    if (window.confirm("게임 진행 중입니다. 나가도 베팅은 서버에서 자동 정산됩니다. 나가시겠습니까?")) onLeave();
  };

  // ────────────────────────────────────────────────
  // 표시용 값
  // ────────────────────────────────────────────────
  const revealedScore = (cards, states) => {
    const shown = cards.filter((_, i) => states[i] === "revealed");
    return shown.length ? handScore(shown) : "-";
  };
  const displayPScore = result ? result.pScore : gameData ? revealedScore(gameData.player, pCards) : "-";
  const displayBScore = result ? result.bScore : gameData ? revealedScore(gameData.banker, bCards) : "-";

  const showRound = phase === "betting" ? serverCurrentRound : activeRound || betRound || serverCurrentRound;
  const roundLabel = `${tableId === "table1" ? "T1" : "T2"}-#${showRound}`;

  const dealerMessage = (() => {
    if (phase === "betting") {
      if (totalMainBet > 0) return multi ? "BET PLACED · PRESS READY" : "BET PLACED · PRESS DEAL";
      return "PLACE YOUR BETS";
    }
    if (phase === "waiting_ready") return multi ? "WAITING FOR OTHERS..." : "DEALING SOON...";
    if (phase === "dealing") return "DEALING CARDS...";
    if (phase === "squeezing") return hasUnrevealed ? "SQUEEZE YOUR CARDS!" : "ALMOST THERE...";
    if (phase === "result" && result) {
      const w = result.winner === "player" ? "PLAYER" : result.winner === "banker" ? "BANKER" : "TIE";
      if (!result.hadBet) return `${w} WINS`;
      return result.won ? `✨ ${w} WINS · YOU WON!` : `${w} WINS · BETTER LUCK NEXT TIME`;
    }
    return "";
  })();

  const summaryParts = [
    mainBets.player > 0 && `P ${mainBets.player.toLocaleString()}`,
    mainBets.banker > 0 && `B ${mainBets.banker.toLocaleString()}`,
    mainBets.tie > 0 && `T ${mainBets.tie.toLocaleString()}`,
    sideBets.playerPair > 0 && `PP ${sideBets.playerPair.toLocaleString()}`,
    sideBets.bankerPair > 0 && `BP ${sideBets.bankerPair.toLocaleString()}`,
    sideBets.perfectPair > 0 && `PF ${sideBets.perfectPair.toLocaleString()}`,
  ].filter(Boolean);

  const pct = (n) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0);

  // ────────────────────────────────────────────────
  // 렌더
  // ────────────────────────────────────────────────
  if (tableLoading) {
    return (
      <div style={{ ...S.container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎰</div>
        <div style={{ color: "#D4A574", fontSize: 13, letterSpacing: 2 }}>테이블 입장 중...</div>
      </div>
    );
  }

  const bettingOpen = phase === "betting";

  return (
    <div style={S.container}>
      {showConfetti && <Confetti />}
      {toast && <div style={S.toast}>{toast}</div>}

      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={handleBack} style={S.backBtn}>← LOBBY</button>
        <h2 style={S.title}>VIP BACCARAT</h2>
        <div style={S.points}>💎 {shownPoints.toLocaleString()}</div>
      </div>

      <div style={S.subHeader}>
        <span style={S.tableTag}>
          <span style={S.liveDot}>●</span> {tableId === "table1" ? "TABLE 1" : "TABLE 2"} · LIVE
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={toggleVoice} style={S.toggleBtn}>{voiceOn ? "🔊" : "🔇"}</button>
          <button onClick={toggleBgm} style={S.toggleBtn}>{bgmOn ? "🎵" : "🎵̸"}</button>
        </div>
      </div>

      {/* 딜러 */}
      <BaccaratDealer
        phase={phase}
        message={dealerMessage}
        roundNumber={roundLabel}
        playerCount={playerCount}
        speaking={dealerSpeaking}
        noMoreBets={noMoreBetsFlash}
      />

      {/* 타이머 (2명 이상일 때만) */}
      {bettingOpen && multi && (
        <div style={S.timerBar}>
          <div
            style={{
              ...S.timerFill,
              width: `${(bettingTimeLeft / BETTING_DURATION) * 100}%`,
              background:
                bettingTimeLeft <= 5 ? "linear-gradient(90deg, #DC2626, #EF4444)"
                : bettingTimeLeft <= 10 ? "linear-gradient(90deg, #D97706, #F59E0B)"
                : "linear-gradient(90deg, #10B981, #34D399)",
            }}
          />
          <div style={S.timerText}>⏰ {bettingTimeLeft}s · {playerCount}명 플레이 중</div>
        </div>
      )}

      {/* 실제 통계 (이 테이블 기록) */}
      {stats.total > 0 && (
        <div style={S.statsBar}>
          <div style={S.statChip}><span style={{ color: "#3B82F6" }}>P</span> {stats.p} <span style={S.pctText}>{pct(stats.p)}%</span></div>
          <div style={S.statChip}><span style={{ color: "#E63975" }}>B</span> {stats.b} <span style={S.pctText}>{pct(stats.b)}%</span></div>
          <div style={S.statChip}><span style={{ color: "#10B981" }}>T</span> {stats.t} <span style={S.pctText}>{pct(stats.t)}%</span></div>
          <div style={S.statChipTotal}>TOTAL {stats.total}</div>
        </div>
      )}

      {/* 로드맵 */}
      <div style={S.roadmapWrap}>
        <div style={S.roadmapHeader}>
          <span style={S.roadmapHeaderTitle}>🀄 중국매 · ROADMAP</span>
          <button onClick={() => setShowRoadmap((v) => !v)} style={S.roadmapToggleBtn}>
            {showRoadmap ? "접기 ▲" : "펼치기 ▼"}
          </button>
        </div>
        {showRoadmap &&
          (historyWinners.length > 0 ? (
            <BaccaratRoadmap history={historyWinners} />
          ) : (
            <div style={S.roadmapEmpty}>첫 라운드 결과가 나오면 로드맵이 쌓입니다</div>
          ))}
      </div>

      {/* 테이블 */}
      <div style={S.tableArea}>
        <div style={{ ...S.shoe, animation: phase === "dealing" ? "shoeShake 0.5s ease-in-out infinite" : "none" }}>
          <div style={S.shoeLabel}>SHOE</div>
          <div style={S.shoeBox}>
            <div style={S.shoeCards}>
              <div style={S.shoeCard} />
              <div style={{ ...S.shoeCard, marginTop: -44 }} />
              <div style={{ ...S.shoeCard, marginTop: -44 }} />
            </div>
            <div style={S.shoeDeckCount}>6 DECKS</div>
          </div>
        </div>

        <div style={S.tableFelt}>
          <div style={S.playerSide}>
            <div style={S.sideTitle}>PLAYER</div>
            <div style={S.cardsContainer}>
              {pCards.map((s, i) => (
                <Card3D key={`p-${i}`} card={gameData?.player[i]} state={s} fromX={-60}
                  onClick={() => peekCard("player", i)}
                  highlight={result && result.winner === "player"} />
              ))}
            </div>
            <div style={S.scoreBox}>{displayPScore}</div>
          </div>

          <div style={S.vsText}>VS</div>

          <div style={S.bankerSide}>
            <div style={{ ...S.sideTitle, color: "#E63975" }}>BANKER</div>
            <div style={S.cardsContainer}>
              {bCards.map((s, i) => (
                <Card3D key={`b-${i}`} card={gameData?.banker[i]} state={s} fromX={-230}
                  onClick={() => peekCard("banker", i)}
                  highlight={result && result.winner === "banker"} />
              ))}
            </div>
            <div style={{ ...S.scoreBox, color: "#E63975", borderColor: "rgba(230,57,117,0.3)" }}>{displayBScore}</div>
          </div>
        </div>

        {result && (
          <div style={S.resultOverlay}>
            <div
              style={{
                ...S.resultBanner,
                background: result.won
                  ? "linear-gradient(90deg, transparent, rgba(16,185,129,0.95), transparent)"
                  : "linear-gradient(90deg, transparent, rgba(0,0,0,0.92), transparent)",
              }}
            >
              <div style={S.resultTitle}>
                {result.winner === "player" ? "PLAYER WINS" : result.winner === "banker" ? "BANKER WINS" : "TIE"}
              </div>
              <div style={S.resultSub}>
                {!result.hadBet ? "구경 중"
                  : result.won ? `+${result.net.toLocaleString()}P`
                  : result.net === 0 ? "PUSH · 원금 반환"
                  : `-${Math.abs(result.net).toLocaleString()}P`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 연출 중 내 베팅 요약 */}
      {!bettingOpen && summaryParts.length > 0 && (
        <div style={S.mySummary}>내 베팅 · {summaryParts.join(" · ")} · 총 {totalBet.toLocaleString()}</div>
      )}

      {/* ── 베팅 ── */}
      {bettingOpen && (
        <div style={S.bettingUI}>
          <div style={S.chipSelector}>
            {CHIPS.map((v) => (
              <button
                key={v}
                onClick={() => setSelectedChip(v)}
                disabled={points - totalBet < v}
                style={{
                  ...S.chipBtn,
                  background: chipBg(v),
                  border: selectedChip === v ? "3px solid #FFD700" : "3px dashed rgba(255,255,255,0.65)",
                  boxShadow: selectedChip === v ? "0 0 16px rgba(255,215,0,0.7)" : "0 4px 10px rgba(0,0,0,0.5)",
                  transform: selectedChip === v ? "translateY(-3px) scale(1.06)" : "none",
                  opacity: points - totalBet < v ? 0.3 : 1,
                }}
              >
                {fmtChip(v)}
              </button>
            ))}
          </div>

          <div style={S.boardAreas}>
            <BetBox label="PLAYER" sub="1 : 1" color="#3B82F6" stack={betStacks.player} onClick={() => placeChip("player")} />
            <BetBox label="TIE" sub="8 : 1" color="#10B981" stack={betStacks.tie} onClick={() => placeChip("tie")} />
            <BetBox label="BANKER" sub="0.95 : 1" color="#E63975" stack={betStacks.banker} onClick={() => placeChip("banker")} />
          </div>
          <div style={S.boardAreas}>
            <BetBox compact label="P PAIR" sub="11 : 1" color="#60A5FA" stack={betStacks.playerPair} onClick={() => placeChip("playerPair")} />
            <BetBox compact label="PERFECT" sub="25 : 1" color="#D4A574" stack={betStacks.perfectPair} onClick={() => placeChip("perfectPair")} />
            <BetBox compact label="B PAIR" sub="11 : 1" color="#F472B6" stack={betStacks.bankerPair} onClick={() => placeChip("bankerPair")} />
          </div>

          <div style={S.infoLine}>
            총 베팅 <strong>{totalBet.toLocaleString()}</strong> / 한도 {MAX_BET.toLocaleString()} · 보유 {shownPoints.toLocaleString()}
          </div>

          <div style={S.chipControls}>
            <button onClick={removeLastChip} disabled={betHistory.length === 0}
              style={{ ...S.chipControlBtn, background: "linear-gradient(135deg, #6B7280, #4B5563)", opacity: betHistory.length === 0 ? 0.4 : 1 }}>
              ↩ 마지막 칩 취소
            </button>
            <button onClick={clearBets} disabled={totalBet === 0}
              style={{ ...S.chipControlBtn, background: "linear-gradient(135deg, #DC2626, #991B1B)", opacity: totalBet === 0 ? 0.4 : 1 }}>
              🗑 전체 리셋
            </button>
          </div>

          <div style={S.infoLine}>
            {multi
              ? "👥 모든 플레이어가 READY 하면 즉시 진행 · 시간 초과 시 자동 진행"
              : "💭 혼자 플레이 중 · DEAL 누르면 즉시 진행"}
          </div>

          <button
            onClick={handleReady}
            disabled={isSendingReady || totalMainBet === 0}
            style={{
              ...S.actionBtn,
              marginTop: 8,
              background: totalMainBet > 0 && !isSendingReady
                ? "linear-gradient(135deg, #D4A574, #B07D46)"
                : "linear-gradient(135deg, #6B7280, #4B5563)",
              cursor: totalMainBet > 0 && !isSendingReady ? "pointer" : "not-allowed",
              opacity: totalMainBet === 0 ? 0.6 : 1,
            }}
          >
            {isSendingReady ? "⏳ 전송 중..."
              : totalMainBet === 0 ? "💭 베팅 먼저 하세요"
              : multi ? `✅ READY (${totalBet.toLocaleString()})` : `🎲 DEAL (${totalBet.toLocaleString()})`}
          </button>
        </div>
      )}

      {/* ── 대기 ── */}
      {phase === "waiting_ready" && (
        <div style={S.statusBar}>
          <div style={{ fontSize: 22 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{multi ? "다른 플레이어 대기 중..." : "카드를 준비하는 중..."}</div>
          {multi && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
              READY {serverReadyPlayers.length} / {playerCount} · {Math.max(0, 20 - waitSeconds)}초 후 자동 진행
            </div>
          )}
          {waitSeconds >= 45 && !readyError && (
            <button onClick={handleBack} style={{ ...S.revealAllBtn, marginTop: 6 }}>응답이 없습니다 · 로비로 나가기</button>
          )}
          {readyError && (
            <button onClick={retryReady} style={{ ...S.actionBtn, padding: 12, fontSize: 13, marginTop: 6 }}>🔄 다시 시도</button>
          )}
        </div>
      )}

      {phase === "dealing" && <div style={S.statusBar}>🎴 카드 딜링 중...</div>}

      {/* ── 쪼기 ── */}
      {phase === "squeezing" && hasUnrevealed && (
        <div>
          <div style={S.squeezeGuide}>카드를 터치할 때마다 조금씩 열립니다 👆</div>
          <button onClick={revealAll} style={S.revealAllBtn}>👁 모두 공개 (SKIP)</button>
        </div>
      )}

      {/* ── 결과 ── */}
      {phase === "result" && (
        <div>
          <div style={S.squeezeGuide}>⏭️ 5초 뒤 자동으로 다음 라운드가 시작됩니다</div>
          <button onClick={autoNextRound} style={S.actionBtn}>▶ NEXT ROUND</button>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// 스타일
// ====================================================================
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
  squeezeGuide: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.55)", margin: "4px 0 10px", padding: 6, background: "rgba(255,255,255,0.03)", borderRadius: 8 },
  revealAllBtn: { width: "100%", padding: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(212,165,116,0.4)", color: "#F0D4B8", borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 1 },

  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,25,0.95)", border: "1px solid rgba(212,165,116,0.5)", color: "#F0D4B8", padding: "10px 18px", borderRadius: 24, fontSize: 12, fontWeight: 700, zIndex: 10100, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", animation: "toastIn 0.25s ease-out", maxWidth: "90vw", textAlign: "center" },
};