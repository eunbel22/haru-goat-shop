// 알림 받는 주소(FCM 토큰)를 받아 Firestore pushTokens/{내 UID} 에 적는다
// - 알림 권한이 granted 이고 손님이 로그인한 상태일 때만 받는다
// - 토큰 값은 화면에도 Console 에도 찍지 않는다. 실패하면 오류 이름만 한 줄 남긴다
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";

// VAPID 공개 키 - 가게 화면에 들어가는 공개 값이다 (비공개 키가 아니다)
const VAPID_KEY = "BFEAKu6X696sKIzEQlnWZ0IBjfj6RXjj4d_uJLaQRk0UhVWxBeT87IBIWOuAl5gc0ih1A-pjq7DtboJVGtIL6xA";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

let running = null;

// force 가 true 이면(「알림 받기」로 granted 가 된 바로 그 자리) 적어 둔 것과 같아도 다시 쓴다
// 아니면 적어 둔 token 이 지금 받은 것과 같고 updatedAt 이 30일 안이면 다시 쓰지 않는다
export function savePushToken({ force = false } = {}) {
  if (running) return running;
  running = run(force)
    .catch((error) => {
      console.error("푸시 토큰 처리 실패:", (error && (error.code || error.name)) || "unknown");
    })
    .finally(() => { running = null; });
  return running;
}

async function run(force) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  const app = getApp();
  const auth = getAuth(app);
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return;

  if (!(await isSupported())) return;

  // 앞에서 등록한 서비스 워커를 함께 넘긴다
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;

  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!token) return;

  const ref = doc(getFirestore(app), "pushTokens", user.uid);

  if (!force) {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const saved = snap.data();
      const updated = saved.updatedAt && saved.updatedAt.toMillis ? saved.updatedAt.toMillis() : 0;
      if (saved.token === token && Date.now() - updated < THIRTY_DAYS) return;
    }
  }

  // 문서가 이미 있으면 token · updatedAt 두 필드만 고치고, 없으면 새로 만든다
  await setDoc(ref, { token, updatedAt: serverTimestamp() }, { merge: true });
}
