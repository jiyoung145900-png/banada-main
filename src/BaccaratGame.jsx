// ===================================================================
// 🎰 Premium Baccarat (Interactive Squeeze - 유저가 직접 쪼기!)
// ===================================================================
// 🎯 플로우:
//   1. BET 선택 → PLACE BET
//   2. 카드 4장 뒷면으로 깔림 (자동)
//   3. 유저가 각 카드 클릭 → 쪼기 (peek) → 완전 공개 (reveal)
//      또는 "모두 공개" 버튼으로 한번에
//   4. 서드 카드 필요하면 또 쪼기
//   5. 결과
// ===================================================================

import React, { useState, useRef, useEffect } from "react";

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
  `;
  document.head.appendChild(style);
};

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

// --- 인터랙티브 카드 컴포넌트 ---
function Card3D({ card, state, onClick, highlight }) {
  // state: "empty"(없음) | "back"(뒷면) | "peek"(쪼기 중) | "revealed"(공개)
  const isRed = card?.suit === "♥" || card?.suit === "♦";
  const clickable = state === "back" || state === "peek";

  if (state === "empty") {
    return <div style={{ width: 68, height: 95, margin: "0 4px" }} />;
  }

  let transform = "rotateY(180deg)";
  let animation = "none";

  if (state === "back") {
    animation = "dealIn 0.4s ease-out forwards";
    transform = "rotateY(180deg)";
  } else if (state === "peek") {
    transform = "rotateY(90deg) scale(1.15)";
  } else if (state === "revealed") {
    transform = "rotateY(0deg)";
  }

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        perspective: "1200px",
        width: 68,
        height: 95,
        margin: "0 4px",
        cursor: clickable ? "pointer" : "default",
        position: "relative",
      }}
    >
      {state === "back" && (
        <div style={S.peekHint}>👆</div>
      )}
      {state === "peek" && (
        <div style={{...S.peekHint, color: "#FFD700"}}>👁</div>
      )}

      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transform: transform,
          transition: (state === "peek" || state === "revealed") 
            ? "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)" 
            : "none",
          animation: animation,
          boxShadow: highlight 
            ? "0 0 20px rgba(255,215,0,0.8), 0 8px 20px rgba(0,0,0,0.6)"
            : "0 8px 20px rgba(0,0,0,0.6)",
          borderRadius: 8,
        }}
      >
        {/* 앞면 */}
        <div style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          borderRadius: 8,
          background: "linear-gradient(145deg, #ffffff, #f0f0f0)",
          color: isRed ? "#E63975" : "#1F0817",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotateY(0deg)",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 4, left: 6, fontSize: 14, lineHeight: 1, textAlign: "center" }}>
            <div style={{ fontWeight: 900 }}>{card?.rank}</div>
            <div style={{ fontSize: 12 }}>{card?.suit}</div>
          </div>
          <div style={{ fontSize: 38, opacity: 0.2, fontWeight: 900 }}>{card?.suit}</div>
          <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 14, lineHeight: 1, transform: "rotate(180deg)", textAlign: "center" }}>
            <div style={{ fontWeight: 900 }}>{card?.rank}</div>
            <div style={{ fontSize: 12 }}>{card?.suit}</div>
          </div>
        </div>

        {/* 뒷면 */}
        <div style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          borderRadius: 8,
          background: "linear-gradient(135deg, #4A1033 0%, #2A0520 50%, #1A0512 100%)",
          border: "2px solid #D4A574",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotateY(180deg)",
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
      </div>
    </div>
  );
}

// --- 메인 컴포넌트 ---
export default function BaccaratGame({ points = 100000, onPointsChange = () => {}, onBack = () => {} }) {
  useEffect(() => { injectKeyframes(); }, []);

  const [bet, setBet] = useState(5000);
  const [side, setSide] = useState(null);
  const [sideBets, setSideBets] = useState({ playerPair: 0, bankerPair: 0, perfectPair: 0 });
  const [history, setHistory] = useState([]);
  
  // phase: "betting" | "dealing" | "squeezing" | "result"
  const [phase, setPhase] = useState("betting");
  const [gameData, setGameData] = useState(null);
  
  const [pCards, setPCards] = useState(["empty", "empty"]);
  const [bCards, setBCards] = useState(["empty", "empty"]);
  const [result, setResult] = useState(null);
  
  // 서드 카드 추가 완료 플래그 (한 번만 실행)
  const thirdCardAddedRef = useRef(false);

  const totalBet = bet + sideBets.playerPair + sideBets.bankerPair + sideBets.perfectPair;
  const canPlay = points >= totalBet && side && phase === "betting";
  
  const audioCtxRef = useRef(null);
  useEffect(() => {
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }, []);

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

  const toggleSideBet = (type) => {
    if (phase !== "betting") return;
    setSideBets(prev => ({ ...prev, [type]: prev[type] > 0 ? 0 : bet }));
  };

  // 🎲 게임 시작
  const handlePlay = async () => {
    if (!canPlay) return;
    
    const game = playBaccarat();
    setGameData(game);
    setPhase("dealing");
    thirdCardAddedRef.current = false;

    setPCards(["empty", "empty"]);
    setBCards(["empty", "empty"]);
    
    // 순차 딜링 (P1 → B1 → P2 → B2)
    for (let i = 0; i < 2; i++) {
      await sleep(300);
      playSound("deal");
      setPCards(prev => { const n = [...prev]; n[i] = "back"; return n; });
      await sleep(300);
      playSound("deal");
      setBCards(prev => { const n = [...prev]; n[i] = "back"; return n; });
    }

    setPhase("squeezing");
  };

  // 👆 개별 카드 클릭 (뒷면 → 쪼기 → 공개)
  const peekCard = (sideKey, idx) => {
    const setter = sideKey === "player" ? setPCards : setBCards;
    setter(prev => {
      const n = [...prev];
      if (n[idx] === "back") {
        n[idx] = "peek";
        playSound("peek");
      } else if (n[idx] === "peek") {
        n[idx] = "revealed";
        playSound("reveal");
      }
      return n;
    });
  };

  // 👁 전체 공개
  const revealAll = () => {
    setPCards(prev => prev.map(s => s === "empty" ? "empty" : "revealed"));
    setBCards(prev => prev.map(s => s === "empty" ? "empty" : "revealed"));
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

  const finalizeGame = () => {
    if (!gameData || result) return;
    
    const game = gameData;
    const winner = game.pScore > game.bScore ? "player" : game.bScore > game.pScore ? "banker" : "tie";
    
    let payout = 0;
    if (side === winner) {
      if (winner === "player") payout = bet * 2;
      else if (winner === "banker") payout = Math.floor(bet * 1.95);
      else payout = bet * 9;
      playSound("win");
    }

    // 사이드 베팅
    const pCard1 = game.player[0], pCard2 = game.player[1];
    const bCard1 = game.banker[0], bCard2 = game.banker[1];
    const sideResults = { playerPair: false, bankerPair: false, perfectPair: false };
    let sidePayout = 0;

    if (sideBets.playerPair > 0 && pCard1.rank === pCard2.rank) {
      sideResults.playerPair = true;
      sidePayout += sideBets.playerPair * 12;
    }
    if (sideBets.bankerPair > 0 && bCard1.rank === bCard2.rank) {
      sideResults.bankerPair = true;
      sidePayout += sideBets.bankerPair * 12;
    }
    if (sideBets.perfectPair > 0) {
      const pPerfect = pCard1.rank === pCard2.rank && pCard1.suit === pCard2.suit;
      const bPerfect = bCard1.rank === bCard2.rank && bCard1.suit === bCard2.suit;
      if (pPerfect || bPerfect) {
        sideResults.perfectPair = true;
        sidePayout += sideBets.perfectPair * 26;
      }
    }

    const totalSideBet = sideBets.playerPair + sideBets.bankerPair + sideBets.perfectPair;
    const totalPayout = payout + sidePayout;
    const won = side === winner || sidePayout > 0;

    onPointsChange(points - bet - totalSideBet + totalPayout);
    setResult({ ...game, winner, won, payout: totalPayout, sideResults, mainWon: side === winner, sidePayout });
    setHistory(prev => [winner, ...prev].slice(0, 12));
    setPhase("result");
  };

  const resetGame = () => {
    setResult(null);
    setGameData(null);
    setSide(null);
    setPCards(["empty", "empty"]);
    setBCards(["empty", "empty"]);
    setSideBets({ playerPair: 0, bankerPair: 0, perfectPair: 0 });
    setPhase("betting");
    thirdCardAddedRef.current = false;
  };

  const getDisplayScore = (cards, cardStates) => {
    const revealedCards = cards.filter((_, i) => cardStates[i] === "revealed");
    if (revealedCards.length === 0) return "-";
    return handScore(revealedCards);
  };

  const displayPScore = gameData ? getDisplayScore(gameData.player, pCards) : "-";
  const displayBScore = gameData ? getDisplayScore(gameData.banker, bCards) : "-";

  const hasUnrevealed = 
    pCards.some(s => s === "back" || s === "peek") ||
    bCards.some(s => s === "back" || s === "peek");

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← LOBBY</button>
        <h2 style={S.title}>VIP BACCARAT</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>

      {history.length > 0 && (
        <div style={S.historyBar}>
          {history.map((h, i) => (
            <div key={i} style={{...S.historyDot, background: h === "player" ? "#3B82F6" : h === "banker" ? "#E63975" : "#10B981"}} />
          ))}
        </div>
      )}

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
              {result.won ? `WIN! +${result.payout.toLocaleString()}` : "LOSE"}
            </div>
          </div>
        )}

        {phase === "squeezing" && (
          <div style={S.squeezeGuide}>
            👆 카드 터치 = 쪼기 · 한번 더 = 공개
          </div>
        )}
      </div>

      {/* 하단 UI */}
      {phase === "betting" && (
        <div style={S.bettingUI}>
          <div style={S.chipSelector}>
            {[5000, 10000, 50000, 100000].map(v => (
              <button key={v} onClick={() => setBet(v)} disabled={points < v}
                style={{...S.chipBtn, ...(bet === v ? S.chipActive : {}), opacity: points < v ? 0.3 : 1}}>
                {v / 1000}K
              </button>
            ))}
          </div>

          <div style={S.boardAreas}>
            <button onClick={() => setSide("player")}
              style={{...S.betArea, borderColor: side === "player" ? "#3B82F6" : "transparent"}}>
              <span style={{color: "#3B82F6", fontWeight: 900}}>PLAYER</span>
              <span style={S.odds}>1:1</span>
            </button>
            <button onClick={() => setSide("tie")}
              style={{...S.betArea, borderColor: side === "tie" ? "#10B981" : "transparent"}}>
              <span style={{color: "#10B981", fontWeight: 900}}>TIE</span>
              <span style={S.odds}>8:1</span>
            </button>
            <button onClick={() => setSide("banker")}
              style={{...S.betArea, borderColor: side === "banker" ? "#E63975" : "transparent"}}>
              <span style={{color: "#E63975", fontWeight: 900}}>BANKER</span>
              <span style={S.odds}>1:0.95</span>
            </button>
          </div>

          {/* 🎯 사이드 베팅 */}
          <div style={S.sideBetSection}>
            <div style={S.sideBetTitle}>SIDE BETS (베팅 선택 → 금액만큼 추가)</div>
            <div style={S.sideBetRow}>
              <button onClick={() => toggleSideBet("playerPair")} disabled={points < totalBet + bet - sideBets.playerPair}
                style={{...S.sideBetBtn, borderColor: sideBets.playerPair > 0 ? "#3B82F6" : "rgba(59,130,246,0.3)",
                  background: sideBets.playerPair > 0 ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#3B82F6", fontSize: 10, fontWeight: 800}}>P.PAIR</span>
                <span style={S.sideBetOdds}>11:1</span>
                {sideBets.playerPair > 0 && <span style={S.sideBetAmount}>{(sideBets.playerPair/1000)}K</span>}
              </button>
              <button onClick={() => toggleSideBet("perfectPair")} disabled={points < totalBet + bet - sideBets.perfectPair}
                style={{...S.sideBetBtn, borderColor: sideBets.perfectPair > 0 ? "#D4A574" : "rgba(212,165,116,0.3)",
                  background: sideBets.perfectPair > 0 ? "rgba(212,165,116,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#D4A574", fontSize: 10, fontWeight: 800}}>PERFECT</span>
                <span style={S.sideBetOdds}>25:1</span>
                {sideBets.perfectPair > 0 && <span style={S.sideBetAmount}>{(sideBets.perfectPair/1000)}K</span>}
              </button>
              <button onClick={() => toggleSideBet("bankerPair")} disabled={points < totalBet + bet - sideBets.bankerPair}
                style={{...S.sideBetBtn, borderColor: sideBets.bankerPair > 0 ? "#E63975" : "rgba(230,57,117,0.3)",
                  background: sideBets.bankerPair > 0 ? "rgba(230,57,117,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#E63975", fontSize: 10, fontWeight: 800}}>B.PAIR</span>
                <span style={S.sideBetOdds}>11:1</span>
                {sideBets.bankerPair > 0 && <span style={S.sideBetAmount}>{(sideBets.bankerPair/1000)}K</span>}
              </button>
            </div>
            {totalBet > bet && (
              <div style={S.totalBetDisplay}>
                총 베팅: <strong style={{color: "#D4A574"}}>{totalBet.toLocaleString()}P</strong>
              </div>
            )}
          </div>

          <button onClick={handlePlay} disabled={!canPlay} style={{...S.actionBtn, opacity: canPlay ? 1 : 0.5}}>
            {side ? `PLACE BET (${totalBet.toLocaleString()}P)` : "SELECT POSITION"}
          </button>
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
        <button onClick={resetGame} style={S.actionBtn}>REBET / NEXT ROUND</button>
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
  chipSelector: { display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 },
  chipBtn: { width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #444, #111)", border: "4px dashed #666", color: "#fff", fontWeight: 900, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.5)" },
  chipActive: { border: "4px dashed #D4A574", transform: "scale(1.1)", boxShadow: "0 0 20px rgba(212,165,116,0.5)" },

  boardAreas: { display: "flex", gap: 12, marginBottom: 16 },
  betArea: { flex: 1, padding: "20px 10px", background: "rgba(255,255,255,0.03)", border: "2px solid", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", transition: "all 0.2s" },
  odds: { fontSize: 11, opacity: 0.5, marginTop: 6, fontWeight: 600 },

  sideBetSection: { marginBottom: 20 },
  sideBetTitle: { fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 8, textAlign: "center" },
  sideBetRow: { display: "flex", gap: 8 },
  sideBetBtn: { flex: 1, padding: "10px 6px", border: "2px solid", borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.2s" },
  sideBetOdds: { fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600 },
  sideBetAmount: { fontSize: 10, color: "#D4A574", fontWeight: 800, marginTop: 2 },
  totalBetDisplay: { textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 10 },

  actionBtn: { width: "100%", padding: 20, background: "linear-gradient(135deg, #D4A574, #B07D46)", border: "none", color: "#000", borderRadius: 16, fontSize: 16, fontWeight: 900, letterSpacing: 2, cursor: "pointer", boxShadow: "0 8px 20px rgba(212,165,116,0.3)" },

  statusBar: { textAlign: "center", padding: 20, fontSize: 14, color: "#D4A574", fontWeight: 800, letterSpacing: 2 },
  
  actionRow: { display: "flex", gap: 8, marginTop: 8 },
  revealAllBtn: { flex: 1, padding: 14, background: "linear-gradient(135deg, #FF6B9D, #E63975)", border: "none", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 800, letterSpacing: 2, cursor: "pointer", boxShadow: "0 4px 15px rgba(230,57,117,0.4)" },
};