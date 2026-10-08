import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, authReady } from "./firebase";

// ★ BANADA 회사 소개 - 인스타 스타일 베너 게시판
// Admin에서 이미지만 업로드하면 세로로 쭉 표시
export default function AboutBanadaSection({ t, user, isGuest, onBack }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null); // 확대보기

  const isKo = t?.home === "홈페이지";
  const isJa = t?.home === "ホーム";
  const tr = (ko, ja, en) => isKo ? ko : isJa ? ja : en;

  useEffect(() => {
    let unsub = () => {};
    authReady.then(() => {
      const q = query(
        collection(db, "about_banners"),
        orderBy("order", "asc")
      );
      unsub = onSnapshot(q, (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(b => b.active !== false); // 비활성화 제외
        setBanners(list);
        setLoading(false);
      }, (err) => {
        console.error("베너 로드 실패:", err);
        setLoading(false);
      });
    });
    return () => unsub();
  }, []);

  // ★★★ [신규] 상단 < 버튼용 뒤로가기 핸들러
  //   확대보기 열려있으면 그거 먼저 닫기, 아니면 Dashboard goBack 또는 history.back()
  const handleTopBack = () => {
    if (selectedImage) { setSelectedImage(null); return; }
    if (typeof onBack === 'function') { onBack(); return; }
    if (typeof window !== 'undefined' && window.history) window.history.back();
  };

  return (
    <div style={s.container}>
      {/* ===== [신규] iOS 스타일 상단 바 - 뒤로가기 + 타이틀 ===== */}
      {/*   position: fixed + maxWidth 500 중앙 정렬로 container padding과 독립  */}
      {/*   모든 아이폰 기종(SE/mini/Pro/Pro Max/Dynamic Island) safe-area 자동 처리  */}
      <div style={s.topBar}>
        <button
          type="button"
          onClick={handleTopBack}
          style={s.topBackBtn}
          aria-label="back"
        >
          <span style={s.topBackArrow}>‹</span>
        </button>
        <div style={s.topTitle}>
          {tr("기업정보", "企業情報", "ABOUT")}
        </div>
        <div style={s.topRightSpacer} />
      </div>
      {/* 고정 바 높이만큼 콘텐츠를 아래로 밀어주는 스페이서 */}
      <div style={s.topBarSpacer} />

      {/* 상단 헤더 */}
      <div style={s.header}>
        <div style={s.headerLabel}>ABOUT BANADA</div>
        <div style={s.headerTitle}>
          {tr("바나다 소개", "BANADA紹介", "ABOUT BANADA")}
          <span style={{ color: '#D4AF37', marginLeft: 8 }}>✨</span>
        </div>
        <div style={s.headerSub}>
          {tr(
            "10년 전통의 프리미엄 매칭 서비스",
            "10年の伝統を誇るプレミアムマッチングサービス",
            "10 Years of Premium Matching Experience"
          )}
        </div>
      </div>

      {/* 베너 리스트 */}
      {loading ? (
        <div style={s.loadingWrap}>
          <div className="about-spinner" />
          <div style={s.loadingText}>
            {tr("불러오는 중...", "読み込み中...", "Loading...")}
          </div>
        </div>
      ) : banners.length === 0 ? (
        <div style={s.emptyWrap}>
          <div style={s.emptyIcon}>📸</div>
          <div style={s.emptyText}>
            {tr("준비 중입니다.", "準備中です。", "Coming soon.")}
          </div>
        </div>
      ) : (
        <div style={s.bannerList}>
          {banners.map((banner, idx) => (
            <div 
              key={banner.id} 
              style={s.bannerCard}
              onClick={() => setSelectedImage(banner.imageUrl)}
            >
              <img 
                src={banner.imageUrl} 
                alt={`BANADA ${idx + 1}`}
                style={s.bannerImage}
                loading="lazy"
              />
            </div>
          ))}
          
          {/* 하단 여백 (네비게이션 가림 방지) */}
          <div style={{ height: 80 }} />
        </div>
      )}

      {/* 이미지 확대보기 모달 */}
      {selectedImage && (
        <div style={s.modalOverlay} onClick={() => setSelectedImage(null)}>
          <button style={s.modalClose} onClick={() => setSelectedImage(null)}>✕</button>
          <img 
            src={selectedImage} 
            alt="BANADA" 
            style={s.modalImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <style>{`
        @keyframes aboutSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .about-spinner { 
          width: 40px; height: 40px; 
          border: 3px solid #222; border-top: 3px solid #D4AF37; 
          border-radius: 50%; animation: aboutSpin 0.8s linear infinite; 
          margin-bottom: 15px; 
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const s = {
  container: {
    minHeight: '100vh',
    background: '#080808',
    padding: '0 16px 20px', // ★ [변경] 상단 padding 0 → 상단 바가 자체 safe-area 처리
  },

  // ===== ★ [신규] iOS 스타일 상단 바 =====
  // Dashboard의 bottomNav와 동일 패턴: fixed + maxWidth 500 중앙 정렬
  // → container padding과 완전히 독립, 좌우 어긋남 없음
  // → 모든 아이폰(SE/mini/일반/Pro/Pro Max/다이나믹아일랜드) safe-area 자동 처리
  topBar: {
    position: 'fixed',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 500,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px',
    paddingTop: 'env(safe-area-inset-top)',
    paddingLeft: 'max(8px, env(safe-area-inset-left))',
    paddingRight: 'max(8px, env(safe-area-inset-right))',
    minHeight: 'calc(48px + env(safe-area-inset-top))',
    boxSizing: 'border-box',
    background: 'rgba(8, 8, 8, 0.92)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  // 고정 바 높이만큼 콘텐츠를 아래로 밀어주는 스페이서
  topBarSpacer: {
    width: '100%',
    height: 'calc(48px + env(safe-area-inset-top))',
  },
  topBackBtn: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: '#fff',
    WebkitTapHighlightColor: 'transparent',
  },
  topBackArrow: {
    fontSize: 34,
    lineHeight: 1,
    color: '#fff',
    fontWeight: 300,
    marginTop: -4,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  topRightSpacer: {
    width: 40,
    height: 40,
  },

  // 헤더
  header: {
    textAlign: 'center',
    padding: '20px 0 30px',
    borderBottom: '1px solid #222',
    marginBottom: 24,
  },
  headerLabel: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '3px',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 900,
    marginBottom: 10,
    letterSpacing: '-0.5px',
  },
  headerSub: {
    color: '#888',
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '0.3px',
  },
  // 베너 리스트
  bannerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  bannerCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    background: '#111',
    cursor: 'pointer',
    animation: 'fadeInUp 0.5s ease-out',
    border: '1px solid #1a1a1a',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  bannerImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
    objectFit: 'cover',
  },
  // 로딩/빈 상태
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
  },
  loadingText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: 600,
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
    opacity: 0.4,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 600,
  },
  // 확대보기 모달
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.95)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingTop: 'calc(20px + env(safe-area-inset-top))', // ★ [신규] 아이폰 노치 아래로 X 버튼 위치
    backdropFilter: 'blur(10px)',
  },
  modalImage: {
    maxWidth: '95%',
    maxHeight: '95vh',
    borderRadius: 12,
    objectFit: 'contain',
  },
  modalClose: {
    position: 'absolute',
    top: 'calc(20px + env(safe-area-inset-top))', // ★ [신규] 아이폰 노치 피하기
    right: 'calc(20px + env(safe-area-inset-right))',
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 20,
    fontWeight: 700,
    cursor: 'pointer',
    zIndex: 10000,
    backdropFilter: 'blur(10px)',
  },
};