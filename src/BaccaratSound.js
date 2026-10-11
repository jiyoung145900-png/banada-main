// ===================================================================
// 🔊 BaccaratSound - 딜러 음성 (TTS) + 사운드 효과
// ===================================================================
// Web Speech API 사용 (브라우저 내장, 무료)
// ===================================================================

let voiceEnabled = true;
let bgmEnabled = true;
let femaleVoice = null;

// 브라우저 음성 로드 (영어 여성 음성 우선)
function loadVoices() {
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  // 영어 여성 음성 우선
  femaleVoice = voices.find(v => 
    v.lang.startsWith("en") && 
    (v.name.toLowerCase().includes("female") || 
     v.name.toLowerCase().includes("samantha") ||
     v.name.toLowerCase().includes("victoria") ||
     v.name.toLowerCase().includes("zira"))
  ) || voices.find(v => v.lang.startsWith("en"));
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// 🎤 딜러 음성 (영어)
export function speak(text) {
  if (!voiceEnabled || !window.speechSynthesis) return;
  try {
    // 이전 음성 중단
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("TTS 실패:", e);
  }
}

// 음성 ON/OFF 토글
export function setVoiceEnabled(enabled) {
  voiceEnabled = enabled;
  if (!enabled && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
export function isVoiceEnabled() { return voiceEnabled; }

// 🎵 BGM (단순 톤 - 사용자가 외부 오디오 파일 추가 시 교체)
let bgmOscillator = null;
let bgmGain = null;
let bgmContext = null;

export function startBGM() {
  if (!bgmEnabled) return;
  try {
    if (!bgmContext) {
      bgmContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    stopBGM();
    bgmOscillator = bgmContext.createOscillator();
    bgmGain = bgmContext.createGain();
    bgmOscillator.type = "sine";
    bgmOscillator.frequency.value = 220;  // A3
    bgmGain.gain.value = 0.015;  // 매우 작게 (앰비언스)
    bgmOscillator.connect(bgmGain);
    bgmGain.connect(bgmContext.destination);
    bgmOscillator.start();
  } catch (e) {}
}

export function stopBGM() {
  try {
    if (bgmOscillator) {
      bgmOscillator.stop();
      bgmOscillator.disconnect();
      bgmOscillator = null;
    }
    if (bgmGain) {
      bgmGain.disconnect();
      bgmGain = null;
    }
  } catch (e) {}
}

export function setBgmEnabled(enabled) {
  bgmEnabled = enabled;
  if (enabled) startBGM();
  else stopBGM();
}
export function isBgmEnabled() { return bgmEnabled; }
