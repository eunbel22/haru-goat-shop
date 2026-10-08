// Firebase 인증 상태 관리 (모든 화면에서 공유)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyADMQa2y2lWp3Fr4huFU5MZYOK6w94xCHs",
  authDomain: "goat-shop-1e768.firebaseapp.com",
  projectId: "goat-shop-1e768",
  storageBucket: "goat-shop-1e768.firebasestorage.app",
  messagingSenderId: "1069398250098",
  appId: "1:1069398250098:web:c375cf80eaf41f512a68eb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "ko";

// 헤더의 로그인 상태 표시 영역
function updateHeader(user) {
  const headerNav = document.querySelector("nav.site");
  if (!headerNav) return;

  // 기존 인증 관련 요소 제거
  const existingAuth = headerNav.querySelector(".auth-section");
  if (existingAuth) existingAuth.remove();

  // 새로운 인증 요소 추가
  const authSection = document.createElement("div");
  authSection.className = "auth-section";
  authSection.style.marginLeft = "auto";
  authSection.style.display = "flex";
  authSection.style.alignItems = "center";
  authSection.style.gap = "12px";
  authSection.style.fontSize = "14px";

  if (user) {
    // 로그인됨: 이메일, 마이페이지, 로그아웃
    const emailSpan = document.createElement("span");
    emailSpan.textContent = user.email;
    emailSpan.style.color = "var(--sub)";

    const mypageLink = document.createElement("a");
    mypageLink.href = "mypage.html";
    mypageLink.textContent = "마이페이지";
    mypageLink.style.color = "var(--sub)";
    mypageLink.style.textDecoration = "none";

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.style.background = "none";
    logoutBtn.style.border = "none";
    logoutBtn.style.color = "var(--sub)";
    logoutBtn.style.cursor = "pointer";
    logoutBtn.style.padding = "0";
    logoutBtn.style.font = "inherit";
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      location.href = "index.html";
    });

    if (user.photoURL) {
      const photo = document.createElement("img");
      photo.src = user.photoURL;
      photo.alt = "";
      photo.referrerPolicy = "no-referrer";
      photo.style.width = "24px";
      photo.style.height = "24px";
      photo.style.borderRadius = "50%";
      photo.style.objectFit = "cover";
      photo.addEventListener("error", () => photo.remove());
      authSection.appendChild(photo);
    }

    authSection.appendChild(emailSpan);
    authSection.appendChild(mypageLink);
    authSection.appendChild(logoutBtn);
  } else {
    // 로그인 안 됨: 로그인 링크
    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.textContent = "로그인";
    loginLink.style.color = "var(--sub)";
    loginLink.style.textDecoration = "none";

    authSection.appendChild(loginLink);
  }

  headerNav.appendChild(authSection);
}

// 모든 화면에서 사용할 인증 상태 확인
window.authStateManager = {
  onAuthStateChanged: function(callback) {
    onAuthStateChanged(auth, (user) => {
      updateHeader(user);
      if (callback) callback(user);
    });
  },
  getCurrentAuth: function() {
    return auth;
  }
};

// 인증 상태 변경 시 헤더 업데이트 (DOM 로드 후)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
      updateHeader(user);
    });
  });
} else {
  // 이미 DOM이 로드된 경우 (로그인 후 이동)
  onAuthStateChanged(auth, (user) => {
    updateHeader(user);
  });
}
