import React, { useState, useRef, useMemo } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, authReady } from "./firebase";
import { uploadToCloudinary, generateVideoThumbnail } from "./CloudinaryService";
import { uploadToR2, isVideoFile } from "./R2Service";

export default function ReviewWriteModal({ 
  user, 
  members = [],
  regionFilters = [],
  onClose, 
  tr, 
  isKo, 
  isJa,
  getRegionName 
}) {
  const [step, setStep] = useState(1); // 1: 미디어, 2: 정보 입력
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [region, setRegion] = useState(""); // 광역 (필수)
  const [loc, setLoc] = useState(""); // 시군구
  const [selectedManager, setSelectedManager] = useState(null); // 선택사항
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // ★ 선택한 광역에 속한 시군구 목록 (매니저 데이터에서 추출)
  const availableLocs = useMemo(() => {
    if (!region) return [];
    const locs = new Set();
    members.forEach(m => {
      if (m.region === region && m.loc) {
        locs.add(m.loc);
      }
    });
    return Array.from(locs);
  }, [region, members]);

  // ★ 선택한 지역에 속한 매니저 목록
  const availableManagers = useMemo(() => {
    let list = members;
    if (region) {
      list = list.filter(m => m.region === region);
    }
    if (loc) {
      list = list.filter(m => m.loc === loc);
    }
    if (managerSearch) {
      const s = managerSearch.toLowerCase();
      list = list.filter(m => 
        (m.name || "").toLowerCase().includes(s) ||
        (m.name_ko || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [region, loc, managerSearch, members]);

  // ★ 파일 선택
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 크기 체크
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024; // 영상 500MB, 사진 10MB
    
    if (file.size > maxSize) {
      const maxMB = isVideo ? 500 : 10;
      alert(tr(
        `파일이 너무 큽니다. 최대 ${maxMB}MB`,
        `ファイルが大きすぎます。最大 ${maxMB}MB`,
        `File too large. Max ${maxMB}MB`
      ));
      return;
    }

    setMediaFile(file);
    // 미리보기 URL 생성
    const url = URL.createObjectURL(file);
    setMediaPreview({ url, type: isVideo ? "video" : "image" });
  };

  // ★ 미디어 제거
  const handleRemoveMedia = () => {
    if (mediaPreview?.url) {
      URL.revokeObjectURL(mediaPreview.url);
    }
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ★ 등록
  const handleSubmit = async () => {
    // 검증
    if (!mediaFile) {
      alert(tr("사진 또는 영상을 첨부해주세요.", "写真または動画を添付してください。", "Please attach a photo or video."));
      return;
    }
    if (!region) {
      alert(tr("지역을 선택해주세요.", "地域を選択してください。", "Please select a region."));
      return;
    }
    if (!content.trim() || content.trim().length < 10) {
      alert(tr("후기를 10자 이상 작성해주세요.", "レビューを10文字以上作成してください。", "Please write at least 10 characters."));
      return;
    }
    if (!user?.id) {
      alert(tr("로그인 후 이용 가능합니다.", "ログイン後にご利用ください。", "Login required."));
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // 1. 파일 업로드 (자동 분기: 영상=R2, 사진=Cloudinary)
      let mediaUrl;
      let thumbnailUrl = null;
      if (isVideoFile(mediaFile)) {
        // 썸네일 먼저 생성 (실패해도 후기 등록은 계속 진행)
        try {
          const thumbFile = await generateVideoThumbnail(mediaFile);
          if (thumbFile) thumbnailUrl = await uploadToCloudinary(thumbFile);
        } catch (thumbErr) {
          console.warn("썸네일 생성/업로드 실패 (영상만 등록):", thumbErr);
        }
        mediaUrl = await uploadToR2(mediaFile, (percent) => {
          setUploadProgress(percent);
        });
      } else {
        setUploadProgress(50); // 사진은 진행률 없어서 임의로
        mediaUrl = await uploadToCloudinary(mediaFile);
        setUploadProgress(100);
      }

      // 2. Firestore에 후기 저장
      await authReady;
      await addDoc(collection(db, "reviews"), {
        userId: user.id,
        userNickname: user.nickname || user.name || user.id,
        mediaUrl,
        thumbnailUrl, // ★ 영상일 때만 값 있음 (사진은 null)
        mediaType: isVideoFile(mediaFile) ? "video" : "image",
        region,
        loc: loc || region,
        managerName: selectedManager?.name_ko || selectedManager?.name || null,
        managerId: selectedManager?.id || null,
        rating,
        content: content.trim(),
        likeCount: 0,
        likedBy: [],
        commentCount: 0,
        createdAt: Date.now(),
        createdAtServer: serverTimestamp(),
      });

      alert(tr("후기가 등록되었습니다! 감사합니다 ✨", "レビューが登録されました!ありがとうございます ✨", "Review posted! Thank you ✨"));
      onClose();
    } catch (e) {
      console.error("후기 등록 실패:", e);
      alert(tr(
        `등록 실패: ${e.message}`,
        `登録失敗: ${e.message}`,
        `Failed: ${e.message}`
      ));
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ============================================
  // STEP 1: 미디어 선택
  // ============================================
  if (step === 1) {
    return (
      <div style={w.overlay} onClick={onClose}>
        <div style={w.modal} onClick={e => e.stopPropagation()}>
          <div style={w.header}>
            <button style={w.closeBtn} onClick={onClose}>✕</button>
            <div style={w.headerTitle}>
              {tr("후기 작성", "レビュー作成", "Write Review")}
            </div>
            <div style={{width: 30}}></div>
          </div>

          <div style={w.stepIndicator}>
            <div style={w.stepDotActive}>1</div>
            <div style={w.stepLine}></div>
            <div style={w.stepDot}>2</div>
          </div>

          <div style={w.body}>
            <div style={w.stepTitle}>
              📷 {tr("사진 또는 영상을 선택해주세요", "写真または動画を選択してください", "Select a photo or video")}
            </div>
            <div style={w.stepDesc}>
              {tr(
                "사진 최대 10MB, 영상 최대 500MB",
                "写真は最大10MB、動画は最大500MB",
                "Photos up to 10MB, Videos up to 500MB"
              )}
            </div>

            {!mediaPreview ? (
              <div 
                style={w.uploadBox}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={w.uploadIcon}>📁</div>
                <div style={w.uploadText}>
                  {tr("클릭하여 파일 선택", "クリックしてファイル選択", "Click to select file")}
                </div>
                <div style={w.uploadSub}>
                  JPG · PNG · GIF · MP4 · MOV · WebM
                </div>
              </div>
            ) : (
              <div style={w.previewWrap}>
                {mediaPreview.type === "video" ? (
                  <video 
                    src={mediaPreview.url} 
                    style={w.previewMedia} 
                    controls 
                    playsInline 
                  />
                ) : (
                  <img 
                    src={mediaPreview.url} 
                    style={w.previewMedia} 
                    alt="preview" 
                  />
                )}
                <button style={w.removeMediaBtn} onClick={handleRemoveMedia}>
                  ✕ {tr("삭제", "削除", "Remove")}
                </button>
              </div>
            )}

            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{display: 'none'}}
            />
          </div>

          <div style={w.footer}>
            <button 
              style={{
                ...w.nextBtn,
                opacity: mediaFile ? 1 : 0.4,
                pointerEvents: mediaFile ? 'auto' : 'none'
              }}
              onClick={() => setStep(2)}
            >
              {tr("다음", "次へ", "NEXT")} ❯
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // STEP 2: 정보 입력
  // ============================================
  return (
    <div style={w.overlay} onClick={uploading ? null : onClose}>
      <div style={w.modal} onClick={e => e.stopPropagation()}>
        <div style={w.header}>
          <button style={w.closeBtn} onClick={() => !uploading && setStep(1)}>❮</button>
          <div style={w.headerTitle}>
            {tr("후기 작성", "レビュー作成", "Write Review")}
          </div>
          <div style={{width: 30}}></div>
        </div>

        <div style={w.stepIndicator}>
          <div style={w.stepDotDone}>✓</div>
          <div style={w.stepLineActive}></div>
          <div style={w.stepDotActive}>2</div>
        </div>

        <div style={w.body}>
          {/* 미디어 미리보기 (작게) */}
          <div style={w.smallPreview}>
            {mediaPreview.type === "video" ? (
              <video src={mediaPreview.url} style={w.smallPreviewMedia} muted playsInline />
            ) : (
              <img src={mediaPreview.url} style={w.smallPreviewMedia} alt="preview" />
            )}
          </div>

          {/* 지역 (광역) - 필수 */}
          <div style={w.field}>
            <label style={w.label}>
              📍 {tr("지역 선택", "地域選択", "Region")} 
              <span style={w.required}>*</span>
            </label>
            <div style={w.regionScroll}>
              {regionFilters.filter(r => r !== "전체").map(r => (
                <div 
                  key={r}
                  onClick={() => { setRegion(r); setLoc(""); setSelectedManager(null); }}
                  style={{
                    ...w.regionChip,
                    background: region === r ? '#D4AF37' : 'transparent',
                    color: region === r ? '#000' : '#888',
                    borderColor: region === r ? '#D4AF37' : '#333'
                  }}
                >
                  {getRegionName(r)}
                </div>
              ))}
            </div>
          </div>

          {/* 시군구 (선택) */}
          {region && availableLocs.length > 0 && (
            <div style={w.field}>
              <label style={w.label}>
                🏙️ {tr("세부 지역", "詳細地域", "Sub-region")}
              </label>
              <div style={w.regionScroll}>
                {availableLocs.map(l => (
                  <div 
                    key={l}
                    onClick={() => setLoc(l === loc ? "" : l)}
                    style={{
                      ...w.regionChip,
                      background: loc === l ? '#D4AF37' : 'transparent',
                      color: loc === l ? '#000' : '#888',
                      borderColor: loc === l ? '#D4AF37' : '#333'
                    }}
                  >
                    {getRegionName(l)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 별점 */}
          <div style={w.field}>
            <label style={w.label}>
              ⭐ {tr("평점", "評価", "Rating")}
            </label>
            <div style={w.ratingRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <div 
                  key={n}
                  onClick={() => setRating(n)}
                  style={{
                    ...w.star,
                    color: n <= rating ? '#FFD700' : '#333',
                    fontSize: 32,
                  }}
                >
                  ★
                </div>
              ))}
            </div>
          </div>

          {/* 후기 텍스트 */}
          <div style={w.field}>
            <label style={w.label}>
              📝 {tr("후기 내용", "レビュー内容", "Review Content")}
              <span style={w.required}>*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={tr(
                "만남에 대한 솔직한 후기를 남겨주세요 (10자 이상)",
                "率直なレビューをお願いします (10文字以上)",
                "Please share your honest review (min 10 chars)"
              )}
              style={w.textarea}
              maxLength={500}
            />
            <div style={w.charCount}>
              {content.trim().length < 10 && (
                <span style={{ color: '#ff9800', marginRight: 8 }}>
                  {tr("10자 이상 입력해주세요", "10文字以上入力してください", "At least 10 characters")}
                </span>
              )}
              {content.length} / 500
            </div>
          </div>

          {/* 익명 안내 */}
          <div style={w.anonNotice}>
            🔒 {tr(
              "닉네임은 자동으로 별표(*) 처리됩니다.",
              "ニックネームは自動的にマスク処理されます。",
              "Your nickname will be automatically masked."
            )}
          </div>
        </div>

        {/* 업로드 진행률 */}
        {uploading && (
          <div style={w.uploadingOverlay}>
            <div style={w.uploadingBox}>
              <div className="upload-spinner" />
              <div style={w.uploadingText}>
                {tr("업로드 중...", "アップロード中...", "Uploading...")}
              </div>
              <div style={w.progressBar}>
                <div style={{...w.progressFill, width: `${uploadProgress}%`}}></div>
              </div>
              <div style={w.progressText}>{uploadProgress}%</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={w.footer}>
          <button 
            style={{
              ...w.submitBtn,
              opacity: (region && content.trim().length >= 10 && !uploading) ? 1 : 0.4,
              pointerEvents: (region && content.trim().length >= 10 && !uploading) ? 'auto' : 'none'
            }}
            onClick={handleSubmit}
          >
            ✨ {tr("후기 등록", "レビュー登録", "POST REVIEW")}
          </button>
        </div>

        {/* 매니저 선택 팝업 */}
        {showManagerPicker && (
          <div style={w.pickerOverlay} onClick={() => setShowManagerPicker(false)}>
            <div style={w.pickerModal} onClick={e => e.stopPropagation()}>
              <div style={w.pickerHeader}>
                <button style={w.closeBtn} onClick={() => setShowManagerPicker(false)}>✕</button>
                <div style={w.headerTitle}>
                  {tr("매니저 선택", "マネージャー選択", "Choose Manager")}
                </div>
                <div style={{width: 30}}></div>
              </div>

              <div style={w.searchWrap}>
                <input
                  type="text"
                  placeholder={tr("이름 검색...", "名前検索...", "Search name...")}
                  value={managerSearch}
                  onChange={e => setManagerSearch(e.target.value)}
                  style={w.searchInput}
                />
              </div>

              <div style={w.managerList}>
                {availableManagers.length === 0 ? (
                  <div style={w.noManagers}>
                    {tr(
                      "해당 지역의 매니저가 없습니다.",
                      "この地域のマネージャーはいません。",
                      "No managers in this region."
                    )}
                  </div>
                ) : (
                  availableManagers.map(m => (
                    <div 
                      key={m.id || m.name}
                      style={w.managerItem}
                      onClick={() => {
                        setSelectedManager(m);
                        setShowManagerPicker(false);
                      }}
                    >
                      <img src={m.img} style={w.managerImg} alt="" />
                      <div style={w.managerInfo}>
                        <div style={w.managerName}>{m.name_ko || m.name}</div>
                        <div style={w.managerMeta}>
                          {getRegionName(m.loc || m.region)} · {m.age ? `${m.age}세` : ''}
                        </div>
                      </div>
                      <div style={w.managerArrow}>❯</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .upload-spinner { 
          width: 40px; height: 40px; 
          border: 4px solid #333; border-top: 4px solid #D4AF37; 
          border-radius: 50%; 
          animation: spin 0.8s linear infinite; 
          margin: 0 auto 15px; 
        }
      `}</style>
    </div>
  );
}

// =========================================================================
// 스타일
// =========================================================================
const w = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.9)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    height: '92vh',
    background: '#0f0f0f',
    borderRadius: '24px 24px 0 0',
    border: '1px solid #222',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  header: {
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1a1a1a',
  },
  closeBtn: {
    width: 30, height: 30,
    background: 'transparent',
    color: '#fff',
    border: 'none',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 1,
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '15px 0',
    gap: 8,
    borderBottom: '1px solid #1a1a1a',
  },
  stepDot: {
    width: 26, height: 26,
    borderRadius: '50%',
    background: '#222',
    color: '#666',
    fontSize: 12,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    width: 26, height: 26,
    borderRadius: '50%',
    background: '#D4AF37',
    color: '#000',
    fontSize: 12,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    width: 26, height: 26,
    borderRadius: '50%',
    background: '#0F9D58',
    color: '#fff',
    fontSize: 12,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 40, height: 2,
    background: '#222',
  },
  stepLineActive: {
    width: 40, height: 2,
    background: '#D4AF37',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  stepTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 6,
  },
  stepDesc: {
    color: '#888',
    fontSize: 12,
    marginBottom: 25,
  },
  uploadBox: {
    border: '2px dashed #333',
    borderRadius: 16,
    padding: '60px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  uploadIcon: {
    fontSize: 50,
    marginBottom: 15,
    opacity: 0.5,
  },
  uploadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
  },
  uploadSub: {
    color: '#555',
    fontSize: 11,
  },
  previewWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    background: '#000',
  },
  previewMedia: {
    width: '100%',
    maxHeight: '50vh',
    objectFit: 'contain',
    display: 'block',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 12, right: 12,
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  smallPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    background: '#000',
    marginBottom: 20,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  smallPreviewMedia: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  field: {
    marginBottom: 22,
  },
  label: {
    display: 'block',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  required: {
    color: '#ff4444',
    marginLeft: 4,
  },
  optional: {
    color: '#666',
    fontSize: 11,
    marginLeft: 6,
    fontWeight: 500,
  },
  regionScroll: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  regionChip: {
    padding: '7px 14px',
    borderRadius: 20,
    border: '1px solid #333',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  pickManagerBtn: {
    width: '100%',
    padding: '14px',
    background: '#1a1a1a',
    color: '#D4AF37',
    border: '1px dashed #D4AF37',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  selectedManagerBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    background: 'rgba(212, 175, 55, 0.08)',
    border: '1px solid #D4AF37',
    borderRadius: 12,
  },
  selectedManagerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  selectedManagerImg: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #D4AF37',
  },
  selectedManagerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 2,
  },
  selectedManagerLoc: {
    color: '#D4AF37',
    fontSize: 11,
  },
  removeManagerBtn: {
    width: 30, height: 30,
    background: 'transparent',
    color: '#888',
    border: '1px solid #333',
    borderRadius: '50%',
    fontSize: 12,
    cursor: 'pointer',
  },
  ratingRow: {
    display: 'flex',
    gap: 6,
  },
  star: {
    cursor: 'pointer',
    transition: 'transform 0.15s',
  },
  textarea: {
    width: '100%',
    minHeight: 100,
    padding: 14,
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    outline: 'none',
  },
  charCount: {
    color: '#666',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  anonNotice: {
    padding: 12,
    background: 'rgba(0, 136, 204, 0.08)',
    border: '1px solid rgba(0, 136, 204, 0.3)',
    borderRadius: 10,
    color: '#66b3ff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  footer: {
    padding: 20,
    borderTop: '1px solid #1a1a1a',
    background: '#0f0f0f',
  },
  nextBtn: {
    width: '100%',
    padding: 16,
    background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
    color: '#000',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    letterSpacing: 1,
  },
  submitBtn: {
    width: '100%',
    padding: 16,
    background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
    color: '#000',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    letterSpacing: 1,
  },
  uploadingOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(6px)',
  },
  uploadingBox: {
    background: '#1a1a1a',
    padding: 30,
    borderRadius: 20,
    border: '1px solid #D4AF37',
    textAlign: 'center',
    minWidth: 260,
  },
  uploadingText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 15,
  },
  progressBar: {
    width: '100%',
    height: 6,
    background: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #D4AF37, #B8860B)',
    transition: 'width 0.3s',
  },
  progressText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
  },
  // 매니저 선택 팝업
  pickerOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.9)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  },
  pickerModal: {
    width: '100%',
    height: '80%',
    background: '#0f0f0f',
    borderRadius: '24px 24px 0 0',
    border: '1px solid #222',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  pickerHeader: {
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1a1a1a',
  },
  searchWrap: {
    padding: '15px 20px',
    borderBottom: '1px solid #1a1a1a',
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
  },
  managerList: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 20px 30px',
  },
  noManagers: {
    color: '#666',
    textAlign: 'center',
    padding: '40px 20px',
    fontSize: 13,
  },
  managerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 8px',
    borderBottom: '1px solid #1a1a1a',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  managerImg: {
    width: 50,
    height: 50,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid #333',
  },
  managerInfo: {
    flex: 1,
  },
  managerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 3,
  },
  managerMeta: {
    color: '#888',
    fontSize: 11,
  },
  managerArrow: {
    color: '#666',
    fontSize: 14,
  },
};