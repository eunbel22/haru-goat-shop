import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const productId = new URLSearchParams(location.search).get("id");
const db = getFirestore(getApp());

function detailPainted() {
  return new Promise((resolve) => {
    const box = document.querySelector("#product-detail");
    if (!box) return;
    if (box.querySelector("h1")) return resolve();
    const watcher = new MutationObserver(() => {
      if (box.querySelector("h1")) {
        watcher.disconnect();
        resolve();
      }
    });
    watcher.observe(box, { childList: true, subtree: true });
  });
}

(async () => {
  let snap = null;
  let errorText = "";
  try {
    snap = await getDoc(doc(db, "products", productId));
  } catch (e) {
    errorText = `${e.code ? e.code + ": " : ""}${e.message}`;
  }
  await detailPainted();

  const title = document.querySelector("#product-detail h1");
  if (!title) return;
  const right = title.parentElement;
  const found = !!snap && snap.exists();

  if (found) {
    const d = snap.data();
    title.textContent = d.name;
    document.title = `${d.name} — ${SHOP.name}`;

    const summary = document.createElement("p");
    summary.className = "sum";
    summary.textContent = d.summary;
    title.after(summary);

    const price = right.querySelector(".price");
    price.textContent = `${Number(d.price).toLocaleString("ko-KR")}원`;

    if (typeof d.stock === "number") {
      const stock = document.createElement("div");
      stock.id = "stock-line";
      stock.style.cssText = "font-size: 14px; color: var(--sub); margin: 0 0 16px;";
      stock.textContent = d.stock > 0 ? `재고 ${d.stock}개` : "품절";
      right.querySelector(".body").after(stock);
    }
  }

  const reads = document.createElement("p");
  reads.style.cssText = "margin: 14px 0 0; color: var(--sub); font-size: 13px;";
  reads.textContent = `이번 화면에서 읽은 문서 ${found ? 1 : 0}장`;
  right.append(reads);

  if (!found) {
    const note = document.createElement("p");
    note.style.cssText = "margin: 6px 0 0; color: var(--sub); font-size: 13px;";
    note.textContent = errorText || `products/${productId} 문서를 찾을 수 없어 기본 정보를 보여 드려요.`;
    right.append(note);
  }
})();
