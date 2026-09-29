// =========================================================================
// 🎯 CloudinaryService.js - Cloudinary 사진 업로드 헬퍼
// -------------------------------------------------------------------------
// ★ 용도: 사진만 업로드 (프로필, 슬라이드, 광고 이미지 등)
// ★ 동영상은 R2Service.js 사용!
// =========================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function uploadToCloudinary(file) {
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // ===== 1. 기본 검증 =====
  if (!file) throw new Error("업로드 파일이 없습니다.");
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary env 누락");
  }

  // ===== 2. 파일 크기 검증 =====
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`파일이 너무 큽니다 (${sizeMB}MB). 최대 10MB까지 업로드 가능합니다.`);
  }

  // ===== 3. 파일 타입 검증 (사진만) =====
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      `사진 파일만 업로드 가능합니다 (JPG, PNG, WebP, GIF). 동영상은 별도 업로드를 이용해주세요.`
    );
  }

  // ===== 4. 업로드 실행 =====
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  let res;
  try {
    res = await fetch(url, { method: "POST", body: formData });
  } catch (e) {
    throw new Error("네트워크 오류 (연결 확인 필요)");
  }

  const rawText = await res.text();

  if (import.meta.env.DEV) {
    console.log("Cloudinary RESPONSE:", res.status, rawText);
  }

  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch (_) {}

  if (!res.ok) {
    throw new Error(data?.error?.message || `업로드 실패 (${res.status})`);
  }

  if (!data?.secure_url) {
    throw new Error("secure_url 없음");
  }

  return data.secure_url;
}