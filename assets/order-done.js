import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { showNotifyCard } from "./notify-card.js";

// 결제 결과는 이 화면 한 곳에서만 받는다 (PC · 휴대폰 모두 주소 뒤의 paymentId · code · message)
const params = new URLSearchParams(location.search);
const code = params.get("code");
const message = params.get("message");
const paymentId = params.get("paymentId");

const title = document.getElementById("done-title");
const status = document.getElementById("done-status");
const prose = document.getElementById("done-prose");

function showProblem(heading, text) {
  title.textContent = heading;
  status.textContent = text;
  prose.hidden = true;
}

async function run() {
  // 실패 · 닫기 - 주문도 만들지 않고 장바구니도 그대로 둔다
  if (code) {
    showProblem("결제가 완료되지 않았습니다", `${message || ""}\n장바구니는 그대로입니다`.trim());
    return;
  }

  // paymentId 도 code 도 없으면 아무것도 만들지 않는다
  if (!paymentId) return;

  const auth = getAuth(getApp());
  const db = getFirestore(getApp());
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    showProblem("로그인이 필요합니다", "로그인하세요");
    return;
  }

  // 장바구니가 이미 비었으면(같은 주소를 다시 연 경우) 금액 0원짜리 주문을 만들지 않는다
  const cartItems = Cart.read();
  if (cartItems.length === 0) {
    showProblem("주문을 만들지 않았습니다", "장바구니가 비어 있습니다");
    return;
  }

  const items = cartItems.map((i) => {
    const p = findProduct(i.id);
    return { productId: p.id, name: p.name, price: p.price, quantity: i.qty };
  });
  const totalPrice = Cart.total();

  try {
    await setDoc(doc(db, "orders", paymentId), {
      userId: user.uid,
      items,
      totalPrice,
      status: "paid",
      createdAt: serverTimestamp(),
      paymentId
    });
  } catch (error) {
    showProblem("주문을 저장하지 못했습니다", `${error.code ? error.code + ": " : ""}${error.message}`);
    return;
  }

  Cart.clear();
  const badge = document.querySelector(".cart-count");
  if (badge) badge.textContent = "0";
  title.textContent = "주문이 접수되었습니다";
  status.textContent = `결제 ID: ${paymentId}`;

  // 주문을 마친 손님에게만 알림을 받을지 묻는 카드를 붙인다
  showNotifyCard(status);

  window.dataLayer = window.dataLayer || [];
  dataLayer.push({ ecommerce: null });
  dataLayer.push({
    event: "purchase",
    ecommerce: {
      transaction_id: paymentId,
      currency: "KRW",
      value: totalPrice,
      items: items.map((i) => ({ item_id: i.productId, item_name: i.name, price: i.price, quantity: i.quantity }))
    }
  });
}

run().catch((error) => {
  showProblem("처리하지 못했습니다", `${error.code ? error.code + ": " : ""}${error.message}`);
});
