import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const app = getApp();
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");
// 내 컴퓨터(localhost)에서 열었을 때만 에뮬레이터 함수를 부른다
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
const askShopBot = httpsCallable(functions, "askShopBot");

// 오른쪽 아래 동그란 버튼
const button = document.createElement("button");
button.type = "button";
button.id = "shopbot-button";
button.textContent = "💬";
button.setAttribute("aria-label", "상점 도우미에게 물어보기");
button.style.cssText =
  "position: fixed; right: 20px; bottom: 20px; width: 56px; height: 56px; border-radius: 50%; border: none; " +
  "cursor: pointer; font-size: 26px; line-height: 1; color: var(--accent-ink, #000); z-index: 1000; " +
  "background: linear-gradient(90deg, var(--accent), var(--accent2)); box-shadow: 0 6px 20px rgba(0,0,0,.35);";

// 작은 대화 창
const panel = document.createElement("div");
panel.id = "shopbot-panel";
panel.hidden = true;
panel.style.cssText =
  "position: fixed; right: 20px; bottom: 88px; width: min(340px, calc(100vw - 40px)); max-height: 70vh; " +
  "display: flex; flex-direction: column; background: var(--card); color: var(--ink); " +
  "border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.4); z-index: 1000; overflow: hidden;";

const head = document.createElement("div");
head.textContent = "상점 도우미";
head.style.cssText = "padding: 12px 14px; font-weight: 600; border-bottom: 1px solid var(--line);";

const log = document.createElement("div");
log.style.cssText = "flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; font-size: 14px;";

const form = document.createElement("form");
form.style.cssText = "display: flex; gap: 8px; padding: 10px; border-top: 1px solid var(--line);";

const input = document.createElement("input");
input.type = "text";
input.maxLength = 300;
input.placeholder = "궁금한 것을 물어보세요";
input.style.cssText =
  "flex: 1; min-width: 0; padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; " +
  "background: transparent; color: var(--ink); font-family: inherit;";

const send = document.createElement("button");
send.type = "submit";
send.textContent = "보내기";
send.style.cssText =
  "padding: 9px 12px; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: 600; " +
  "background: linear-gradient(90deg, var(--accent), var(--accent2)); color: var(--accent-ink, #000);";

form.append(input, send);
panel.append(head, log, form);
document.body.append(button, panel);

function addLine(text, mine) {
  const line = document.createElement("div");
  line.textContent = text;
  line.style.cssText =
    "padding: 8px 10px; border-radius: 10px; white-space: pre-wrap; word-break: break-word; max-width: 90%; " +
    (mine
      ? "align-self: flex-end; background: var(--line);"
      : "align-self: flex-start; border: 1px solid var(--line);");
  log.append(line);
  log.scrollTop = log.scrollHeight;
  return line;
}

// 창을 열 때 로그인했는지 본다 - 로그인 안 한 손님에게는 안내 한 줄만 보여 준다
async function checkLogin() {
  await auth.authStateReady();
  const loggedIn = !!auth.currentUser;
  input.disabled = !loggedIn;
  send.disabled = !loggedIn;
  return loggedIn;
}

let opened = false;
button.addEventListener("click", async () => {
  panel.hidden = !panel.hidden;
  if (panel.hidden || opened) return;
  opened = true;
  if (await checkLogin()) {
    addLine("안녕하세요! 상품 이름과 가격을 물어보세요.", false);
    input.focus();
  } else {
    addLine("로그인한 뒤에 물어볼 수 있어요", false);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  if (!(await checkLogin())) {
    addLine("로그인한 뒤에 물어볼 수 있어요", false);
    return;
  }

  addLine(question, true);
  input.value = "";
  input.disabled = true;
  send.disabled = true;
  const waiting = addLine("답을 찾는 중…", false);
  try {
    const result = await askShopBot({ question });
    waiting.textContent = result.data.answer;
  } catch (error) {
    waiting.textContent = error.message;
  } finally {
    input.disabled = false;
    send.disabled = false;
    input.focus();
  }
});
