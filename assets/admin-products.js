// 관리 화면 상품 표 - 입구가 직원(staff · admin)으로 판단했을 때만 그린다
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// 앱은 입구(admin-gate.js)가 만든 뒤에 받는다 - 파일을 불러오는 순간에는 아직 없다
let db;
const box = document.getElementById("product-admin");

let rows = [];

function errText(err) {
  return (err.code ? err.code + ": " : "") + err.message;
}

function el(tag, text, attrs) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (attrs) Object.assign(node, attrs);
  return node;
}

// 문서 하나를 고치고 표의 그 줄만 새로 그린다 - 실패하면 그 줄 옆에 글을 그대로 보인다
async function save(row, changes, errorEl) {
  errorEl.textContent = "";
  try {
    await updateDoc(doc(db, "products", row.id), changes);
    Object.assign(row.data, changes);
    render();
  } catch (err) {
    errorEl.textContent = errText(err);
    render(row.id, errText(err));
  }
}

function parseWhole(text, min) {
  const trimmed = String(text).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= min ? n : null;
}

function render(errorId, errorMessage) {
  box.replaceChildren();

  // 새 상품
  const newBtn = el("button", "새 상품", { type: "button" });
  const newForm = el("form");
  newForm.hidden = true;
  const nameIn = el("input", undefined, { placeholder: "name" });
  const priceIn = el("input", undefined, { placeholder: "price", inputMode: "numeric" });
  const summaryIn = el("input", undefined, { placeholder: "summary" });
  const stockIn = el("input", undefined, { placeholder: "stock", inputMode: "numeric" });
  const newSave = el("button", "저장", { type: "submit" });
  const newErr = el("p");
  newErr.style.cssText = "color:#c0392b;white-space:pre-wrap;";
  newForm.append(nameIn, priceIn, summaryIn, stockIn, newSave, newErr);
  newBtn.addEventListener("click", () => { newForm.hidden = !newForm.hidden; });
  newForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    newErr.textContent = "";
    const price = parseWhole(priceIn.value, 1);
    const stock = parseWhole(stockIn.value, 0);
    if (!nameIn.value.trim() || price === null || stock === null) {
      newErr.textContent = "name 을 적고, price 는 1 이상, stock 은 0 이상의 정수로 적어 주세요";
      return;
    }
    newSave.disabled = true;
    try {
      const data = { name: nameIn.value.trim(), price, summary: summaryIn.value, stock, isVisible: false, createdAt: serverTimestamp() };
      const created = await addDoc(collection(db, "products"), data);
      rows.push({ id: created.id, data: { ...data, createdAt: null } });
      render();
    } catch (err) {
      newErr.textContent = errText(err);
      newSave.disabled = false;
    }
  });
  box.append(newBtn, newForm);

  // 표
  const table = el("table");
  table.style.cssText = "width:100%;margin-top:16px;border-collapse:collapse;";
  const head = el("tr");
  ["ID", "name", "price", "stock", "품절", "노출", ""].forEach((t) => head.append(el("th", t)));
  table.append(head);

  rows.forEach((row) => {
    const d = row.data;
    const tr = el("tr");
    const rowErr = el("span");
    rowErr.style.cssText = "color:#c0392b;white-space:pre-wrap;display:block;";
    if (errorId === row.id) rowErr.textContent = errorMessage;

    const soldOut = el("input", undefined, { type: "checkbox", checked: d.stock === 0 });
    soldOut.addEventListener("change", () => {
      if (soldOut.checked) return save(row, { stock: 0 }, rowErr);
      const answer = prompt("다시 팔 재고 숫자를 적어 주세요 (1 이상 정수)");
      const n = answer === null ? null : parseWhole(answer, 1);
      if (n === null) { soldOut.checked = true; return; }
      return save(row, { stock: n }, rowErr);
    });

    const visible = el("input", undefined, { type: "checkbox", checked: d.isVisible === true });
    visible.addEventListener("change", () => save(row, { isVisible: visible.checked }, rowErr));

    const editBtn = el("button", "고치기", { type: "button" });
    editBtn.addEventListener("click", () => editRow(row, tr));

    const last = el("td");
    last.append(editBtn, rowErr);
    [row.id, d.name, d.price, d.stock].forEach((v) => tr.append(el("td", String(v ?? ""))));
    const c1 = el("td"); c1.append(soldOut);
    const c2 = el("td"); c2.append(visible);
    tr.append(c1, c2, last);
    table.append(tr);
  });
  box.append(table);
}

// 고치기 - price · summary · stock 칸을 그 줄 아래에 연다
function editRow(row, tr) {
  if (tr.nextSibling && tr.nextSibling.dataset && tr.nextSibling.dataset.edit) return;
  const d = row.data;
  const editTr = el("tr");
  editTr.dataset.edit = row.id;
  const td = el("td", undefined, { colSpan: 7 });
  const priceIn = el("input", undefined, { value: d.price ?? "", inputMode: "numeric" });
  const summaryIn = el("input", undefined, { value: d.summary ?? "" });
  const stockIn = el("input", undefined, { value: d.stock ?? "", inputMode: "numeric" });
  const saveBtn = el("button", "저장", { type: "button" });
  const cancelBtn = el("button", "취소", { type: "button" });
  const err = el("p");
  err.style.cssText = "color:#c0392b;white-space:pre-wrap;";
  td.append("price ", priceIn, " summary ", summaryIn, " stock ", stockIn, " ", saveBtn, cancelBtn, err);
  editTr.append(td);
  tr.after(editTr);
  cancelBtn.addEventListener("click", () => editTr.remove());
  saveBtn.addEventListener("click", () => {
    const price = parseWhole(priceIn.value, 1);
    const stock = parseWhole(stockIn.value, 0);
    if (price === null || stock === null) {
      err.textContent = "price 는 1 이상, stock 은 0 이상의 정수로 적어 주세요";
      return;
    }
    save(row, { price, summary: summaryIn.value, stock }, err);
  });
}

export async function showProducts() {
  db = getFirestore(getApp());
  box.hidden = false;
  box.replaceChildren(el("p", "상품을 읽는 중…"));
  try {
    const snap = await getDocs(collection(db, "products"));
    rows = snap.docs.map((d) => ({ id: d.id, data: d.data() })).sort((a, b) => a.id.localeCompare(b.id));
    render();
  } catch (err) {
    box.replaceChildren(el("p", errText(err)));
  }
}

export function hideProducts() {
  box.hidden = true;
  box.replaceChildren();
}
