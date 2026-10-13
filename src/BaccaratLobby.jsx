// ===================================================================
// 🎰 BaccaratLobby - 라이브 바카라 테이블 선택 화면
// ===================================================================
// 2개 테이블 표시:
//   - 현재 플레이어 수
//   - 현재 라운드 번호
//   - 최근 결과 (최근 10개)
//   - 입장 버튼
// ===================================================================

import { useEffect } from "react";
import { useAllBaccaratTables, useBaccaratHistory, TABLES, MIN_BET, MAX_BET } from "./BaccaratFirestore";

export default function BaccaratLobby({ 
  userId, 
  userName, 
  gamePoints, 
  onPointsChange, 
  onEnterTable, 
  onBack 
}) {
  const tables = useAllBaccaratTables();

  // 애니메이션 CSS
  useEffect(() => {
    if (document.getElementById("baccarat-lobby-anims")) return;
    const style = document.createElement("style");
    style.id = "baccarat-lobby-anims";
    style.innerHTML = `
      @keyframes tablePulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(230,57,117,0.4); }
        50% { box-shadow: 0 0 0 8px rgba(230,57,117,0); }
      }
      @keyframes tableGlow {
        0%, 100% { box-shadow: 0 10px 30px rgba(230,57,117,0.2); }
        50% { box-shadow: 0 10px 40px rgba(230,57,117,0.4); }
      }
      @keyframes playerDot {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div style={S.container}>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← LOUNGE</button>
        <div style={S.headerCenter}>
          <div style={S.headerLabel}>LIVE BACCARAT</div>
          <div style={S.headerTitle}>테이블 선택</div>
        </div>
        <div style={S.pointsBadge}>
          💎 {gamePoints.toLocaleString()}
        </div>
      </div>

      {/* 설명 */}
      <div style={S.intro}>
        <div style={S.introIcon}>♠♥</div>
        <div style={S.introText}>
          <strong>라이브 멀티플레이 바카라</strong><br />
          2개 테이블 상시 운영 · 혼자서도 즉시 플레이 가능<br />
          최소 {MIN_BET.toLocaleString()} · 최대 {MAX_BET.toLocaleString()}
        </div>
      </div>

      {/* 테이블 리스트 */}
      <div style={S.tableGrid}>
        {TABLES.map((cfg, idx) => (
          <TableCard
            key={cfg.id}
            config={cfg}
            tableState={tables[cfg.id]}
            userId={userId}
            onEnter={() => onEnterTable(cfg.id)}
            index={idx}
          />
        ))}
      </div>

      {/* 가이드 */}
      <div style={S.guide}>
        <div style={S.guideTitle}>🎯 플레이 방법</div>
        <div style={S.guideText}>
          · 테이블 입장 → 베팅 → <strong>READY</strong> 버튼<br />
          · <strong>혼자</strong>면 즉시 결과 공개<br />
          · <strong>2명 이상</strong>이면 모두 READY 시 즉시 진행<br />
          · 20초 지나면 자동 결과 처리
        </div>
      </div>
    </div>
  );
}

// ====================== 테이블 카드 ======================
function TableCard({ config, tableState, userId, onEnter, index }) {
  const history = useBaccaratHistory(config.id, 10);
  
  const players = tableState?.players || [];
  const playerCount = players.length;
  const currentRound = tableState?.currentRound || 1;
  const phase = tableState?.phase || "waiting";
  const alreadyJoined = players.includes(userId);
  
  // 테마 색상
  const themeColor = config.theme === "ruby" ? "#E63975" : "#D4A574";
  const themeRgb = config.theme === "ruby" ? "230,57,117" : "212,165,116";
  
  // Phase 설명
  const phaseText = {
    waiting: "대기 중",
    betting: "🎰 베팅 가능",
    dealing: "🎴 카드 공개 중",
    result: "✨ 결과 확인",
  }[phase] || "대기 중";

  return (
    <div style={{
      ...S.tableCard,
      border: `2px solid rgba(${themeRgb}, 0.4)`,
      background: `linear-gradient(135deg, rgba(${themeRgb}, 0.08) 0%, rgba(10,10,15,0.95) 100%)`,
      animation: playerCount > 0 ? `tableGlow 3s ease-in-out infinite` : "none",
    }}>
      {/* 상단 */}
      <div style={S.cardTop}>
        <div>
          <div style={{ ...S.cardLabel, color: themeColor }}>
            {config.name.toUpperCase()}
          </div>
          <div style={S.cardRound}>
            ROUND #{currentRound}
          </div>
        </div>
        
        {/* Phase 배지 */}
        <div style={{
          ...S.phaseBadge,
          background: playerCount > 0 ? `rgba(${themeRgb}, 0.2)` : "rgba(255,255,255,0.08)",
          color: playerCount > 0 ? themeColor : "rgba(255,255,255,0.4)",
          border: `1px solid rgba(${themeRgb}, 0.4)`,
        }}>
          {phaseText}
        </div>
      </div>

      {/* 플레이어 수 */}
      <div style={S.playerInfo}>
        <div style={S.playerCount}>
          <span style={{
            ...S.playerDot,
            background: playerCount > 0 ? themeColor : "rgba(255,255,255,0.3)",
            animation: playerCount > 0 ? "playerDot 1.5s ease-in-out infinite" : "none",
          }} />
          <span style={{ color: playerCount > 0 ? "#fff" : "rgba(255,255,255,0.5)" }}>
            {playerCount > 0 ? `${playerCount}명 플레이 중` : "비어있음"}
          </span>
        </div>
      </div>

      {/* 최근 결과 (미니 로드맵) */}
      {history.length > 0 && (
        <div style={S.miniRoad}>
          <div style={S.miniRoadLabel}>최근 결과</div>
          <div style={S.miniRoadDots}>
            {history.map((h, i) => (
              <MiniRoadDot key={i} winner={h.winner} />
            ))}
          </div>
        </div>
      )}

      {/* 입장 버튼 */}
      <button
        onClick={onEnter}
        style={{
          ...S.enterBtn,
          background: `linear-gradient(135deg, ${themeColor}, ${themeColor}DD)`,
          boxShadow: `0 8px 20px rgba(${themeRgb}, 0.4)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 12px 28px rgba(${themeRgb}, 0.6)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = `0 8px 20px rgba(${themeRgb}, 0.4)`;
        }}
      >
        {alreadyJoined ? "다시 입장 →" : "입장 하기 →"}
      </button>
    </div>
  );
}

// ====================== 미니 로드맵 도트 ======================
function MiniRoadDot({ winner }) {
  const colors = {
    player: "#3B82F6",
    banker: "#E63975",
    tie: "#10B981",
  };
  const letters = {
    player: "P",
    banker: "B",
    tie: "T",
  };
  const color = colors[winner] || "#444";
  const letter = letters[winner] || "?";
  
  return (
    <div style={{
      width: 16, height: 16, borderRadius: "50%",
      background: color, color: "#fff",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 900,
      border: `1.5px solid ${color}`,
    }}>
      {letter}
    </div>
  );
}

// ====================== 스타일 ======================
const S = {
  container: {
    padding: "20px 24px",
    color: "#fff",
  },
  
  // 헤더
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  backBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(212,165,116,0.3)",
    color: "rgba(212,165,116,0.9)",
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
    cursor: "pointer",
  },
  headerCenter: {
    textAlign: "center", flex: 1,
  },
  headerLabel: {
    fontSize: 9, letterSpacing: 4,
    color: "rgba(212,165,116,0.7)", fontWeight: 700,
  },
  headerTitle: {
    fontSize: 16, fontWeight: 800, color: "#fff",
    fontFamily: "'Playfair Display', serif",
    marginTop: 2,
  },
  pointsBadge: {
    background: "linear-gradient(135deg, rgba(212,165,116,0.2), rgba(255,107,157,0.15))",
    border: "1px solid rgba(212,165,116,0.4)",
    color: "#F0D4B8",
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 800,
  },
  
  // 소개
  intro: {
    display: "flex", gap: 14, alignItems: "center",
    padding: 16,
    background: "linear-gradient(135deg, rgba(230,57,117,0.08), rgba(212,165,116,0.05))",
    border: "1px solid rgba(212,165,116,0.2)",
    borderRadius: 12,
    marginBottom: 20,
  },
  introIcon: {
    fontSize: 32, letterSpacing: -4,
    color: "#E63975",
    filter: "drop-shadow(0 0 10px rgba(230,57,117,0.5))",
  },
  introText: {
    fontSize: 11, color: "rgba(255,255,255,0.75)", lineHeight: 1.6,
  },
  
  // 테이블 그리드
  tableGrid: {
    display: "flex", flexDirection: "column", gap: 14,
    marginBottom: 20,
  },
  tableCard: {
    padding: 18,
    borderRadius: 16,
    transition: "all 0.3s ease",
  },
  cardTop: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 14,
  },
  cardLabel: {
    fontSize: 20, fontWeight: 900, letterSpacing: 3,
    fontFamily: "'Playfair Display', serif",
  },
  cardRound: {
    fontSize: 10, color: "rgba(255,255,255,0.5)",
    fontFamily: "'Courier New', monospace",
    marginTop: 2, letterSpacing: 1,
  },
  phaseBadge: {
    padding: "4px 10px", borderRadius: 12,
    fontSize: 10, fontWeight: 700, letterSpacing: 1,
    whiteSpace: "nowrap",
  },
  
  // 플레이어 수
  playerInfo: {
    display: "flex", alignItems: "center",
    marginBottom: 14,
  },
  playerCount: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 13, fontWeight: 600,
  },
  playerDot: {
    display: "inline-block",
    width: 8, height: 8, borderRadius: "50%",
  },
  
  // 미니 로드맵
  miniRoad: {
    padding: "10px 12px",
    background: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    marginBottom: 14,
  },
  miniRoadLabel: {
    fontSize: 9, color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5, marginBottom: 6, fontWeight: 700,
  },
  miniRoadDots: {
    display: "flex", gap: 4, flexWrap: "wrap",
  },
  
  // 입장 버튼
  enterBtn: {
    width: "100%",
    padding: "12px 20px",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 2,
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  
  // 가이드
  guide: {
    padding: 14,
    background: "rgba(212,165,116,0.05)",
    border: "1px dashed rgba(212,165,116,0.2)",
    borderRadius: 10,
  },
  guideTitle: {
    fontSize: 11, fontWeight: 700,
    color: "#D4A574", marginBottom: 8, letterSpacing: 1,
  },
  guideText: {
    fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.8,
  },
};