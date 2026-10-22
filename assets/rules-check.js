import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, query, where, limit, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");
// 내 컴퓨터(localhost)에서 열었을 때만 에뮬레이터 함수를 부른다
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

const gate = document.getElementById("gate");
const box = document.getElementById("check-box");
const tableBox = document.getElementById("table-box");
const buttons = [...document.querySelectorAll("#check-box button")];

const errText = (error) => `${error.code ? error.code + ": " : ""}${error.message}`;

function show(el, kind, text) {
  el.className = `check-result ${kind}`;
  el.textContent = text;
}

// 버튼 하나를 눌렀을 때: 그 버튼 아래 결과 칸을 비우고, 실패해도 화면이 멈추지 않게 오류를 그대로 보여 준다
async function run(resultEl, job) {
  resultEl.className = "check-result";
  resultEl.textContent = "";
  tableBox.replaceChildren();
  buttons.forEach((b) => { b.disabled = true; });
  try {
    await job();
  } catch (error) {
    const label = error.code === "permission-denied" ? "거부 · 실패" : "실패";
    show(resultEl, "denied", `${label}: ${errText(error)}`);
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
  }
}

await auth.authStateReady();

if (!auth.currentUser) {
  gate.textContent = "로그인하세요";
} else {
  gate.hidden = true;
  box.hidden = false;
  document.getElementById("who-email").textContent = auth.currentUser.email;
  document.getElementById("who-uid").textContent = auth.currentUser.uid;

  const readResult = document.getElementById("result-read");
  const editResult = document.getElementById("result-edit");
  const zeroResult = document.getElementById("result-zero");

  document.getElementById("read-orders").addEventListener("click", () => run(readResult, async () => {
    const uid = auth.currentUser.uid;
    const snap = await getDocs(collection(db, "orders"));
    const others = snap.docs.filter((d) => d.data().userId !== uid).length;
    show(readResult, "ok", `허용 · 성공: 전체 ${snap.size}건 · userId 가 내 UID와 다른 주문 ${others}건`);

    const table = document.createElement("table");
    table.className = "cart";
    table.innerHTML = "<tr><th>문서 ID</th><th>userId</th><th>totalPrice</th></tr>";
    snap.docs.forEach((d) => {
      const data = d.data();
      const row = document.createElement("tr");
      [d.id, data.userId, data.totalPrice].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.append(cell);
      });
      table.append(row);
    });
    tableBox.append(table);
  }));

  document.getElementById("edit-my-order").addEventListener("click", () => run(editResult, async () => {
    const uid = auth.currentUser.uid;
    const snap = await getDocs(query(collection(db, "orders"), where("userId", "==", uid), limit(1)));
    if (snap.empty) {
      show(editResult, "denied", "내 UID로 된 주문이 없어서 고치지 않았습니다");
      return;
    }
    const target = snap.docs[0];
    await updateDoc(doc(db, "orders", target.id), { totalPrice: 1 });
    show(editResult, "ok", `허용 · 성공: orders/${target.id} 의 totalPrice 를 1 로 바꿨습니다`);
  }));

  document.getElementById("zero-price").addEventListener("click", () => run(zeroResult, async () => {
    await updateDoc(doc(db, "products", "p1"), { price: 0 });
    show(zeroResult, "ok", "허용 · 성공: products/p1 의 price 를 0 으로 바꿨습니다");
  }));

  const askResult = document.getElementById("result-ask");
  const sendResult = document.getElementById("result-send");
  const calcOrderTotal = httpsCallable(functions, "calcOrderTotal");

  // 서버에게 금액 묻기 - productId 와 quantity 만 보낸다
  document.getElementById("ask-total").addEventListener("click", () => run(askResult, async () => {
    const result = await calcOrderTotal({ productId: "p1", quantity: 2 });
    show(askResult, "ok", `totalPrice: ${result.data.totalPrice}`);
  }));

  // 가격 바꿔 보내기 - 같은 요청에 price: 100 을 덧붙인다 (함수는 이 값을 쓰지 않는다)
  document.getElementById("send-price").addEventListener("click", () => run(sendResult, async () => {
    const result = await calcOrderTotal({ productId: "p1", quantity: 2, price: 100 });
    show(sendResult, "ok", `totalPrice: ${result.data.totalPrice}`);
  }));

  // 수량 0으로 묻기 - productId "p1", quantity 0 을 보낸다
  const zeroQuantityResult = document.getElementById("result-zero-quantity");
  document.getElementById("zero-quantity").addEventListener("click", () => run(zeroQuantityResult, async () => {
    const result = await calcOrderTotal({ productId: "p1", quantity: 0 });
    show(zeroQuantityResult, "ok", `totalPrice: ${result.data.totalPrice}`);
  }));
}
