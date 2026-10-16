import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const gate = document.getElementById("gate");
const box = document.getElementById("upload-box");
const select = document.getElementById("product-select");
const fileInput = document.getElementById("image-file");
const button = document.getElementById("upload-image");
const status = document.getElementById("upload-status");

const errText = (error) => `${error.code ? error.code + ": " : ""}${error.message}`;

async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));
  select.innerHTML = "";
  if (snap.empty) {
    gate.textContent = "products 문서가 없습니다";
    gate.hidden = false;
    box.hidden = true;
    return;
  }
  snap.docs.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.id} — ${d.data().name || "(이름 없음)"}`;
    select.append(opt);
  });
}

await auth.authStateReady();

if (!auth.currentUser) {
  gate.textContent = "로그인하세요";
} else {
  try {
    gate.hidden = true;
    box.hidden = false;
    await loadProducts();
  } catch (error) {
    gate.hidden = false;
    gate.textContent = errText(error);
    box.hidden = true;
  }
}

button.addEventListener("click", () => {
  status.textContent = "";
  const file = fileInput.files[0];
  const productId = select.value;
  if (!productId) { status.textContent = "상품을 골라 주세요"; return; }
  if (!file) { status.textContent = "사진 파일을 골라 주세요"; return; }

  const path = `products/${productId}/main.jpg`;
  button.disabled = true;
  status.textContent = "올리는 중 … 0%";

  const task = uploadBytesResumable(ref(storage, path), file);
  task.on(
    "state_changed",
    (snapshot) => {
      const percent = Math.floor((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      status.textContent = `올리는 중 … ${percent}%`;
    },
    (error) => {
      status.textContent = errText(error);
      button.disabled = false;
    },
    async () => {
      try {
        await updateDoc(doc(db, "products", productId), { imagePath: path });
        status.textContent = `끝났어요: ${path}`;
      } catch (error) {
        status.textContent = `사진은 올라갔지만 문서에 경로를 저장하지 못했습니다\n${errText(error)}`;
      } finally {
        button.disabled = false;
      }
    }
  );
});
