// ===================================================================
// 🎰 Premium Baccarat LIVE Multi-Table (서버 결과 + 멀티플레이)
// ===================================================================
// 🎯 플로우:
//   1. 테이블 입장 → joinBaccaratTable
//   2. BET 선택 → PLACE BET
//   3. "READY" 또는 "DEAL" 버튼
//      - 혼자면: 서버 즉시 결과 생성
//      - 2명+: 모두 READY 시 결과 생성
//   4. 서버 결과 수신 → 카드 공개 (쪼기 가능)
//   5. 결과 후 다음 라운드 자동 시작
// ===================================================================

import React, { useState, useRef, useEffect } from "react";
import BaccaratDealer from "./BaccaratDealer";
import BaccaratRoadmap, { computeStats } from "./BaccaratRoadmap";
import { 
  speak, setVoiceEnabled, isVoiceEnabled,
  setBgmEnabled, isBgmEnabled, startBGM, stopBGM
} from "./BaccaratSound";
// ★ [라이브] Firestore 통신
import {
  useBaccaratTable,
  useBaccaratHistory,
  useMyLatestBet,
  placeBaccaratBet,
  joinBaccaratTable,
  leaveBaccaratTable,
  sendReady,
  MIN_BET,
  MAX_BET,
} from "./BaccaratFirestore";

// 라운드 번호 생성 (fallback 용 - 보통 서버 라운드 번호 사용)
function generateRoundNumber() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `BAC-${dateStr}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

const BETTING_DURATION = 180;  // 3분 (초)

// --- 글로벌 애니메이션 주입 ---
const injectKeyframes = () => {
  if (document.getElementById("baccarat-animations")) return;
  const style = document.createElement("style");
  style.id = "baccarat-animations";
  style.innerHTML = `
    @keyframes dealIn {
      0% { transform: translateY(-200px) translateX(50px) rotate(-15deg); opacity: 0; }
      100% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
    }
    @keyframes bannerSlide {
      0% { opacity: 0; transform: translateY(-20px) scale(0.9); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes peekPulse {
      0%, 100% { opacity: 0.7; transform: translateX(-50%) scale(1); }
      50% { opacity: 1; transform: translateX(-50%) scale(1.2); }
    }
    @keyframes confettiFall {
      0% { transform: translateY(-30px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(600px) rotate(720deg); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
};

// 🎆 Confetti - 승리 축하 효과
function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2,
    color: ["#FFD700", "#FF6B9D", "#D4A574", "#10B981", "#3B82F6", "#E63975"][Math.floor(Math.random() * 6)],
    size: 6 + Math.random() * 6,
    shape: Math.random() > 0.5 ? "50%" : "0%",
  }));
  
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: "none", zIndex: 9999, overflow: "hidden",
    }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.left}%`,
          top: 0,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: p.shape,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

// --- 게임 로직 ---
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
  return deck.sort(() => Math.random() - 0.5);
}

function cardScore(card) {
  if (["J", "Q", "K", "10"].includes(card.rank)) return 0;
  if (card.rank === "A") return 1;
  return parseInt(card.rank, 10);
}

function handScore(hand) {
  return hand.reduce((sum, c) => sum + cardScore(c), 0) % 10;
}

function playBaccarat() {
  const deck = createDeck();
  const player = [deck.pop(), deck.pop()];
  const banker = [deck.pop(), deck.pop()];

  let pScore = handScore(player);
  let bScore = handScore(banker);

  if (pScore >= 8 || bScore >= 8) return { player, banker, pScore, bScore };

  let playerThird = null;
  if (pScore <= 5) {
    playerThird = deck.pop();
    player.push(playerThird);
    pScore = handScore(player);
  }

  if (bScore <= 5) {
    if (!playerThird && bScore <= 5) banker.push(deck.pop());
    else if (playerThird) {
      const t = cardScore(playerThird);
      if (bScore === 0 || bScore === 1 || bScore === 2) banker.push(deck.pop());
      else if (bScore === 3 && t !== 8) banker.push(deck.pop());
      else if (bScore === 4 && t <= 7) banker.push(deck.pop());
      else if (bScore === 5 && t <= 7) banker.push(deck.pop());
      else if (bScore === 6 && (t === 6 || t === 7)) banker.push(deck.pop());
    }
    bScore = handScore(banker);
  }
  return { player, banker, pScore, bScore };
}

// --- 카드 중앙 레이아웃 (표준 트럼프 카드 pip 배치) ---
// 각 핍 좌표: [top%, left%, flipped?]
// 아래쪽 절반은 flipped=true (뒤집어서 거꾸로 보이게)
const PIP_LAYOUTS = {
  "A":  [[50, 50]],

  "2":  [[18, 50], 
         [82, 50, true]],

  "3":  [[18, 50], 
         [50, 50], 
         [82, 50, true]],

  "4":  [[18, 28], [18, 72], 
         [82, 28, true], [82, 72, true]],

  "5":  [[18, 28], [18, 72], 
         [50, 50], 
         [82, 28, true], [82, 72, true]],

  "6":  [[18, 28], [18, 72], 
         [50, 28], [50, 72], 
         [82, 28, true], [82, 72, true]],

  "7":  [[18, 28], [18, 72], 
         [34, 50], 
         [50, 28], [50, 72], 
         [82, 28, true], [82, 72, true]],

  "8":  [[18, 28], [18, 72], 
         [34, 50], 
         [50, 28], [50, 72], 
         [66, 50, true], 
         [82, 28, true], [82, 72, true]],

  "9":  [[18, 28], [18, 72], 
         [38, 28], [38, 72], 
         [50, 50], 
         [62, 28, true], [62, 72, true], 
         [82, 28, true], [82, 72, true]],

  "10": [[18, 28], [18, 72], 
         [32, 50], 
         [44, 28], [44, 72], 
         [56, 28, true], [56, 72, true], 
         [68, 50, true], 
         [82, 28, true], [82, 72, true]],
};

function CardCenter({ rank, suit, isRed }) {
  if (!rank || !suit) return null;
  
  // J, Q, K는 큰 글자로
  if (["J", "Q", "K"].includes(rank)) {
    return (
      <div style={{ 
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        fontSize: 32, fontWeight: 900, fontFamily: "serif",
        color: isRed ? "#E63975" : "#1F0817",
        letterSpacing: -2,
      }}>
        {rank}
      </div>
    );
  }
  
  // A, 2~10 → 핍 배치
  const pips = PIP_LAYOUTS[rank];
  if (!pips) return null;
  
  // A는 중앙에 큰 무늬 하나
  if (rank === "A") {
    return (
      <div style={{ 
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        fontSize: 32,
      }}>
        {suit}
      </div>
    );
  }
  
  // 2~10 → 숫자만큼 무늬 배치
  return (
    <>
      {pips.map(([topPct, leftPct, flipped], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${topPct}%`,
            left: `${leftPct}%`,
            transform: `translate(-50%, -50%) ${flipped ? "rotate(180deg)" : ""}`,
            fontSize: 12,
            lineHeight: 1,
            fontWeight: 900,
          }}
        >
          {suit}
        </div>
      ))}
    </>
  );
}

// --- 인터랙티브 카드 컴포넌트 (모서리 접기 쪼기) ---
function Card3D({ card, state, onClick, highlight }) {
  // state: "empty" | "back" | "peek1" | "peek2" | "peek3" | "revealed"
  // 쪼기 플로우: back → peek1 (살짝) → peek2 (반쯤) → peek3 (많이) → revealed (공개)
  const isRed = card?.suit === "♥" || card?.suit === "♦";
  const clickable = ["back", "peek1", "peek2", "peek3"].includes(state);

  if (state === "empty") {
    return <div style={{ width: 68, height: 95, margin: "0 4px" }} />;
  }

  // 뒷면의 clip-path: 왼쪽 아래 모서리부터 점점 접히도록 처리
  // peek1 → peek2 → peek3 순서로 왼쪽 아래에서 앞면이 조금씩 드러남
  const backClipPath = {
    back:     "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
    peek1:    "polygon(0% 0%, 100% 0%, 100% 100%, 32% 100%, 0% 78%)",
    peek2:    "polygon(0% 0%, 100% 0%, 100% 100%, 55% 100%, 0% 55%)",
    peek3:    "polygon(0% 0%, 100% 0%, 100% 100%, 85% 100%, 0% 25%)",
    revealed: "polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)",
  }[state] || "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";

  // 접힌 모서리 그림자: 왼쪽 아래 삼각형
  const foldAccent = {
    back:     "polygon(0% 100%, 0% 100%, 0% 100%)",
    peek1:    "polygon(0% 78%, 32% 100%, 0% 100%)",
    peek2:    "polygon(0% 55%, 55% 100%, 0% 100%)",
    peek3:    "polygon(0% 25%, 85% 100%, 0% 100%)",
    revealed: "polygon(0% 100%, 0% 100%, 0% 100%)",
  }[state] || "polygon(0% 100%, 0% 100%, 0% 100%)";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        width: 68,
        height: 95,
        margin: "0 4px",
        cursor: clickable ? "pointer" : "default",
        position: "relative",
        animation: state === "back" ? "dealIn 0.4s ease-out" : "none",
      }}
    >
      {/* 쪼기 가능 힌트 */}
      {state === "back" && <div style={S.peekHint}>👆</div>}
      {(state === "peek1" || state === "peek2" || state === "peek3") && (
        <div style={{...S.peekHint, color: "#FFD700"}}>👁</div>
      )}

      {/* 카드 본체 (2 레이어) */}
      <div style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 8,
        boxShadow: highlight 
          ? "0 0 20px rgba(255,215,0,0.8), 0 8px 20px rgba(0,0,0,0.6)"
          : "0 8px 20px rgba(0,0,0,0.6)",
      }}>
        
        {/* 📜 아래 레이어: 앞면 (실제 트럼프 카드처럼 무늬 배치) */}
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%",
          height: "100%",
          borderRadius: 8,
          background: "linear-gradient(145deg, #ffffff, #f0f0f0)",
          color: isRed ? "#E63975" : "#1F0817",
          overflow: "hidden",
        }}>
          {/* 왼쪽 위 랭크/무늬 (쪼일 때 보이는 곳) */}
          <div style={{ position: "absolute", top: 4, left: 5, fontSize: 13, lineHeight: 1, textAlign: "center", fontFamily: "serif" }}>
            <div style={{ fontWeight: 900 }}>{card?.rank}</div>
            <div style={{ fontSize: 11 }}>{card?.suit}</div>
          </div>
          
          {/* 왼쪽 아래 모서리에는 숫자/무늬를 두지 않음: 이쪽부터 쪼아도 정보가 먼저 노출되지 않게 함 */}

          {/* 중앙 - 랭크별 실제 트럼프 카드 레이아웃 */}
          <CardCenter rank={card?.rank} suit={card?.suit} isRed={isRed} />
          
          {/* 오른쪽 아래 랭크/무늬 (뒤집어진 형태) */}
          <div style={{ position: "absolute", bottom: 4, right: 5, fontSize: 13, lineHeight: 1, transform: "rotate(180deg)", textAlign: "center", fontFamily: "serif" }}>
            <div style={{ fontWeight: 900 }}>{card?.rank}</div>
            <div style={{ fontSize: 11 }}>{card?.suit}</div>
          </div>
        </div>

        {/* 📜 위 레이어: 뒷면 (clip-path 로 모서리 접힘) */}
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%",
          height: "100%",
          borderRadius: 8,
          background: "linear-gradient(135deg, #4A1033 0%, #2A0520 50%, #1A0512 100%)",
          border: "2px solid #D4A574",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          clipPath: backClipPath,
          WebkitClipPath: backClipPath,
          transition: "clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1), -webkit-clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          boxSizing: "border-box",
        }}>
          <div style={{ 
            border: "1px dashed rgba(212,165,116,0.6)", 
            width: "80%", 
            height: "86%", 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center", 
            justifyContent: "center",
            gap: 2,
            color: "#D4A574",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, opacity: 0.8 }}>VIP</div>
            <div style={{ fontSize: 24 }}>♦</div>
            <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.6 }}>BACCARAT</div>
          </div>
        </div>

        {/* 📜 접힌 모서리 그림자 (삼각형, 접혔다는 걸 강조) */}
        {["peek1", "peek2", "peek3"].includes(state) && (
          <div style={{
            position: "absolute",
            top: 0, left: 0,
            width: "100%",
            height: "100%",
            borderRadius: 8,
            background: "linear-gradient(315deg, rgba(0,0,0,0.4), rgba(0,0,0,0.1))",
            clipPath: foldAccent,
            WebkitClipPath: foldAccent,
            transition: "clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1), -webkit-clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            pointerEvents: "none",
          }} />
        )}

      </div>
    </div>
  );
}

// --- 메인 컴포넌트 (★ 라이브 멀티플레이) ---
export default function BaccaratLiveTable({ 
  tableId,
  userId,
  userName,
  gamePoints = 100000,
  onPointsChange = () => {},
  onLeave = () => {},
}) {
  useEffect(() => { injectKeyframes(); }, []);
  
  // ★ [라이브] Firestore 실시간 상태
  const { table, loading: tableLoading } = useBaccaratTable(tableId);
  const serverCurrentRound = table?.currentRound || 1;
  const serverPlayers = table?.players || [];
  const serverReadyPlayers = table?.readyPlayers || [];
  const serverLastResult = table?.lastResult;
  const serverLastResultRound = table?.lastResultRound;
  
  // 서버 히스토리 → 로드맵용으로 변환 (winner 배열)
  const serverHistory = useBaccaratHistory(tableId, 80);
  const historyWinners = React.useMemo(
    () => serverHistory.map(h => h.winner),
    [serverHistory]
  );
  
  // ★ [라이브] 내 베팅 (정산 결과 수신용)
  const myBet = useMyLatestBet(userId, tableId, serverLastResultRound);
  
  // points 는 외부에서 전달됨 (gamePoints)
  const points = gamePoints;

  // 칩을 선택한 뒤 베팅 자리를 누를 때마다 해당 칩 금액이 누적됩니다.
  const [selectedChip, setSelectedChip] = useState(10000);  // 10K 부터
  const [betStacks, setBetStacks] = useState({
    player: [], tie: [], banker: [],
    playerPair: [], bankerPair: [], perfectPair: [],
  });
  // 로컬 history (베팅 전 미리보기) - 실제론 serverHistory 사용
  const [showRoadmap, setShowRoadmap] = useState(true);
  const stats = React.useMemo(() => computeStats(historyWinners), [historyWinners]);

  // 🎰 Evolution 모드 기능들
  const [bettingTimeLeft, setBettingTimeLeft] = useState(BETTING_DURATION);
  // 라운드 번호: 서버 라운드 사용 (예: "T1-#1024")
  const roundNumber = `${tableId === "table1" ? "T1" : "T2"}-#${serverCurrentRound}`;
  // ★ 플레이어 수: 서버 실시간
  const playerCount = serverPlayers.length;
  const [voiceOn, setVoiceOn] = useState(true);
  const [bgmOn, setBgmOn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [noMoreBetsFlash, setNoMoreBetsFlash] = useState(false);
  const [dealerSpeaking, setDealerSpeaking] = useState(false);
  const bettingTimerRef = useRef(null);
  const spectatorMode = useRef(false);
  
  // phase: "betting" | "waiting_ready" | "dealing" | "squeezing" | "result"
  const [phase, setPhase] = useState("betting");
  const [gameData, setGameData] = useState(null);
  
  const [pCards, setPCards] = useState(["empty", "empty"]);
  const [bCards, setBCards] = useState(["empty", "empty"]);
  const [result, setResult] = useState(null);
  
  // ★ [라이브] 서버 결과 처리 상태
  const [isSendingReady, setIsSendingReady] = useState(false);
  const amIReady = serverReadyPlayers.includes(userId);
  const processedRoundRef = useRef(0);
  
  // 서드 카드 추가 완료 플래그 (한 번만 실행)
  const thirdCardAddedRef = useRef(false);

  const sumChips = (chips = []) => chips.reduce((sum, value) => sum + value, 0);
  const mainBets = {
    player: sumChips(betStacks.player),
    tie: sumChips(betStacks.tie),
    banker: sumChips(betStacks.banker),
  };
  const sideBets = {
    playerPair: sumChips(betStacks.playerPair),
    bankerPair: sumChips(betStacks.bankerPair),
    perfectPair: sumChips(betStacks.perfectPair),
  };
  const totalMainBet = mainBets.player + mainBets.tie + mainBets.banker;
  const totalSideBet = sideBets.playerPair + sideBets.bankerPair + sideBets.perfectPair;
  const totalBet = totalMainBet + totalSideBet;
  // ★ [수정] 이제 points 는 베팅 즉시 차감된 상태이므로 추가 체크 불필요
  //   메인 베팅이 있고 betting phase 면 DEAL 가능
  const canPlay = totalMainBet > 0 && phase === "betting";
  
  const audioCtxRef = useRef(null);
  useEffect(() => {
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }, []);
  
  // ★ [라이브] 테이블 입장 (마운트) / 퇴장 (언마운트)
  const joinedRef = useRef(false);
  useEffect(() => {
    if (!tableId || !userId || joinedRef.current) return;
    joinedRef.current = true;
    joinBaccaratTable(tableId).catch(err => {
      console.error("[Baccarat] 입장 실패:", err);
      alert("테이블 입장 실패: " + (err.message || err.code || "unknown"));
    });
    
    return () => {
      leaveBaccaratTable(tableId);
      joinedRef.current = false;
    };
  }, [tableId, userId]);
  
  // ★ [라이브] 서버에서 결과 수신 → 카드 공개 애니메이션
  useEffect(() => {
    if (!serverLastResult || !serverLastResultRound) return;
    if (serverLastResultRound <= processedRoundRef.current) return;
    processedRoundRef.current = serverLastResultRound;
    
    // 서버 결과를 gameData 형태로 변환
    const data = {
      player: serverLastResult.playerCards || [],
      banker: serverLastResult.bankerCards || [],
      pScore: serverLastResult.playerValue || 0,
      bScore: serverLastResult.bankerValue || 0,
      winner: serverLastResult.winner,
      sideResults: serverLastResult.sideResults || {},
    };
    setGameData(data);
    
    // 카드 상태: 모두 back (뒷면) → 쪼기 가능
    const pStates = Array(data.player.length).fill("back");
    const bStates = Array(data.banker.length).fill("back");
    setPCards(pStates);
    setBCards(bStates);
    
    setPhase("squeezing");
    playSound("deal");
    speakDealer("Cards are dealt. Please reveal.");
  }, [serverLastResult, serverLastResultRound]);
  
  // ★ [라이브] 내 베팅 정산 결과 수신 → 결과 처리
  useEffect(() => {
    if (!myBet || !myBet.settled) return;
    if (!gameData) return;
    if (phase === "result") return;  // 이미 처리됨
    // 쪼기 중이면 완료 대기 (유저가 reveal 할 때 finalize)
  }, [myBet, gameData, phase]);

  const playSound = (type) => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "deal") {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.value = 0.2;
        osc.start(); setTimeout(() => osc.stop(), 100);
      } else if (type === "peek") {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.value = 0.1;
        osc.start(); setTimeout(() => osc.stop(), 80);
      } else if (type === "reveal") {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
        gain.gain.value = 0.2;
        osc.start(); setTimeout(() => osc.stop(), 200);
      } else if (type === "win") {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.value = 0.4;
        osc.type = "sine";
        osc.start(); setTimeout(() => osc.stop(), 300);
      }
    } catch (e) {}
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // 선택한 칩을 어느 베팅 자리에 놓을지 결정합니다.
  // ★ [수정] 베팅 시 즉시 포인트 차감 (뒤로가기 시 공짜 베팅 방지)
  const placeChip = (target) => {
    if (phase !== "betting" || !betStacks[target]) return;
    if (points < selectedChip) return;

    // ★ 즉시 차감 → Firestore 에도 반영됨 → 뒤로가기 해도 돈 빠진 상태
    onPointsChange(points - selectedChip);
    
    setBetStacks(prev => ({
      ...prev,
      [target]: [...prev[target], selectedChip],
    }));
  };

  const clearBets = () => {
    if (phase !== "betting") return;
    // ★ [수정] 베팅 취소 시 포인트 환불
    if (totalBet > 0) {
      onPointsChange(points + totalBet);
    }
    setBetStacks({ player: [], tie: [], banker: [], playerPair: [], bankerPair: [], perfectPair: [] });
  };

  const formatChipLabel = (value) => {
    if (value >= 1000000) return `${value / 1000000}M`;
    if (value >= 1000) return `${value / 1000}K`;
    return String(value);
  };

  const renderPlacedChips = (target) => {
    const stack = betStacks[target] || [];
    if (!stack.length) return null;
    const visible = stack.slice(-3);
    return (
      <div style={S.placedChips} aria-label={`${sumChips(stack).toLocaleString()}P placed`}>
        {stack.length > 3 && <span style={S.extraChipCount}>+{stack.length - 3}</span>}
        {visible.map((value, index) => (
          <span key={`${target}-${stack.length - visible.length + index}-${value}`} style={{
            ...S.placedChip,
            background: value >= 1000000 ? "linear-gradient(135deg, #FFF0A8, #C49A2C)"
              : value >= 500000 ? "linear-gradient(135deg, #D8B4FE, #7E22CE)"
              : value >= 100000 ? "linear-gradient(135deg, #FCA5A5, #B91C1C)"
              : value >= 50000 ? "linear-gradient(135deg, #93C5FD, #1D4ED8)"
              : value >= 10000 ? "linear-gradient(135deg, #86EFAC, #15803D)"
              : "linear-gradient(135deg, #E5E7EB, #6B7280)",
          }}>{formatChipLabel(value)}</span>
        ))}
      </div>
    );
  };

  // ★ [라이브] READY 전송 (= 서버 호출)
  //   혼자: 즉시 결과
  //   2명+: 모두 READY 시 결과
  const handleReady = async () => {
    if (phase !== "betting") return;
    if (totalMainBet === 0) {
      alert("Player / Banker / Tie 중 최소 한 곳에 베팅하세요");
      return;
    }
    if (totalBet < MIN_BET) {
      alert(`최소 베팅 ${MIN_BET.toLocaleString()}`);
      return;
    }
    if (totalBet > MAX_BET) {
      alert(`최대 베팅 ${MAX_BET.toLocaleString()}`);
      return;
    }
    if (isSendingReady) return;
    
    setIsSendingReady(true);
    thirdCardAddedRef.current = false;
    
    try {
      // 1. 베팅 Firestore 저장
      await placeBaccaratBet({
        userId,
        nickname: userName,
        tableId,
        round: serverCurrentRound,
        bets: {
          player: mainBets.player,
          banker: mainBets.banker,
          tie: mainBets.tie,
          playerPair: sideBets.playerPair,
          bankerPair: sideBets.bankerPair,
          perfectPair: sideBets.perfectPair,
        },
        totalBet,
        balanceBeforeBet: points + totalBet,  // 베팅 전 잔액
      });
      
      // 2. READY 신호 (혼자면 즉시 결과)
      setPhase("waiting_ready");
      speakDealer("Ready. Waiting for result.");
      
      const result = await sendReady(tableId);
      console.log("[Baccarat] READY 응답:", result);
      
      // 결과는 서버 상태(serverLastResult) 로 자동 반영됨 (useEffect)
    } catch (err) {
      console.error("[Baccarat] READY 실패:", err);
      alert("READY 실패: " + (err.message || err.code || "unknown"));
      setPhase("betting");
    } finally {
      setIsSendingReady(false);
    }
  };

  // 👆 개별 카드 클릭 (뒷면 → 쪼기 단계 → 공개)
  // back → peek1 (살짝) → peek2 (반쯤) → peek3 (많이) → revealed
  const peekCard = (sideKey, idx) => {
    const setter = sideKey === "player" ? setPCards : setBCards;
    setter(prev => {
      const n = [...prev];
      const order = ["back", "peek1", "peek2", "peek3", "revealed"];
      const curIdx = order.indexOf(n[idx]);
      if (curIdx === -1 || curIdx >= order.length - 1) return prev;
      n[idx] = order[curIdx + 1];
      playSound(n[idx] === "revealed" ? "reveal" : "peek");
      return n;
    });
  };

  // 👁 전체 공개 (back/peek1/peek2/peek3 → revealed)
  const revealAll = () => {
    const unrevealedStates = ["back", "peek1", "peek2", "peek3"];
    setPCards(prev => prev.map(s => unrevealedStates.includes(s) ? "revealed" : s));
    setBCards(prev => prev.map(s => unrevealedStates.includes(s) ? "revealed" : s));
    playSound("reveal");
  };

  // 카드 공개 상태 체크 → 서드 카드 or 결과
  useEffect(() => {
    if (phase !== "squeezing" || !gameData) return;
    
    const allRevealed = 
      pCards.every(s => s === "revealed" || s === "empty") &&
      bCards.every(s => s === "revealed" || s === "empty");
    
    if (!allRevealed) return;
    
    const needPlayerThird = gameData.player.length === 3 && pCards.length < 3;
    const needBankerThird = gameData.banker.length === 3 && bCards.length < 3;
    
    if ((needPlayerThird || needBankerThird) && !thirdCardAddedRef.current) {
      thirdCardAddedRef.current = true;
      (async () => {
        await sleep(500);
        if (needPlayerThird) {
          playSound("deal");
          setPCards(prev => [...prev, "back"]);
          await sleep(400);
        }
        if (needBankerThird) {
          playSound("deal");
          setBCards(prev => [...prev, "back"]);
        }
        // 서드 카드 추가 후 다음 effect 실행 위해 ref 리셋
        setTimeout(() => { thirdCardAddedRef.current = false; }, 100);
      })();
      return;
    }
    
    // 모든 카드 공개 완료 → 결과
    if (!needPlayerThird && !needBankerThird) {
      setTimeout(() => finalizeGame(), 400);
    }
  }, [pCards, bCards, phase, gameData]);

  // ★ [라이브] 서버 결과 기반 정산 (서버 계산과 동일 로직)
  const finalizeGame = () => {
    if (!gameData || result) return;
    
    const game = gameData;
    const winner = game.winner;  // 서버가 결정한 winner 사용
    
    // 로컬 payout 계산 (서버 로직과 동일)
    let mainPayout = 0;
    if (winner === "player") {
      mainPayout += mainBets.player * 2;
    } else if (winner === "banker") {
      mainPayout += Math.floor(mainBets.banker * 1.95);
    } else {
      mainPayout += mainBets.tie * 9;
      mainPayout += mainBets.player + mainBets.banker;  // Tie 시 환불
    }
    if ((winner === "player" && mainBets.player > 0) ||
        (winner === "banker" && mainBets.banker > 0) ||
        (winner === "tie" && mainBets.tie > 0)) {
      playSound("win");
    }

    // 사이드 베팅 (서버 결과 사용)
    const sideResults = game.sideResults || { playerPair: false, bankerPair: false, perfectPair: false };
    let sidePayout = 0;
    if (sideBets.playerPair > 0 && sideResults.playerPair) {
      sidePayout += sideBets.playerPair * 12;
    }
    if (sideBets.bankerPair > 0 && sideResults.bankerPair) {
      sidePayout += sideBets.bankerPair * 12;
    }
    if (sideBets.perfectPair > 0 && sideResults.perfectPair) {
      sidePayout += sideBets.perfectPair * 26;
    }

    const totalPayout = mainPayout + sidePayout;
    const net = totalPayout - totalBet;
    const won = net > 0;

    // ★ 베팅 시 이미 차감 → payout 만 추가
    //   서버도 Firestore 에 FieldValue.increment(payout) → 결과적으로 로컬과 동일
    if (!spectatorMode.current && totalPayout > 0) {
      onPointsChange(points + totalPayout);
    }
    
    setResult({ ...game, winner, won, payout: totalPayout, net, sideResults,
      mainWon: mainBets[winner] > 0, sidePayout, spectator: spectatorMode.current });
    setPhase("result");

    // 🎤 결과 발표
    const winName = winner === "player" ? "Player wins" : winner === "banker" ? "Banker wins" : "Tie";
    speakDealer(winName);
    setDealerSpeaking(true);
    setTimeout(() => setDealerSpeaking(false), 2000);

    // 🎆 승리 시 폭죽
    if (won && !spectatorMode.current) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    // ⏭️ 자동 다음 라운드 (5초 후)
    setTimeout(() => {
      autoNextRound();
    }, 5000);
  };

  // ★ [라이브] 다음 라운드 (로컬 리셋만 - 서버는 자동으로 라운드 증가)
  const autoNextRound = () => {
    setResult(null);
    setGameData(null);
    setBetStacks({ player: [], tie: [], banker: [], playerPair: [], bankerPair: [], perfectPair: [] });
    setPCards(["empty", "empty"]);
    setBCards(["empty", "empty"]);
    setPhase("betting");
    thirdCardAddedRef.current = false;
    spectatorMode.current = false;
    // 라운드 번호는 serverCurrentRound 가 자동 반영됨 (useEffect)
  };

  const resetGame = () => {
    autoNextRound();
  };

  const getDisplayScore = (cards, cardStates) => {
    const revealedCards = cards.filter((_, i) => cardStates[i] === "revealed");
    if (revealedCards.length === 0) return "-";
    return handScore(revealedCards);
  };

  // 🔥 결과 발표 시 (result 단계)에는 반드시 최종 점수를 보여줌
  //    쪼기 중 (squeezing)에는 공개된 카드만 기준
  const displayPScore = result ? result.pScore 
    : gameData ? getDisplayScore(gameData.player, pCards) : "-";
  const displayBScore = result ? result.bScore 
    : gameData ? getDisplayScore(gameData.banker, bCards) : "-";

  const unrevealedStates = ["back", "peek1", "peek2", "peek3"];
  const hasUnrevealed = 
    pCards.some(s => unrevealedStates.includes(s)) ||
    bCards.some(s => unrevealedStates.includes(s));

  // ⏰ 베팅 타이머 (자동 진행)
  useEffect(() => {
    if (phase !== "betting") {
      if (bettingTimerRef.current) {
        clearInterval(bettingTimerRef.current);
        bettingTimerRef.current = null;
      }
      return;
    }

    setBettingTimeLeft(BETTING_DURATION);
    speakDealer("Place your bets, please");
    setDealerSpeaking(true);
    setTimeout(() => setDealerSpeaking(false), 2500);

    bettingTimerRef.current = setInterval(() => {
      setBettingTimeLeft(prev => {
        // 음성 알림
        if (prev === 31) { speakDealer("30 seconds left"); setDealerSpeaking(true); setTimeout(()=>setDealerSpeaking(false), 1800); }
        if (prev === 11) { speakDealer("10 seconds, final bets"); setDealerSpeaking(true); setTimeout(()=>setDealerSpeaking(false), 2000); }
        
        if (prev <= 1) {
          clearInterval(bettingTimerRef.current);
          bettingTimerRef.current = null;
          // ⏰ 타이머 끝 → 자동으로 라운드 진행
          handleAutoRoundStart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (bettingTimerRef.current) clearInterval(bettingTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, serverCurrentRound]);

  // ★ [라이브] 플레이어 수는 서버에서 실시간 수신 (가짜 변동 제거)

  // 🔊 BGM 토글 효과
  useEffect(() => {
    if (bgmOn) startBGM();
    else stopBGM();
    return () => stopBGM();
  }, [bgmOn]);

  const speakDealer = (text) => {
    if (voiceOn) speak(text);
  };

  const toggleVoice = () => {
    const newVal = !voiceOn;
    setVoiceOn(newVal);
    setVoiceEnabled(newVal);
  };
  const toggleBgm = () => {
    const newVal = !bgmOn;
    setBgmOn(newVal);
    setBgmEnabled(newVal);
  };

  // ★ [라이브] 타이머 끝 자동 시작 → 베팅 있으면 자동 READY
  const handleAutoRoundStart = async () => {
    if (totalMainBet === 0) {
      // 베팅 안 하면 구경 모드 (아무것도 안 함)
      spectatorMode.current = true;
      return;
    }
    // "No more bets!" 플래시
    setNoMoreBetsFlash(true);
    speakDealer("No more bets!");
    setDealerSpeaking(true);
    await sleep(1500);
    setDealerSpeaking(false);
    setNoMoreBetsFlash(false);
    
    // 자동 READY 전송
    spectatorMode.current = false;
    handleReady();
  };

  // 💁 딜러 메시지
  const getDealerMessage = () => {
    if (phase === "betting") return totalMainBet > 0 ? "BET PLACED · READY TO DEAL" : "PLACE YOUR BETS";
    if (phase === "waiting_ready") return playerCount > 1 ? "WAITING FOR OTHERS..." : "GENERATING RESULT...";
    if (phase === "dealing") return "DEALING CARDS...";
    if (phase === "squeezing") return hasUnrevealed ? "SQUEEZE YOUR CARDS!" : "ALMOST THERE...";
    if (phase === "result") {
      if (!result) return "";
      const winName = result.winner === "player" ? "PLAYER" : result.winner === "banker" ? "BANKER" : "TIE";
      return result.won ? `✨ ${winName} WINS · YOU WON!` : `${winName} WINS · BETTER LUCK NEXT TIME`;
    }
    return "";
  };
  const dealerMessage = getDealerMessage();

  // ★ [라이브] 안전한 로비 복귀 - 베팅 중이면 로컬 환불 + Firestore 는 서버가 처리
  const handleBack = () => {
    // 베팅 중 (betting phase) 이고 베팅 안 보냈으면 → 로컬 환불
    if (phase === "betting" && totalBet > 0) {
      if (window.confirm("베팅 중입니다. 나가시면 베팅 금액이 환불됩니다. 로비로 돌아가시겠습니까?")) {
        onPointsChange(points + totalBet);
        onLeave();
      }
      return;
    }
    // waiting_ready / dealing / squeezing 중에는 → 결과 포기 경고
    if (phase === "waiting_ready" || phase === "dealing" || phase === "squeezing") {
      if (window.confirm("게임 진행 중입니다. 지금 나가시면 결과를 볼 수 없습니다. (베팅은 서버에 저장되어 자동 정산됩니다) 그래도 나가시겠습니까?")) {
        onLeave();
      }
      return;
    }
    // 그 외 (result phase 등) 는 그냥 나가기
    onLeave();
  };
  
  // 로딩 중
  if (tableLoading) {
    return (
      <div style={{...S.container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400}}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🎰</div>
        <div style={{ color: "#D4A574", fontSize: 14, letterSpacing: 2 }}>테이블 입장 중...</div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button onClick={handleBack} style={S.backBtn}>← LOBBY</button>
        <h2 style={S.title}>VIP BACCARAT · LIVE</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>

      {/* 💁 딜러 영역 */}
      <BaccaratDealer 
        phase={phase} 
        message={dealerMessage}
        roundNumber={roundNumber}
        playerCount={playerCount}
        speaking={dealerSpeaking}
        noMoreBets={noMoreBetsFlash}
      />

      {/* ⏰ 베팅 타이머 바 (phase === betting 일 때만) */}
      {phase === "betting" && (
        <div style={S.timerBar}>
          <div style={{...S.timerFill, 
            width: `${(bettingTimeLeft / BETTING_DURATION) * 100}%`,
            background: bettingTimeLeft <= 10 
              ? "linear-gradient(90deg, #DC2626, #EF4444)"
              : bettingTimeLeft <= 30
              ? "linear-gradient(90deg, #D97706, #F59E0B)"
              : "linear-gradient(90deg, #10B981, #34D399)",
          }} />
          <div style={S.timerText}>
            ⏰ BETTING TIME: {Math.floor(bettingTimeLeft / 60)}:{String(bettingTimeLeft % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* 🔊 음성/BGM 토글 */}
      <div style={S.soundControls}>
        <button onClick={toggleVoice} style={{
          ...S.soundBtn, 
          background: voiceOn ? "rgba(16,185,129,0.2)" : "rgba(100,100,100,0.2)",
          borderColor: voiceOn ? "#10B981" : "rgba(255,255,255,0.1)",
        }}>
          🔊 Voice {voiceOn ? "ON" : "OFF"}
        </button>
        <button onClick={toggleBgm} style={{
          ...S.soundBtn, 
          background: bgmOn ? "rgba(16,185,129,0.2)" : "rgba(100,100,100,0.2)",
          borderColor: bgmOn ? "#10B981" : "rgba(255,255,255,0.1)",
        }}>
          🎵 BGM {bgmOn ? "ON" : "OFF"}
        </button>
      </div>

      {/* 🎆 승리 폭죽 */}
      {showConfetti && <Confetti />}

      {/* 📊 통계 바 */}
      {stats.total > 0 && (
        <div style={S.statsBar}>
          <div style={S.statChip}><span style={{color: "#3B82F6"}}>P</span> {stats.p}</div>
          <div style={S.statChip}><span style={{color: "#E63975"}}>B</span> {stats.b}</div>
          <div style={S.statChip}><span style={{color: "#10B981"}}>T</span> {stats.t}</div>
          <div style={S.statChipTotal}>TOTAL {stats.total}</div>
        </div>
      )}

      {/* 🀄 로드맵 (중국매) - 베팅 결정 참고용, 항상 표시 */}
      <div style={S.roadmapWrap}>
        <div style={S.roadmapHeader}>
          <span style={S.roadmapHeaderTitle}>🀄 중국매 · ROADMAP</span>
          <button onClick={() => setShowRoadmap(v => !v)} style={S.roadmapToggleBtn}>
            {showRoadmap ? "접기 ▲" : "펼치기 ▼"}
          </button>
        </div>
        {showRoadmap && (
          historyWinners.length > 0 ? (
            <BaccaratRoadmap history={historyWinners} />
          ) : (
            <div style={S.roadmapEmpty}>
              첫 라운드 결과가 나오면 로드맵이 쌓입니다
            </div>
          )
        )}
      </div>

      {/* 게임 테이블 */}
      <div style={S.tableArea}>
        <div style={S.tableFelt}>
          <div style={S.playerSide}>
            <div style={S.sideTitle}>PLAYER</div>
            <div style={S.cardsContainer}>
              {pCards.map((cardState, i) => (
                <Card3D
                  key={`p-${i}`}
                  card={gameData?.player[i]}
                  state={cardState}
                  onClick={() => peekCard("player", i)}
                  highlight={result && result.winner === "player"}
                />
              ))}
            </div>
            <div style={S.scoreBox}>{displayPScore}</div>
          </div>

          <div style={S.vsText}>VS</div>

          <div style={S.bankerSide}>
            <div style={{...S.sideTitle, color: "#E63975"}}>BANKER</div>
            <div style={S.cardsContainer}>
              {bCards.map((cardState, i) => (
                <Card3D
                  key={`b-${i}`}
                  card={gameData?.banker[i]}
                  state={cardState}
                  onClick={() => peekCard("banker", i)}
                  highlight={result && result.winner === "banker"}
                />
              ))}
            </div>
            <div style={{...S.scoreBox, color: "#E63975", borderColor: "rgba(230,57,117,0.3)"}}>
              {displayBScore}
            </div>
          </div>
        </div>

        {result && (
          <div style={S.resultOverlay}>
            <div style={{
              ...S.resultBanner,
              background: result.won 
                ? "linear-gradient(90deg, transparent, rgba(16,185,129,0.95), transparent)"
                : "linear-gradient(90deg, transparent, rgba(0,0,0,0.9), transparent)",
            }}>
              <div style={{fontSize: 14, letterSpacing: 2, marginBottom: 4, opacity: 0.9}}>
                {result.winner === "player" ? `🟦 PLAYER ${result.pScore} ` : result.winner === "banker" ? `🟥 BANKER ${result.bScore} ` : `🟩 TIE `}
                WINS
              </div>
              <div style={{fontSize: 28}}>
                {result.net > 0 ? `WIN! +${result.net.toLocaleString()}` : result.net === 0 ? "PUSH" : `LOSE -${Math.abs(result.net).toLocaleString()}`}
              </div>
            </div>
          </div>
        )}

        {phase === "squeezing" && (
          <div style={S.squeezeGuide}>
            👆 카드 터치할수록 모서리가 더 접힘 · 4번 터치 = 완전 공개
          </div>
        )}
      </div>

      {/* 하단 UI */}
      {phase === "betting" && (
        <div style={S.bettingUI}>
          <div style={S.bettingHelp}>① 칩 선택  →  ② 베팅 자리를 누를 때마다 해당 금액 추가  →  ③ START</div>
          <div style={S.chipSelector}>
            {[5000, 10000, 50000, 100000, 500000, 1000000].map(v => (
              <button key={v} onClick={() => setSelectedChip(v)} disabled={points - totalBet < v}
                style={{
                  ...S.chipBtn,
                  ...(selectedChip === v ? S.chipActive : {}),
                  ...(v >= 1000000 ? S.chipMillion : v >= 500000 ? S.chipHalfMillion : {}),
                  opacity: points - totalBet < v ? 0.3 : 1,
                }}>
                {formatChipLabel(v)}
              </button>
            ))}
          </div>
          <div style={S.selectedChipInfo}>선택한 칩: <strong>{selectedChip.toLocaleString()}P</strong> · 베팅 자리 클릭 시 칩 1개 추가</div>

          <div style={S.boardAreas}>
            <button onClick={() => placeChip("player")}
              style={{...S.betArea, borderColor: betStacks.player.length ? "#3B82F6" : "rgba(59,130,246,0.25)"}}>
              <span style={{color: "#3B82F6", fontWeight: 900}}>PLAYER</span>
              <span style={S.odds}>1:1</span>
              {renderPlacedChips("player")}
              <span style={S.placedAmount}>{mainBets.player.toLocaleString()}P</span>
            </button>
            <button onClick={() => placeChip("tie")}
              style={{...S.betArea, borderColor: betStacks.tie.length ? "#10B981" : "rgba(16,185,129,0.25)"}}>
              <span style={{color: "#10B981", fontWeight: 900}}>TIE</span>
              <span style={S.odds}>8:1</span>
              {renderPlacedChips("tie")}
              <span style={S.placedAmount}>{mainBets.tie.toLocaleString()}P</span>
            </button>
            <button onClick={() => placeChip("banker")}
              style={{...S.betArea, borderColor: betStacks.banker.length ? "#E63975" : "rgba(230,57,117,0.25)"}}>
              <span style={{color: "#E63975", fontWeight: 900}}>BANKER</span>
              <span style={S.odds}>1:0.95</span>
              {renderPlacedChips("banker")}
              <span style={S.placedAmount}>{mainBets.banker.toLocaleString()}P</span>
            </button>
          </div>

          {/* 사이드 베팅도 선택한 칩을 클릭할 때마다 누적됩니다. */}
          <div style={S.sideBetSection}>
            <div style={S.sideBetTitle}>SIDE BETS · 선택한 칩을 누를 때마다 금액이 추가됩니다</div>
            <div style={S.sideBetRow}>
              <button onClick={() => placeChip("playerPair")}
                style={{...S.sideBetBtn, borderColor: betStacks.playerPair.length ? "#3B82F6" : "rgba(59,130,246,0.3)",
                  background: betStacks.playerPair.length ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#3B82F6", fontSize: 10, fontWeight: 800}}>P.PAIR</span>
                <span style={S.sideBetOdds}>11:1</span>
                {renderPlacedChips("playerPair")}
                <span style={S.sideBetAmount}>{sideBets.playerPair.toLocaleString()}P</span>
              </button>
              <button onClick={() => placeChip("perfectPair")}
                style={{...S.sideBetBtn, borderColor: betStacks.perfectPair.length ? "#D4A574" : "rgba(212,165,116,0.3)",
                  background: betStacks.perfectPair.length ? "rgba(212,165,116,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#D4A574", fontSize: 10, fontWeight: 800}}>PERFECT</span>
                <span style={S.sideBetOdds}>25:1</span>
                {renderPlacedChips("perfectPair")}
                <span style={S.sideBetAmount}>{sideBets.perfectPair.toLocaleString()}P</span>
              </button>
              <button onClick={() => placeChip("bankerPair")}
                style={{...S.sideBetBtn, borderColor: betStacks.bankerPair.length ? "#E63975" : "rgba(230,57,117,0.3)",
                  background: betStacks.bankerPair.length ? "rgba(230,57,117,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#E63975", fontSize: 10, fontWeight: 800}}>B.PAIR</span>
                <span style={S.sideBetOdds}>11:1</span>
                {renderPlacedChips("bankerPair")}
                <span style={S.sideBetAmount}>{sideBets.bankerPair.toLocaleString()}P</span>
              </button>
            </div>
          </div>

          <div style={S.betFooter}>
            <div style={S.totalBetDisplay}>
              본벳 {totalMainBet.toLocaleString()}P + 사이드 {totalSideBet.toLocaleString()}P
              <div style={S.totalBetStrong}>총 베팅: {totalBet.toLocaleString()}P / 보유: {points.toLocaleString()}P</div>
            </div>
            <button onClick={clearBets} disabled={totalBet === 0}
              style={{...S.clearBetBtn, opacity: totalBet === 0 ? 0.4 : 1}}>BET RESET</button>
          </div>

          {/* ★ [라이브] 멀티플레이 상태 안내 */}
          <div style={S.autoModeInfo}>
            {playerCount > 1 ? (
              totalMainBet > 0 
                ? `✅ BET PLACED (${totalBet.toLocaleString()}P) · READY 누르면 다른 플레이어 대기`
                : `👥 ${playerCount}명 플레이 중 · 베팅 후 READY`
            ) : (
              totalMainBet > 0 
                ? `✅ BET PLACED (${totalBet.toLocaleString()}P) · DEAL 누르면 즉시 결과`
                : "💭 베팅 후 DEAL 버튼 · 혼자 플레이 중"
            )}
          </div>

          {/* ★ [라이브] READY / DEAL 버튼 */}
          <button 
            onClick={handleReady}
            disabled={isSendingReady || totalMainBet === 0}
            style={{
              ...S.actionBtn,
              marginTop: 10,
              background: totalMainBet > 0 && !isSendingReady
                ? "linear-gradient(135deg, #D4A574, #B07D46)"
                : "linear-gradient(135deg, #6B7280, #4B5563)",
              opacity: totalMainBet === 0 ? 0.6 : 1,
              cursor: isSendingReady ? "wait" : "pointer",
            }}
          >
            {isSendingReady 
              ? "⏳ 전송 중..." 
              : totalMainBet > 0 
                ? (playerCount > 1 
                    ? `✅ READY (${totalBet.toLocaleString()}P)` 
                    : `🎲 DEAL (${totalBet.toLocaleString()}P)`)
                : "💭 베팅 먼저 하세요"}
          </button>
        </div>
      )}

      {/* ★ [라이브] READY 전송 후 대기 */}
      {phase === "waiting_ready" && (
        <div style={{...S.statusBar, flexDirection: "column", gap: 8, padding: "16px"}}>
          <div style={{ fontSize: 24 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {playerCount > 1 
              ? "다른 플레이어 대기 중..." 
              : "결과 생성 중..."}
          </div>
          {playerCount > 1 && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
              READY: {serverReadyPlayers.length} / {playerCount}
            </div>
          )}
        </div>
      )}

      {phase === "dealing" && (
        <div style={S.statusBar}>🎴 카드 딜링 중...</div>
      )}

      {phase === "squeezing" && hasUnrevealed && (
        <div style={S.actionRow}>
          <button onClick={revealAll} style={S.revealAllBtn}>
            👁 모두 공개 (SKIP)
          </button>
        </div>
      )}

      {phase === "result" && (
        <div>
          <div style={S.autoModeInfo}>
            ⏭️ 5초 뒤 자동으로 다음 라운드 시작
          </div>
          <button onClick={resetGame} style={{...S.actionBtn, marginTop: 8}}>
            ⏩ 바로 다음 라운드
          </button>
        </div>
      )}
    </div>
  );
}


// --- 스타일 ---
const S = {
  container: { fontFamily: "'Inter', sans-serif", padding: 16, color: "#fff", background: "#0a0a0a", minHeight: "100vh", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700 },
  title: { margin: 0, fontSize: 20, fontWeight: 900, background: "linear-gradient(135deg, #D4A574, #FFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2 },
  points: { background: "linear-gradient(135deg, #FFD700, #D4A574)", color: "#000", padding: "6px 16px", borderRadius: 20, fontWeight: 900, fontSize: 14, boxShadow: "0 0 15px rgba(212,165,116,0.4)" },

  historyBar: { display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 12, overflow: "hidden" },
  historyDot: { width: 14, height: 14, borderRadius: "50%", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" },

  // 📊 통계 바
  statsBar: { 
    display: "flex", gap: 6, marginBottom: 14, 
    padding: "6px", background: "rgba(0,0,0,0.3)", 
    borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)",
  },
  statChip: { 
    flex: 1, textAlign: "center", fontSize: 11, fontWeight: 800,
    color: "#fff", padding: "6px 4px",
    background: "rgba(255,255,255,0.03)", borderRadius: 6,
  },
  statChipTotal: { 
    flex: 1.2, textAlign: "center", fontSize: 10, fontWeight: 800,
    color: "#D4A574", padding: "6px 4px",
    background: "rgba(212,165,116,0.1)", borderRadius: 6,
    letterSpacing: 1,
  },

  // 자동 모드 안내
  autoModeInfo: {
    marginTop: 10, padding: 12,
    background: "rgba(212,165,116,0.08)",
    border: "1px dashed rgba(212,165,116,0.3)",
    borderRadius: 10,
    textAlign: "center", fontSize: 12, color: "#D4A574", fontWeight: 700,
    letterSpacing: 0.5,
  },

  // ⏰ 베팅 타이머 바
  timerBar: {
    position: "relative", height: 32, borderRadius: 10,
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(212,165,116,0.3)",
    marginBottom: 12, overflow: "hidden",
  },
  timerFill: {
    position: "absolute", top: 0, left: 0, bottom: 0,
    transition: "width 1s linear, background 0.3s",
    opacity: 0.4,
  },
  timerText: {
    position: "relative", height: "100%", display: "flex",
    alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: 12, fontWeight: 900, letterSpacing: 2,
    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
  },

  // 🔊 음성/BGM 토글
  soundControls: {
    display: "flex", gap: 8, marginBottom: 12,
  },
  soundBtn: {
    flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer",
    border: "1px solid",
    color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1,
    transition: "all 0.2s",
  },

  // 🀄 로드맵 섹션 (베팅 결정 참고용 - 테이블 위에 위치)
  roadmapWrap: { marginBottom: 14 },
  roadmapHeader: { 
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "6px 10px", marginBottom: 4,
  },
  roadmapHeaderTitle: {
    fontSize: 11, fontWeight: 900, color: "#D4A574", letterSpacing: 2,
  },
  roadmapToggleBtn: { 
    padding: "4px 12px", 
    background: "rgba(212,165,116,0.1)", 
    border: "1px solid rgba(212,165,116,0.3)",
    color: "#D4A574", borderRadius: 12, 
    cursor: "pointer", fontSize: 10, fontWeight: 700, letterSpacing: 1,
  },
  roadmapEmpty: {
    padding: 20, textAlign: "center", color: "rgba(255,255,255,0.4)",
    fontSize: 11, fontStyle: "italic",
    background: "rgba(0,0,0,0.3)", borderRadius: 10,
    border: "1px dashed rgba(212,165,116,0.2)",
  },

  tableArea: { position: "relative", marginBottom: 20 },
  tableFelt: { background: "radial-gradient(ellipse at top, #1a4f36 0%, #061c12 100%)", borderRadius: 24, border: "4px solid #D4A574", padding: "30px 10px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.5)", minHeight: 220 },

  playerSide: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  bankerSide: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  sideTitle: { fontSize: 13, fontWeight: 900, letterSpacing: 4, color: "#3B82F6", marginBottom: 16, textShadow: "0 2px 4px rgba(0,0,0,0.5)" },
  cardsContainer: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: 100, marginBottom: 16, flexWrap: "wrap" },

  scoreBox: { background: "rgba(0,0,0,0.4)", border: "2px solid rgba(59,130,246,0.3)", color: "#3B82F6", fontSize: 24, fontWeight: 900, width: 50, height: 50, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  vsText: { color: "rgba(255,255,255,0.2)", fontSize: 20, fontWeight: 900, fontStyle: "italic", padding: "0 4px" },

  peekHint: { position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", fontSize: 14, zIndex: 5, animation: "peekPulse 1.5s ease-in-out infinite" },
  
  squeezeGuide: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 8, padding: "6px", background: "rgba(255,255,255,0.03)", borderRadius: 8 },

  resultOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 },
  resultBanner: { width: "100%", textAlign: "center", padding: "16px 0", fontSize: 28, fontWeight: 900, letterSpacing: 3, color: "#fff", textShadow: "0 4px 10px rgba(0,0,0,0.8)", animation: "bannerSlide 0.5s ease-out" },

  bettingUI: { background: "rgba(255,255,255,0.02)", borderRadius: 24, padding: 16 },
  chipSelector: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 },
  chipBtn: { width: 54, height: 54, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #444, #111)", border: "4px dashed #666", color: "#fff", fontWeight: 900, fontSize: 10, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.5)" },
  chipActive: { border: "4px dashed #D4A574", transform: "scale(1.08)", boxShadow: "0 0 20px rgba(212,165,116,0.5)" },
  chipHalfMillion: { borderColor: "#C084FC", color: "#F3E8FF", background: "radial-gradient(circle at 30% 30%, #7E22CE, #2E1065)", fontSize: 11 },
  chipMillion: { borderColor: "#FDE68A", color: "#FFF7CC", background: "radial-gradient(circle at 30% 30%, #D4A72C, #713F12)", fontSize: 11 },
  bettingHelp: { textAlign: "center", color: "rgba(255,255,255,0.68)", fontSize: 11, lineHeight: 1.6, marginBottom: 12 },
  selectedChipInfo: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: -8, marginBottom: 14 },

  boardAreas: { display: "flex", gap: 8, marginBottom: 16 },
  betArea: { flex: 1, minWidth: 0, padding: "14px 4px", minHeight: 126, background: "rgba(255,255,255,0.03)", border: "2px solid", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", cursor: "pointer", transition: "all 0.2s", overflow: "hidden" },
  odds: { fontSize: 11, opacity: 0.5, marginTop: 6, fontWeight: 600 },
  placedChips: { display: "flex", alignItems: "center", justifyContent: "center", gap: 3, minHeight: 26, marginTop: 8, flexWrap: "wrap", maxWidth: "100%" },
  placedChip: { width: 31, height: 23, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#17120A", fontWeight: 900, fontSize: 8, border: "2px dashed rgba(255,255,255,0.85)", boxShadow: "0 2px 4px rgba(0,0,0,0.5)", flex: "0 0 auto" },
  extraChipCount: { color: "#fff", fontSize: 9, fontWeight: 800 },
  placedAmount: { fontSize: 11, color: "#F5E9D2", fontWeight: 800, marginTop: 5, overflowWrap: "anywhere" },

  sideBetSection: { marginBottom: 12 },
  sideBetTitle: { fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 0.3, marginBottom: 8, textAlign: "center" },
  sideBetRow: { display: "flex", gap: 6 },
  sideBetBtn: { flex: 1, minWidth: 0, minHeight: 118, padding: "10px 4px", border: "2px solid", borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.2s", overflow: "hidden" },
  sideBetOdds: { fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600 },
  sideBetAmount: { fontSize: 10, color: "#D4A574", fontWeight: 800, marginTop: 2, overflowWrap: "anywhere" },
  betFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 },
  totalBetDisplay: { flex: 1, textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 },
  totalBetStrong: { color: "#D4A574", fontWeight: 900, fontSize: 12 },
  clearBetBtn: { padding: "9px 11px", color: "#E5E7EB", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, fontSize: 9, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },

  actionBtn: { width: "100%", padding: 20, background: "linear-gradient(135deg, #D4A574, #B07D46)", border: "none", color: "#000", borderRadius: 16, fontSize: 16, fontWeight: 900, letterSpacing: 2, cursor: "pointer", boxShadow: "0 8px 20px rgba(212,165,116,0.3)" },

  statusBar: { textAlign: "center", padding: 20, fontSize: 14, color: "#D4A574", fontWeight: 800, letterSpacing: 2 },
  
  actionRow: { display: "flex", gap: 8, marginTop: 8 },
  revealAllBtn: { flex: 1, padding: 14, background: "linear-gradient(135deg, #FF6B9D, #E63975)", border: "none", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 800, letterSpacing: 2, cursor: "pointer", boxShadow: "0 4px 15px rgba(230,57,117,0.4)" },
};