import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, limit, startAfter, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const PAGE_SIZE = 3;
const app = getApp();
const db = getFirestore(app);
const storage = getStorage(app);

window.productSource = {
  async loadPage(cursor) {
    const parts = [collection(db, "products"), where("isVisible", "==", true), orderBy("price", "asc")];
    if (cursor) parts.push(startAfter(cursor));
    parts.push(limit(PAGE_SIZE));
    const snap = await getDocs(query(...parts));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    await Promise.all(items.map(async (item) => {
      if (!item.imagePath) return;
      try {
        item.imageUrl = await getDownloadURL(ref(storage, item.imagePath));
      } catch (error) {
        console.error(`${item.id} 사진: ${error.code ? error.code + ": " : ""}${error.message}`);
      }
    }));
    return {
      items,
      cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor,
      reads: snap.size
    };
  }
};
