// ===================================================================
// 🏛 HoldemLobby - VIP Poker Lounge (모바일 우선 + Evolution 디자인)
// ===================================================================

import React, { useState, useEffect } from "react";
import { createTable, joinTable, subscribeTableList } from "./HoldemFirestore";

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

  useEffect(() => {
    const unsub = subscribeTableList((list) => setTables(list));
    return unsub;
  }, []);

  // 에러 자동 숨김
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const canCreateOrJoin = gamePoints >= DEFAULT_BUY_IN;

  const handleCreate = async () => {
    if (!newTableName.trim()) { setError("테이블 이름을 입력해주세요."); return; }
    if (!canCreateOrJoin) { setError(`최소 ${DEFAULT_BUY_IN.toLocaleString()}P가 필요합니다.`); return; }
    setCreating(true); setError("");
    try {
      const tableId = await createTable({
        name: newTableName.trim(), maxPlayers,
        buyIn: DEFAULT_BUY_IN, smallBlind: DEFAULT_SMALL_BLIND, bigBlind: DEFAULT_BIG_BLIND,
        creatorId: userId, creatorNickname: userName,
      });
      await joinTable({ tableId, userId, nickname: userName, buyInAmount: DEFAULT_BUY_IN });
      onPointsChange(gamePoints - DEFAULT_BUY_IN);
      setShowCreate(false);
      onEnterTable(tableId);
    } catch (e) { 
      setError("생성 실패: " + e.message); 
    }
    setCreating(false);
  };

  const handleJoin = async (table) => {
    const alreadyJoined = table.players.find(p => p.userId === userId);
    if (alreadyJoined) return onEnterTable(table.id);
    if (!canCreateOrJoin) return setError(`최소 ${DEFAULT_BUY_IN.toLocaleString()}P가 필요합니다.`);
    if (table.players.length >= table.maxPlayers) return setError("테이블이 가득 찼습니다.");
    
    setJoining(table.id); setError("");
    try {
      await joinTable({ tableId: table.id, userId, nickname: userName, buyInAmount: table.buyIn });
      onPointsChange(gamePoints - table.buyIn);
      onEnterTable(table.id);
    } catch (e) { 
      setError("입장 실패: " + e.message); 
    }
    setJoining(null);
  };

  return (
    <div style={S.container}>
      {/* 🔹 상단 바 (브랜드 + 뒤로가기 + 유저 정보) */}
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>❮ 로비</button>
        <div style={S.logoArea}>
          <span style={S.logoSpade}>♠</span>
          <div style={S.logoText}>
            <div style={{fontSize: 10, letterSpacing: 2, opacity: 0.6}}>EVOLUTION</div>
            <div style={{color:"#D4A574", fontSize: 14, letterSpacing: 3}}>HOLD'EM</div>
          </div>
        </div>
        <div style={{width: 60}} />{/* spacer */}
      </div>

      {/* 🔹 유저 프로필 카드 */}
      <div style={S.userProfile}>
        <div style={S.profileLeft}>
          <div style={S.avatar}>{userName.charAt(0).toUpperCase()}</div>
          <div>
            <div style={S.userName}>{userName}</div>
            <div style={S.userBadge}>VIP MEMBER</div>
          </div>
        </div>
        <div style={S.balanceBox}>
          <span style={S.balanceLabel}>BALANCE</span>
          <span style={S.balanceAmount}>💎 {gamePoints.toLocaleString()}</span>
        </div>
      </div>

      {/* 🔹 Create Table Button */}
      <button 
        onClick={() => setShowCreate(true)} 
        disabled={!canCreateOrJoin} 
        style={{...S.createBtn, opacity: canCreateOrJoin ? 1 : 0.4}}
      >
        + CREATE VIP TABLE
      </button>

      {/* 에러 */}
      {error && <div style={S.errorBanner}>{error}</div>}

      {/* 테이블 리스트 섹션 헤더 */}
      <div style={S.sectionHeader}>
        <h2 style={S.sectionTitle}>LIVE TABLES</h2>
        <span style={S.sectionCount}>{tables.length} active</span>
      </div>

      {/* 테이블 리스트 */}
      <div style={S.tableList}>
        {tables.length === 0 ? (
          <div style={S.emptyState}>
            <div style={{fontSize: 32, marginBottom: 10}}>🎴</div>
            <div style={{fontSize: 13, color: "rgba(255,255,255,0.5)"}}>No active tables yet</div>
            <div style={{fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4}}>Be the first to open a VIP room</div>
          </div>
        ) : (
          tables.map(t => {
            const alreadyJoined = t.players.find(p => p.userId === userId);
            const isFull = t.players.length >= t.maxPlayers;
            const canJoin = !isFull && canCreateOrJoin;

            return (
              <div key={t.id} style={S.tableCard}>
                <div style={S.cardHeader}>
                  <div style={S.cardName}>{t.name}</div>
                  <div style={t.status === "playing" ? S.statusLive : S.statusWait}>
                    {t.status === "playing" ? "● LIVE" : "○ WAITING"}
                  </div>
                </div>
                
                <div style={S.cardDetails}>
                  <div style={S.detailItem}>
                    <div style={S.detailLabel}>BLINDS</div>
                    <div style={S.detailValue}>{t.smallBlind}/{t.bigBlind}</div>
                  </div>
                  <div style={S.detailItem}>
                    <div style={S.detailLabel}>BUY-IN</div>
                    <div style={S.detailValue}>{t.buyIn.toLocaleString()}</div>
                  </div>
                  <div style={S.detailItem}>
                    <div style={S.detailLabel}>PLAYERS</div>
                    <div style={S.detailValue}>{t.players.length}/{t.maxPlayers}</div>
                  </div>
                </div>

                {/* 플레이어 시각화 바 */}
                <div style={S.playerTrack}>
                  {Array.from({length: t.maxPlayers}).map((_, i) => (
                    <div key={i} style={{
                      ...S.playerSlot, 
                      background: i < t.players.length ? "#D4A574" : "rgba(255,255,255,0.1)"
                    }} />
                  ))}
                </div>

                {/* 플레이어 이름 (최대 3명 표시) */}
                {t.players.length > 0 && (
                  <div style={S.playerNames}>
                    {t.players.slice(0, 3).map((p, i) => (
                      <span key={i} style={{
                        ...S.playerNameChip,
                        background: p.userId === userId 
                          ? "linear-gradient(135deg, #10B981, #059669)"
                          : "rgba(255,255,255,0.05)",
                      }}>{p.nickname}</span>
                    ))}
                    {t.players.length > 3 && (
                      <span style={S.playerNameMore}>+{t.players.length - 3}</span>
                    )}
                  </div>
                )}

                <button 
                  onClick={() => handleJoin(t)} 
                  disabled={joining === t.id || (!canJoin && !alreadyJoined)} 
                  style={{
                    ...S.joinBtn, 
                    background: alreadyJoined 
                      ? "linear-gradient(135deg, #10B981, #059669)" 
                      : "linear-gradient(135deg, #D4A574, #B07D46)",
                    color: "#000",
                    opacity: (joining === t.id || (!canJoin && !alreadyJoined)) ? 0.3 : 1,
                  }}
                >
                  {alreadyJoined ? "↻ TAKE SEAT" 
                   : isFull ? "FULL" 
                   : joining === t.id ? "JOINING..." 
                   : "JOIN GAME"}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 테이블 생성 모달 */}
      {showCreate && (
        <div style={S.modalOverlay} onClick={() => !creating && setShowCreate(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={S.modalTitle}>Configure New Table</h3>
            <input 
              type="text" 
              value={newTableName} 
              onChange={e => setNewTableName(e.target.value)} 
              placeholder="Table Name (예: High Rollers)" 
              style={S.input} 
              maxLength={20}
              autoFocus
            />
            
            <div style={S.settingRow}>
              <span style={S.settingLabel}>Max Players</span>
              <div style={{display: "flex", gap: 6}}>
                {[2, 4, 6].map(n => (
                  <button 
                    key={n} 
                    onClick={() => setMaxPlayers(n)} 
                    style={{
                      ...S.chipBtn, 
                      background: maxPlayers === n ? "linear-gradient(135deg, #D4A574, #B07D46)" : "rgba(255,255,255,0.05)", 
                      color: maxPlayers === n ? "#000" : "#fff"
                    }}
                  >
                    {n} Max
                  </button>
                ))}
              </div>
            </div>
            <div style={S.settingRow}>
              <span style={S.settingLabel}>Buy-in</span>
              <span style={S.settingValue}>{DEFAULT_BUY_IN.toLocaleString()} P</span>
            </div>
            <div style={S.settingRow}>
              <span style={S.settingLabel}>Blinds</span>
              <span style={S.settingValue}>{DEFAULT_SMALL_BLIND} / {DEFAULT_BIG_BLIND}</span>
            </div>

            <div style={S.modalActions}>
              <button 
                onClick={() => setShowCreate(false)} 
                disabled={creating}
                style={S.cancelBtn}
              >CANCEL</button>
              <button 
                onClick={handleCreate} 
                disabled={creating} 
                style={S.confirmBtn}
              >
                {creating ? "OPENING..." : "OPEN TABLE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  container: { 
    padding: 16, 
    color: "#fff", 
    background: "linear-gradient(180deg, #050A10 0%, #0a0f18 100%)",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
  },
  
  topBar: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 16,
  },
  backBtn: { 
    background: "rgba(255,255,255,0.05)", 
    border: "1px solid rgba(255,255,255,0.1)", 
    color: "#fff", 
    padding: "8px 14px", 
    borderRadius: 20, 
    cursor: "pointer", 
    fontSize: 11, 
    fontWeight: 700,
    width: 60,
  },
  logoArea: { 
    display: "flex", 
    alignItems: "center", 
    gap: 10,
  },
  logoSpade: { 
    fontSize: 32, 
    color: "#D4A574", 
    textShadow: "0 0 10px rgba(212,165,116,0.5)" 
  },
  logoText: { 
    textAlign: "left",
    lineHeight: 1.2,
  },

  userProfile: { 
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.3))", 
    border: "1px solid rgba(212,165,116,0.3)",
    borderRadius: 16, 
    padding: 14, 
    marginBottom: 16,
  },
  profileLeft: { display: "flex", alignItems: "center", gap: 12 },
  avatar: { 
    width: 48, height: 48, borderRadius: "50%", 
    background: "linear-gradient(135deg, #1E293B, #0F172A)", 
    border: "2px solid #D4A574", 
    display: "flex", justifyContent: "center", alignItems: "center", 
    fontSize: 20, fontWeight: 900,
  },
  userName: { fontSize: 15, fontWeight: 800, color: "#fff" },
  userBadge: { 
    fontSize: 9, color: "#D4A574", letterSpacing: 2, 
    fontWeight: 700, marginTop: 2,
  },
  balanceBox: { 
    display: "flex", flexDirection: "column",
    alignItems: "flex-end", gap: 2,
  },
  balanceLabel: { 
    fontSize: 9, color: "rgba(255,255,255,0.5)", 
    letterSpacing: 1, fontWeight: 700,
  },
  balanceAmount: { fontSize: 16, color: "#10B981", fontWeight: 900 },

  createBtn: { 
    width: "100%",
    padding: "14px 20px",
    background: "linear-gradient(135deg, #D4A574, #B07D46)", 
    border: "none", color: "#000", 
    borderRadius: 14, 
    fontWeight: 900, cursor: "pointer", 
    letterSpacing: 2, fontSize: 13,
    boxShadow: "0 4px 15px rgba(212,165,116,0.3)",
    marginBottom: 12,
  },

  errorBanner: { 
    background: "rgba(239,68,68,0.15)", 
    color: "#FCA5A5", padding: 12, 
    borderRadius: 10, marginBottom: 12, 
    border: "1px solid #EF4444", fontWeight: 600,
    fontSize: 12,
  },

  sectionHeader: { 
    display: "flex", justifyContent: "space-between", 
    alignItems: "center", padding: "4px 2px", marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: { 
    margin: 0, fontSize: 13, fontWeight: 900, 
    letterSpacing: 2, color: "#D4A574",
  },
  sectionCount: { 
    fontSize: 10, color: "rgba(255,255,255,0.4)", 
    fontWeight: 700, letterSpacing: 1,
  },

  tableList: { display: "flex", flexDirection: "column", gap: 12 },
  emptyState: { 
    padding: "40px 20px", textAlign: "center",
    background: "rgba(0,0,0,0.3)", borderRadius: 14,
    border: "1px dashed rgba(212,165,116,0.2)",
  },
  tableCard: { 
    background: "linear-gradient(180deg, #111827 0%, #030712 100%)", 
    border: "1px solid rgba(255,255,255,0.08)", 
    borderRadius: 14, padding: 14, 
    boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
  },
  cardHeader: { 
    display: "flex", justifyContent: "space-between", 
    alignItems: "center", marginBottom: 12,
  },
  cardName: { fontSize: 15, fontWeight: 900, color: "#fff" },
  statusLive: { 
    color: "#EF4444", fontSize: 10, fontWeight: 900, 
    letterSpacing: 1, padding: "3px 8px",
    background: "rgba(239,68,68,0.15)", borderRadius: 10,
  },
  statusWait: { 
    color: "#10B981", fontSize: 10, fontWeight: 900, 
    letterSpacing: 1, padding: "3px 8px",
    background: "rgba(16,185,129,0.15)", borderRadius: 10,
  },
  cardDetails: { 
    display: "flex", justifyContent: "space-between", 
    background: "rgba(0,0,0,0.4)", padding: 10, 
    borderRadius: 10, marginBottom: 10,
  },
  detailItem: { textAlign: "center", flex: 1 },
  detailLabel: { 
    fontSize: 8, color: "rgba(255,255,255,0.4)", 
    marginBottom: 3, letterSpacing: 1, fontWeight: 700,
  },
  detailValue: { 
    fontSize: 12, color: "#D4A574", 
    fontWeight: 800,
  },
  playerTrack: { display: "flex", gap: 3, marginBottom: 10 },
  playerSlot: { flex: 1, height: 3, borderRadius: 2 },
  playerNames: {
    display: "flex", gap: 4, flexWrap: "wrap",
    marginBottom: 10,
  },
  playerNameChip: {
    fontSize: 10, color: "#fff", fontWeight: 700,
    padding: "3px 8px", borderRadius: 10,
  },
  playerNameMore: {
    fontSize: 10, color: "rgba(255,255,255,0.5)",
    padding: "3px 8px", fontWeight: 700,
  },
  joinBtn: { 
    width: "100%", padding: 12, 
    border: "none", borderRadius: 10, 
    fontWeight: 900, fontSize: 12, letterSpacing: 2, 
    cursor: "pointer",
  },

  modalOverlay: { 
    position: "fixed", 
    inset: 0, 
    background: "rgba(0,0,0,0.85)", 
    backdropFilter: "blur(8px)", 
    display: "flex", justifyContent: "center", alignItems: "center", 
    zIndex: 10000,
    padding: 16,
  },
  modalContent: { 
    background: "linear-gradient(180deg, #111827 0%, #0a0f18 100%)", 
    padding: 24, borderRadius: 20, 
    width: "100%", maxWidth: 400,
    border: "1px solid rgba(212,165,116,0.4)", 
    boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
    boxSizing: "border-box",
  },
  modalTitle: { 
    margin: "0 0 20px 0", fontSize: 18, 
    fontWeight: 900, color: "#D4A574", letterSpacing: 1,
  },
  input: { 
    width: "100%", padding: 12, 
    background: "rgba(0,0,0,0.5)", 
    border: "1px solid rgba(255,255,255,0.1)", 
    color: "#fff", borderRadius: 10, 
    marginBottom: 16, boxSizing: "border-box",
    fontSize: 13,
  },
  settingRow: { 
    display: "flex", justifyContent: "space-between", 
    alignItems: "center", padding: "12px 0", 
    borderBottom: "1px solid rgba(255,255,255,0.05)", 
    fontSize: 12, fontWeight: 600,
  },
  settingLabel: { color: "rgba(255,255,255,0.7)" },
  settingValue: { color: "#D4A574", fontWeight: 800 },
  chipBtn: { 
    border: "none", padding: "6px 10px", 
    borderRadius: 20, fontWeight: 800, 
    cursor: "pointer", fontSize: 11,
  },
  modalActions: { display: "flex", gap: 10, marginTop: 20 },
  cancelBtn: { 
    flex: 1, padding: 12, 
    background: "rgba(255,255,255,0.08)", border: "none", 
    color: "#fff", borderRadius: 10, 
    fontWeight: 800, cursor: "pointer", fontSize: 12,
  },
  confirmBtn: { 
    flex: 2, padding: 12, 
    background: "linear-gradient(135deg, #D4A574, #B07D46)", 
    border: "none", color: "#000", borderRadius: 10, 
    fontWeight: 900, cursor: "pointer", fontSize: 12,
    letterSpacing: 1,
  },
};