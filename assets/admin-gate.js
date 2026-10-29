// 관리 화면 입구 - 로그인 토큰의 커스텀 클레임 role 로만 판단한다
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { showProducts, hideProducts } from "./admin-products.js";
import { showOrders, hideOrders } from "./admin-orders.js";

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
const functions = getFunctions(app, "us-central1");

const statusEl = document.getElementById("gate-status");
const actionsEl = document.getElementById("gate-actions");
const errorEl = document.getElementById("gate-error");
const recheckBtn = document.getElementById("recheck");

// 토큰을 읽어 role 로 판단한다 - refresh 가 true 면 서버에서 새로 받는다
async function judge(user, refresh) {
  actionsEl.replaceChildren();
  hideProducts();
  hideOrders();
  recheckBtn.hidden = !user;
  if (!user) {
    statusEl.textContent = "로그인이 필요합니다";
    const link = document.createElement("a");
    link.href = "/login.html";
    link.textContent = "로그인 화면으로 가기";
    actionsEl.append(link);
    return;
  }

  const result = await user.getIdTokenResult(refresh);
  const role = result.claims.role;
  if (role === "staff" || role === "admin") {
    statusEl.textContent = "관리자: " + role;
    showProducts();
    showOrders();
    return;
  }

  statusEl.textContent = "권한이 없습니다";
  const grantBtn = document.createElement("button");
  grantBtn.type = "button";
  grantBtn.textContent = "주인 명찰 받기";
  grantBtn.addEventListener("click", () => grant(user, grantBtn));
  actionsEl.append(grantBtn);
}

// 함수를 불러 명찰을 받고, 토큰을 새로 받아 다시 판단한다
async function grant(user, button) {
  errorEl.textContent = "";
  button.disabled = true;
  try {
    await httpsCallable(functions, "grantOwnerRole")();
    await judge(user, true);
  } catch (err) {
    errorEl.textContent = (err.code ? err.code + ": " : "") + err.message;
    button.disabled = false;
  }
}

recheckBtn.addEventListener("click", async () => {
  errorEl.textContent = "";
  try {
    await judge(auth.currentUser, true);
  } catch (err) {
    errorEl.textContent = (err.code ? err.code + ": " : "") + err.message;
  }
});

onAuthStateChanged(auth, (user) => {
  judge(user, false).catch((err) => {
    errorEl.textContent = (err.code ? err.code + ": " : "") + err.message;
  });
});
