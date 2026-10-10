// ===================================================================
// 🃏 BlackjackGame - 블랙잭 (사이트 전용)
// ===================================================================
// Props:
//   points: 현재 포인트
//   onPointsChange: 포인트 변경 콜백
//   onBack: 로비로 돌아가기
// ===================================================================

import { useState, useRef, useEffect } from "react";

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
  const [bet, setBet] = useState(5000);
  const [gameState, setGameState] = useState("betting"); // betting, playing, dealer, result
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [result, setResult] = useState(null);
  const [hideDealerFirst, setHideDealerFirst] = useState(true);
  const [cardAnimation, setCardAnimation] = useState({});

  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);

  // 오디오 초기화
  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  const playSound = (type) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "win") {
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      gain.gain.value = 0.5;
      osc.type = "sine";
      osc.start();
      setTimeout(() => osc.stop(), 220);
    } else if (type === "bust") {
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.value = 0.6;
      osc.type = "sawtooth";
      osc.start();
      setTimeout(() => osc.stop(), 400);
    } else if (type === "blackjack") {
      osc.frequency.setValueAtTime(680, ctx.currentTime);
      gain.gain.value = 0.4;
      osc.type = "sine";
      osc.start();
      setTimeout(() => osc.stop(), 120);
    } else if (type === "bet") {
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      gain.gain.value = 0.3;
      osc.type = "sawtooth";
      osc.start();
      setTimeout(() => osc.stop(), 80);
    }
  };

  const getDeck = () => {
    const d = newDeck();
    const p = [d.pop(), d.pop()];
    const dl = [d.pop(), d.pop()];
    return { deck: d, player: p, dealer: dl };
  };

  const startGame = () => {
    if (!points || points < bet) return;
    setGameState("betting");
    setResult(null);
    setHideDealerFirst(true);
    setCardAnimation({});

    const { deck: newDeck, player, dealer } = getDeck();
    setDeck(newDeck);
    setPlayerHand(player);
    setDealerHand(dealer);

    // 블랙잭 체크
    const pBJ = isBlackjack(player);
    const dBJ = isBlackjack(dealer);

    if (pBJ || dBJ) {
      setHideDealerFirst(false);
      setTimeout(() => {
        if (pBJ && dBJ) finishGame("push", player, dealer);
        else if (pBJ) finishGame("blackjack", player, dealer);
        else finishGame("lose", player, dealer);
      }, 900);
      setGameState("result");
    } else {
      setGameState("playing");
    }
  };

  const hit = () => {
    if (gameState !== "playing") return;

    const newDeck = [...deck];
    const newPlayer = [...playerHand, newDeck.pop()];
    setDeck(newDeck);
    setPlayerHand(newPlayer);

    const v = handValue(newPlayer);

    if (v > 21) {
      playSound("bust");
      setHideDealerFirst(false);
      setTimeout(() => finishGame("bust", newPlayer, dealerHand), 600);
      setGameState("result");
    } else if (v === 21) {
      stand(newPlayer);
    }
  };

  const stand = async (currentHand = playerHand) => {
    setGameState("dealer");
    setHideDealerFirst(false);

    let newDeck = [...deck];
    let dh = [...dealerHand];

    // 딜러 애니메이션
    await new Promise(r => setTimeout(r, 700));

    while (handValue(dh) < 17) {
      await new Promise(r => setTimeout(r, 550));
      dh = [...dh, newDeck.pop()];
      setDealerHand([...dh]);
    }

    await new Promise(r => setTimeout(r, 600));
    finishGame(null, currentHand, dh);
  };

  const finishGame = (outcome, pHand, dHand) => {
    let payout = 0;
    let msg = "";

    if (outcome === "blackjack") {
      payout = Math.floor(bet * 2.5);
      msg = "🎉 블랙잭! 1.5배 보너스!";
    } else if (outcome === "win") {
      payout = bet * 2;
      msg = "🎉 승리!";
    } else if (outcome === "push") {
      payout = bet;
      msg = "🤝 무승부";
    } else if (outcome === "bust") {
      payout = 0;
      msg = "💥 버스트! 패배";
    } else if (outcome === "lose") {
      payout = 0;
      msg = "💔 패배";
    }

    const net = payout - bet;
    onPointsChange(points + net);

    setResult({ outcome, msg, payout, net, pValue: handValue(pHand), dValue: handValue(dHand) });
  };

  const resetGame = () => {
    setGameState("betting");
    setPlayerHand([]);
    setDealerHand([]);
    setDeck([]);
    setResult(null);
    setHideDealerFirst(true);
  };

  // 카드 뒤집기 애니메이션 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;

    const ctx = canvas.getContext("2d");
    canvas.width = 220;
    canvas.height = 130;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pCards = playerHand || [];
      const dCards = dealerHand || [];

      pCards.forEach((card, i) => {
        const flip = cardAnimation.player?.[i]?.back ? 1 : 0;
        ctx.save();
        ctx.translate(30 + i * 35, 20);
        ctx.scale(flip, 1);
        ctx.drawImage(canvasRef.current, 0, 0, 55, 78);
        ctx.restore();
      });

      dCards.forEach((card, i) => {
        const flip = cardAnimation.dealer?.[i]?.back ? 1 : 0;
        ctx.save();
        ctx.translate(30 + i * 35, 70);
        ctx.scale(flip, 1);
        ctx.drawImage(canvasRef.current, 0, 0, 55, 78);
        ctx.restore();
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [result, playerHand, dealerHand, cardAnimation]);

  return (
    <div style={S.container}>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← 로비</button>
        <h2 style={S.title}>🃏 Blackjack</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>

      {/* 테이블 */}
      <div style={S.table}>
        <canvas ref={canvasRef} style={{ display: "block", margin: "0 auto 12px" }} />

        <div style={S.handArea}>
          <div style={S.handLabel}>DEALER</div>
          <div style={S.cards}>
            {dealerHand.map((c, i) => (
              <Card
                key={i}
                card={c}
                hidden={hideDealerFirst && i === 1}
              />
            ))}
          </div>
        </div>

        <div style={S.divider}></div>

        <div style={S.handArea}>
          <div style={S.handLabel}>PLAYER</div>
          <div style={S.cards}>
            {playerHand.map((c, i) => (
              <Card key={i} card={c} />
            ))}
          </div>
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div
          style={{
            ...S.resultMsg,
            background: result.net > 0
              ? "linear-gradient(135deg, #10B981, #059669)"
              : result.net === 0
              ? "linear-gradient(135deg, #D4A574, #B88E5D)"
              : "linear-gradient(135deg, #EF4444, #DC2626)",
          }}
        >
          {result.msg}
          <div style={S.resultSub}>
            {result.net > 0 ? `+${result.net.toLocaleString()}P` :
             result.net === 0 ? "±0P" : `${result.net.toLocaleString()}P`}
          </div>
        </div>
      )}

      {/* 베팅 UI */}
      {gameState === "betting" && (
        <div style={S.betSection}>
          <div style={S.betLabel}>베팅 금액</div>
          <div style={S.betChips}>
            {[1000, 5000, 10000, 50000, 100000].map((v) => (
              <button
                key={v}
                onClick={() => setBet(v)}
                disabled={points < v}
                style={{
                  ...S.chip,
                  ...(bet === v ? S.chipActive : {}),
                  opacity: points < v ? 0.3 : 1,
                }}
              >
                {v >= 10000 ? `${v / 10000}만` : `${v / 1000}천`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div style={S.actions}>
        {gameState === "betting" && (
          <button
            onClick={startGame}
            disabled={!points || points < bet}
            style={{ ...S.playBtn, opacity: !points || points < bet ? 0.4 : 1 }}
          >
            {bet.toLocaleString()}P 베팅 · DEAL
          </button>
        )}

        {gameState === "playing" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={hit} style={{ ...S.playBtn, flex: 1, background: "linear-gradient(135deg, #10B981, #059669)" }}>
              HIT
            </button>
            <button onClick={stand} style={{ ...S.playBtn, flex: 1, background: "linear-gradient(135deg, #D4A574, #B88E5D)" }}>
              STAND
            </button>
          </div>
        )}

        {gameState === "result" && (
          <button onClick={resetGame} style={S.playBtn}>
            다시 하기
          </button>
        )}
      </div>
    </div>
  );
}

function Card({ card, hidden }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      style={{
        ...S.card,
        background: hidden ? "linear-gradient(135deg, #3d1028, #1f0817)" : "#fff",
        color: hidden ? "#D4A574" : red ? "#E63975" : "#1F0817",
        fontSize: hidden ? 32 : 18,
      }}
    >
      {hidden ? "🂠" : `${card.rank}${card.suit}`}
    </div>
  );
}

// 스타일
const S = {
  container: { padding: 16, color: "#fff", minHeight: 520 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backBtn: { background: "transparent", border: "1px solid rgba(212,165,116,0.5)", color: "#D4A574", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  title: { margin: 0, fontSize: 26, fontWeight: 800, background: "linear-gradient(135deg, #D4A574, #FF6B9D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  points: { background: "linear-gradient(135deg, #3d1028, #1f0817)", padding: "8px 20px", borderRadius: 50, border: "1px solid #D4A574", color: "#D4A574", fontWeight: 700, fontSize: 15 },
  table: { background: "radial-gradient(ellipse at center, #4e1835 0%, #1f0817 70%)", border: "3px solid rgba(212,165,116,0.4)", borderRadius: 24, padding: 20, marginBottom: 20, position: "relative" },
  divider: { height: 1, background: "rgba(212,165,116,0.3)", margin: "16px 0" },
  handArea: { textAlign: "center" },
  handLabel: { fontSize: 13, fontWeight: 800, letterSpacing: 3, marginBottom: 12, color: "#60A5FA" },
  cards: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 10 },
  card: { width: 56, height: 80, background: "#fff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.5)", transition: "transform 0.3s" },
  resultMsg: { padding: 20, borderRadius: 16, textAlign: "center", fontSize: 21, fontWeight: 800, marginBottom: 20 },
  resultSub: { fontSize: 13, opacity: 0.9, marginTop: 6 },
  betSection: { marginBottom: 16 },
  betLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, letterSpacing: 1 },
  betChips: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: { flex: 1, minWidth: 50, padding: "12px 14px", background: "rgba(212,165,116,0.12)", border: "1px solid rgba(212,165,116,0.3)", color: "#D4A574", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  chipActive: { background: "linear-gradient(135deg, #D4A574, #FF6B9D)", border: "2px solid #FF6B9D", color: "#fff" },
  actions: { marginTop: 12 },
  playBtn: { width: "100%", padding: 18, background: "linear-gradient(135deg, #E63975, #FF6B9D)", border: "none", color: "#fff", borderRadius: 14, fontSize: 17, fontWeight: 800, cursor: "pointer", letterSpacing: 2, boxShadow: "0 6px 20px rgba(230,57,117,0.4)" },
};