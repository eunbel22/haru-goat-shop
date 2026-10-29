// 관리 화면 「매출」 탭 - dailyStats 집계 문서만 읽는다 (주문은 읽지 않는다)
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const DAYS = 7;

let db;
let chart = null;
let loaded = false;

const tabs = document.getElementById("admin-tabs");
const tabSales = document.getElementById("tab-sales");
const tabProducts = document.getElementById("tab-products");
const tabOrders = document.getElementById("tab-orders");
const panelProducts = document.getElementById("panel-products");
const panelOrders = document.getElementById("panel-orders");
const panelSales = document.getElementById("panel-sales");
const headlineEl = document.getElementById("sales-headline");
const msgEl = document.getElementById("sales-msg");
const canvas = document.getElementById("sales-chart");
const tableEl = document.getElementById("sales-table");

function el(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

// 오류 글은 줄이지 않고 콘솔에 남기고, 화면에는 한 줄로만 알린다
function report(what, err) {
  console.error(`${what}: ${err.code ? err.code + ": " : ""}${err.message}`, err);
  return `${what} 못했습니다 (자세한 글은 브라우저 콘솔)`;
}

// 어제부터 거꾸로 7일 - 한국 날짜로 센다. 오래된 날이 앞
function lastDays() {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const days = [];
  for (let back = DAYS; back >= 1; back--) {
    const date = new Date(Date.UTC(y, m - 1, d - back));
    const iso = date.toISOString().slice(0, 10);
    days.push({ id: iso.replaceAll("-", ""), label: iso.slice(5) });
  }
  return days;
}

function when(value) {
  return value && value.toDate ? value.toDate().toLocaleString("ko-KR") : "";
}

function won(n) {
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

function showTab() {
  panelProducts.hidden = true;
  panelOrders.hidden = true;
  panelSales.hidden = false;
  tabProducts.setAttribute("aria-pressed", "false");
  tabOrders.setAttribute("aria-pressed", "false");
  tabSales.setAttribute("aria-pressed", "true");
  tabProducts.style.fontWeight = "400";
  tabOrders.style.fontWeight = "400";
  tabSales.style.fontWeight = "700";
  if (!loaded) load();
}

// 다른 탭을 누르면 매출 칸을 닫는다 - 다른 탭의 코드는 그대로 두고, 여기서 따로 듣는다
function leaveSales() {
  panelSales.hidden = true;
  tabSales.setAttribute("aria-pressed", "false");
  tabSales.style.fontWeight = "400";
}

tabSales.addEventListener("click", showTab);
tabProducts.addEventListener("click", leaveSales);
tabOrders.addEventListener("click", leaveSales);

async function load() {
  msgEl.textContent = "";
  try {
    const days = lastDays();
    // 날짜마다 문서 한 장씩만 읽는다
    const snaps = await Promise.all(days.map((day) => getDoc(doc(db, "dailyStats", day.id))));
    const stats = snaps.map((snap) => (snap.exists() ? snap.data() : null));
    loaded = true;
    draw(days, stats);
  } catch (err) {
    msgEl.textContent = report("매출을 읽지", err);
  }
}

function draw(days, stats) {
  // 맨 위 한 줄 - 가장 최근 문서의 날짜와 센 시각
  let latest = -1;
  stats.forEach((s, i) => { if (s) latest = i; });
  if (latest < 0) {
    headlineEl.textContent = "집계된 날이 없습니다";
  } else {
    const id = days[latest].id;
    const text = `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6)}까지의 매출입니다 - 매일 00:05에 전날을 셉니다`;
    headlineEl.textContent = `${text} · 마지막으로 센 시각 ${when(stats[latest].countedAt)}`;
  }

  // 막대 차트 - 문서가 없는 날은 0이 아니라 비워 두고 날짜 아래에 「집계 없음」
  const labels = days.map((day, i) => (stats[i] ? day.label : [day.label, "집계 없음"]));
  const data = stats.map((s) => (s ? s.totalSales : null));
  if (chart) chart.destroy();
  chart = new window.Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ label: "매출(원)", data }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // 표 - 날짜 · 건수 · 매출 · 센 시각 (취소 건수가 있으면 표에만)
  const table = el("table");
  table.style.cssText = "width:100%;border-collapse:collapse;";
  const head = el("tr");
  ["날짜", "건수", "매출", "취소", "센 시각"].forEach((t) => head.append(el("th", t)));
  table.append(head);
  days.forEach((day, i) => {
    const s = stats[i];
    const tr = el("tr");
    tr.append(el("td", `${day.id.slice(0, 4)}-${day.label}`));
    if (!s) {
      const none = el("td", "집계 없음");
      none.colSpan = 4;
      tr.append(none);
    } else {
      tr.append(el("td", String(s.orderCount ?? "")), el("td", won(s.totalSales ?? 0)));
      tr.append(el("td", s.canceledCount === undefined ? "" : String(s.canceledCount)), el("td", when(s.countedAt)));
    }
    table.append(tr);
  });
  tableEl.replaceChildren(table);
}

export function showSales() {
  db = getFirestore(getApp());
  tabSales.hidden = false;
}

export function hideSales() {
  tabSales.hidden = true;
  panelSales.hidden = true;
  loaded = false;
  if (chart) {
    chart.destroy();
    chart = null;
  }
  headlineEl.textContent = "";
  tableEl.replaceChildren();
}
