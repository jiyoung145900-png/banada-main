// =========================================================================
// 🎨 ReviewStyles.js - 후기 섹션 스타일
// -------------------------------------------------------------------------
// BANADA 럭셔리 테마 유지 (#D4AF37 골드, #0a0a0a 다크)
// Instagram + Tinder 스타일 카드 디자인
// =========================================================================

export const r = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#fff',
    paddingBottom: 100,
    position: 'relative',
  },

  // ===== 상단 상담 배너 =====
  consultBanner: {
    margin: '15px 15px 20px',
    padding: '18px 20px',
    background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)',
    borderRadius: 16,
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(212, 175, 55, 0.25)',
    transition: 'transform 0.2s',
  },
  consultBannerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  consultBannerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  consultIcon: {
    fontSize: 32,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
  },
  consultTitle: {
    color: '#000',
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  consultSub: {
    color: 'rgba(0,0,0,0.7)',
    fontSize: 11,
    fontWeight: 600,
  },
  consultArrow: {
    color: '#000',
    fontSize: 20,
    fontWeight: 900,
  },

  // ===== 제목 =====
  titleWrap: {
    textAlign: 'center',
    padding: '10px 20px 20px',
  },
  titleSub: {
    color: '#D4AF37',
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: 700,
    opacity: 0.8,
    marginBottom: 5,
  },
  titleMain: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.5,
    margin: 0,
  },
  titleAccent: {
    color: '#D4AF37',
    marginLeft: 8,
    fontSize: 16,
  },

  // ===== 필터/정렬 컨트롤 =====
  controlBar: {
    padding: '0 15px 15px',
  },
  filterScrollWrap: {
    overflowX: 'auto',
    marginBottom: 15,
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  filterScroll: {
    display: 'inline-flex',
    gap: 8,
    padding: '0 5px 5px',
  },
  filterItem: {
    padding: '8px 18px',
    borderRadius: 20,
    border: '1px solid #333',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  sortRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '5px 5px',
  },
  sortBtn: {
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  sortDivider: {
    color: '#333',
    fontSize: 12,
  },

  // ===== 로딩/빈 상태 =====
  loadingWrap: {
    padding: '60px 20px',
    textAlign: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 13,
    marginTop: 10,
  },
  emptyWrap: {
    padding: '80px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
    opacity: 0.4,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
  },
  emptySub: {
    color: '#555',
    fontSize: 13,
  },

  // ===== 그리드 =====
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: '0 15px',
  },

  // ===== 카드 =====
  card: {
    background: '#111',
    borderRadius: 18,
    border: '1px solid #1f1f1f',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s, border-color 0.2s',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  cardHeader: {
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1a1a1a',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 3,
  },
  userMeta: {
    color: '#888',
    fontSize: 11,
    fontWeight: 500,
  },
  metaDot: {
    margin: '0 5px',
    color: '#444',
  },
  rating: {
    fontSize: 10,
    letterSpacing: -2,
  },
  
  // ===== 매니저 태그 =====
  managerTag: {
    padding: '8px 16px',
    background: 'rgba(212, 175, 55, 0.08)',
    borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
  },

  // ===== 미디어 (사진/영상) =====
  mediaWrap: {
    width: '100%',
    aspectRatio: '1/1',
    background: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  videoWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mediaEl: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoPlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: 60,
    color: '#fff',
    textShadow: '0 2px 12px rgba(0,0,0,0.7)',
    pointerEvents: 'none',
  },

  // ===== 인터랙션 =====
  interactionRow: {
    display: 'flex',
    gap: 20,
    padding: '14px 16px 10px',
  },
  interactionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    transition: 'transform 0.15s',
  },
  interactionCount: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: 700,
  },

  // ===== 본문 =====
  content: {
    padding: '0 16px 12px',
  },
  contentText: {
    color: '#ddd',
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
    wordBreak: 'break-word',
  },

  // ===== 해시태그 =====
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '0 16px 12px',
  },
  tag: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: 600,
  },

  // ===== 상담 버튼 =====
  consultBtn: {
    display: 'block',
    width: 'calc(100% - 32px)',
    margin: '0 16px 16px',
    padding: '12px',
    background: 'linear-gradient(135deg, #0088cc 0%, #005588 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: 0.5,
    transition: 'transform 0.15s',
    boxShadow: '0 4px 12px rgba(0, 136, 204, 0.25)',
  },

  // ===== 플로팅 버튼 =====
  floatingConsult: {
    position: 'fixed',
    right: 20,
    bottom: 100,
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
    color: '#000',
    border: 'none',
    fontSize: 26,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingWrite: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 100,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 22px',
    background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
    color: '#000',
    border: 'none',
    borderRadius: 30,
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(212, 175, 55, 0.5)',
    zIndex: 90,
    letterSpacing: 0.5,
  },
  floatingWriteText: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
};
