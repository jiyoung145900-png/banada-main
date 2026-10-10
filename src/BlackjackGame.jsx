// ===================================================================
// 🃏 Premium Blackjack (Evolution Style with 3D Cards & Dealer)
// ===================================================================
import React, { useState, useRef, useEffect } from "react";

// --- 글로벌 애니메이션 주입 ---
const injectKeyframes = () => {
  if (document.getElementById("blackjack-animations")) return;
  const style = document.createElement("style");
  style.id = "blackjack-animations";
  style.innerHTML = `
    @keyframes dealCard {
      0% { transform: translateY(-300px) scale(0.5) rotate(-20deg); opacity: 0; }
      100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes flipCard {
      0% { transform: rotateY(180deg); }
      100% { transform: rotateY(0deg); }
    }
    @keyframes popResult {
      0% { transform: scale(0.5); opacity: 0; }
      70% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
};

// --- 카드 유틸리티 ---
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  const deck = [];
  for (let i = 0; i < 4; i++) { // 4덱 사용
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({ suit: s, rank: r });
      }
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function getCardValue(rank) {
  if (["J", "Q", "K"].includes(rank)) return 10;
  if (rank === "A") return 11;
  return parseInt(rank, 10);
}

function calculateScore(hand) {
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    if (!card.hidden) {
      score += getCardValue(card.rank);
      if (card.rank === "A") aces += 1;
    }
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

// --- 3D 카드 컴포넌트 ---
function Card3D({ card, index, isDealer }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  
  // 카드가 겹쳐 보이도록 marginLeft 적용 (첫 카드 제외)
  const offsetStyle = {
    marginLeft: index > 0 ? "-35px" : "0px",
    zIndex: index,
    animation: "dealCard 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
  };

  return (
    <div style={{ perspective: "1000px", width: 80, height: 115, ...offsetStyle }}>
      <div style={{
        width: "100%", height: "100%", position: "relative",
        transformStyle: "preserve-3d",
        transition: "transform 0.6s",
        transform: card.hidden ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        {/* 앞면 */}
        <div style={{
          ...S.cardFace, background: "linear-gradient(145deg, #fff, #f0f0f0)", color: isRed ? "#E63975" : "#111",
          transform: "rotateY(0deg)", boxShadow: "2px 4px 10px rgba(0,0,0,0.3)"
        }}>
          <div style={{ position: "absolute", top: 4, left: 6, fontSize: 18, lineHeight: 1 }}>
            <div>{card.rank}</div>
            <div style={{ fontSize: 14 }}>{card.suit}</div>
          </div>
          <div style={{ fontSize: 36, opacity: 0.1, transform: "scale(1.5)" }}>{card.suit}</div>
          <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 18, lineHeight: 1, transform: "rotate(180deg)" }}>
            <div>{card.rank}</div>
            <div style={{ fontSize: 14 }}>{card.suit}</div>
          </div>
        </div>

        {/* 뒷면 (Hidden) */}
        <div style={{
          ...S.cardFace, background: "linear-gradient(135deg, #1A0512, #4A1033)",
          border: "2px solid #D4A574", color: "#D4A574", transform: "rotateY(180deg)",
          boxShadow: "2px 4px 10px rgba(0,0,0,0.5)"
        }}>
          <div style={{ border: "1px dashed rgba(212,165,116,0.5)", width: "86%", height: "90%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
            🂠
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 메인 게임 ---
export default function BlackjackGame({ points = 100000, onPointsChange = ()=>{}, onBack = ()=>{} }) {
  useEffect(() => { injectKeyframes(); }, []);

  const [deck, setDeck] = useState([]);
  const [gameState, setGameState] = useState("BETTING"); // BETTING, DEALING, PLAYER_TURN, DEALER_TURN, GAME_OVER
  const [bet, setBet] = useState(0);
  const [chipAmount, setChipAmount] = useState(1000);
  
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [resultMsg, setResultMsg] = useState(null);
  const [winAmount, setWinAmount] = useState(0);

  const audioCtxRef = useRef(null);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    setDeck(createDeck());
  }, []);

  const playSound = (type) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "chip") {
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gain.gain.value = 0.3;
      osc.start(); setTimeout(() => osc.stop(), 100);
    } else if (type === "card") {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      gain.gain.value = 0.2;
      osc.type = "triangle";
      osc.start(); setTimeout(() => osc.stop(), 150);
    } else if (type === "win") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.value = 0.4;
      osc.start(); setTimeout(() => osc.stop(), 400);
    } else if (type === "lose") {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
      gain.gain.value = 0.4;
      osc.type = "sawtooth";
      osc.start(); setTimeout(() => osc.stop(), 500);
    }
  };

  const placeBet = () => {
    if (points < chipAmount) return;
    setBet(prev => prev + chipAmount);
    onPointsChange(points - chipAmount);
    playSound("chip");
  };

  const clearBet = () => {
    onPointsChange(points + bet);
    setBet(0);
  };

  const dealCards = async () => {
    if (bet === 0) return;
    setGameState("DEALING");
    setResultMsg(null);
    setWinAmount(0);
    
    let currentDeck = [...deck];
    if (currentDeck.length < 20) currentDeck = createDeck();

    const pHand = [];
    const dHand = [];

    // 딜링 연출 (P -> D -> P -> D(Hidden))
    pHand.push({ ...currentDeck.pop(), hidden: false });
    setPlayerHand([...pHand]);
    playSound("card"); await sleep(400);

    dHand.push({ ...currentDeck.pop(), hidden: false });
    setDealerHand([...dHand]);
    playSound("card"); await sleep(400);

    pHand.push({ ...currentDeck.pop(), hidden: false });
    setPlayerHand([...pHand]);
    playSound("card"); await sleep(400);

    dHand.push({ ...currentDeck.pop(), hidden: true }); // 딜러 히든 카드
    setDealerHand([...dHand]);
    setDeck(currentDeck);
    playSound("card"); await sleep(600);

    const pScore = calculateScore(pHand);
    const dScore = calculateScore([{...dHand[0]}, {...dHand[1], hidden: false}]); // 미리 확인용

    // 블랙잭 체크
    if (pScore === 21) {
      if (dScore === 21) {
        endGame(pHand, dHand, "PUSH (BOTH BLACKJACK)");
      } else {
        endGame(pHand, dHand, "BLACKJACK!");
      }
    } else {
      setGameState("PLAYER_TURN");
    }
  };

  const hit = async () => {
    playSound("card");
    const newCard = deck.pop();
    const newHand = [...playerHand, { ...newCard, hidden: false }];
    setPlayerHand(newHand);
    setDeck([...deck]);

    const score = calculateScore(newHand);
    if (score > 21) {
      await sleep(500);
      endGame(newHand, dealerHand, "BUST");
    } else if (score === 21) {
      await sleep(500);
      dealerTurn(newHand, dealerHand); // 21이면 강제 스탠드
    }
  };

  const stand = async () => {
    dealerTurn(playerHand, dealerHand);
  };

  const doubleDown = async () => {
    if (points < bet) return; // 포인트 부족
    onPointsChange(points - bet);
    setBet(bet * 2);
    playSound("chip");
    await sleep(300);

    playSound("card");
    const newCard = deck.pop();
    const newHand = [...playerHand, { ...newCard, hidden: false }];
    setPlayerHand(newHand);
    setDeck([...deck]);

    const score = calculateScore(newHand);
    await sleep(800);
    
    if (score > 21) {
      endGame(newHand, dealerHand, "BUST");
    } else {
      dealerTurn(newHand, dealerHand);
    }
  };

  const dealerTurn = async (pHand, dHand) => {
    setGameState("DEALER_TURN");
    await sleep(500);
    
    // 딜러 히든 카드 오픈
    let currentDHand = [...dHand];
    currentDHand[1].hidden = false;
    setDealerHand([...currentDHand]);
    playSound("card");
    await sleep(800);

    let dScore = calculateScore(currentDHand);
    let currentDeck = [...deck];

    // 소프트 17 룰 (17 이상일 때까지 힛)
    while (dScore < 17) {
      currentDHand.push({ ...currentDeck.pop(), hidden: false });
      setDealerHand([...currentDHand]);
      dScore = calculateScore(currentDHand);
      setDeck([...currentDeck]);
      playSound("card");
      await sleep(800);
    }

    const pScore = calculateScore(pHand);
    
    if (dScore > 21) endGame(pHand, currentDHand, "DEALER BUST! YOU WIN");
    else if (dScore > pScore) endGame(pHand, currentDHand, "DEALER WINS");
    else if (dScore < pScore) endGame(pHand, currentDHand, "YOU WIN!");
    else endGame(pHand, currentDHand, "PUSH");
  };

  const endGame = (pHand, dHand, msg) => {
    setGameState("GAME_OVER");
    
    // 히든카드 강제 오픈
    const finalDHand = dHand.map(c => ({...c, hidden: false}));
    setDealerHand(finalDHand);
    setResultMsg(msg);

    let payout = 0;
    if (msg.includes("BLACKJACK!")) { payout = bet + (bet * 1.5); playSound("win"); }
    else if (msg.includes("WIN")) { payout = bet * 2; playSound("win"); }
    else if (msg.includes("PUSH")) { payout = bet; playSound("chip"); } // 원금 반환
    else { playSound("lose"); } // 패배 시 사운드

    if (payout > 0) {
      onPointsChange(points + payout);
      setWinAmount(payout);
    }
  };

  const resetRound = () => {
    setPlayerHand([]);
    setDealerHand([]);
    setBet(0);
    setResultMsg(null);
    setGameState("BETTING");
  };

  // UI 렌더링 값
  const pScore = calculateScore(playerHand);
  const dScore = calculateScore(dealerHand);

  return (
    <div style={S.container}>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← LOBBY</button>
        <h2 style={S.title}>VIP BLACKJACK</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>

      {/* 테이블 영역 */}
      <div style={S.table}>
        {/* 딜러 영역 */}
        <div style={S.dealerArea}>
          <div style={S.dealerAvatar}>
            <div style={S.dealerIcon}>🤵</div>
            <div style={S.dealerName}>EVOLUTION DEALER</div>
          </div>
          
          <div style={S.cardsWrapper}>
            {dealerHand.map((card, i) => <Card3D key={`d-${i}`} card={card} index={i} isDealer />)}
          </div>
          {dealerHand.length > 0 && gameState !== "DEALING" && (
            <div style={S.scoreBadge}>
              {dScore}
            </div>
          )}
        </div>

        {/* 중앙 베팅존 / 로고 */}
        <div style={S.centerLogo}>
          {gameState === "BETTING" ? (
            <div style={{ opacity: 0.3 }}>BLACKJACK PAYS 3 TO 2<br/>DEALER MUST DRAW TO 16, AND STAND ON ALL 17S</div>
          ) : (
            <div style={S.betCircle}>
              <div style={S.betAmount}>{bet >= 1000 ? `${bet/1000}k` : bet}</div>
            </div>
          )}
        </div>

        {/* 결과 오버레이 */}
        {resultMsg && (
          <div style={S.resultOverlay}>
            <div style={{...S.resultText, color: resultMsg.includes("WIN") || resultMsg.includes("BLACKJACK") ? "#FFD700" : resultMsg.includes("PUSH") ? "#aaa" : "#ff4444"}}>
              {resultMsg}
            </div>
            {winAmount > 0 && <div style={{ fontSize: 20, color: "#fff", marginTop: 8 }}>+{winAmount.toLocaleString()} P</div>}
          </div>
        )}

        {/* 플레이어 영역 */}
        <div style={S.playerArea}>
          {playerHand.length > 0 && (
            <div style={{...S.scoreBadge, bottom: "110%", top: "auto", background: pScore > 21 ? "#ff4444" : "rgba(0,0,0,0.6)"}}>
              {pScore}
            </div>
          )}
          <div style={S.cardsWrapper}>
            {playerHand.map((card, i) => <Card3D key={`p-${i}`} card={card} index={i} />)}
          </div>
        </div>
      </div>

      {/* 컨트롤 패널 */}
      <div style={S.controlPanel}>
        {gameState === "BETTING" && (
          <>
            <div style={S.chipRow}>
              {[1000, 5000, 10000, 50000].map(v => (
                <div key={v} onClick={() => setChipAmount(v)} 
                  style={{...S.chipBtn, ...(chipAmount === v ? S.chipActive : {}), opacity: points < v ? 0.3 : 1}}>
                  {v >= 1000 ? `${v/1000}k` : v}
                </div>
              ))}
            </div>
            <div style={S.betActions}>
              <button onClick={clearBet} disabled={bet === 0} style={{...S.actionBtn, background: "#333", color: "#fff"}}>CLEAR</button>
              <button onClick={placeBet} disabled={points < chipAmount} style={{...S.actionBtn, background: "#D4A574", color: "#000"}}>BET CHIP</button>
              <button onClick={dealCards} disabled={bet === 0} style={{...S.actionBtn, background: "linear-gradient(135deg, #E63975, #FF6B9D)", color: "#fff"}}>DEAL</button>
            </div>
          </>
        )}

        {gameState === "PLAYER_TURN" && (
          <div style={S.playActions}>
            <button onClick={hit} style={{...S.playBtn, background: "#10B981"}}>HIT</button>
            <button onClick={stand} style={{...S.playBtn, background: "#ef4444"}}>STAND</button>
            <button onClick={doubleDown} disabled={points < bet || playerHand.length > 2} style={{...S.playBtn, background: "#FFD700", color: "#000", opacity: (points < bet || playerHand.length > 2) ? 0.4 : 1}}>DOUBLE</button>
          </div>
        )}

        {gameState === "GAME_OVER" && (
          <div style={S.playActions}>
            <button onClick={resetRound} style={{...S.playBtn, width: "100%", background: "#D4A574", color: "#000"}}>NEW ROUND</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 스타일 객체 ---
const S = {
  container: { fontFamily: "'Inter', sans-serif", padding: 16, background: "#0a0a0a", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backBtn: { background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700 },
  title: { margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: 2, color: "#D4A574" },
  points: { background: "rgba(0,0,0,0.5)", border: "1px solid #D4A574", color: "#FFD700", padding: "6px 16px", borderRadius: 20, fontWeight: 800, fontSize: 13 },
  
  table: { flex: 1, position: "relative", background: "radial-gradient(ellipse at 50% -20%, #1a4f36 0%, #061c12 100%)", borderRadius: "30px 30px 10px 10px", borderTop: "12px solid #2a1610", borderLeft: "4px solid #2a1610", borderRight: "4px solid #2a1610", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px 0", boxShadow: "inset 0 20px 50px rgba(0,0,0,0.5)" },
  
  dealerArea: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 140 },
  dealerAvatar: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 10 },
  dealerIcon: { fontSize: 32, background: "rgba(0,0,0,0.4)", borderRadius: "50%", width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,215,0,0.3)" },
  dealerName: { fontSize: 10, color: "#D4A574", marginTop: 4, fontWeight: 700, letterSpacing: 1 },
  
  centerLogo: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: 2 },
  betCircle: { width: 50, height: 50, borderRadius: "50%", border: "2px dashed rgba(255,215,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" },
  betAmount: { background: "radial-gradient(circle, #FFD700, #B8860B)", color: "#000", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, border: "2px solid #000", boxShadow: "0 4px 8px rgba(0,0,0,0.5)" },

  playerArea: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 140, paddingBottom: 20 },
  
  cardsWrapper: { display: "flex", justifyContent: "center", alignItems: "center", position: "relative" },
  scoreBadge: { position: "absolute", top: "105%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: 12, fontSize: 14, fontWeight: 900, color: "#fff", zIndex: 10 },
  
  resultOverlay: { position: "absolute", top: "45%", left: 0, width: "100%", textAlign: "center", zIndex: 50, animation: "popResult 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)" },
  resultText: { fontSize: 36, fontWeight: 900, textShadow: "0 4px 10px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)", letterSpacing: 2 },
  
  controlPanel: { background: "#111", padding: 16, borderRadius: "20px 20px 0 0", marginTop: 16 },
  chipRow: { display: "flex", justifyContent: "center", gap: 12, marginBottom: 16 },
  chipBtn: { width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #444, #1a1a1a)", border: "3px dashed #666", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, cursor: "pointer", transition: "all 0.2s" },
  chipActive: { border: "3px dashed #D4A574", transform: "scale(1.1)", boxShadow: "0 4px 15px rgba(212,165,116,0.3)" },
  
  betActions: { display: "flex", gap: 10 },
  actionBtn: { flex: 1, padding: 14, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: "pointer", letterSpacing: 1 },
  
  playActions: { display: "flex", gap: 10 },
  playBtn: { flex: 1, padding: 16, border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 10px rgba(0,0,0,0.3)" },
  
  cardFace: { position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }
};