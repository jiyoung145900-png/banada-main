// ===================================================================
// 🎰 HoldemTable - 실제 플레이 테이블 (Firestore 실시간)
// ===================================================================
// Props:
//   tableId, userId, userName
//   gamePoints, onPointsChange
//   onLeave: 로비로 돌아가기
// ===================================================================

import React, { useState, useEffect, useRef } from "react";
import { 
  subscribeTable, leaveTable, startGame, playerAction, nextRound, deleteTable
} from "./HoldemFirestore";
import { evaluateHand } from "./HoldemLogic";

export default function HoldemTable({ tableId, userId, userName, gamePoints, onPointsChange, onLeave }) {
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const prevChipsRef = useRef({});

  // Firestore 실시간 구독
  useEffect(() => {
    const unsub = subscribeTable(tableId, (t) => {
      if (!t) {
        onLeave();  // 테이블 삭제됨
        return;
      }
      
      // 칩 변동 감지 → 포인트 반영
      const me = t.players.find(p => p.userId === userId);
      if (me && prevChipsRef.current[userId] !== undefined) {
        const diff = me.chips - prevChipsRef.current[userId];
        if (diff !== 0) {
          // 서버에서 받은 chips 변화를 로컬 gamePoints 에 반영 안 함
          // → 떠날 때 한번에 반영 (여기서는 그냥 표시만)
        }
      }
      if (me) prevChipsRef.current[userId] = me.chips;
      
      setTable(t);
      setLoading(false);
    });
    return unsub;
  }, [tableId, userId]);

  const handleLeave = async () => {
    const me = table?.players.find(p => p.userId === userId);
    if (me && me.chips > 0 && table.status !== "playing") {
      // 남은 칩 포인트로 환원
      onPointsChange(gamePoints + me.chips);
    }
    try {
      await leaveTable({ tableId, userId });
    } catch (e) {}
    onLeave();
  };

  const handleStart = async () => {
    setActionLoading(true);
    setError("");
    try {
      await startGame(tableId);
    } catch (e) {
      setError(e.message);
    }
    setActionLoading(false);
  };

  const handleAction = async (action, amount = 0) => {
    setActionLoading(true);
    setError("");
    try {
      await playerAction({ tableId, userId, action, amount });
    } catch (e) {
      setError(e.message);
    }
    setActionLoading(false);
  };

  const handleNextRound = async () => {
    setActionLoading(true);
    try {
      await nextRound(tableId);
    } catch (e) {
      setError(e.message);
    }
    setActionLoading(false);
  };

  if (loading || !table) {
    return <div style={S.loading}>테이블 로딩 중...</div>;
  }

  const me = table.players.find(p => p.userId === userId);
  const myIdx = table.players.findIndex(p => p.userId === userId);
  const isMyTurn = myIdx === table.currentPlayerIdx && table.status === "playing";
  const canStart = table.status === "waiting" && table.players.length >= 2;
  const isShowdown = table.phase === "showdown";
  const callAmount = me ? Math.max(0, table.currentBet - me.bet) : 0;
  const minRaise = table.currentBet + table.bigBlind;

  return (
    <div style={S.container}>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={handleLeave} style={S.backBtn}>← 나가기</button>
        <h2 style={S.title}>{table.name}</h2>
        <div style={S.phaseBadge}>{getPhaseName(table.phase)}</div>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {/* 테이블 (타원형) */}
      <div style={S.tableArea}>
        <div style={S.tableFelt}>
          {/* 중앙: 팟 + 공유 카드 */}
          <div style={S.centerArea}>
            <div style={S.potBox}>
              <div style={S.potLabel}>POT</div>
              <div style={S.potValue}>{table.pot.toLocaleString()}</div>
            </div>
            
            <div style={S.communityCards}>
              {[0,1,2,3,4].map(i => (
                <CommunityCard key={i} card={table.communityCards[i]} />
              ))}
            </div>
            
            {table.currentBet > 0 && (
              <div style={S.betInfo}>Current Bet: {table.currentBet.toLocaleString()}</div>
            )}
          </div>

          {/* 플레이어들 (주변) */}
          <div style={S.playersGrid}>
            {table.players.map((p, i) => (
              <PlayerSeat 
                key={p.userId}
                player={p}
                isMe={p.userId === userId}
                isCurrent={i === table.currentPlayerIdx && table.status === "playing"}
                isDealer={i === table.dealerIdx}
                isWinner={false}
                showCards={isShowdown || p.userId === userId}
                position={i}
                total={table.players.length}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 하단 액션 영역 */}
      <div style={S.actionArea}>
        {/* 대기 중 - 게임 시작 버튼 */}
        {table.status === "waiting" && table.phase !== "showdown" && (
          <>
            <div style={S.waitingMsg}>
              {table.players.length < 2 
                ? `⏳ 다른 플레이어 기다리는 중 (${table.players.length}/${table.maxPlayers})`
                : `✅ ${table.players.length}명 준비됨`}
            </div>
            {canStart && (
              <button onClick={handleStart} disabled={actionLoading} style={S.startBtn}>
                {actionLoading ? "시작 중..." : "🎲 게임 시작"}
              </button>
            )}
          </>
        )}

        {/* 쇼다운 */}
        {isShowdown && (
          <>
            <ShowdownResult table={table} userId={userId} />
            <button onClick={handleNextRound} disabled={actionLoading} style={S.startBtn}>
              {actionLoading ? "준비 중..." : "⏭ 다음 라운드"}
            </button>
          </>
        )}

        {/* 플레이 중 */}
        {table.status === "playing" && !isShowdown && me && (
          <>
            {isMyTurn ? (
              <div>
                <div style={S.yourTurnBadge}>🎯 당신 차례!</div>
                <div style={S.actionButtons}>
                  <button onClick={() => handleAction("fold")} disabled={actionLoading} style={{...S.actBtn, background: "#6B7280"}}>
                    FOLD
                  </button>
                  {callAmount === 0 ? (
                    <button onClick={() => handleAction("check")} disabled={actionLoading} style={{...S.actBtn, background: "#3B82F6"}}>
                      CHECK
                    </button>
                  ) : (
                    <button onClick={() => handleAction("call")} disabled={actionLoading || callAmount > me.chips} style={{...S.actBtn, background: "#10B981"}}>
                      CALL {callAmount.toLocaleString()}
                    </button>
                  )}
                  {me.chips > callAmount && (
                    <button onClick={() => handleAction("all-in")} disabled={actionLoading} style={{...S.actBtn, background: "#EF4444"}}>
                      ALL-IN
                    </button>
                  )}
                </div>
                
                {me.chips > callAmount + table.bigBlind && (
                  <div style={S.raiseRow}>
                    <input
                      type="number"
                      value={raiseAmount || minRaise}
                      onChange={e => setRaiseAmount(Number(e.target.value) || 0)}
                      min={minRaise}
                      max={me.chips + me.bet}
                      style={S.raiseInput}
                      placeholder={`최소 ${minRaise}`}
                    />
                    <button 
                      onClick={() => handleAction("raise", raiseAmount || minRaise)}
                      disabled={actionLoading || !raiseAmount || raiseAmount < minRaise || raiseAmount > me.chips + me.bet}
                      style={{...S.actBtn, flex: 1, background: "#D4A574", color: "#000"}}
                    >
                      RAISE {(raiseAmount || minRaise).toLocaleString()}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={S.waitingTurnMsg}>
                ⏳ {table.players[table.currentPlayerIdx]?.nickname || "..."} 차례
              </div>
            )}
          </>
        )}

        {/* 히스토리 (최근 5개) */}
        {table.history && table.history.length > 0 && (
          <div style={S.historyBox}>
            <div style={S.historyTitle}>📋 LOG</div>
            {table.history.slice(-5).reverse().map((h, i) => (
              <div key={i} style={S.historyItem}>{h.event}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// 서브 컴포넌트
// ────────────────────────────────────────

function CommunityCard({ card }) {
  if (!card) {
    return <div style={{...S.card, background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(212,165,116,0.2)"}} />;
  }
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div style={{...S.card, background: "#fff", color: isRed ? "#E63975" : "#1F0817"}}>
      <div style={S.cardRank}>{card.rank}</div>
      <div style={S.cardSuit}>{card.suit}</div>
    </div>
  );
}

function PlayerSeat({ player, isMe, isCurrent, isDealer, showCards, position, total }) {
  const seatBg = player.folded ? "rgba(50,50,50,0.5)" :
                 isCurrent ? "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(212,165,116,0.2))" :
                 isMe ? "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.2))" :
                 "rgba(255,255,255,0.05)";
  
  return (
    <div style={{
      ...S.playerSeat,
      background: seatBg,
      border: isCurrent ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.1)",
      opacity: player.folded ? 0.4 : 1,
    }}>
      <div style={S.playerHeader}>
        <span style={S.playerName}>{player.nickname}{isMe ? " (나)" : ""}</span>
        {isDealer && <span style={S.dealerChip}>D</span>}
      </div>
      <div style={S.playerCards}>
        {player.cards && player.cards.length > 0 ? player.cards.map((c, i) => (
          showCards ? (
            <MiniCard key={i} card={c} />
          ) : (
            <div key={i} style={S.cardBack} />
          )
        )) : <span style={S.noCards}>-</span>}
      </div>
      <div style={S.playerStats}>
        <div style={S.chipsLabel}>💰 {player.chips.toLocaleString()}</div>
        {player.bet > 0 && <div style={S.betLabel}>BET {player.bet.toLocaleString()}</div>}
        {player.allIn && <div style={S.allInLabel}>ALL-IN</div>}
        {player.folded && <div style={S.foldedLabel}>FOLD</div>}
      </div>
    </div>
  );
}

function MiniCard({ card }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div style={{...S.miniCard, color: isRed ? "#E63975" : "#1F0817"}}>
      <div style={{fontSize: 10, fontWeight: 900}}>{card.rank}</div>
      <div style={{fontSize: 12}}>{card.suit}</div>
    </div>
  );
}

function ShowdownResult({ table, userId }) {
  const active = table.players.filter(p => !p.folded);
  const results = active.map(p => ({
    player: p,
    hand: evaluateHand([...p.cards, ...table.communityCards]),
  })).sort((a, b) => b.hand.rank - a.hand.rank);
  
  const winner = results[0];
  const won = winner && winner.player.userId === userId;
  
  return (
    <div style={{
      ...S.showdownBox,
      background: won 
        ? "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.1))" 
        : "linear-gradient(135deg, rgba(100,100,100,0.3), rgba(50,50,50,0.1))",
    }}>
      <div style={S.showdownTitle}>
        {won ? "🏆 YOU WIN!" : `🏆 ${winner?.player.nickname} 승리!`}
      </div>
      {results.map((r, i) => (
        <div key={i} style={S.showdownRow}>
          <span>{r.player.nickname}</span>
          <span style={{color: i === 0 ? "#FFD700" : "#aaa"}}>{r.hand.name}</span>
        </div>
      ))}
    </div>
  );
}

function getPhaseName(phase) {
  return {
    waiting: "대기",
    preflop: "프리플랍",
    flop: "플랍",
    turn: "턴",
    river: "리버",
    showdown: "쇼다운",
    ended: "종료",
  }[phase] || phase;
}

const S = {
  container: { padding: 12, color: "#fff", background: "#0a0a0a", minHeight: "100vh", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px 12px", borderRadius: 16, cursor: "pointer", fontSize: 11, fontWeight: 700 },
  title: { margin: 0, fontSize: 15, fontWeight: 900, color: "#D4A574", maxWidth: "40%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  phaseBadge: { background: "rgba(212,165,116,0.2)", color: "#D4A574", padding: "4px 10px", borderRadius: 10, fontSize: 10, fontWeight: 800, letterSpacing: 1 },
  
  loading: { padding: 40, textAlign: "center", color: "#D4A574", fontSize: 14 },
  error: { background: "rgba(239,68,68,0.15)", border: "1px solid #EF4444", color: "#FCA5A5", padding: "8px 12px", borderRadius: 8, fontSize: 11, marginBottom: 10 },
  
  tableArea: { marginBottom: 12 },
  tableFelt: {
    background: "radial-gradient(ellipse at center, #1a4f36 0%, #061c12 100%)",
    border: "3px solid #D4A574", borderRadius: 24, padding: "16px 12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.5)",
    minHeight: 400,
  },
  centerArea: { textAlign: "center", marginBottom: 14 },
  potBox: {
    display: "inline-block", padding: "6px 20px",
    background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(212,165,116,0.1))",
    border: "1px solid rgba(255,215,0,0.5)", borderRadius: 10, marginBottom: 10,
  },
  potLabel: { fontSize: 9, color: "#FFD700", letterSpacing: 2, fontWeight: 800 },
  potValue: { fontSize: 18, fontWeight: 900, color: "#FFD700" },
  communityCards: { display: "flex", gap: 4, justifyContent: "center", marginBottom: 8 },
  betInfo: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700 },
  
  card: {
    width: 44, height: 60, borderRadius: 6,
    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
  },
  cardRank: { fontSize: 14, fontWeight: 900, lineHeight: 1 },
  cardSuit: { fontSize: 16, lineHeight: 1 },
  
  playersGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  playerSeat: {
    padding: 8, borderRadius: 10, transition: "all 0.3s",
  },
  playerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  playerName: { fontSize: 11, fontWeight: 800, color: "#fff" },
  dealerChip: { background: "#FFD700", color: "#000", fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 10 },
  playerCards: { display: "flex", gap: 3, marginBottom: 4 },
  cardBack: {
    width: 28, height: 38,
    background: "linear-gradient(135deg, #4A1033, #1A0512)",
    border: "1px solid #D4A574", borderRadius: 4,
  },
  miniCard: {
    width: 28, height: 38, background: "#fff",
    borderRadius: 4, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  noCards: { fontSize: 20, color: "rgba(255,255,255,0.2)" },
  playerStats: { display: "flex", flexWrap: "wrap", gap: 4, fontSize: 9 },
  chipsLabel: { color: "#FFD700", fontWeight: 800 },
  betLabel: { color: "#D4A574", fontWeight: 700 },
  allInLabel: { color: "#EF4444", fontWeight: 900, background: "rgba(239,68,68,0.2)", padding: "1px 5px", borderRadius: 4 },
  foldedLabel: { color: "#6B7280", fontWeight: 700 },
  
  actionArea: { background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 12 },
  waitingMsg: { textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 10, fontWeight: 700 },
  startBtn: {
    width: "100%", padding: 14,
    background: "linear-gradient(135deg, #10B981, #059669)",
    border: "none", color: "#fff", borderRadius: 10,
    fontSize: 14, fontWeight: 900, cursor: "pointer", letterSpacing: 2,
  },
  
  yourTurnBadge: {
    textAlign: "center", padding: 8, marginBottom: 10,
    background: "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(212,165,116,0.2))",
    border: "1px solid #FFD700", borderRadius: 8,
    color: "#FFD700", fontWeight: 900, fontSize: 13, letterSpacing: 1,
  },
  waitingTurnMsg: {
    textAlign: "center", padding: 10,
    background: "rgba(255,255,255,0.05)", borderRadius: 8,
    color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700,
  },
  actionButtons: { display: "flex", gap: 6, marginBottom: 8 },
  actBtn: {
    flex: 1, padding: "10px 8px", border: "none", color: "#fff",
    borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 1,
  },
  raiseRow: { display: "flex", gap: 6 },
  raiseInput: {
    width: 90, padding: "8px 10px",
    background: "rgba(0,0,0,0.4)", border: "1px solid rgba(212,165,116,0.3)",
    color: "#fff", borderRadius: 6, fontSize: 12, outline: "none",
  },
  
  showdownBox: {
    padding: 14, borderRadius: 12, marginBottom: 10,
    border: "1px solid rgba(212,165,116,0.3)",
  },
  showdownTitle: {
    fontSize: 16, fontWeight: 900, textAlign: "center",
    color: "#FFD700", marginBottom: 10, letterSpacing: 2,
  },
  showdownRow: {
    display: "flex", justifyContent: "space-between",
    padding: "4px 8px", fontSize: 11,
    borderTop: "1px solid rgba(255,255,255,0.1)",
  },
  
  historyBox: {
    marginTop: 10, padding: 10,
    background: "rgba(0,0,0,0.3)", borderRadius: 8,
    maxHeight: 120, overflowY: "auto",
  },
  historyTitle: { fontSize: 9, color: "rgba(212,165,116,0.6)", letterSpacing: 2, marginBottom: 6, fontWeight: 800 },
  historyItem: { fontSize: 10, color: "rgba(255,255,255,0.6)", padding: "2px 0" },
};
