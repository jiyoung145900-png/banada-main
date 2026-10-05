import { useEffect, useState, useCallback, useMemo } from "react";
import { db, authReady } from "./firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import LandingPage from "./LandingPage";
import IntroAnimation from "./IntroAnimation";
import WelcomeAnimation from "./WelcomeAnimation";
import Dashboard from "./Dashboard";
import { validateUserId, validatePassword, validateNickname, sanitizeText } from "./validation";

// [Core] Broadcast channel
const broadcast = new BroadcastChannel('banada_global_channel');

const REGIONS = ["서울", "경기 북부", "경기 남부", "인천", "충청", "강원", "전라", "경북·대구", "부산·울산·경남", "제주"];

// --- [Utility] ---
const load = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    if (!v) return d;
    const parsed = JSON.parse(v);
    return parsed === null ? d : parsed;
  } catch { return d; }
};

const save = (k, v) => {
  try {
    if (v === undefined) return;
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    if (e.name === 'QuotaExceededError') alert("Storage quota exceeded!");
  }
};

// ★ Translations - 3개 언어 지원 (한국어/영어/일본어)
// ★ [수정] video → review 로 변경
const translations = {
  ko: { 
    login: "로그인", signup: "회원가입", id: "아이디", pw: "비밀번호", ref: "추천인 코드", 
    guest: "게스트로 시작", logout: "로그아웃", 
    home: "홈페이지", manager: "매니저", event: "이벤트", review: "후기", mypage: "마이페이지", 
    welcome: "📢 BANADA에 오신 것을 환영합니다!", 
    desc_suffix: " 화면입니다.", prepare: "컨텐츠 준비 중입니다.", close: "닫기", 
    input_id_pw: "아이디와 비밀번호를 입력하세요.", 
    id_exists: "이미 존재하는 아이디입니다.", 
    signup_ok: "가입이 완료되었습니다!", 
    login_fail: "로그인 정보가 틀립니다." 
  },
  en: { 
    login: "LOGIN", signup: "SIGN UP", id: "ID", pw: "PASSWORD", ref: "REFERRAL CODE", 
    guest: "START AS GUEST", logout: "LOGOUT", 
    home: "HOME", manager: "MODELS", event: "GAMES", review: "REVIEWS", mypage: "MY PAGE", 
    welcome: "📢 Welcome to BANADA!", 
    desc_suffix: " Page Content.", prepare: "Coming Soon.", close: "CLOSE", 
    input_id_pw: "Please enter ID and Password.", 
    id_exists: "ID already exists.", 
    signup_ok: "Sign up successful!", 
    login_fail: "Login Failed" 
  },
  ja: { 
    login: "ログイン", signup: "会員登録", id: "ID", pw: "パスワード", ref: "招待コード", 
    guest: "ゲストで始める", logout: "ログアウト", 
    home: "ホーム", manager: "マネージャー", event: "イベント", review: "レビュー", mypage: "マイページ", 
    welcome: "📢 BANADAへようこそ!", 
    desc_suffix: " ページ内容", prepare: "準備中です。", close: "閉じる", 
    input_id_pw: "IDとパスワードを入力してください。", 
    id_exists: "既に存在するIDです。", 
    signup_ok: "登録が完了しました!", 
    login_fail: "ログイン情報が間違っています。" 
  }
};

export default function App() {
  const [lang, setLang] = useState(() => load("lang", "ko"));
  const [loggedIn, setLoggedIn] = useState(() => load("loggedIn", false));
  const [isGuest, setIsGuest] = useState(() => load("isGuest", false));
  const [users, setUsers] = useState(() => load("users", []));
  const [currentUser, setCurrentUser] = useState(() => load("currentUser", null));

  const [appAvatarImage, setAppAvatarImage] = useState(null);
  const [appAvatarIdx, setAppAvatarIdx] = useState(0);

  const [telegramLink, setTelegramLink] = useState(() => load("telegramLink", "https://t.me/BANADA_OFFICIAL"));
  const [showPopup, setShowPopup] = useState(true);
  const [hero, setHero] = useState(() => load("hero", { mode: "image", imageSrc: null, title: { ko: "", en: "" }, desc: { ko: "", en: "" } }));
  const [members, setMembers] = useState(() => load("members", []));
  const [slideImages, setSlideImages] = useState(() => load("slideImages", []));
  const [slideImagesJa, setSlideImagesJa] = useState(() => load("slideImages_ja", []));
  const [slideImagesEn, setSlideImagesEn] = useState(() => load("slideImages_en", []));
  // ★ [제거] videos, videoURL 관련 state 제거 (후기 섹션은 Firestore 직접 사용)
  const [showIntro, setShowIntro] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [logo, setLogo] = useState(() => load("logo", null));
  const [logoSize, setLogoSize] = useState(() => load("logoSize", 140));
  const [logoPos, setLogoPos] = useState(() => load("logoPos", { x: 0, y: 0 }));
  const [innerLogo, setInnerLogo] = useState(() => load("innerLogo", null));
  const [topAdImage, setTopAdImage] = useState(() => load("topAdImage", null));
  const [topAdImage2, setTopAdImage2] = useState(() => load("topAdImage2", null));
  const [topAdImageJa, setTopAdImageJa] = useState(() => load("topAdImage_ja", null));
  const [topAdImage2Ja, setTopAdImage2Ja] = useState(() => load("topAdImage2_ja", null));
  const [topAdImageEn, setTopAdImageEn] = useState(() => load("topAdImage_en", null));
  const [topAdImage2En, setTopAdImage2En] = useState(() => load("topAdImage2_en", null));

  const [noticeText, setNoticeText] = useState(() => load("noticeText", "📢 BANADA에 오신 것을 환영합니다!"));
  // ★ [신규] 후기 작성 가능 추천코드 (Admin에서 설정)
  const [reviewAccessCode, setReviewAccessCode] = useState(() => load("reviewAccessCode", ""));

  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  const t = useMemo(() => translations[lang] || translations.ko, [lang]);

  // ★ [신규] 실시간 차단 감지
  useEffect(() => {
    if (!loggedIn || !currentUser?.id || isGuest) return;

    const userRef = doc(db, "users", currentUser.id);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        if (data.banned === true) {
          const reason = data.bannedReason
            ? `\n\n사유: ${data.bannedReason}`
            : "";
          alert(
            `🚫 관리자에 의해 접속이 차단되었습니다.${reason}\n\n관리자에게 문의해주세요.`
          );

          setLoggedIn(false);
          setCurrentUser(null);
          setIsGuest(false);

          try {
            localStorage.removeItem("currentUser");
            localStorage.removeItem("loggedIn");
          } catch (e) {}

          setTimeout(() => window.location.reload(), 500);
        }
      },
      (err) => {
        console.warn("차단 감지 리스너 에러:", err);
      }
    );

    return () => unsub();
  }, [loggedIn, currentUser?.id, isGuest]);

  // ★ 온라인/오프라인 감지
  useEffect(() => {
    let checkTimer = null;
    
    const verifyConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch('https://www.google.com/generate_204', { 
          method: 'HEAD', 
          mode: 'no-cors',
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        return true;
      } catch (e) {
        return false;
      }
    };

    const handleOnline = async () => {
      const reallyOnline = await verifyConnection();
      if (reallyOnline) {
        setIsOnline(true);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };
    
    const handleOffline = async () => {
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(async () => {
        const reallyOnline = await verifyConnection();
        if (!reallyOnline) {
          setIsOnline(false);
          setShowReconnected(false);
        }
      }, 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, []);

  // ★ Firebase Realtime Listener (Global Settings)
  useEffect(() => {
    let unsub = () => {};
    
    authReady.then(() => {
      unsub = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.hero) setHero(data.hero);
          if (data.logo !== undefined) setLogo(data.logo);
          if (data.logoSize) setLogoSize(data.logoSize);
          if (data.logoPos) setLogoPos(data.logoPos);
          if (data.members) setMembers(data.members);
          if (data.slideImages) setSlideImages(data.slideImages);
          if (data.slideImages_ja) setSlideImagesJa(data.slideImages_ja);
          if (data.slideImages_en) setSlideImagesEn(data.slideImages_en);
          // ★ [제거] videos 관련 필드 제거
          if (data.innerLogo !== undefined) setInnerLogo(data.innerLogo);
          if (data.topAdImage !== undefined) setTopAdImage(data.topAdImage);
          if (data.topAdImage2 !== undefined) setTopAdImage2(data.topAdImage2);
          if (data.topAdImage_ja !== undefined) setTopAdImageJa(data.topAdImage_ja);
          if (data.topAdImage2_ja !== undefined) setTopAdImage2Ja(data.topAdImage2_ja);
          if (data.topAdImage_en !== undefined) setTopAdImageEn(data.topAdImage_en);
          if (data.topAdImage2_en !== undefined) setTopAdImage2En(data.topAdImage2_en);
          if (data.telegramLink) setTelegramLink(data.telegramLink);
          if (data.noticeText !== undefined) setNoticeText(data.noticeText);
          if (data.reviewAccessCode !== undefined) setReviewAccessCode(data.reviewAccessCode); // ★ [신규]
        }
      });
    });
    
    return () => unsub();
  }, []);

  // ★ Sync Function
  const syncToFirebase = async (updates) => {
    try {
      await authReady; 
      const finalData = {
        hero, logo, logoSize, logoPos,
        members, slideImages, innerLogo, topAdImage, topAdImage2,
        telegramLink, noticeText,
        ...updates
      };
      await setDoc(doc(db, "settings", "global"), finalData, { merge: true });
      return true;
    } catch (e) {
      console.error("▶ Sync Failed:", e);
      return false;
    }
  };

  const syncUpdate = useCallback((targetId, newPoint, newRefCode, newReferral) => {
    setUsers(prev => prev.map(u => u.id === targetId ? { ...u, diamond: newPoint, refCode: newRefCode, referral: newReferral } : u));
    setCurrentUser(prev => (prev?.id === targetId ? { ...prev, diamond: newPoint, refCode: newRefCode, referral: newReferral } : prev));
  }, []);

  // External Broadcast/Listener
  useEffect(() => {
    broadcast.onmessage = (event) => {
      const { type, userId, point, refCode, referral } = event.data || {};
      if ((type === 'USER_UPDATE' || type === 'POINT_UPDATE') && userId) {
        syncUpdate(userId, point, refCode, referral);
      }
    };
    const handleLocalUpdate = (e) => {
      const { userId, point, refCode, referral } = e.detail || {};
      if (userId) syncUpdate(userId, point, refCode, referral);
    };
    window.addEventListener("user_point_update", handleLocalUpdate);
    return () => window.removeEventListener("user_point_update", handleLocalUpdate);
  }, [syncUpdate]);

  // Local Storage Auto-Save
  useEffect(() => {
    save("lang", lang); save("loggedIn", loggedIn);
    save("isGuest", isGuest); save("users", users); save("currentUser", currentUser);
    save("members", members); save("hero", hero); save("logo", logo);
    save("logoSize", logoSize); save("logoPos", logoPos); save("slideImages", slideImages);
    save("innerLogo", innerLogo);
    save("telegramLink", telegramLink); save("noticeText", noticeText);
  }, [lang, loggedIn, isGuest, users, currentUser, hero, logo, logoSize, logoPos, members, slideImages, innerLogo, telegramLink, noticeText]);

  // ★ 로그인 액션
  const handleLoginAction = async (id, pw) => {
    if (id === "admin" || id === "game") {
      return alert(t.login_fail || "존재하지 않는 아이디입니다.");
    }

    try {
      await authReady;
      const userRef = doc(db, "users", id);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.banned === true) {
          const reason = userData.bannedReason
            ? `\n\n사유: ${userData.bannedReason}`
            : "";
          alert(`🚫 접속이 차단된 회원입니다.${reason}\n\n관리자에게 문의해주세요.`);
          return;
        }

        if (userData.password === pw) {
          setCurrentUser(userData);
          setLoggedIn(true);
          setIsGuest(false);
          setShowWelcome(true);
          
          try {
            updateDoc(userRef, { lastActive: Date.now() });
          } catch (histErr) {}
        } else {
          alert(t.login_fail || "비밀번호가 일치하지 않습니다.");
        }
      } else {
        const localUser = users.find(u => u.id === id && u.pw === pw);
        if (localUser) {
          await setDoc(doc(db, "users", id), localUser, { merge: true });
          setCurrentUser(localUser);
          setLoggedIn(true);
          setIsGuest(false);
          setShowWelcome(true);
        } else {
          alert(t.login_fail || "존재하지 않는 아이디입니다.");
        }
      }
    } catch (e) {
      console.error(e);
      alert("Login Error");
    }
  };

  // ★ 회원가입 액션
  const handleSignupAction = async (id, pw, nickname, referralCode) => {
    if (!id || !pw) return alert(t.input_id_pw || "ID/PW Required");

    const idCheck = validateUserId(id);
    if (!idCheck.ok) return alert(idCheck.reason);
    const pwCheck = validatePassword(pw);
    if (!pwCheck.ok) return alert(pwCheck.reason);
    const nickCheck = validateNickname(nickname || id);
    if (!nickCheck.ok) return alert(nickCheck.reason);

    try {
      await authReady;
      const cleanId = idCheck.value;
      const cleanPw = pwCheck.value;
      const cleanNick = nickCheck.value;
      const cleanRef = sanitizeText(referralCode || "", 30);

      const userRef = doc(db, "users", cleanId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        alert(t.id_exists || "ID exists");
        return;
      }

      let referralOwnerId = "";
      if (cleanRef) {
        const q = query(collection(db, "users"), where("refCode", "==", cleanRef));
        const snap = await getDocs(q);
        if (!snap.empty) referralOwnerId = snap.docs[0].id;
      }

      const newUser = {
        id: cleanId,
        password: cleanPw,
        nickname: cleanNick,
        refCode: cleanId.toUpperCase(),
        referral: referralOwnerId,
        referralCode: cleanRef,
        diamond: 0,
        rewards: 0,
        lastActive: Date.now(),
        createdAt: new Date().toISOString(),
      };

      await setDoc(userRef, newUser);
      setUsers((prev) => [...prev, newUser]);
      alert(t.signup_ok || "Sign up successful!");
    } catch (e) {
      console.error(e);
      alert("Signup Error");
    }
  };

  const handleLogout = () => {
    setLoggedIn(false); setIsGuest(false);
    setCurrentUser(null);
  };

  const refreshAvatar = (newImg, newIdx) => {
    setAppAvatarImage(newImg); 
    setAppAvatarIdx(newIdx);
    
    setCurrentUser(prev => {
      if (!prev) return prev;
      const updated = { 
        ...prev, 
        avatar: { image: newImg, idx: newIdx } 
      };
      save("currentUser", updated);
      return updated;
    });
  };

  useEffect(() => {
    if (currentUser?.avatar) {
      const { image, idx } = currentUser.avatar;
      if (image !== undefined) setAppAvatarImage(image);
      if (idx !== undefined && idx !== null) setAppAvatarIdx(idx);
    }
  }, [currentUser?.id, currentUser?.avatar]);

  const actualLoggedIn = loggedIn && currentUser;
  const showLanding = !actualLoggedIn;

  return (
    <div style={{ ...styles.app, height: '100vh', overflow: 'hidden' }}>

      {showIntro && (
        <IntroAnimation 
          logo={logo} 
          onComplete={() => setShowIntro(false)} 
        />
      )}

      {showWelcome && (
        <WelcomeAnimation 
          user={currentUser} 
          onComplete={() => setShowWelcome(false)} 
        />
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {!isOnline && (
        <div style={styles.offlineBanner}>
          <span style={styles.offlineIcon}>📶</span>
          <span>{lang === "ko" 
            ? "인터넷 연결이 끊어졌습니다. 연결을 확인해주세요." 
            : lang === "ja"
            ? "インターネット接続が切れました。接続を確認してください。"
            : "You're offline. Please check your connection."}</span>
        </div>
      )}
      
      {showReconnected && isOnline && (
        <div style={styles.onlineBanner}>
          <span style={styles.onlineIcon}>✅</span>
          <span>{lang === "ko" 
            ? "다시 연결되었습니다!" 
            : lang === "ja"
            ? "再接続されました!"
            : "Back online!"}</span>
        </div>
      )}

      {showPopup && actualLoggedIn && !showLanding && (
        <div style={styles.popupOverlay}>
          <div style={styles.popupContent}>
            <h2 style={{ color: '#ffb347', marginBottom: '15px' }}>NOTICE</h2>
            <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '25px' }}>최상의 서비스를 제공하겠습니다.</p>
            <button onClick={() => setShowPopup(false)} style={styles.popupBtn}>{t.close}</button>
          </div>
        </div>
      )}

      {showLanding ? (
        <div style={{ height: '100%', overflowY: 'auto' }}>
          <LandingPage
            t={t} lang={lang} users={users} setUsers={setUsers} hero={hero}
            logo={logo} logoSize={logoSize} logoPos={logoPos} styles={styles} isAdmin={false}
            setLang={setLang}
            onLogin={handleLoginAction}
            onSignup={handleSignupAction}
            onGuestLogin={() => {
              const guestUser = { id: "GUEST", no: "G-1", diamond: 0, rewards: 0, refCode: "" };
              setCurrentUser(guestUser);
              setLoggedIn(true); setIsGuest(true);
            }}
            syncToFirebase={syncToFirebase}
          />
        </div>
      ) : (
        <Dashboard
          user={currentUser}
          onUpdatePoint={(newVal) => syncUpdate(currentUser.id, newVal, currentUser.refCode, currentUser.referral)}
          appAvatarImage={appAvatarImage} appAvatarIdx={appAvatarIdx} onAvatarChange={refreshAvatar}
          t={t} lang={lang} isGuest={isGuest} members={members} regions={REGIONS}
          slideImages={lang === 'ja' && slideImagesJa?.length ? slideImagesJa : lang === 'en' && slideImagesEn?.length ? slideImagesEn : slideImages}
          innerLogo={innerLogo}
          topAdImage={lang === 'ja' && topAdImageJa ? topAdImageJa : lang === 'en' && topAdImageEn ? topAdImageEn : topAdImage}
          topAdImage2={lang === 'ja' && topAdImage2Ja ? topAdImage2Ja : lang === 'en' && topAdImage2En ? topAdImage2En : topAdImage2}
          telegramLink={telegramLink}
          noticeText={noticeText}
          reviewAccessCode={reviewAccessCode} // ★ [신규] 후기 작성 추천코드
          onLogout={handleLogout} dashStyles={dashStyles}
        />
      )}

      {showLanding && (
        <header style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 10002,
          display: 'flex',
          gap: '8px',
          padding: '6px 10px',
          background: 'rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(201, 149, 105, 0.3)',
          borderRadius: '999px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}>
          {[
            { code: 'ko', flag: '/flags/kr.png', label: '한국어' },
            { code: 'ja', flag: '/flags/jp.png', label: '日本語' },
            { code: 'en', flag: '/flags/uk.png', label: 'English' },
          ].map((item) => (
            <button
              key={item.code}
              onClick={() => setLang(item.code)}
              title={item.label}
              style={{
                width: '36px',
                height: '24px',
                padding: 0,
                border: lang === item.code ? '2px solid #E4B689' : '2px solid transparent',
                borderRadius: '4px',
                background: `url(${item.flag}) center/cover no-repeat`,
                cursor: 'pointer',
                opacity: lang === item.code ? 1 : 0.55,
                transition: 'all 0.25s ease',
                boxShadow: lang === item.code ? '0 2px 12px rgba(228, 182, 137, 0.6)' : 'none',
                transform: lang === item.code ? 'scale(1.1)' : 'scale(1)',
              }}
              onMouseEnter={(e) => {
                if (lang !== item.code) {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (lang !== item.code) {
                  e.currentTarget.style.opacity = '0.55';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            />
          ))}
        </header>
      )}
    </div>
  );
}

const styles = {
  app: { width: "100%", background: "#000", fontFamily: "'Inter', sans-serif", color: '#fff', position: 'relative' },
  bgWrap: { position: "fixed", inset: 0, zIndex: 0 },
  bgOverlay: { position: 'absolute', inset: 0, background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.6) 100%)', zIndex: 1 },
  bgImage: { width: "100%", height: "100%", backgroundSize: "cover", backgroundPosition: "center" },
  bgVideo: { width: "100%", height: "100%", objectFit: "cover" },
  logoContainer: { position: "absolute", zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' },
  defaultLogo: { fontSize: 32, letterSpacing: 4, fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(255,179,71,0.5)' },
  landingWrapper: { minHeight: '100vh', position: 'relative', zIndex: 1 },
  mainContent: { position: 'relative', zIndex: 5, paddingTop: '15vh' },
  heroSection: { textAlign: "center", marginBottom: 40 },
  mainTitle: { fontSize: '4rem', fontWeight: 900, letterSpacing: -2, margin: 0, color: '#fff' },
  subTitle: { fontSize: '1.2rem', opacity: 0.7, color: '#fff', fontWeight: 300, marginTop: 10 },
  authWrap: { display: "flex", justifyContent: "center", padding: '0 20px' },
  authCard: { width: '100%', maxWidth: 380, padding: 40, borderRadius: 30, background: "rgba(255,255,255,0.05)", backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' },
  authTitle: { textAlign: 'center', marginBottom: 25, fontSize: 24, fontWeight: 700 },
  authInput: { width: "100%", padding: '15px 20px', marginBottom: 15, borderRadius: 15, background: "rgba(255,255,255,0.1)", border: '1px solid rgba(255,255,255,0.1)', color: "#fff", fontSize: 16, boxSizing: 'border-box' },
  primaryBtn: { width: "100%", padding: 15, borderRadius: 15, fontWeight: 700, background: '#fff', color: '#000', border: 'none', cursor: 'pointer', fontSize: 16 },
  guestBtn: { width: "100%", padding: 15, marginTop: 10, borderRadius: 15, background: "transparent", color: "#fff", border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14 },
  authToggle: { marginTop: 20, textAlign: "center", fontSize: 13, opacity: 0.6, cursor: 'pointer', textDecoration: 'underline' },
  langBtn: { padding: "8px 16px", borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontWeight: 600, backdropFilter: 'blur(5px)' },
  popupOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' },
  popupContent: { width: '90%', maxWidth: '350px', backgroundColor: '#111', border: '2px solid #ffb347', borderRadius: '25px', padding: '30px', textAlign: 'center', boxShadow: '0 0 30px rgba(255,179,71,0.4)' },
  popupBtn: { width: '100%', padding: '12px', background: '#ffb347', border: 'none', borderRadius: '12px', fontWeight: 'bold', color: '#000', cursor: 'pointer' },
  offlineBanner: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
    background: 'linear-gradient(90deg, #dc2626, #b91c1c)', color: '#fff',
    padding: '12px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 4px 20px rgba(220,38,38,0.4)', animation: 'slideDown 0.3s ease-out',
  },
  offlineIcon: { fontSize: 18 },
  onlineBanner: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
    background: 'linear-gradient(90deg, #16a34a, #15803d)', color: '#fff',
    padding: '12px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 4px 20px rgba(22,163,74,0.4)', animation: 'slideDown 0.3s ease-out',
  },
  onlineIcon: { fontSize: 18 }
};

const dashStyles = {
  container: {
    position: 'relative', zIndex: 10, width: '100%', maxWidth: 500, margin: '0 auto', background: '#000',
    height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
  },
  contentArea: {
    flex: 1, overflowY: 'auto', paddingBottom: 100, WebkitOverflowScrolling: 'touch'
  },
  bottomNav: {
    position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: '100%', maxWidth: 500, height: 80, background: 'rgba(20,20,20,0.95)',
    display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #222',
    backdropFilter: 'blur(10px)', zIndex: 100,
    transition: 'transform 0.3s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease'
  },
  navItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  logoutBtn: { padding: '12px 30px', borderRadius: 15, background: 'rgba(255,45,85,0.1)', color: '#ff2d55', border: '1px solid #ff2d55', fontWeight: 700, cursor: 'pointer' }
};