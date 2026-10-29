// 1. 쓰는 묶음 불러오기
const { onUserDeleted } = require("firebase-functions/identity");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// 2. 서버용 라이브러리 준비 - 이미 준비돼 있으면 건너뛴다
if (getApps().length === 0) {
  initializeApp();
}

// 3. 계정이 지워지면 그 사람의 users 문서와 푸시 토큰 문서를 지운다
exports.cleanupDeletedUser = onUserDeleted(
  { region: "us-central1" },
  async (event) => {
    const uid = event.data.uid;
    const db = getFirestore();
    await db.doc("users/" + uid).delete();
    await db.doc("pushTokens/" + uid).delete();
    console.log("탈퇴 정리", uid);
  }
);
