import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, collection, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

class UserMessage extends Error {}

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

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) throw new Error(`products/${productId} 문서를 찾을 수 없습니다`);
      const product = snap.data();
      if (!(product.stock >= 1)) throw new UserMessage("재고가 없습니다");

      tx.set(orderRef, {
        userId: user.uid,
        items: [{ productId, name: product.name, price: product.price, quantity: 1 }],
        totalPrice: product.price * 1,
        status: "paid",
        createdAt: serverTimestamp()
      });
      tx.update(productRef, { stock: product.stock - 1 });
    });

    msgEl.textContent = `주문했어요. 주문 번호: ${orderRef.id}`;
  } catch (error) {
    msgEl.textContent = error instanceof UserMessage
      ? error.message
      : `${error.code ? error.code + ": " : ""}${error.message}`;
  } finally {
    btn.disabled = false;
  }
});
