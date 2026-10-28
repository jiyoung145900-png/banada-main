// ===================================================================
// 🎴 MatgoLobby - 맞고 테이블 선택 화면 (2인 전용)
// ===================================================================
// 2개 테이블 표시:
//   - 현재 플레이어 수 (0/2, 1/2, 2/2)
//   - 현재 라운드 번호
//   - 최근 결과 (최근 10판 승자)
//   - 입장 버튼
// ===================================================================

import { useEffect } from "react";
import {
  useAllMatgoTables,
  useMatgoHistory,
  TABLES,
  ENTRY_FEE,
  TARGET_SCORE,
  MAX_PLAYERS,
} from "./MatgoFirestore";

export default function MatgoLobby({
  userId,
  userName,
  gamePoints,
  onPointsChange,
  onEnterTable,
  onEnterSolo,  // 🤖 [신규] AI 연습 모드 진입
  onBack,
}) {
  const tables = useAllMatgoTables();

  // 애니메이션 CSS
  useEffect(() => {
    if (document.getElementById("matgo-lobby-anims")) return;
    const style = document.createElement("style");
    style.id = "matgo-lobby-anims";
    style.innerHTML = `
      @keyframes matgoTableGlow {
        0%, 100% { box-shadow: 0 10px 30px rgba(76,175,80,0.2); }
        50% { box-shadow: 0 10px 40px rgba(76,175,80,0.5); }
      }
      @keyframes matgoPlayerDot {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.7; }
      }
      @keyframes matgoShimmer {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
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
          <div style={S.headerLabel}>LIVE MATGO</div>
          <div style={S.headerTitle}>맞고 (화투)</div>
        </div>
        <div style={S.pointsBadge}>
          💎 {(gamePoints || 0).toLocaleString()}
        </div>
      </div>

      {/* 설명 */}
      <div style={S.intro}>
        <div style={S.introIcon}>🎴</div>
        <div style={S.introText}>
          <strong>2인 맞고 (화투)</strong><br />
          {TARGET_SCORE}점 먼저 달성하면 <strong>GO 또는 STOP</strong><br />
          입장료 {ENTRY_FEE.toLocaleString()} · 승자가 양쪽 입장료 획득
        </div>
      </div>

      {/* 🤖 AI 연습 모드 카드 */}
      {onEnterSolo && (
        <div style={S.soloCard} onClick={onEnterSolo}>
          <div style={S.soloCardLeft}>
            <div style={S.soloCardIcon}>🤖</div>
            <div>
              <div style={S.soloCardTitle}>AI와 연습 (어려움)</div>
              <div style={S.soloCardDesc}>
                포인트 사용 안함 · 혼자서 바로 플레이<br />
                똑똑한 AI와 1:1 대전
              </div>
            </div>
          </div>
          <div style={S.soloCardBadge}>FREE →</div>
        </div>
      )}

      {/* 테이블 리스트 */}
      <div style={S.tableGrid}>
        {TABLES.map((cfg, idx) => (
          <TableCard
            key={cfg.id}
            config={cfg}
            tableState={tables[cfg.id]}
            userId={userId}
            gamePoints={gamePoints}
            onEnter={() => onEnterTable(cfg.id)}
            index={idx}
          />
        ))}
      </div>

      {/* 가이드 */}
      <div style={S.guide}>
        <div style={S.guideTitle}>🎯 플레이 방법</div>
        <div style={S.guideText}>
          · 테이블 입장 → 2명 모이면 자동 시작<br />
          · 손패의 카드와 바닥패를 같은 월끼리 매칭<br />
          · <strong>광/띠/열끗/피</strong> 모아서 역 완성<br />
          · {TARGET_SCORE}점 달성 → GO(계속)로 점수 올리기 or STOP(승리)
        </div>
      </div>
    </div>
  );
}

// ====================== 테이블 카드 ======================
function TableCard({ config, tableState, userId, gamePoints, onEnter, index }) {
  const history = useMatgoHistory(config.id, 10);

  const players = tableState?.players || [];
  const names = tableState?.names || {};
  const playerCount = players.length;
  const currentRound = tableState?.currentRound || 1;
  const phase = tableState?.phase || "waiting";
  const alreadyJoined = players.includes(userId);
  const canAfford = (gamePoints || 0) >= ENTRY_FEE;

  // 테마 색상 (jade=에메랄드/초록, amber=금색/화투)
  const isJade = config.theme === "jade";
  const themeColor = isJade ? "#4CAF50" : "#D4A574";
  const themeRgb = isJade ? "76,175,80" : "212,165,116";
  const accentColor = isJade ? "#81C784" : "#FFCC80";

  // Phase 설명
  const phaseText = {
    waiting: playerCount === 0 ? "🪑 비어있음" : playerCount === 1 ? "⏳ 상대 대기 중" : "✅ 시작 준비됨",
    playing: "🎴 플레이 중",
    go_stop: "🎲 고/스톱 선택",
    ended: "🏁 종료",
  }[phase] || "대기 중";

  const phaseColor = phase === "playing" || phase === "go_stop" ? "#FF6B9D" : themeColor;

  return (
    <div
      style={{
        ...S.tableCard,
        border: `2px solid rgba(${themeRgb}, 0.4)`,
        background: `linear-gradient(135deg, rgba(${themeRgb}, 0.08) 0%, rgba(10,10,15,0.95) 100%)`,
        animation: playerCount > 0 ? `matgoTableGlow 3s ease-in-out infinite` : "none",
      }}
    >
      {/* 상단 */}
      <div style={S.cardTop}>
        <div>
          <div style={{ ...S.cardLabel, color: themeColor }}>
            {config.name}
          </div>
          <div style={S.cardRound}>
            ROUND #{currentRound}
          </div>
        </div>

        {/* Phase 배지 */}
        <div
          style={{
            ...S.phaseBadge,
            background: playerCount > 0 ? `rgba(${themeRgb}, 0.2)` : "rgba(255,255,255,0.08)",
            color: playerCount > 0 ? phaseColor : "rgba(255,255,255,0.4)",
            border: `1px solid rgba(${themeRgb}, 0.4)`,
          }}
        >
          {phaseText}
        </div>
      </div>

      {/* 플레이어 수 */}
      <div style={S.playerInfo}>
        <div style={S.playerCount}>
          <span
            style={{
              ...S.playerDot,
              background: playerCount > 0 ? themeColor : "rgba(255,255,255,0.3)",
              animation: playerCount > 0 ? "matgoPlayerDot 1.5s ease-in-out infinite" : "none",
            }}
          />
          <span style={{ color: playerCount > 0 ? "#fff" : "rgba(255,255,255,0.5)" }}>
            {playerCount} / {MAX_PLAYERS} 명
          </span>
          {playerCount > 0 && (
            <span style={S.playerNames}>
              ({players.map(p => names[p] || p.slice(0, 6)).join(", ")})
            </span>
          )}
        </div>
      </div>

      {/* 최근 결과 (미니 로드맵) */}
      {history.length > 0 && (
        <div style={S.miniRoad}>
          <div style={S.miniRoadLabel}>최근 결과</div>
          <div style={S.miniRoadDots}>
            {history.map((h, i) => (
              <MiniRoadDot key={i} winner={h.winner} userId={userId} players={h.players} />
            ))}
          </div>
        </div>
      )}

      {/* 입장료 안내 */}
      <div style={S.feeBadge}>
        <span style={{ color: canAfford ? accentColor : "#E57373" }}>
          입장료 {ENTRY_FEE.toLocaleString()}
        </span>
        {!canAfford && !alreadyJoined && (
          <span style={{ color: "#E57373", marginLeft: 6 }}>· 포인트 부족</span>
        )}
      </div>

      {/* 입장 버튼 */}
      <button
        onClick={onEnter}
        disabled={!alreadyJoined && !canAfford}
        style={{
          ...S.enterBtn,
          background: alreadyJoined || canAfford
            ? `linear-gradient(135deg, ${themeColor}, ${themeColor}DD)`
            : "rgba(100,100,100,0.3)",
          boxShadow: alreadyJoined || canAfford
            ? `0 8px 20px rgba(${themeRgb}, 0.4)`
            : "none",
          cursor: alreadyJoined || canAfford ? "pointer" : "not-allowed",
        }}
        onMouseEnter={(e) => {
          if (alreadyJoined || canAfford) {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 12px 28px rgba(${themeRgb}, 0.6)`;
          }
        }}
        onMouseLeave={(e) => {
          if (alreadyJoined || canAfford) {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = `0 8px 20px rgba(${themeRgb}, 0.4)`;
          }
        }}
      >
        {alreadyJoined
          ? "다시 입장 →"
          : playerCount >= MAX_PLAYERS
          ? "자리 가득 ⛔"
          : "입장 하기 →"}
      </button>
    </div>
  );
}

// ====================== 미니 로드맵 도트 ======================
function MiniRoadDot({ winner, userId, players = [] }) {
  // 승자가 나면 ★, 상대면 ○, 무승부면 =
  let letter, color;
  if (!winner) {
    letter = "="; color = "#9E9E9E";
  } else if (winner === userId) {
    letter = "W"; color = "#4CAF50";
  } else if (players.includes(userId)) {
    letter = "L"; color = "#E57373";
  } else {
    // 내가 안 낀 판
    letter = "•"; color = "#616161";
  }

  return (
    <div
      style={{
        width: 18, height: 18, borderRadius: "50%",
        background: color, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 900,
        border: `1.5px solid ${color}`,
      }}
    >
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
    border: "1px solid rgba(76,175,80,0.3)",
    color: "rgba(129,199,132,0.9)",
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
    color: "rgba(129,199,132,0.7)", fontWeight: 700,
  },
  headerTitle: {
    fontSize: 16, fontWeight: 800, color: "#fff",
    fontFamily: "'Playfair Display', serif",
    marginTop: 2,
  },
  pointsBadge: {
    background: "linear-gradient(135deg, rgba(76,175,80,0.2), rgba(212,165,116,0.15))",
    border: "1px solid rgba(76,175,80,0.4)",
    color: "#E8F5E9",
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 800,
  },

  // 소개
  intro: {
    display: "flex", gap: 14, alignItems: "center",
    padding: 16,
    background: "linear-gradient(135deg, rgba(76,175,80,0.08), rgba(212,165,116,0.05))",
    border: "1px solid rgba(76,175,80,0.2)",
    borderRadius: 12,
    marginBottom: 20,
  },
  introIcon: {
    fontSize: 36,
    filter: "drop-shadow(0 0 10px rgba(76,175,80,0.5))",
  },
  introText: {
    fontSize: 11, color: "rgba(255,255,255,0.75)", lineHeight: 1.6,
  },

  // 🤖 AI 연습 카드
  soloCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: 16,
    background: "linear-gradient(135deg, rgba(156,39,176,0.15), rgba(76,175,80,0.1))",
    border: "1px solid rgba(156,39,176,0.4)",
    borderRadius: 12,
    marginBottom: 14,
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  soloCardLeft: {
    display: "flex", alignItems: "center", gap: 14,
  },
  soloCardIcon: {
    fontSize: 36,
    filter: "drop-shadow(0 0 10px rgba(156,39,176,0.6))",
  },
  soloCardTitle: {
    fontSize: 13, fontWeight: 800, color: "#CE93D8",
    letterSpacing: 1, marginBottom: 2,
  },
  soloCardDesc: {
    fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.5,
  },
  soloCardBadge: {
    background: "linear-gradient(135deg, #9C27B0, #6A1B9A)",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1,
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
    fontSize: 18, fontWeight: 900, letterSpacing: 2,
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
    marginBottom: 14,
  },
  playerCount: {
    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    fontSize: 13, fontWeight: 600,
  },
  playerDot: {
    display: "inline-block",
    width: 8, height: 8, borderRadius: "50%",
  },
  playerNames: {
    fontSize: 11, color: "rgba(255,255,255,0.5)",
    fontWeight: 500,
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

  // 입장료 배지
  feeBadge: {
    fontSize: 11, fontWeight: 700,
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: 0.5,
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
    transition: "all 0.3s ease",
  },

  // 가이드
  guide: {
    padding: 14,
    background: "rgba(76,175,80,0.05)",
    border: "1px dashed rgba(76,175,80,0.2)",
    borderRadius: 10,
  },
  guideTitle: {
    fontSize: 11, fontWeight: 700,
    color: "#81C784", marginBottom: 8, letterSpacing: 1,
  },
  guideText: {
    fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.8,
  },
};