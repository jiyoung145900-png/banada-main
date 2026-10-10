// ===================================================================
// 🃏 BlackjackGame - 블랙잭 (21)
// ===================================================================

import { useState } from "react";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function newDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ suit: s, rank: r });
  return d.sort(() => Math.random() - 0.5);
}

function cardValue(c) {
  if (["J", "Q", "K"].includes(c.rank)) return 10;
  if (c.rank === "A") return 11;
  return parseInt(c.rank, 10);
}

function handValue(hand) {
  let total = hand.reduce((s, c) => s + cardValue(c), 0);
  let aces = hand.filter(c => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

export default function BlackjackGame({ points, onPointsChange, onBack }) {
  const [bet, setBet] = useState(1000);
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gameState, setGameState] = useState("betting"); // betting, playing, dealer, result
  const [result, setResult] = useState(null);
  const [hideDealer, setHideDealer] = useState(true);
  
  const canPlay = points >= bet && gameState === "betting";
  
  const startGame = () => {
    if (!canPlay) return;
    const d = newDeck();
    const p = [d.pop(), d.pop()];
    const dl = [d.pop(), d.pop()];
    setDeck(d);
    setPlayerHand(p);
    setDealerHand(dl);
    setHideDealer(true);
    setResult(null);
    
    // 블랙잭 즉시 체크
    const pBJ = isBlackjack(p);
    const dBJ = isBlackjack(dl);
    
    if (pBJ || dBJ) {
      setHideDealer(false);
      setTimeout(() => {
        if (pBJ && dBJ) finishGame("push", p, dl);
        else if (pBJ) finishGame("blackjack", p, dl);
        else finishGame("lose", p, dl);
      }, 1000);
      setGameState("result");
    } else {
      setGameState("playing");
    }
  };
  
  const hit = () => {
    if (gameState !== "playing") return;
    const d = [...deck];
    const newHand = [...playerHand, d.pop()];
    setDeck(d);
    setPlayerHand(newHand);
    
    const v = handValue(newHand);
    if (v > 21) {
      setHideDealer(false);
      setTimeout(() => finishGame("bust", newHand, dealerHand), 500);
      setGameState("result");
    } else if (v === 21) {
      stand(newHand);
    }
  };
  
  const stand = async (currentHand = playerHand) => {
    setGameState("dealer");
    setHideDealer(false);
    
    // 딜러 턴
    let d = [...deck];
    let dh = [...dealerHand];
    
    await new Promise(r => setTimeout(r, 500));
    
    while (handValue(dh) < 17) {
      await new Promise(r => setTimeout(r, 600));
      dh = [...dh, d.pop()];
      setDealerHand([...dh]);
    }
    
    await new Promise(r => setTimeout(r, 500));
    
    const pV = handValue(currentHand);
    const dV = handValue(dh);
    
    let outcome;
    if (dV > 21) outcome = "dealer_bust";
    else if (pV > dV) outcome = "win";
    else if (pV < dV) outcome = "lose";
    else outcome = "push";
    
    finishGame(outcome, currentHand, dh);
  };
  
  const finishGame = (outcome, pHand, dHand) => {
    let payout = 0;
    let msg = "";
    
    switch (outcome) {
      case "blackjack":
        payout = Math.floor(bet * 2.5);
        msg = "🎉 블랙잭! 1.5배 보너스";
        break;
      case "win":
      case "dealer_bust":
        payout = bet * 2;
        msg = outcome === "dealer_bust" ? "🎉 딜러 버스트!" : "🎉 승리!";
        break;
      case "push":
        payout = bet;
        msg = "🤝 무승부";
        break;
      case "bust":
        payout = 0;
        msg = "💥 버스트! 패배";
        break;
      case "lose":
        payout = 0;
        msg = "💔 패배";
        break;
    }
    
    const netChange = payout - bet;
    onPointsChange(points + netChange);
    
    setResult({ outcome, msg, payout, netChange, pValue: handValue(pHand), dValue: handValue(dHand) });
    setGameState("result");
  };
  
  const resetGame = () => {
    setPlayerHand([]);
    setDealerHand([]);
    setDeck([]);
    setResult(null);
    setGameState("betting");
    setHideDealer(true);
  };
  
  return (
    <div style={S.container}>
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← 로비</button>
        <h2 style={S.title}>🃏 Blackjack</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>
      
      {/* 테이블 */}
      <div style={S.table}>
        {/* 딜러 */}
        <div style={S.handArea}>
          <div style={S.handLabel}>
            DEALER {!hideDealer && dealerHand.length > 0 && `(${handValue(dealerHand)})`}
          </div>
          <div style={S.cards}>
            {dealerHand.length === 0 ? (
              <div style={S.cardPlaceholder}>?</div>
            ) : dealerHand.map((c, i) => (
              <Card key={i} card={c} hidden={hideDealer && i === 1} />
            ))}
          </div>
        </div>
        
        <div style={S.divider}></div>
        
        {/* 플레이어 */}
        <div style={S.handArea}>
          <div style={S.handLabel}>
            PLAYER {playerHand.length > 0 && `(${handValue(playerHand)})`}
          </div>
          <div style={S.cards}>
            {playerHand.length === 0 ? (
              <div style={S.cardPlaceholder}>?</div>
            ) : playerHand.map((c, i) => (
              <Card key={i} card={c} />
            ))}
          </div>
        </div>
      </div>
      
      {/* 결과 */}
      {result && (
        <div style={{
          ...S.resultMsg,
          background: result.netChange > 0 
            ? "linear-gradient(135deg, #10B981, #059669)"
            : result.netChange === 0
            ? "linear-gradient(135deg, #D4A574, #B88E5D)"
            : "linear-gradient(135deg, #EF4444, #DC2626)"
        }}>
          {result.msg}
          <div style={S.resultSub}>
            {result.netChange > 0 ? `+${result.netChange.toLocaleString()}P` : 
             result.netChange === 0 ? "±0P" :
             `${result.netChange.toLocaleString()}P`}
          </div>
        </div>
      )}
      
      {/* 베팅 */}
      {gameState === "betting" && (
        <div style={S.betSection}>
          <div style={S.betLabel}>베팅 금액</div>
          <div style={S.betChips}>
            {[1000, 5000, 10000, 50000, 100000].map(v => (
              <button
                key={v}
                onClick={() => setBet(v)}
                disabled={points < v}
                style={{
                  ...S.chip,
                  ...(bet === v ? S.chipActive : {}),
                  opacity: points < v ? 0.3 : 1
                }}
              >
                {v >= 10000 ? `${v/10000}만` : `${v/1000}천`}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* 액션 버튼 */}
      <div style={S.actions}>
        {gameState === "betting" && (
          <button onClick={startGame} disabled={!canPlay} style={{...S.playBtn, opacity: canPlay ? 1 : 0.4}}>
            {bet.toLocaleString()}P 베팅 · DEAL
          </button>
        )}
        
        {gameState === "playing" && (
          <div style={{display: "flex", gap: 8}}>
            <button onClick={hit} style={{...S.playBtn, flex: 1, background: "linear-gradient(135deg, #10B981, #059669)"}}>
              HIT
            </button>
            <button onClick={() => stand()} style={{...S.playBtn, flex: 1, background: "linear-gradient(135deg, #D4A574, #B88E5D)"}}>
              STAND
            </button>
          </div>
        )}
        
        {gameState === "dealer" && (
          <button disabled style={{...S.playBtn, opacity: 0.5}}>딜러 턴...</button>
        )}
        
        {gameState === "result" && (
          <button onClick={resetGame} style={S.playBtn}>다시 하기</button>
        )}
      </div>
    </div>
  );
}

function Card({ card, hidden }) {
  if (hidden) {
    return (
      <div style={{...S.card, background: "linear-gradient(135deg, #3d1028, #1f0817)", border: "2px solid #D4A574", color: "#D4A574", justifyContent: "center", alignItems: "center"}}>
        <div style={{fontSize: 28}}>🂠</div>
      </div>
    );
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div style={{...S.card, color: red ? "#E63975" : "#1F0817"}}>
      <div style={S.cardRank}>{card.rank}</div>
      <div style={S.cardSuit}>{card.suit}</div>
    </div>
  );
}

const S = {
  container: { padding: 16, color: "#fff", minHeight: 500 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { background: "transparent", border: "1px solid rgba(212,165,116,0.4)", color: "#D4A574", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, background: "linear-gradient(135deg, #D4A574, #FF6B9D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  points: { background: "linear-gradient(135deg, #3d1028, #1f0817)", padding: "8px 16px", borderRadius: 50, border: "1px solid #D4A574", color: "#D4A574", fontWeight: 700, fontSize: 14 },
  table: { background: "radial-gradient(ellipse at center, #4e1835 0%, #1f0817 70%)", border: "2px solid rgba(212,165,116,0.3)", borderRadius: 20, padding: 24, marginBottom: 20 },
  handArea: { textAlign: "center", marginBottom: 16 },
  handLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 12, color: "#D4A574" },
  cards: { display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", minHeight: 85 },
  card: { width: 56, height: 80, background: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" },
  cardPlaceholder: { width: 56, height: 80, background: "rgba(255,255,255,0.05)", borderRadius: 8, border: "2px dashed rgba(212,165,116,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(212,165,116,0.4)", fontSize: 24 },
  cardRank: { fontSize: 16, fontWeight: 800 },
  cardSuit: { fontSize: 20, textAlign: "right" },
  divider: { height: 1, background: "rgba(212,165,116,0.3)", margin: "16px 0" },
  resultMsg: { padding: 16, borderRadius: 12, textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 16, color: "#fff" },
  resultSub: { fontSize: 14, marginTop: 4, opacity: 0.9 },
  betSection: { marginBottom: 16 },
  betLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 8, letterSpacing: 1 },
  betChips: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: { flex: 1, minWidth: 50, padding: "10px 8px", background: "rgba(212,165,116,0.1)", border: "1px solid rgba(212,165,116,0.3)", color: "#D4A574", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 },
  chipActive: { background: "linear-gradient(135deg, #D4A574, #FF6B9D)", border: "1px solid #FF6B9D", color: "#fff" },
  actions: { marginTop: 16 },
  playBtn: { width: "100%", padding: 16, background: "linear-gradient(135deg, #E63975, #FF6B9D)", border: "none", color: "#fff", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: 1 },
};
