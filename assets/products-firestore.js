import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, limit, startAfter, getDocs, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const PAGE_SIZE = 3;
const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

window.productSource = {
  async loadPage(cursor) {
    const parts = [collection(db, "products"), where("isVisible", "==", true), orderBy("price", "asc")];
    if (cursor) parts.push(startAfter(cursor));
    parts.push(limit(PAGE_SIZE));
    const snap = await getDocs(query(...parts));
    return {
      items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor,
      reads: snap.size
    };
  }
};

const SEED = {
  p2: { stock: 30, isVisible: true },
  p3: { stock: 8, isVisible: true },
  p4: { stock: 0, isVisible: true },
  p5: { stock: 5, isVisible: false },
  p6: { stock: 40, isVisible: true }
};

const wrap = document.querySelector("main .wrap");
if (wrap) {
  const box = document.createElement("div");
  box.style.marginTop = "28px";

  const btn = document.createElement("button");
  btn.className = "btn ghost";
  btn.id = "upload-products";
  btn.textContent = "상품 올리기";
  btn.style.display = "none";

  const msg = document.createElement("p");
  msg.id = "upload-msg";
  msg.style.cssText = "margin: 14px 0 0; color: var(--sub);";

  box.append(btn, msg);
  wrap.append(box);

  onAuthStateChanged(auth, (user) => {
    btn.style.display = user ? "inline-block" : "none";
  });

  btn.addEventListener("click", async () => {
    msg.textContent = "";
    btn.disabled = true;
    try {
      const ids = Object.keys(SEED);
      await runTransaction(db, async (tx) => {
        const refs = ids.map((id) => doc(db, "products", id));
        const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
        const existing = snaps.filter((s) => s.exists()).map((s) => s.id);
        if (existing.length) {
          throw new Error(`이미 있는 문서가 있어 하나도 올리지 않았습니다: ${existing.join(", ")}`);
        }
        ids.forEach((id, i) => {
          const shopItem = PRODUCTS.find((p) => p.id === id);
          tx.set(refs[i], {
            name: shopItem.name,
            price: shopItem.price,
            summary: shopItem.summary,
            stock: SEED[id].stock,
            isVisible: SEED[id].isVisible,
            createdAt: serverTimestamp()
          });
        });
      });
      msg.textContent = `상품 ${ids.length}장을 올렸어요 (${ids.join(", ")})`;
    } catch (error) {
      msg.textContent = `${error.code ? error.code + ": " : ""}${error.message}`;
    } finally {
      btn.disabled = false;
    }
  });
}
