// 주문을 마친 손님에게만 「알림을 받을지」 묻는 카드 - 주문 완료 화면과 「바로 주문」 성공 뒤에서만 부른다
// 알림 받을 주소(토큰)는 받지 않는다. 브라우저 허락 창은 「알림 받기」 단추를 누른 처리 안에서만 띄운다.

import { savePushToken } from "./push-token.js";

const CARD_ID = "notify-card";
const GRANTED_TEXT = "알림을 받고 있어요";
const DENIED_TEXT = "브라우저 주소창 왼쪽 아이콘 → 알림에서 켤 수 있어요";

function makeLine(text) {
  const line = document.createElement("p");
  line.id = CARD_ID;
  line.textContent = text;
  line.style.cssText = "margin: 16px 0 0; color: var(--sub); font-size: 14px;";
  return line;
}

// anchor 바로 아래에 카드(또는 안내 한 줄)를 붙인다
export function showNotifyCard(anchor) {
  if (!anchor || !("Notification" in window)) return;

  // 같은 화면에서 주문을 또 해도 카드가 겹치지 않게 앞의 것을 치운다
  const old = document.getElementById(CARD_ID);
  if (old) old.remove();

  const permission = Notification.permission;

  if (permission === "granted") {
    anchor.after(makeLine(GRANTED_TEXT));
    return;
  }
  if (permission === "denied") {
    anchor.after(makeLine(DENIED_TEXT));
    return;
  }

  // default - 아직 묻지 않았다: 카드를 보여 준다 (허락 창은 아직 띄우지 않는다)
  const card = document.createElement("div");
  card.id = CARD_ID;
  card.style.cssText =
    "margin: 16px 0 0; padding: 16px; max-width: 360px; border: 1px solid var(--line); border-radius: 12px; background: var(--card);";

  const title = document.createElement("p");
  title.textContent = "배송이 출발하면 알려 드릴까요?";
  title.style.cssText = "margin: 0 0 12px; font-weight: 600;";

  const row = document.createElement("div");
  row.style.cssText = "display: flex; gap: 8px;";

  const yes = document.createElement("button");
  yes.type = "button";
  yes.className = "btn";
  yes.textContent = "알림 받기";

  const later = document.createElement("button");
  later.type = "button";
  later.className = "btn ghost";
  later.textContent = "나중에";

  // 「나중에」 - 이번 주문에서는 카드를 숨긴다
  later.addEventListener("click", () => card.remove());

  // 「알림 받기」 - 브라우저 허락 창은 이 단추를 누른 이 처리 안에서만 띄운다
  yes.addEventListener("click", async () => {
    yes.disabled = true;
    later.disabled = true;
    let result = "default";
    try {
      result = await Notification.requestPermission();
    } catch (error) {
      console.error("알림 허락 창을 띄우지 못했습니다:", error);
    }
    console.log("알림 허락 결과:", result);

    if (result === "granted") {
      card.replaceWith(makeLine(GRANTED_TEXT));
      // granted 가 된 바로 그 자리에서 알림 받는 주소(토큰)를 받아 적는다
      savePushToken({ force: true });
    } else if (result === "denied") {
      card.replaceWith(makeLine(DENIED_TEXT));
    } else {
      // default - 손님이 창을 닫기만 했다: 카드를 그대로 두고 다시 누를 수 있게 한다
      yes.disabled = false;
      later.disabled = false;
    }
  });

  row.append(yes, later);
  card.append(title, row);
  anchor.after(card);
}
