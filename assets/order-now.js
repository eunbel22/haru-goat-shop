import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, collection, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { showNotifyCard } from "./notify-card.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

class UserMessage extends Error {}

function showStock(count) {
  const line = document.getElementById("stock-line");
  if (line) line.textContent = count > 0 ? `재고 ${count}개` : "품절";
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("#order-now");
  if (!btn) return;

  const msgEl = document.getElementById("order-msg");
  const productId = new URLSearchParams(location.search).get("id");
  msgEl.textContent = "";
  btn.disabled = true;

  try {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) throw new UserMessage("로그인이 필요합니다");

    const productRef = doc(db, "products", productId);
    const orderRef = doc(collection(db, "orders"));

    const remaining = await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) throw new Error(`products/${productId} 문서를 찾을 수 없습니다`);
      const product = snap.data();
      if (!(product.stock >= 1)) {
        showStock(0);
        throw new UserMessage("재고가 없습니다");
      }

      tx.set(orderRef, {
        userId: user.uid,
        items: [{ productId, name: product.name, price: product.price, quantity: 1 }],
        totalPrice: product.price * 1,
        status: "paid",
        createdAt: serverTimestamp()
      });
      tx.update(productRef, { stock: product.stock - 1 });
      return product.stock - 1;
    });

    showStock(remaining);
    msgEl.textContent = `주문했어요. 주문 번호: ${orderRef.id}`;

    // 주문을 마친 손님에게만 알림을 받을지 묻는 카드를 「주문했어요」 바로 아래에 붙인다
    showNotifyCard(msgEl);
  } catch (error) {
    msgEl.textContent = error instanceof UserMessage
      ? error.message
      : `${error.code ? error.code + ": " : ""}${error.message}`;
  } finally {
    btn.disabled = false;
  }
});
