// ===================================================================
// 🏛 HoldemLobby - 공개 로비 (방 목록 + 생성 + 입장)
// ===================================================================
// Props:
//   userId, userName
//   gamePoints: 유저가 가진 포인트
//   onPointsChange: 포인트 차감/증가 콜백
//   onEnterTable: (tableId) => void - 테이블 입장 시
//   onBack: 미니게임 로비로
// ===================================================================

import React, { useState, useEffect } from "react";
import { createTable, joinTable, subscribeTableList, deleteTable } from "./HoldemFirestore";

const DEFAULT_BUY_IN = 10000;
const DEFAULT_SMALL_BLIND = 100;
const DEFAULT_BIG_BLIND = 200;

export default function HoldemLobby({ userId, userName, gamePoints, onPointsChange, onEnterTable, onBack }) {
  const [tables, setTables] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(null);
  const [error, setError] = useState("");

  // 테이블 목록 실시간 구독
  useEffect(() => {
    const unsub = subscribeTableList((list) => {
      setTables(list);
    });
    return unsub;
  }, []);

  const canCreateOrJoin = gamePoints >= DEFAULT_BUY_IN;

  const handleCreate = async () => {
    if (!newTableName.trim()) { setError("테이블 이름을 입력하세요"); return; }
    if (!canCreateOrJoin) { setError(`최소 ${DEFAULT_BUY_IN.toLocaleString()}P 필요`); return; }
    setCreating(true);
    setError("");
    try {
      const tableId = await createTable({
        name: newTableName.trim(),
        maxPlayers,
        buyIn: DEFAULT_BUY_IN,
        smallBlind: DEFAULT_SMALL_BLIND,
        bigBlind: DEFAULT_BIG_BLIND,
        creatorId: userId,
        creatorNickname: userName,
      });
      // 생성 후 바로 입장
      await joinTable({
        tableId, userId, nickname: userName,
        buyInAmount: DEFAULT_BUY_IN,
      });
      onPointsChange(gamePoints - DEFAULT_BUY_IN);
      onEnterTable(tableId);
    } catch (e) {
      setError("테이블 생성 실패: " + e.message);
    }
    setCreating(false);
  };

  const handleJoin = async (table) => {
    if (!canCreateOrJoin) { setError(`최소 ${DEFAULT_BUY_IN.toLocaleString()}P 필요`); return; }
    if (table.players.length >= table.maxPlayers) { setError("테이블 가득참"); return; }
    if (table.players.find(p => p.userId === userId)) {
      // 이미 입장한 테이블 → 재입장
      onEnterTable(table.id);
      return;
    }
    setJoining(table.id);
    setError("");
    try {
      await joinTable({
        tableId: table.id, userId, nickname: userName,
        buyInAmount: table.buyIn,
      });
      onPointsChange(gamePoints - table.buyIn);
      onEnterTable(table.id);
    } catch (e) {
      setError("입장 실패: " + e.message);
    }
    setJoining(null);
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← LOBBY</button>
        <h2 style={S.title}>♠ HOLD'EM LOBBY</h2>
        <div style={S.points}>💎 {gamePoints.toLocaleString()}</div>
      </div>

      {/* 안내 */}
      <div style={S.info}>
        <div style={S.infoRow}>
          <span style={S.infoLabel}>버이인:</span>
          <span style={S.infoValue}>{DEFAULT_BUY_IN.toLocaleString()}P</span>
        </div>
        <div style={S.infoRow}>
          <span style={S.infoLabel}>블라인드:</span>
          <span style={S.infoValue}>SB {DEFAULT_SMALL_BLIND} / BB {DEFAULT_BIG_BLIND}</span>
        </div>
      </div>

      {/* 에러 */}
      {error && <div style={S.error}>{error}</div>}

      {/* 테이블 생성 */}
      {!showCreate ? (
        <button 
          onClick={() => setShowCreate(true)} 
          disabled={!canCreateOrJoin}
          style={{...S.createBtn, opacity: canCreateOrJoin ? 1 : 0.4}}
        >
          ➕ 새 테이블 만들기
        </button>
      ) : (
        <div style={S.createForm}>
          <div style={S.createTitle}>새 테이블</div>
          <input
            type="text"
            value={newTableName}
            onChange={e => setNewTableName(e.target.value)}
            placeholder="테이블 이름 (예: VIP Room)"
            style={S.input}
            maxLength={20}
          />
          <div style={S.maxPlayersRow}>
            <span style={S.maxLabel}>최대 인원:</span>
            {[2, 4, 6].map(n => (
              <button
                key={n}
                onClick={() => setMaxPlayers(n)}
                style={{
                  ...S.maxBtn,
                  background: maxPlayers === n ? "linear-gradient(135deg, #D4A574, #B07D46)" : "rgba(255,255,255,0.05)",
                  color: maxPlayers === n ? "#000" : "#fff",
                }}
              >{n}명</button>
            ))}
          </div>
          <div style={S.createActions}>
            <button onClick={() => { setShowCreate(false); setError(""); }} style={S.cancelBtn}>취소</button>
            <button onClick={handleCreate} disabled={creating} style={S.confirmBtn}>
              {creating ? "생성 중..." : `생성 (-${DEFAULT_BUY_IN.toLocaleString()}P)`}
            </button>
          </div>
        </div>
      )}

      {/* 테이블 목록 */}
      <div style={S.tableListTitle}>
        🎰 OPEN TABLES ({tables.length})
      </div>
      
      {tables.length === 0 ? (
        <div style={S.empty}>아직 열린 테이블이 없어요. 첫 번째 테이블을 만들어보세요!</div>
      ) : (
        <div style={S.tableList}>
          {tables.map(t => {
            const alreadyJoined = t.players.find(p => p.userId === userId);
            const isFull = t.players.length >= t.maxPlayers;
            const canJoin = !isFull && canCreateOrJoin;
            
            return (
              <div key={t.id} style={S.tableCard}>
                <div style={S.tableHeader}>
                  <span style={S.tableName}>{t.name}</span>
                  <span style={{
                    ...S.tableStatus,
                    background: t.status === "playing" ? "#EF4444" : "#10B981",
                  }}>
                    {t.status === "playing" ? "🔴 LIVE" : "⏳ WAITING"}
                  </span>
                </div>
                <div style={S.tableInfo}>
                  <span>👥 {t.players.length}/{t.maxPlayers}</span>
                  <span>💰 Buy-in {t.buyIn.toLocaleString()}P</span>
                  <span>Blinds {t.smallBlind}/{t.bigBlind}</span>
                </div>
                <div style={S.tablePlayers}>
                  {t.players.slice(0, 6).map((p, i) => (
                    <span key={i} style={{
                      ...S.playerChip,
                      background: p.userId === userId 
                        ? "linear-gradient(135deg, #D4A574, #B07D46)" 
                        : "rgba(255,255,255,0.05)",
                      color: p.userId === userId ? "#000" : "#fff",
                    }}>{p.nickname}</span>
                  ))}
                </div>
                <button
                  onClick={() => handleJoin(t)}
                  disabled={joining === t.id || (!canJoin && !alreadyJoined)}
                  style={{
                    ...S.joinBtn,
                    opacity: (joining === t.id || (!canJoin && !alreadyJoined)) ? 0.4 : 1,
                    background: alreadyJoined 
                      ? "linear-gradient(135deg, #10B981, #059669)"
                      : "linear-gradient(135deg, #D4A574, #B07D46)",
                  }}
                >
                  {alreadyJoined ? "↻ 재입장" 
                   : isFull ? "GAME FULL" 
                   : joining === t.id ? "입장 중..." 
                   : `입장 (-${t.buyIn.toLocaleString()}P)`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  container: { padding: 16, color: "#fff", background: "#0a0a0a", minHeight: "100vh", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700 },
  title: { margin: 0, fontSize: 18, fontWeight: 900, background: "linear-gradient(135deg, #D4A574, #FFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2 },
  points: { background: "linear-gradient(135deg, #FFD700, #D4A574)", color: "#000", padding: "6px 14px", borderRadius: 20, fontWeight: 900, fontSize: 13 },
  
  info: {
    background: "rgba(212,165,116,0.08)", border: "1px solid rgba(212,165,116,0.3)",
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  infoRow: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 },
  infoLabel: { color: "rgba(255,255,255,0.6)" },
  infoValue: { color: "#D4A574", fontWeight: 700 },
  
  error: {
    background: "rgba(239,68,68,0.1)", border: "1px solid #EF4444",
    color: "#FCA5A5", padding: "10px 14px", borderRadius: 10,
    fontSize: 12, marginBottom: 12,
  },
  
  createBtn: {
    width: "100%", padding: 14,
    background: "linear-gradient(135deg, #D4A574, #B07D46)",
    border: "none", color: "#000", borderRadius: 12,
    fontSize: 14, fontWeight: 900, cursor: "pointer",
    letterSpacing: 1, marginBottom: 16,
  },
  
  createForm: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,165,116,0.3)",
    borderRadius: 12, padding: 16, marginBottom: 16,
  },
  createTitle: { fontSize: 13, fontWeight: 800, color: "#D4A574", marginBottom: 10, letterSpacing: 1 },
  input: {
    width: "100%", padding: "10px 12px",
    background: "rgba(0,0,0,0.4)", border: "1px solid rgba(212,165,116,0.3)",
    color: "#fff", borderRadius: 8, fontSize: 13, outline: "none",
    marginBottom: 10, boxSizing: "border-box",
  },
  maxPlayersRow: { display: "flex", gap: 6, alignItems: "center", marginBottom: 12 },
  maxLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  maxBtn: {
    padding: "6px 14px", border: "none", borderRadius: 20,
    cursor: "pointer", fontSize: 12, fontWeight: 700,
  },
  createActions: { display: "flex", gap: 8 },
  cancelBtn: {
    flex: 1, padding: 10, background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
    borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
  },
  confirmBtn: {
    flex: 2, padding: 10,
    background: "linear-gradient(135deg, #10B981, #059669)",
    border: "none", color: "#fff", borderRadius: 8,
    cursor: "pointer", fontSize: 12, fontWeight: 700,
  },
  
  tableListTitle: {
    fontSize: 11, fontWeight: 800, color: "#D4A574",
    letterSpacing: 2, marginBottom: 10, padding: "0 4px",
  },
  empty: {
    padding: 30, textAlign: "center", color: "rgba(255,255,255,0.4)",
    fontSize: 12, fontStyle: "italic",
    background: "rgba(0,0,0,0.3)", borderRadius: 12,
    border: "1px dashed rgba(212,165,116,0.2)",
  },
  tableList: { display: "flex", flexDirection: "column", gap: 10 },
  tableCard: {
    background: "linear-gradient(135deg, rgba(20,20,25,0.85), rgba(10,10,15,0.95))",
    border: "1px solid rgba(212,165,116,0.2)",
    borderRadius: 12, padding: 14,
  },
  tableHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  tableName: { fontSize: 14, fontWeight: 900, color: "#fff" },
  tableStatus: {
    fontSize: 9, fontWeight: 800, color: "#fff",
    padding: "3px 8px", borderRadius: 10, letterSpacing: 1,
  },
  tableInfo: {
    display: "flex", gap: 10, flexWrap: "wrap",
    fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 10,
  },
  tablePlayers: {
    display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10,
  },
  playerChip: {
    fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 700,
  },
  joinBtn: {
    width: "100%", padding: 10, border: "none", color: "#000",
    borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 900,
    letterSpacing: 1,
  },
};
