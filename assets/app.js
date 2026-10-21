/* ===========================================================
   하루상점 — 화면을 그리고 장바구니를 다루는 코드
   이 파일은 고치지 않아도 됩니다. (상품은 shop.js 에 있습니다)
   =========================================================== */

const won = n => n.toLocaleString("ko-KR") + "원";
const findProduct = id => PRODUCTS.find(p => p.id === id);
const qs = key => new URLSearchParams(location.search).get(key);

/* --- 장바구니는 브라우저에 저장합니다 --- */
const Cart = {
  read() {
    try { return JSON.parse(localStorage.getItem("haru_cart") || "[]"); }
    catch (e) { return []; }
  },
  write(items) {
    localStorage.setItem("haru_cart", JSON.stringify(items));
  },
  add(id) {
    const items = Cart.read();
    const hit = items.find(i => i.id === id);
    if (hit) hit.qty += 1;
    else items.push({ id, qty: 1 });
    Cart.write(items);

    // 담은 상품의 이름과 가격을 상품 목록에서 찾아 온다
   const p = findProduct(id);
   // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
   window.dataLayer = window.dataLayer || [];
   // 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
   dataLayer.push({ ecommerce: null });
   // 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
   dataLayer.push({
     // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
     event: "add_to_cart",
     // 같이 보내는 상품 값 묶음
     ecommerce: {
    // 어느 나라 돈인가
       currency: "KRW",
    // 금액 - 한 번 누르면 한 개라 그 상품 가격 하나
       value: p.price,
    // 담은 상품 상자 하나를 목록에 넣는다
       items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
     }
   });

  },
  remove(id) {
    Cart.write(Cart.read().filter(i => i.id !== id));
  },
  clear() {
    localStorage.removeItem("haru_cart");
  },
  count() {
    return Cart.read().reduce((sum, i) => sum + i.qty, 0);
  },
  total() {
    return Cart.read().reduce((sum, i) => {
      const p = findProduct(i.id);
      return sum + (p ? p.price * i.qty : 0);
    }, 0);
  }
};

/* --- 머리글과 꼬리글 --- */
function paintChrome() {
  // 화면마다 제목이 달라야 검색에서 구분됩니다.
  // 그래서 제목을 통째로 바꾸지 않고 가게 이름만 갈아 끼웁니다.
  document.title = document.title.replaceAll("하루상점", SHOP.name);

  const brand = document.querySelector(".brand");
  if (brand) brand.textContent = SHOP.name;

  const badge = document.querySelector(".cart-count");
  if (badge) badge.textContent = Cart.count();

  const foot = document.querySelector("footer.site .wrap");
  if (foot) foot.textContent = SHOP.name + " · " + SHOP.tagline;
}

/* --- 상품 목록 --- */
function paintList() {
  const box = document.querySelector("#product-list");
  if (!box) return;

  document.querySelector("#hero-title").textContent = SHOP.name;
  document.querySelector("#hero-tagline").textContent = SHOP.tagline;

  const PAGE_SIZE = 3;
  const source = window.productSource;
  let cursor = null;
  let reads = 0;
  let shown = 0;

  const more = document.createElement("button");
  more.className = "btn";
  more.textContent = "더 보기";
  more.style.marginTop = "24px";
  box.after(more);

  const countEl = document.createElement("p");
  countEl.style.cssText = "color: var(--sub); font-size: 13px; margin: 16px 0 0;";
  countEl.hidden = true;
  box.after(countEl);

  const errEl = document.createElement("p");
  errEl.style.cssText = "color: var(--sub); font-size: 13px; margin: 8px 0 0;";
  errEl.hidden = true;
  countEl.after(errEl);

  const card = p => `
    <a class="card" href="product.html?id=${p.id}">
      <div class="thumb">${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" style="display: block; width: 100%; height: 140px; object-fit: cover; border-radius: 8px;">` : p.emoji}</div>
      <h3>${p.name}</h3>
      <p class="sum">${p.summary}</p>
      <div class="price">${won(p.price)}</div>${typeof p.stock === "number" ? `
      <div class="stock" style="font-size: 13px; color: var(--sub);">${p.stock > 0 ? `재고 ${p.stock}개` : "품절"}</div>` : ""}
    </a>`;

  async function fetchNext() {
    try {
      if (!source) throw new Error("window.productSource 가 없습니다 (assets/products-firestore.js 를 불러오지 못했습니다)");
      const page = await Promise.race([
        source.loadPage(cursor),
        new Promise((_, reject) => setTimeout(() => reject(new Error("5초 안에 Firestore 응답이 오지 않았습니다")), 5000))
      ]);
      cursor = page.cursor;
      reads += page.reads;
      countEl.textContent = `이번 화면에서 읽은 문서 ${reads}장`;
      countEl.hidden = false;
      return {
        items: page.items.map(i => ({ ...i, emoji: (findProduct(i.id) || {}).emoji || "🛍️" })),
        last: page.items.length < PAGE_SIZE
      };
    } catch (e) {
      console.error(`${e.code ? e.code + ": " : ""}${e.message}`);
      errEl.textContent = "목록을 불러오지 못했습니다";
      errEl.hidden = false;
      return { items: [], last: true };
    }
  }

  async function showMore() {
    more.disabled = true;
    const { items, last } = await fetchNext();
    box.insertAdjacentHTML("beforeend", items.map(card).join(""));
    shown += items.length;
    more.disabled = false;
    if (last || items.length === 0) more.style.display = "none";
  }

  more.addEventListener("click", showMore);
  showMore();
}

/* --- 상품 상세 --- */
function paintDetail() {
  const box = document.querySelector("#product-detail");
  if (!box) return;

  const p = findProduct(qs("id"));
  if (!p) { box.innerHTML = '<p class="empty">그런 상품이 없습니다.</p>'; return; }

  document.title = p.name + " — " + SHOP.name;
  box.innerHTML = `
    <div class="thumb">${p.emoji}</div>
    <div>
      <h1>${p.name}</h1>
      <div class="price">${won(p.price)}</div>
      <div class="body prose">${p.detail.map(t => `<p>${t}</p>`).join("")}</div>
      <button class="btn" id="add-to-cart">장바구니에 담기</button>
      <button class="btn ghost" id="order-now">바로 주문</button>
      <p id="order-msg" style="margin: 14px 0 0; color: var(--sub);"></p>
    </div>`;

  window.dataLayer = window.dataLayer || [];
  dataLayer.push({ ecommerce: null });
  dataLayer.push({
    event: "view_item",
    ecommerce: {
      currency: "KRW",
      value: p.price,
      items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
    }
  });

  document.querySelector("#add-to-cart").addEventListener("click", () => {
    Cart.add(p.id);
    location.href = "cart.html";
  });
}

/* --- 장바구니 --- */
function paintCart() {
  const box = document.querySelector("#cart-box");
  if (!box) return;

  const items = Cart.read();
  if (items.length === 0) {
    box.innerHTML = '<p class="empty">장바구니가 비어 있습니다.</p>';
    return;
  }

  box.innerHTML = `
    <table class="cart">
      <tr><th>상품</th><th>수량</th><th>금액</th><th></th></tr>
      ${items.map(i => {
        const p = findProduct(i.id);
        if (!p) return "";
        return `<tr>
          <td>${p.emoji} ${p.name}</td>
          <td>${i.qty}</td>
          <td>${won(p.price * i.qty)}</td>
          <td><button class="btn ghost drop" data-id="${p.id}">빼기</button></td>
        </tr>`;
      }).join("")}
    </table>
    <div class="total">합계 ${won(Cart.total())}</div>
    <a class="btn" href="checkout.html">결제하기</a>`;

  box.querySelectorAll(".drop").forEach(b => {
    b.addEventListener("click", () => { Cart.remove(b.dataset.id); location.reload(); });
  });
}

/* --- 결제 --- */
function paintCheckout() {
  const form = document.querySelector("#pay-form");
  if (!form) return;

  const sum = document.querySelector("#pay-total");
  if (sum) sum.textContent = won(Cart.total());

  // ▼ 여기에 「결제를 시작했다」를 알리는 코드가 들어갑니다 (뒤 수업에서)

  window.dataLayer = window.dataLayer || [];
  dataLayer.push({ ecommerce: null });
  dataLayer.push({
    event: "begin_checkout",
    ecommerce: {
      currency: "KRW",
      value: Cart.total(),
      items: Cart.read().map(i => {
        const p = findProduct(i.id);
        return { item_id: p.id, item_name: p.name, price: p.price, quantity: i.qty };
      })
    },
    free_shipping: Cart.total() >= 50000 ? "yes" : "no"
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();

    // ▼ 여기에 「결제를 마쳤다」를 알리는 코드가 들어갑니다 (뒤 수업에서)

    // purchase 는 주문 완료 화면(assets/order-done.js)이 결제 성공일 때 한 번 보낸다

    // 포트원 결제창(테스트) - 결과는 주문 완료 화면 한 곳에서만 받는다
    const cartItems = Cart.read();
    if (cartItems.length === 0) return;
    const firstName = findProduct(cartItems[0].id).name;
    const orderName = cartItems.length > 1 ? `${firstName} 외 ${cartItems.length - 1}건` : firstName;
    const paymentId = `HARU-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    let result = document.querySelector("#pay-result");
    if (!result) {
      result = document.createElement("p");
      result.id = "pay-result";
      result.style.cssText = "margin: 16px 0 0; color: var(--sub); white-space: pre-wrap; word-break: break-all;";
      form.after(result);
    }
    result.textContent = `paymentId: ${paymentId}`;

    try {
      const response = await PortOne.requestPayment({
        storeId: "store-a9d0c42d-2b1e-4f48-af8e-4aab8d1299d6",
        channelKey: "channel-key-52baec72-61e4-42bb-975a-f3d6e73e6639",
        paymentId,
        orderName,
        totalAmount: Cart.total(),
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customData: { items: cartItems.map(i => ({ id: i.id, qty: i.qty })) },
        redirectUrl: new URL("done.html", location.href).href
      });
      // PC 는 결제창이 결과를 돌려준다 - 휴대폰이 주소 뒤에 붙여 오는 것과 같은 모양(paymentId · code · message)으로 넘긴다
      if (response) {
        const query = new URLSearchParams();
        query.set("paymentId", response.paymentId || paymentId);
        if (response.code != null) query.set("code", response.code);
        if (response.message != null) query.set("message", response.message);
        location.href = `done.html?${query}`;
      }
    } catch (error) {
      result.textContent += `\n${error}`;
    }
  });
}

/* --- 가게 소개·배송 안내 글 --- */
function paintProse() {
  const about = document.querySelector("#about-body");
  if (about) about.innerHTML = SHOP.about.map(t => `<p>${t}</p>`).join("");

  const ship = document.querySelector("#shipping-body");
  if (ship) ship.innerHTML = SHOP.shipping.map(t => `<p>${t}</p>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  paintChrome();
  paintList();
  paintDetail();
  paintCart();
  paintCheckout();
  paintProse();
});
