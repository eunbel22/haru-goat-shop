// 관리 화면 상품 표 - 입구가 직원(staff · admin)으로 판단했을 때만 그린다
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, deleteField, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

// 앱은 입구(admin-gate.js)가 만든 뒤에 받는다 - 파일을 불러오는 순간에는 아직 없다
let db;
let storage;
const box = document.getElementById("product-admin");

let rows = [];
let newNotice = "";
let undoRow = null;
const DELETE = deleteField();

// 보는 방법 - 한 번 읽어 둔 rows 에서 화면이 고른다 (Firestore 에 다시 묻지 않는다)
let filterMode = "all";
let searchText = "";
let sortMode = "";

const FILTERS = [["all", "전체"], ["soldout", "품절만"], ["hidden", "숨김만"], ["down", "내린 상품"]];

function visibleRows() {
  const needle = searchText.trim().toLowerCase();
  const shown = rows.filter((row) => {
    const d = row.data;
    if (filterMode === "soldout" && d.stock !== 0) return false;
    if (filterMode === "hidden" && d.isVisible !== false) return false;
    if (filterMode === "down" && !d.deletedAt) return false;
    return !needle || String(d.name ?? "").toLowerCase().includes(needle);
  });
  if (sortMode === "stock") shown.sort((a, b) => (a.data.stock ?? Infinity) - (b.data.stock ?? Infinity));
  if (sortMode === "name") shown.sort((a, b) => String(a.data.name ?? "").localeCompare(String(b.data.name ?? ""), "ko"));
  return shown;
}

const MAX_BYTES = 5 * 1024 * 1024;

// 올리기 전에 막는다 - 기다리지 않게 알려 줄 뿐이고, 진짜로 막는 것은 Storage 규칙이다
function checkFile(file) {
  if (!file.type.startsWith("image/")) return "이미지 파일만 올릴 수 있습니다";
  if (file.size >= MAX_BYTES) return "5MB 넘는 사진은 올릴 수 없습니다";
  return "";
}

// 사진을 products/문서 ID/main.jpg 에 올린다 - 다 올라가면 경로 글자를 돌려준다
function uploadPhoto(docId, file, statusEl) {
  const path = `products/${docId}/main.jpg`;
  statusEl.textContent = "올리는 중 … 0%";
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.floor((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        statusEl.textContent = `올리는 중 … ${percent}%`;
      },
      reject,
      () => resolve(path)
    );
  });
}

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
    for (const [key, value] of Object.entries(changes)) {
      if (key === "deletedAt") {
        // 서버 시각은 화면이 모른다 - 내렸다는 표시만 남긴다
        if (value === DELETE) delete row.data.deletedAt; else row.data.deletedAt = true;
      } else {
        row.data[key] = value;
      }
    }
    render();
  } catch (err) {
    errorEl.textContent = errText(err);
    undoRow = null;
    render(row.id, errText(err));
  }
}

// 내리기 확인 창 - 글자와 버튼을 하는 일 그대로 적는다
function confirmTakeDown(name) {
  return new Promise((resolve) => {
    const dialog = el("dialog");
    dialog.append(el("p", `『${name}』을 가게에서 내립니다`));
    const yes = el("button", "내리기", { type: "button" });
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

async function takeDown(row, errorEl) {
  if (!(await confirmTakeDown(row.data.name ?? row.id))) return;
  undoRow = row;
  await save(row, { deletedAt: serverTimestamp(), isVisible: false }, errorEl);
}

async function restore(row, errorEl) {
  undoRow = null;
  await save(row, { deletedAt: DELETE, isVisible: true }, errorEl);
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
  const fileIn = el("input", undefined, { type: "file", accept: "image/*" });
  const newStatus = el("p");
  const newSave = el("button", "저장", { type: "submit" });
  const newErr = el("p");
  newErr.style.cssText = "color:#c0392b;white-space:pre-wrap;";
  newErr.textContent = newNotice;
  newForm.append(nameIn, priceIn, summaryIn, stockIn, fileIn, newSave, newStatus, newErr);
  newForm.hidden = !newNotice;
  newBtn.addEventListener("click", () => { newForm.hidden = !newForm.hidden; });
  newForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    newErr.textContent = "";
    newNotice = "";
    const price = parseWhole(priceIn.value, 1);
    const stock = parseWhole(stockIn.value, 0);
    if (!nameIn.value.trim() || price === null || stock === null) {
      newErr.textContent = "name 을 적고, price 는 1 이상, stock 은 0 이상의 정수로 적어 주세요";
      return;
    }
    const file = fileIn.files[0];
    const fileProblem = file ? checkFile(file) : "";
    if (fileProblem) {
      newErr.textContent = fileProblem;
      return;
    }
    newSave.disabled = true;
    try {
      // 1) 문서를 숨긴 채로 만든다
      const data = { name: nameIn.value.trim(), price, summary: summaryIn.value, stock, isVisible: false, createdAt: serverTimestamp() };
      const created = await addDoc(collection(db, "products"), data);
      const row = { id: created.id, data: { ...data, createdAt: null } };
      rows.push(row);
      if (file) {
        try {
          // 2) 사진을 올리고 3) 다 올라간 뒤에 경로를 적는다
          const path = await uploadPhoto(created.id, file, newStatus);
          await updateDoc(doc(db, "products", created.id), { imagePath: path });
          row.data.imagePath = path;
        } catch (err) {
          newNotice = `상품 문서(${created.id})는 만들었지만 사진은 올리지 못했습니다
${errText(err)}`;
        }
      }
      render();
    } catch (err) {
      newErr.textContent = errText(err);
      newSave.disabled = false;
    }
  });
  box.append(newBtn, newForm);

  // 필터 · 검색 · 정렬 - 눌러도 표 칸만 다시 그린다
  const controls = el("div");
  controls.style.cssText = "margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;";
  const filterBtns = FILTERS.map(([mode, label]) => {
    const btn = el("button", label, { type: "button" });
    btn.addEventListener("click", () => {
      filterMode = mode;
      markFilter();
      drawTable();
    });
    return [mode, btn];
  });
  function markFilter() {
    filterBtns.forEach(([mode, btn]) => {
      btn.style.fontWeight = mode === filterMode ? "700" : "400";
      btn.setAttribute("aria-pressed", String(mode === filterMode));
    });
  }
  const searchIn = el("input", undefined, { type: "search", placeholder: "이름 검색", value: searchText });
  searchIn.addEventListener("input", () => {
    searchText = searchIn.value;
    drawTable();
  });
  const sortSel = el("select");
  [["", "정렬 없음"], ["stock", "재고 적은 순"], ["name", "이름순"]].forEach(([value, label]) => {
    sortSel.append(el("option", label, { value }));
  });
  sortSel.value = sortMode;
  sortSel.addEventListener("change", () => {
    sortMode = sortSel.value;
    drawTable();
  });
  controls.append(...filterBtns.map(([, btn]) => btn), searchIn, sortSel);
  markFilter();

  const tableBox = el("div");
  box.append(controls, tableBox);
  if (undoRow) {
    const bar = el("p", `『${undoRow.data.name ?? undoRow.id}』을 내렸습니다 `);
    const undoBtn = el("button", "되돌리기", { type: "button" });
    const target = undoRow;
    undoBtn.addEventListener("click", () => restore(target, bar));
    bar.append(undoBtn);
    box.append(bar);
  }
  drawTable(errorId, errorMessage);

  // 표 - 고른 줄만 그린다
  function drawTable(errId, errMessage) {
  const shown = visibleRows();
  const count = el("p", `지금 보이는 상품 ${shown.length}개 / 전체 ${rows.length}개`);
  const table = el("table");
  table.style.cssText = "width:100%;margin-top:16px;border-collapse:collapse;";
  const head = el("tr");
  ["ID", "사진", "name", "price", "stock", "품절", "노출", ""].forEach((t) => head.append(el("th", t)));
  table.append(head);

  shown.forEach((row) => {
    const d = row.data;
    const tr = el("tr");
    const rowErr = el("span");
    rowErr.style.cssText = "color:#c0392b;white-space:pre-wrap;display:block;";
    if (errId === row.id) rowErr.textContent = errMessage;

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

    // 내린 상품에는 되돌리기, 그 밖에는 내리기
    const downBtn = d.deletedAt
      ? el("button", "되돌리기", { type: "button" })
      : el("button", "내리기", { type: "button" });
    downBtn.addEventListener("click", () => (d.deletedAt ? restore(row, rowErr) : takeDown(row, rowErr)));

    const last = el("td");
    last.append(editBtn, downBtn, rowErr);
    tr.append(el("td", row.id));
    const photoTd = el("td");
    if (d.imagePath) {
      const img = el("img", undefined, { alt: d.imagePath });
      img.style.cssText = "width:48px;height:48px;object-fit:cover;";
      getDownloadURL(ref(storage, d.imagePath)).then((url) => { img.src = url; }).catch((err) => { photoTd.title = errText(err); });
      photoTd.append(img);
    }
    tr.append(photoTd);
    [d.name, d.price, d.stock].forEach((v) => tr.append(el("td", String(v ?? ""))));
    const c1 = el("td"); c1.append(soldOut);
    const c2 = el("td"); c2.append(visible);
    tr.append(c1, c2, last);
    table.append(tr);
  });
  tableBox.replaceChildren(count, table);
  }
}

// 고치기 - price · summary · stock 칸을 그 줄 아래에 연다
function editRow(row, tr) {
  if (tr.nextSibling && tr.nextSibling.dataset && tr.nextSibling.dataset.edit) return;
  const d = row.data;
  const editTr = el("tr");
  editTr.dataset.edit = row.id;
  const td = el("td", undefined, { colSpan: 8 });
  const priceIn = el("input", undefined, { value: d.price ?? "", inputMode: "numeric" });
  const summaryIn = el("input", undefined, { value: d.summary ?? "" });
  const stockIn = el("input", undefined, { value: d.stock ?? "", inputMode: "numeric" });
  const fileIn = el("input", undefined, { type: "file", accept: "image/*" });
  const status = el("p");
  const saveBtn = el("button", "저장", { type: "button" });
  const cancelBtn = el("button", "취소", { type: "button" });
  const err = el("p");
  err.style.cssText = "color:#c0392b;white-space:pre-wrap;";
  td.append("price ", priceIn, " summary ", summaryIn, " stock ", stockIn, " 사진 ", fileIn, " ", saveBtn, cancelBtn, status, err);
  editTr.append(td);
  tr.after(editTr);
  cancelBtn.addEventListener("click", () => editTr.remove());
  saveBtn.addEventListener("click", async () => {
    err.textContent = "";
    const price = parseWhole(priceIn.value, 1);
    const stock = parseWhole(stockIn.value, 0);
    if (price === null || stock === null) {
      err.textContent = "price 는 1 이상, stock 은 0 이상의 정수로 적어 주세요";
      return;
    }
    const changes = { price, summary: summaryIn.value, stock };
    const file = fileIn.files[0];
    if (file) {
      const problem = checkFile(file);
      if (problem) {
        err.textContent = problem;
        return;
      }
      saveBtn.disabled = true;
      try {
        // 다 올라간 뒤에만 경로를 적는다 - 실패하면 아무것도 저장하지 않는다
        changes.imagePath = await uploadPhoto(row.id, file, status);
      } catch (error) {
        err.textContent = errText(error);
        saveBtn.disabled = false;
        return;
      }
    }
    save(row, changes, err);
  });
}

// 최근 활동 - 함수가 남기는 adminLogs 를 읽기만 한다
async function loadActivity() {
  const list = document.getElementById("activity-list");
  if (!list) return;
  list.replaceChildren(el("li", "읽는 중…"));
  try {
    const snap = await getDocs(query(collection(db, "adminLogs"), orderBy("at", "desc"), limit(10)));
    list.replaceChildren();
    if (snap.empty) list.append(el("li", "아직 활동이 없습니다"));
    snap.docs.forEach((d) => {
      const log = d.data();
      const product = rows.find((r) => r.id === log.productId);
      const when = log.at && log.at.toDate ? log.at.toDate().toLocaleString("ko-KR") : "";
      const name = product && product.data.name ? product.data.name : log.productId;
      list.append(el("li", `${when} · ${name} · ${log.action} · ${(log.changedKeys || []).join(", ")}`));
    });
  } catch (err) {
    list.replaceChildren(el("li", errText(err)));
  }
}

export async function showProducts() {
  db = getFirestore(getApp());
  storage = getStorage(getApp());
  box.hidden = false;
  box.replaceChildren(el("p", "상품을 읽는 중…"));
  try {
    const snap = await getDocs(collection(db, "products"));
    rows = snap.docs.map((d) => ({ id: d.id, data: d.data() })).sort((a, b) => a.id.localeCompare(b.id));
    render();
    document.getElementById("activity").hidden = false;
    await loadActivity();
  } catch (err) {
    box.replaceChildren(el("p", errText(err)));
  }
}

export function hideProducts() {
  const activity = document.getElementById("activity");
  if (activity) activity.hidden = true;
  box.hidden = true;
  box.replaceChildren();
}

const refreshActivity = document.getElementById("activity-refresh");
if (refreshActivity) refreshActivity.addEventListener("click", loadActivity);
