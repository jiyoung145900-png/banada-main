// ===================================================================
// 🎰 VIP Premium Baccarat Dealer - Upgraded by Gemini
// ===================================================================

import React, { useEffect } from "react";

// 고급 카지노 전용 애니메이션 주입
const injectPremiumAnimations = () => {
  if (document.getElementById("premium-dealer-animations")) return;
  const style = document.createElement("style");
  style.id = "premium-dealer-animations";
  style.innerHTML = `
    @keyframes floatBreathing {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-2px); }
    }
    @keyframes goldPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(212, 165, 116, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(212, 165, 116, 0); }
    }
    @keyframes redAlertPulse {
      0%, 100% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.2), inset 0 0 20px rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.5); }
      50% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.6), inset 0 0 30px rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.9); }
    }
    @keyframes waveBounce {
      0%, 100% { transform: scaleY(0.4); }
      50% { transform: scaleY(1); }
    }
    @keyframes messageFadeIn {
      0% { opacity: 0; transform: translateX(10px); }
      100% { opacity: 1; transform: translateX(0); }
    }
    @keyframes liveDotBlink {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }
  `;
  document.head.appendChild(style);
};

// -----------------------------------------------------
// 1. 프리미엄 딜러 아바타 (헤드셋 장착형 프로 딜러)
// -----------------------------------------------------
function PremiumAvatar({ phase, speaking }) {
  const isDealing = phase === "dealing" || phase === "squeezing";
  
  return (
    <div style={{
      width: 64, height: 64, borderRadius: "50%",
      background: "linear-gradient(145deg, #1A1A1A, #0A0A0A)",
      padding: 3,
      border: "1px solid rgba(212,165,116,0.6)",
      animation: isDealing ? "goldPulse 2s infinite" : "none",
      position: "relative",
      boxShadow: "0 4px 15px rgba(0,0,0,0.5)"
    }}>
      <svg viewBox="0 0 120 120" style={{
        width: "100%", height: "100%", borderRadius: "50%",
        background: "linear-gradient(180deg, #2c3e50, #000000)",
        animation: "floatBreathing 4s ease-in-out infinite",
      }}>
        {/* 우아한 배경 후광 */}
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(212,165,116,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <circle cx="60" cy="60" r="60" fill="url(#glow)" />

        {/* 딜러 정장 (Body) */}
        <path d="M 20 120 C 20 85, 35 75, 60 75 C 85 75, 100 85, 100 120 Z" fill="#111" stroke="#222" strokeWidth="2"/>
        
        {/* 화이트 셔츠 깃 */}
        <path d="M 45 76 L 60 95 L 75 76 Z" fill="#E8E8E8" />
        
        {/* 골드 보우타이 */}
        <path d="M 52 86 L 60 90 L 68 86 L 68 94 L 60 90 L 52 94 Z" fill="#D4A574" />
        <circle cx="60" cy="90" r="2.5" fill="#B07D46" />

        {/* 목 & 얼굴 */}
        <rect x="52" y="55" width="16" height="25" fill="#FAD6B1" />
        <path d="M 38 50 C 38 20, 82 20, 82 50 C 82 72, 70 80, 60 80 C 50 80, 38 72, 38 50 Z" fill="#FAD6B1" />

        {/* 세련된 올백 머리 (Hair) */}
        <path d="M 36 50 C 36 15, 84 15, 84 50 C 84 55, 82 60, 78 60 C 80 40, 75 22, 60 22 C 45 22, 40 40, 42 60 C 38 60, 36 55, 36 50 Z" fill="#1A1512" />

        {/* 프로페셔널한 눈매 */}
        <path d="M 48 49 Q 52 46 55 49" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 65 49 Q 68 46 72 49" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        
        {/* 은은한 미소 */}
        <path d="M 54 66 Q 60 69 66 66" stroke="#C25975" strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {/* 🎧 라이브 카지노 전용 헤드셋 & 마이크 */}
        <path d="M 82 35 A 25 25 0 0 1 87 50" stroke="#333" strokeWidth="2.5" fill="none" />
        <rect x="84" y="44" width="7" height="14" rx="3.5" fill="#222" stroke="#D4A574" strokeWidth="1" />
        {/* 마이크 붐 (입가로 내려오는 선) */}
        <path d="M 85 55 C 80 70, 70 73, 64 73" stroke="#222" strokeWidth="2" fill="none" />
        {/* 마이크 팁 */}
        <circle cx="62" cy="73" r="3" fill="#D4A574" />
        {speaking && <circle cx="62" cy="73" r="5" fill="rgba(212,165,116,0.5)" />}
      </svg>
    </div>
  );
}

// -----------------------------------------------------
// 2. 오디오 이퀄라이저 (말할 때 표시됨)
// -----------------------------------------------------
function AudioEqualizer() {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 16, margin: "0 8px" }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{
          width: 3, height: "100%", background: "#D4A574", borderRadius: 2,
          animation: `waveBounce 0.8s infinite ease-in-out`,
          animationDelay: `${i * 0.15}s`,
          transformOrigin: "bottom"
        }} />
      ))}
    </div>
  );
}

// -----------------------------------------------------
// 3. 메인 컴포넌트 
// -----------------------------------------------------
export default function BaccaratDealer({ 
  phase, 
  message = "Place your bets, please.", 
  dealerName = "SOPHIA",
  roundNumber = "1049-A",
  playerCount = 142,
  speaking = true,
  noMoreBets = false,
}) {
  useEffect(() => { injectPremiumAnimations(); }, []);
  
  return (
    <div style={{
      ...S.dealerContainer,
      // No More Bets 상태일 때 고급스러운 네온 레드 경고 효과
      animation: noMoreBets ? "redAlertPulse 1.5s infinite" : "none",
      border: noMoreBets ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(212, 165, 116, 0.2)",
    }}>
      
      {/* 왼쪽: 아바타 및 딜러 정보 */}
      <div style={S.leftSection}>
        <PremiumAvatar phase={phase} speaking={speaking} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={S.dealerBadge}>LIVE DEALER</div>
          <div style={S.dealerName}>
            {dealerName}
            <span style={S.liveIndicator}>●</span>
          </div>
          {playerCount > 0 && (
            <div style={S.playerCount}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:4}}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              {playerCount.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 메시지 및 라운드 정보 */}
      <div style={S.rightSection}>
        <div style={S.messageWrapper} key={message}>
          {/* 말풍선 꼬리 */}
          <div style={S.messageTail} />
          
          <div style={S.messageContent}>
            {speaking && <AudioEqualizer />}
            <span style={S.messageText}>{message}</span>
          </div>
        </div>
        
        {roundNumber && (
          <div style={S.roundBadge}>
            ROUND {roundNumber}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------
// 4. 스타일 정의 (Glassmorphism & Luxury)
// -----------------------------------------------------
const S = {
  dealerContainer: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    // 글래스모피즘 딥다크 배경
    background: "linear-gradient(135deg, rgba(20, 20, 25, 0.85), rgba(10, 10, 15, 0.95))",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    borderRadius: 16, 
    padding: "14px 20px", 
    marginBottom: 16,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    transition: "all 0.4s ease",
  },
  leftSection: { 
    display: "flex", gap: 16, alignItems: "center", flex: 1 
  },
  rightSection: { 
    display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" 
  },
  dealerBadge: { 
    fontSize: 9, color: "#D4A574", fontWeight: 700, letterSpacing: 2,
    textTransform: "uppercase" 
  },
  dealerName: { 
    fontSize: 16, fontWeight: 900, color: "#FFFFFF", letterSpacing: 1,
    display: "flex", alignItems: "center", gap: 8,
    textShadow: "0 2px 4px rgba(0,0,0,0.5)"
  },
  liveIndicator: { 
    color: "#EF4444", fontSize: 10, 
    animation: "liveDotBlink 2s infinite" 
  },
  playerCount: { 
    display: "flex", alignItems: "center",
    fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 
  },
  messageWrapper: {
    position: "relative",
    animation: "messageFadeIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
  messageTail: {
    position: "absolute",
    right: -6, top: "50%", transform: "translateY(-50%)",
    borderTop: "6px solid transparent",
    borderBottom: "6px solid transparent",
    borderLeft: "6px solid rgba(212, 165, 116, 0.15)",
  },
  messageContent: {
    display: "flex", alignItems: "center",
    background: "rgba(30, 30, 35, 0.6)",
    border: "1px solid rgba(212, 165, 116, 0.2)",
    padding: "8px 16px", borderRadius: 12,
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 4px 10px rgba(0,0,0,0.2)",
  },
  messageText: {
    fontSize: 13, fontWeight: 600, color: "#F3F4F6", 
    letterSpacing: 0.5, maxWidth: 220,
    textShadow: "0 1px 2px rgba(0,0,0,0.5)"
  },
  roundBadge: {
    fontSize: 10, color: "rgba(212, 165, 116, 0.7)", 
    fontFamily: "Courier New, monospace", fontWeight: 700,
    letterSpacing: 1.5, background: "rgba(0,0,0,0.4)",
    padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(212,165,116,0.1)"
  },
};