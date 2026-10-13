import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, limit, startAfter, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const PAGE_SIZE = 3;
const db = getFirestore(getApp());

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
