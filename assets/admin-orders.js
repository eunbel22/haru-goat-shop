// 관리 화면 「주문」 탭 - 입구가 직원(staff · admin)으로 판단했을 때만 연다
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const PAGE_SIZE = 20;
const STATES = ["전체", "paid", "preparing", "shipped", "delivered", "canceled"];
// 지금 상태에서 다음으로 갈 버튼 하나
const NEXT = {
  paid: { label: "포장 시작", to: "preparing" },
  preparing: { label: "배송 시작", to: "shipped" },
  shipped: { label: "배송 완료", to: "delivered" }
};

let db;
const tabs = document.getElementById("admin-tabs");
const tabProducts = document.getElementById("tab-products");
const tabOrders = document.getElementById("tab-orders");
const panelProducts = document.getElementById("panel-products");
const panelOrders = document.getElementById("panel-orders");

let status = "전체";
let cursor = null;
let loaded = false;

function el(tag, text, attrs) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (attrs) Object.assign(node, attrs);
  return node;
}

// 오류 글은 줄이지 않고 콘솔에 남기고, 화면에는 한 줄로만 알린다
function report(what, err) {
  console.error(`${what}: ${err.code ? err.code + ": " : ""}${err.message}`, err);
  return `${what} 못했습니다 (자세한 글은 브라우저 콘솔)`;
}

function when(value) {
  return value && value.toDate ? value.toDate().toLocaleString("ko-KR") : "";
}

function showTab(name) {
  const orders = name === "orders";
  panelProducts.hidden = orders;
  panelOrders.hidden = !orders;
  tabProducts.setAttribute("aria-pressed", String(!orders));
  tabOrders.setAttribute("aria-pressed", String(orders));
  tabProducts.style.fontWeight = orders ? "400" : "700";
  tabOrders.style.fontWeight = orders ? "700" : "400";
  if (orders && !loaded) loadFirstPage();
}

tabProducts.addEventListener("click", () => showTab("products"));
tabOrders.addEventListener("click", () => showTab("orders"));

const listEl = document.getElementById("orders-list");
const moreBtn = document.getElementById("orders-more");
const msgEl = document.getElementById("orders-msg");
const detailEl = document.getElementById("order-detail");
const statusSel = document.getElementById("orders-status");

STATES.forEach((s) => statusSel.append(el("option", s, { value: s })));
statusSel.addEventListener("change", () => {
  status = statusSel.value;
  loadFirstPage();
});
moreBtn.addEventListener("click", () => loadPage());

// 고른 상태의 주문만 읽어 온다 - 전체면 조건 없이 최근 순
async function loadFirstPage() {
  cursor = null;
  listEl.replaceChildren();
  detailEl.replaceChildren();
  moreBtn.hidden = true;
  await loadPage();
  loaded = true;
}

async function loadPage() {
  msgEl.textContent = "";
  try {
    const parts = [collection(db, "orders")];
    if (status !== "전체") parts.push(where("status", "==", status));
    parts.push(orderBy("createdAt", "desc"));
    if (cursor) parts.push(startAfter(cursor));
    parts.push(limit(PAGE_SIZE));
    const snap = await getDocs(query(...parts));
    snap.docs.forEach((d) => listEl.append(orderRow(d.id, d.data())));
    if (snap.docs.length) cursor = snap.docs[snap.docs.length - 1];
    moreBtn.hidden = snap.docs.length < PAGE_SIZE;
    if (!listEl.children.length) msgEl.textContent = "주문이 없습니다";
  } catch (err) {
    msgEl.textContent = report("주문을 읽지", err);
  }
}

function rowText(id, o) {
  return `${id} · ${o.totalPrice ?? ""}원 · ${o.status ?? ""} · ${when(o.createdAt)}`;
}

function orderRow(id, o) {
  const li = el("li");
  li.dataset.id = id;
  const btn = el("button", rowText(id, o), { type: "button" });
  btn.style.cssText = "text-align:left;width:100%;margin:2px 0;";
  btn.addEventListener("click", () => showDetail(id));
  li.append(btn);
  return li;
}

function itemsText(items) {
  if (!Array.isArray(items)) return "";
  return items.map((i) => `${i.name ?? i.productId ?? i.id ?? "?"} × ${i.quantity ?? i.qty ?? 1}`).join(", ");
}

async function showDetail(id) {
  detailEl.replaceChildren(el("p", "읽는 중…"));
  try {
    const snap = await getDoc(doc(db, "orders", id));
    if (!snap.exists()) {
      detailEl.replaceChildren(el("p", "주문 문서가 없습니다"));
      return;
    }
    const o = snap.data();
    // 목록의 그 줄도 새 상태로 맞춘다 (상태로 골라 둔 목록에서는 줄이 남아 있을 뿐이다)
    const li = listEl.querySelector(`li[data-id="${CSS.escape(id)}"]`);
    if (li) li.firstChild.textContent = rowText(id, o);

    const lines = [
      ["주문 번호", id],
      ["산 것", itemsText(o.items)],
      ["금액", `${o.totalPrice ?? ""}`],
      ["상태", o.status ?? ""],
      ["받은 시각", when(o.receivedAt)],
      ["처리 표시", o.processStatus ? o.processStatus + (o.processError ? ` (${o.processError})` : "") : ""]
    ];
    if (o.mailStatus) lines.push(["메일 표시", o.mailStatus]);
    if (o.statusUpdatedAt) lines.push(["상태를 바꾼 시각", when(o.statusUpdatedAt)]);

    const dl = el("dl");
    lines.forEach(([k, v]) => { dl.append(el("dt", k), el("dd", v)); });
    detailEl.replaceChildren(dl);

    const next = NEXT[o.status];
    if (next) {
      const btn = el("button", next.label, { type: "button" });
      btn.addEventListener("click", () => changeStatus(id, next.to));
      detailEl.append(btn);
    }
  } catch (err) {
    detailEl.replaceChildren(el("p", report("주문 상세를 읽지", err)));
  }
}

function confirmChange(id, to) {
  return new Promise((resolve) => {
    const dialog = el("dialog");
    dialog.append(el("p", `주문 ${id}를 ${to}로 바꿉니다`));
    const yes = el("button", "바꾸기", { type: "button" });
    const no = el("button", "그만두기", { type: "button" });
    let answer = false;
    yes.addEventListener("click", () => { answer = true; dialog.close(); });
    no.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { dialog.remove(); resolve(answer); });
    dialog.append(yes, no);
    document.body.append(dialog);
    dialog.showModal();
  });
}

// status 와 statusUpdatedAt 두 필드만 고친다
async function changeStatus(id, to) {
  if (!(await confirmChange(id, to))) return;
  try {
    await updateDoc(doc(db, "orders", id), { status: to, statusUpdatedAt: serverTimestamp() });
  } catch (err) {
    detailEl.append(el("p", report("상태를 바꾸지", err)));
    return;
  }
  await showDetail(id);
}

export function showOrders() {
  db = getFirestore(getApp());
  tabs.hidden = false;
  showTab("products");
}

export function hideOrders() {
  tabs.hidden = true;
  panelProducts.hidden = false;
  panelOrders.hidden = true;
  loaded = false;
  listEl.replaceChildren();
  detailEl.replaceChildren();
}
