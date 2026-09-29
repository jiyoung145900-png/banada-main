import React, { useState, useEffect, useCallback, useRef } from "react";
import HomeSection from "./HomeSection";
import ManagerSection from "./ManagerSection";
import ReviewSection from "./ReviewSection"; // ★ [신규] VideoSection → ReviewSection (후기 섹션)
import EventSection from "./EventSection";
import MyPageSection from "./MyPage"; 
// ★ Firebase 연동을 위한 import 추가
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// ★ [신규] 시간대별 baseline 범위 계산
//   - 새벽/오전/오후/저녁마다 자연스러운 접속자 범위
const getTimeBasedBaseline = () => {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6)   return { min: 130, max: 170, target: 150 };  // 새벽
  if (hour >= 6 && hour < 11)  return { min: 140, max: 180, target: 160 };  // 오전
  if (hour >= 11 && hour < 18) return { min: 160, max: 200, target: 180 };  // 오후
  return { min: 180, max: 230, target: 205 };                                 // 저녁 (18~24시)
};

// ★ [신규] localStorage 키 (새로고침해도 값 유지)
const LIVE_COUNT_KEY = 'banada_live_count';
const LIVE_COUNT_TIME_KEY = 'banada_live_count_time';

export default function Dashboard({ 
  user, 
  onUpdatePoint, 
  appAvatarImage, 
  appAvatarIdx, 
  onAvatarChange,
  t, 
  onLogout, 
  lang, 
  dashStyles, 
  isGuest, 
  members = [], 
  regions = [], 
  slideImages = [],
  innerLogo, 
  topAdImage,
  topAdImage2,
  telegramLink = "https://t.me/your_address",
  noticeText = ""
}) {
  const [activeTab, setActiveTab] = useState('home');
  
  // ★★★ 트렌디한 뒤로가기 시스템 - 필터까지 완벽 복원
  const [tabHistory, setTabHistory] = useState([
    { tab: 'home', region: '전체' }
  ]);
  const localBackHandlerRef = useRef(null);
  // ★ 베팅 UI 활성 여부 - EventSection이 알려줌 → 하단 바 숨김 트리거
  const [isBettingActive, setIsBettingActive] = useState(false);
  const [selectedM, setSelectedM] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState("전체");
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ★ 중요: props로 받은 user 대신 상위에서 관리되는 실시간 데이터를 참조
  const safeUser = user || { id: "MEMBER", no: "2282290", diamond: 0, rewards: 0 };

  // ★ 데일리 보너스 서버 저장 함수
  const handleClaimBonus = async () => {
    if (isGuest) return alert("회원만 이용 가능합니다.");
    
    const bonusAmount = 100000;
    const nextPoint = (Number(user?.diamond) || 0) + bonusAmount;

    onUpdatePoint(nextPoint);

    if (user?.id) {
      try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, {
          diamond: nextPoint,
          lastBonusDate: new Date().toISOString()
        });
        alert("데일리 보너스 10만 다이아가 서버에 저장되었습니다!");
      } catch (e) {
        console.error("보너스 서버 저장 실패:", e);
        alert("서버 저장에 실패했습니다. 인터넷 연결을 확인하세요.");
      }
    }
  };

  // 매니저 필터 로직
  const filteredMembers = members.filter(m => {
    if (!selectedRegion || selectedRegion === "전체" || selectedRegion === "ALL") return true;
    return m.region === selectedRegion;
  });

  // ★ 실시간 접속자 카운트 - 자연스럽고 안정적으로
  const [matchingCount, setMatchingCount] = useState(() => {
    try {
      const saved = localStorage.getItem(LIVE_COUNT_KEY);
      const savedTime = localStorage.getItem(LIVE_COUNT_TIME_KEY);
      const baseline = getTimeBasedBaseline();
      
      if (saved && savedTime) {
        const elapsed = Date.now() - Number(savedTime);
        if (elapsed < 30 * 60 * 1000) {
          const savedNum = Number(saved);
          if (savedNum >= 100 && savedNum <= 260) return savedNum;
        }
      }
      return Math.floor(Math.random() * (baseline.max - baseline.min + 1)) + baseline.min;
    } catch (e) {
      return 175;
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setMatchingCount(prev => {
        const baseline = getTimeBasedBaseline();
        const rand = Math.random();
        
        const distFromTarget = prev - baseline.target;
        
        let change;
        
        if (Math.abs(distFromTarget) > 20 && rand < 0.30) {
          change = distFromTarget > 0 ? -1 : 1;
        } else {
          if (rand < 0.30) change = 1;
          else if (rand < 0.60) change = -1;
          else if (rand < 0.72) change = 2;
          else if (rand < 0.85) change = -2;
          else if (rand < 0.92) change = 3;
          else if (rand < 0.97) change = -3;
          else change = 0;
        }
        
        let nextCount = prev + change;
        
        if (nextCount < baseline.min - 10) nextCount = baseline.min;
        if (nextCount > baseline.max + 10) nextCount = baseline.max;
        
        try {
          localStorage.setItem(LIVE_COUNT_KEY, String(nextCount));
          localStorage.setItem(LIVE_COUNT_TIME_KEY, String(Date.now()));
        } catch (e) {}
        
        return nextCount;
      });
    }, 4000); 
    return () => clearInterval(timer);
  }, []);

  // ★★★ 트렌디한 뒤로가기 시스템
  const handlePopState = useCallback(() => {
    if (document.getElementById('full-screen-view')) return;
    
    // 1️⃣ 자식 섹션의 로컬 뒤로가기 시도
    if (localBackHandlerRef.current) {
      const handled = localBackHandlerRef.current();
      if (handled) {
        window.history.pushState(null, '');
        return;
      }
    }
    
    // 2️⃣ 탭 히스토리 스택 pop
    if (tabHistory.length > 1) {
      const newHistory = tabHistory.slice(0, -1);
      const prev = newHistory[newHistory.length - 1];
      setTabHistory(newHistory);
      setActiveTab(prev.tab);
      if (prev.region !== undefined) setSelectedRegion(prev.region);
      window.history.pushState(null, '');
      return;
    }
    
    // 3️⃣ 홈에서 뒤로가기 → 로그아웃 확인
    setShowLogoutConfirm(true);
    window.history.pushState(null, '');
  }, [tabHistory]);

  const goBack = useCallback(() => {
    if (localBackHandlerRef.current) {
      const handled = localBackHandlerRef.current();
      if (handled) return;
    }
    
    if (tabHistory.length > 1) {
      const newHistory = tabHistory.slice(0, -1);
      const prev = newHistory[newHistory.length - 1];
      setTabHistory(newHistory);
      setActiveTab(prev.tab);
      if (prev.region !== undefined) setSelectedRegion(prev.region);
      return;
    }
    
    setActiveTab('home');
  }, [tabHistory]);

  useEffect(() => {
    window.history.pushState(null, '');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  // ★★★ 탭 클릭 시 히스토리 스택에 추가
  const handleTabClick = (key) => {
    // ★ [수정] 후기 탭도 회원 전용으로 (익명 게시판이지만 로그인 필요)
    if (isGuest && (key === 'event' || key === 'mypage' || key === 'review')) {
      alert(lang === "ko" ? "승인된 회원 전용 구역입니다." : lang === "ja" ? "承認された会員専用エリアです。" : "Authorized Members Only.");
      return;
    }
    if (activeTab === key) return;
    
    if (key === 'home') {
      setTabHistory([{ tab: 'home', region: selectedRegion }]);
    } else {
      setTabHistory(prev => [...prev, { tab: key, region: selectedRegion }]);
    }
    
    if (key === 'event') {
      setIsEventLoading(true);
      setActiveTab(key);
      setTimeout(() => setIsEventLoading(false), 800);
    } else { 
      setActiveTab(key); 
    }
  };

  // ★★★ 매니저 지역 필터 wrapper
  const handleRegionChange = useCallback((region) => {
    if (region === selectedRegion) return;
    setTabHistory(prev => [...prev, { tab: 'manager', region }]);
    setSelectedRegion(region);
  }, [selectedRegion]);

  const openDetail = (m) => {
    setSelectedM(m);
    if (activeTab !== 'manager') {
      setTabHistory(prev => [...prev, { tab: 'manager', region: selectedRegion }]);
    }
    setActiveTab('manager');
    window.history.pushState({ isDetail: true }, ''); 
  };

  const handleTelegram = () => {
    if (telegramLink) window.open(telegramLink, "_blank");
    else alert(lang === "ko" ? "상담 링크가 설정되지 않았습니다." : lang === "ja" ? "相談リンクが設定されていません。" : "Link not set.");
  };

  useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);
  
  // ★ 이벤트 탭 벗어나면 베팅 상태 초기화
  useEffect(() => {
    if (activeTab !== 'event') setIsBettingActive(false);
  }, [activeTab]);

  // ★★★ CustomEvent 리스너 - MyPage에서 이벤트 참여 클릭 시 이벤트 탭으로 이동
  useEffect(() => {
    const handleNavigateToEvent = () => {
      setTabHistory(prev => {
        const current = prev[prev.length - 1];
        return [...prev, { tab: 'event', region: current?.region || selectedRegion }];
      });
      setActiveTab('event');
    };
    window.addEventListener('navigate-to-event', handleNavigateToEvent);
    return () => window.removeEventListener('navigate-to-event', handleNavigateToEvent);
  }, [selectedRegion]);

  // ★ Heartbeat - 30초마다 lastActive만 저장
  useEffect(() => {
    if (!user?.id || isGuest) return;
    
    let interval = null;
    
    const updateLastActive = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        await updateDoc(doc(db, "users", user.id), { 
          lastActive: Date.now(),
        });
      } catch (e) {
        // 조용히 실패
      }
    };
    
    updateLastActive();
    interval = setInterval(updateLastActive, 30000);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLastActive();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, isGuest]);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeSection 
            t={t} innerLogo={innerLogo} topAdImage={topAdImage} topAdImage2={topAdImage2} slideImages={slideImages} members={members} 
            setActiveTab={setActiveTab} openDetail={openDetail} 
            handleTelegram={handleTelegram} matchingCount={matchingCount}
            onClaimBonus={handleClaimBonus}
            noticeText={noticeText}
          />
        );
      case 'manager':
        return (
          <ManagerSection 
            t={t} regions={regions} selectedRegion={selectedRegion} setSelectedRegion={handleRegionChange} 
            filteredMembers={filteredMembers} initialMember={selectedM} 
            onCloseDetail={() => setSelectedM(null)}
            backHandlerRef={localBackHandlerRef}
          />
        );
      case 'event':
        return isEventLoading ? (
          <div style={s.loadingContainer}>
            <div className="loading-spinner"></div>
            <div style={s.loadingText}>{lang === "ko" ? "프라이빗 혜택 로딩 중..." : lang === "ja" ? "プライベート特典を読み込み中..." : "Loading Private Benefits..."}</div>
          </div>
        ) : (
          <EventSection 
            t={t} 
            user={user}
            userPoint={user?.diamond || 0}
            onUpdatePoint={onUpdatePoint}
            onBack={goBack} confirmedImage={appAvatarImage} confirmedAvatarIdx={appAvatarIdx}
            onBettingStateChange={setIsBettingActive}
            backHandlerRef={localBackHandlerRef}
          />
        );
      // ★ [신규] 후기 섹션 - VideoSection 대체
      case 'review':
        return (
          <ReviewSection 
            t={t}
            user={user}
            isGuest={isGuest}
            regions={regions}
            members={members}
            backHandlerRef={localBackHandlerRef}
          />
        );
      case 'mypage':
        return (
          <MyPageSection 
            t={t} user={user} onBack={goBack} onLogout={() => setShowLogoutConfirm(true)} 
            confirmedImage={appAvatarImage} confirmedAvatarIdx={appAvatarIdx} onAvatarChange={onAvatarChange} s={s} 
            telegramLink={telegramLink}
            setActiveTab={setActiveTab}
            backHandlerRef={localBackHandlerRef}
          />
        );
      default: return null;
    }
  };

  return (
    <div style={{ ...dashStyles.container, background: '#080808', zIndex: 10, position: 'relative' }}>
      <div style={{...dashStyles.contentArea, background: 'transparent'}}>
        {activeTab !== 'home' && activeTab !== 'event' && activeTab !== 'mypage' && (
          <div style={s.topStatus}>
            <div style={s.statusInner}>
              <span className="dot-active" />
              <span style={s.statusText}>LIVE CONNECTED : </span>
              <b style={s.statusCount}>{matchingCount} MEMBERS</b>
            </div>
          </div>
        )}
        {renderContent()}
      </div>

      {showLogoutConfirm && (
        <div style={s.modalOverlay} onClick={() => setShowLogoutConfirm(false)}>
          <div style={{...s.modalContent, textAlign: 'center'}} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalName}>{t.logout}</h3>
            <p style={{color: '#8E8E93', fontSize: 14, marginBottom: 20}}>
              {lang === "ko" ? "정말 로그아웃 하시겠습니까?" : lang === "ja" ? "本当にログアウトしますか?" : "Are you sure you want to log out?"}
            </p>
            <div style={s.modalBtnGroup}>
              <button onClick={onLogout} style={s.mMatchBtn}>{t.logout}</button>
              <button onClick={() => setShowLogoutConfirm(false)} style={s.mCloseBtn}>
                {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "CANCEL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ★ [수정] 하단 네비게이션 - VideoSection 자리에 ReviewSection */}
      <nav style={{ 
        ...dashStyles.bottomNav, 
        backgroundColor: '#0F0F0F', 
        borderTop: '1px solid #222', 
        paddingBottom: 'env(safe-area-inset-bottom)',
        transform: isBettingActive 
          ? 'translateX(-50%) translateY(100%)' 
          : 'translateX(-50%) translateY(0)',
        pointerEvents: isBettingActive ? 'none' : 'auto',
        opacity: isBettingActive ? 0 : 1
      }}>
        {[
          { key: 'home', label: t.home, icon: '🏠' },
          { key: 'manager', label: t.manager, icon: '💎' },
          { key: 'event', label: t.event, icon: '🎁' },
          { key: 'review', label: t.review, icon: '⭐' }, // ★ [변경] video → review
          { key: 'mypage', label: t.mypage, icon: '👤' }
        ].map((item) => (
          <div key={item.key} onClick={() => handleTabClick(item.key)}
            style={{ ...dashStyles.navItem, color: activeTab === item.key ? '#D4AF37' : '#555' }}>
            <span style={{ fontSize: 22, filter: activeTab === item.key ? 'none' : 'grayscale(100%) opacity(0.4)', marginBottom: 4 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800 }}>{item.label}</span>
          </div>
        ))}
      </nav>

      <style>{`
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
        .dot-active { width: 8px; height: 8px; background: #34C759; border-radius: 50%; box-shadow: 0 0 8px #34C759; animation: pulse 1.5s infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .loading-spinner { width: 35px; height: 35px; border: 3px solid #222; border-top: 3px solid #D4AF37; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px; }
      `}</style>
    </div>
  );
}

const s = {
  topStatus: { background: '#121212', padding: '12px 0', borderBottom: '1px solid #222' },
  statusInner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusText: { color: '#666', fontSize: 11, fontWeight: 600 },
  statusCount: { color: '#D4AF37', fontSize: 11, fontWeight: 800 },
  loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 0' },
  loadingText: { fontSize: 13, color: '#D4AF37', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' },
  modalContent: { background: '#1A1A1A', width: '88%', maxWidth: '380px', padding: '24px', borderRadius: '28px', border: '1px solid #333' },
  modalName: { color: '#FFF', fontSize: 22, fontWeight: 800, margin: '0 0 6px 0' },
  modalBtnGroup: { display: 'flex', flexDirection: 'column', gap: 10 },
  mMatchBtn: { width: '100%', padding: '16px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '15px' },
  mCloseBtn: { width: '100%', padding: '14px', background: '#222', color: '#888', border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '14px' },
};
