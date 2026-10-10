// ===================================================================
// 🎰 MiniGameModal - 히든 미니게임 로비
// ===================================================================
// 로고 5번 클릭 시 열림 (App.jsx 에서 트리거)
// 완전 재미용 (실제 돈 X, gamePoints 별도)
// 
// Props:
//   isOpen: 모달 열림 여부
//   onClose: 닫기 콜백
//   currentUser: 현재 로그인 유저
// ===================================================================

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import BaccaratGame from "./BaccaratGame";
import RouletteGame from "./RouletteGame";
import BlackjackGame from "./BlackjackGame";

const INITIAL_POINTS = 10000;
const DAILY_BONUS = 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function MiniGameModal({ isOpen, onClose, currentUser }) {
  const [points, setPoints] = useState(0);
  const [screen, setScreen] = useState("lobby"); // lobby, baccarat, roulette, blackjack
  const [loading, setLoading] = useState(true);
  const [bonusMsg, setBonusMsg] = useState("");
  const [saving, setSaving] = useState(false);
  
  const userId = currentUser?.id;
  
  // 포인트 로드 + 일일 보너스 체크
  useEffect(() => {
    if (!isOpen || !userId) return;
    
    (async () => {
      setLoading(true);
      try {
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        
        if (!snap.exists()) {
          // 유저 문서 없음 - 그냥 기본 포인트로 시작 (저장 안 함, 유저 문서 깨지면 안 됨)
          setPoints(INITIAL_POINTS);
          setBonusMsg(`환영 보너스 +${INITIAL_POINTS.toLocaleString()}P`);
          setTimeout(() => setBonusMsg(""), 3000);
          setLoading(false);
          return;
        }
        
        const data = snap.data();
        let currentPoints = data.gamePoints;
        let lastBonus = data.gameLastBonus || 0;
        
        // 처음 플레이 - 초기 지급
        if (currentPoints === undefined || currentPoints === null) {
          currentPoints = INITIAL_POINTS;
          lastBonus = Date.now();
          await updateDoc(userRef, {
            gamePoints: currentPoints,
            gameLastBonus: lastBonus,
          });
          setBonusMsg(`환영 보너스 +${INITIAL_POINTS.toLocaleString()}P`);
          setTimeout(() => setBonusMsg(""), 3000);
        }
        // 일일 보너스 체크
        else if (Date.now() - lastBonus >= ONE_DAY_MS) {
          currentPoints += DAILY_BONUS;
          lastBonus = Date.now();
          await updateDoc(userRef, {
            gamePoints: currentPoints,
            gameLastBonus: lastBonus,
          });
          setBonusMsg(`일일 보너스 +${DAILY_BONUS.toLocaleString()}P`);
          setTimeout(() => setBonusMsg(""), 3000);
        }
        // 파산 - 리셋
        else if (currentPoints <= 0) {
          currentPoints = INITIAL_POINTS;
          await updateDoc(userRef, { gamePoints: currentPoints });
          setBonusMsg(`💎 파산! 포인트 리셋 ${INITIAL_POINTS.toLocaleString()}P`);
          setTimeout(() => setBonusMsg(""), 3000);
        }
        
        setPoints(currentPoints);
      } catch (e) {
        console.error("게임 포인트 로드 실패:", e);
        setPoints(INITIAL_POINTS);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, userId]);
  
  // 포인트 변경 → Firestore 저장 (디바운스)
  const handlePointsChange = async (newPoints) => {
    setPoints(newPoints);
    
    if (!userId || saving) return;
    setSaving(true);
    
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { gamePoints: newPoints });
    } catch (e) {
      console.error("포인트 저장 실패:", e);
    } finally {
      setSaving(false);
    }
  };
  
  const handleClose = () => {
    setScreen("lobby");
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div style={S.overlay} onClick={handleClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {/* 닫기 */}
        <button onClick={handleClose} style={S.closeBtn}>✕</button>
        
        {/* 보너스 알림 */}
        {bonusMsg && (
          <div style={S.bonusAlert}>{bonusMsg}</div>
        )}
        
        {loading ? (
          <div style={S.loading}>
            <div style={S.loadingIcon}>🎰</div>
            <div>라운지 입장 중...</div>
          </div>
        ) : (
          <>
            {screen === "lobby" && (
              <Lobby 
                points={points} 
                onSelect={setScreen}
                userName={currentUser?.nickname || currentUser?.id || "GUEST"}
              />
            )}
            {screen === "baccarat" && (
              <BaccaratGame 
                points={points} 
                onPointsChange={handlePointsChange}
                onBack={() => setScreen("lobby")}
              />
            )}
            {screen === "roulette" && (
              <RouletteGame 
                points={points} 
                onPointsChange={handlePointsChange}
                onBack={() => setScreen("lobby")}
              />
            )}
            {screen === "blackjack" && (
              <BlackjackGame 
                points={points} 
                onPointsChange={handlePointsChange}
                onBack={() => setScreen("lobby")}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 로비 화면
function Lobby({ points, onSelect, userName }) {
  return (
    <div style={L.container}>
      {/* 상단 로고 */}
      <div style={L.hero}>
        <div style={L.heroIcon}>✨</div>
        <h1 style={L.heroTitle}>SECRET LOUNGE</h1>
        <div style={L.heroSub}>VIP Members Only</div>
      </div>
      
      {/* 유저 카드 */}
      <div style={L.userCard}>
        <div style={L.userLabel}>Welcome back,</div>
        <div style={L.userName}>{userName}</div>
        <div style={L.pointsBig}>💎 {points.toLocaleString()}P</div>
      </div>
      
      {/* 게임 선택 */}
      <div style={L.gamesGrid}>
        <GameCard 
          icon="🎴" 
          title="Baccarat" 
          subtitle="바카라" 
          desc="Player vs Banker"
          color="#E63975"
          onClick={() => onSelect("baccarat")}
        />
        <GameCard 
          icon="🎡" 
          title="Roulette" 
          subtitle="룰렛" 
          desc="0 ~ 36"
          color="#D4A574"
          onClick={() => onSelect("roulette")}
        />
        <GameCard 
          icon="🃏" 
          title="Blackjack" 
          subtitle="블랙잭" 
          desc="21 Game"
          color="#FF6B9D"
          onClick={() => onSelect("blackjack")}
        />
      </div>
      
      {/* 안내 */}
      <div style={L.notice}>
        <div style={L.noticeTitle}>🎁 재미용 게임</div>
        <div style={L.noticeText}>
          · 실제 다이아와 무관<br/>
          · 일일 로그인 보너스 +{DAILY_BONUS.toLocaleString()}P<br/>
          · 파산 시 자동으로 {INITIAL_POINTS.toLocaleString()}P 지급
        </div>
      </div>
    </div>
  );
}

function GameCard({ icon, title, subtitle, desc, color, onClick }) {
  return (
    <button onClick={onClick} style={{...L.gameCard, borderColor: color}}>
      <div style={L.gameIcon}>{icon}</div>
      <div style={{...L.gameTitle, color}}>{title}</div>
      <div style={L.gameSubtitle}>{subtitle}</div>
      <div style={L.gameDesc}>{desc}</div>
    </button>
  );
}

const S = {
  overlay: { 
    position: "fixed", 
    inset: 0, 
    background: "rgba(0,0,0,0.85)", 
    backdropFilter: "blur(8px)",
    zIndex: 9999, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center",
    padding: 12,
  },
  modal: { 
    width: "100%", 
    maxWidth: 500, 
    maxHeight: "95vh", 
    overflowY: "auto",
    background: "linear-gradient(180deg, #1f0817 0%, #120410 100%)",
    borderRadius: 20, 
    border: "1px solid rgba(212,165,116,0.3)",
    boxShadow: "0 20px 60px rgba(230,57,117,0.3)",
    position: "relative",
  },
  closeBtn: { 
    position: "absolute", 
    top: 12, 
    right: 12, 
    background: "rgba(255,255,255,0.1)", 
    border: "none", 
    color: "#fff", 
    width: 32, 
    height: 32, 
    borderRadius: "50%", 
    cursor: "pointer", 
    fontSize: 16, 
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bonusAlert: { 
    position: "absolute", 
    top: 20, 
    left: "50%", 
    transform: "translateX(-50%)", 
    background: "linear-gradient(135deg, #D4A574, #FF6B9D)", 
    color: "#fff", 
    padding: "10px 20px", 
    borderRadius: 50, 
    fontWeight: 800, 
    fontSize: 13,
    zIndex: 20,
    boxShadow: "0 8px 24px rgba(255,107,157,0.4)",
    animation: "slideDown 0.5s ease-out",
  },
  loading: { padding: 60, textAlign: "center", color: "#D4A574" },
  loadingIcon: { fontSize: 48, marginBottom: 16, animation: "spin 2s linear infinite" },
};

const L = {
  container: { padding: 24, color: "#fff" },
  hero: { textAlign: "center", marginBottom: 24, paddingTop: 20 },
  heroIcon: { fontSize: 32, marginBottom: 8 },
  heroTitle: { 
    fontSize: 28, 
    fontWeight: 800, 
    letterSpacing: 4, 
    margin: 0,
    background: "linear-gradient(135deg, #D4A574, #FF6B9D, #D4A574)", 
    WebkitBackgroundClip: "text", 
    WebkitTextFillColor: "transparent",
    fontFamily: "'Playfair Display', serif",
  },
  heroSub: { fontSize: 11, color: "rgba(212,165,116,0.7)", letterSpacing: 4, marginTop: 4 },
  userCard: { 
    background: "linear-gradient(135deg, #3d1028, #1f0817)", 
    border: "1px solid rgba(212,165,116,0.4)",
    borderRadius: 16, 
    padding: 20, 
    textAlign: "center", 
    marginBottom: 24,
  },
  userLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: 2 },
  userName: { fontSize: 20, fontWeight: 700, color: "#D4A574", marginTop: 4, marginBottom: 12 },
  pointsBig: { 
    fontSize: 32, 
    fontWeight: 800, 
    background: "linear-gradient(135deg, #D4A574, #FF6B9D)", 
    WebkitBackgroundClip: "text", 
    WebkitTextFillColor: "transparent",
  },
  gamesGrid: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 },
  gameCard: { 
    padding: 20, 
    background: "linear-gradient(135deg, rgba(255,107,157,0.05), rgba(212,165,116,0.05))",
    border: "2px solid",
    borderRadius: 16, 
    cursor: "pointer", 
    display: "flex", 
    alignItems: "center", 
    gap: 16, 
    textAlign: "left",
    transition: "all 0.3s",
  },
  gameIcon: { fontSize: 36 },
  gameTitle: { fontSize: 18, fontWeight: 800, fontFamily: "'Playfair Display', serif" },
  gameSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 },
  gameDesc: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: "auto" },
  notice: { 
    padding: 16, 
    background: "rgba(212,165,116,0.08)", 
    borderRadius: 12, 
    fontSize: 12,
    border: "1px dashed rgba(212,165,116,0.3)",
  },
  noticeTitle: { color: "#D4A574", fontWeight: 700, marginBottom: 8 },
  noticeText: { color: "rgba(255,255,255,0.6)", lineHeight: 1.8 },
};
