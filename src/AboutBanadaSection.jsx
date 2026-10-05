import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, authReady } from "./firebase";

// ★ BANADA 회사 소개 - 인스타 스타일 베너 게시판
// Admin에서 이미지만 업로드하면 세로로 쭉 표시
export default function AboutBanadaSection({ t, user, isGuest }) {
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

  return (
    <div style={s.container}>
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
    padding: '20px 16px 20px',
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
    top: 20,
    right: 20,
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
