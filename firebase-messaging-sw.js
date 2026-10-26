// 웹 푸시 알림을 받을 서비스 워커 - 알림을 받을 준비까지만 해 둔다
// 가게 화면이 쓰는 Firebase 와 같은 버전(12.19.0)의 서비스 워커용 묶음 둘을 불러온다
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

// 가게 화면(assets/auth-state.js)과 같은 Firebase 설정 값
firebase.initializeApp({
  apiKey: "AIzaSyADMQa2y2lWp3Fr4huFU5MZYOK6w94xCHs",
  authDomain: "goat-shop-1e768.firebaseapp.com",
  projectId: "goat-shop-1e768",
  storageBucket: "goat-shop-1e768.firebasestorage.app",
  messagingSenderId: "1069398250098",
  appId: "1:1069398250098:web:c375cf80eaf41f512a68eb"
});

// 알림을 받을 준비 - 손님에게 허락을 묻거나 알림 받을 주소(토큰)를 받는 일은 아직 하지 않는다
firebase.messaging();
