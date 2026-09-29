// =========================================================================
// 🎬 R2Service.js - Cloudflare R2 동영상 업로드 헬퍼
// -------------------------------------------------------------------------
// ★ 용도: 동영상 및 큰 파일 업로드 (후기 섹션 동영상 등)
// ★ 사진은 CloudinaryService.js 사용!
// -------------------------------------------------------------------------
// 프로세스:
//   1. 브라우저 → Vercel API(/api/upload): "업로드용 URL 발급해줘"
//   2. Vercel → 브라우저: 15분 유효한 R2 Presigned URL 발급
//   3. 브라우저 → R2 직접 업로드 (Vercel 안 거침 → 4.5MB 제한 우회)
// =========================================================================

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime", "video/webm",
];

/**
 * R2에 파일 업로드
 * @param {File} file - 업로드할 파일
 * @param {Function} onProgress - 진행률 콜백 (0~100)
 * @returns {Promise<string>} - 업로드된 파일의 공개 URL
 */
export async function uploadToR2(file, onProgress = null) {
  // ===== 1. 기본 검증 =====
  if (!file) throw new Error("업로드 파일이 없습니다.");
  
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`파일이 너무 큽니다 (${sizeMB}MB). 최대 500MB까지 업로드 가능합니다.`);
  }
  
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`지원하지 않는 파일 형식입니다 (${file.type})`);
  }
  
  // ===== 2. Vercel API에서 Presigned URL 발급 =====
  let presignedData;
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Presigned URL 발급 실패 (${res.status})`);
    }
    
    presignedData = await res.json();
  } catch (e) {
    throw new Error(`URL 발급 실패: ${e.message}`);
  }
  
  const { uploadUrl, publicUrl } = presignedData;
  
  if (!uploadUrl || !publicUrl) {
    throw new Error("Presigned URL 응답이 올바르지 않습니다");
  }
  
  // ===== 3. R2에 직접 업로드 (XMLHttpRequest로 진행률 지원) =====
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    
    // 진행률 콜백
    if (onProgress && typeof onProgress === "function") {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 업로드 실패 (${xhr.status})`));
      }
    };
    
    xhr.onerror = () => reject(new Error("네트워크 오류로 업로드 실패"));
    xhr.onabort = () => reject(new Error("업로드가 중단되었습니다"));
    
    xhr.send(file);
  });
  
  if (import.meta.env.DEV) {
    console.log("✅ R2 업로드 완료:", publicUrl);
  }
  
  return publicUrl;
}

/**
 * 파일이 동영상인지 판별
 * @param {File|string} fileOrUrl - 파일 객체 또는 URL 문자열
 */
export function isVideoFile(fileOrUrl) {
  if (!fileOrUrl) return false;
  
  if (typeof fileOrUrl === "string") {
    // URL로 판별
    return /\.(mp4|webm|mov|quicktime|avi)$/i.test(fileOrUrl);
  }
  
  // File 객체로 판별
  return fileOrUrl.type?.startsWith("video/");
}

/**
 * 파일 종류에 따라 자동으로 Cloudinary 또는 R2로 업로드
 * @param {File} file - 업로드할 파일
 * @param {Function} onProgress - 진행률 콜백 (R2일 때만 동작)
 */
export async function autoUpload(file, onProgress = null) {
  if (isVideoFile(file)) {
    // 동영상 → R2
    return await uploadToR2(file, onProgress);
  } else {
    // 사진 → Cloudinary
    const { uploadToCloudinary } = await import("./CloudinaryService.js");
    return await uploadToCloudinary(file);
  }
}
