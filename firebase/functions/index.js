// 에뮬레이터에서만 돌린다. 배포하지 않는다.
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// 갑자기 요청이 몰려도 함수가 10개 넘게 뜨지 않게 한다 (비용 상한)
setGlobalOptions({ maxInstances: 10 });

// 시크릿 값은 코드에 적지 않는다 - 에뮬레이터는 functions/.secret.local 에서 읽는다
const portoneApiSecret = defineSecret("PORTONE_API_SECRET");
// Gemini API 키도 같다 - 가게 화면 코드에는 넣지 않고 함수가 돌 때만 .value() 로 꺼낸다
const geminiApiKey = defineSecret("GEMINI_API_KEY");

if (getApps().length === 0) initializeApp();

// customData 가 글자 한 줄로 오면 풀어서 읽는다
function readCustomData(raw) {
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return raw || null;
}

// customData 의 상품 ID · 수량으로 에뮬레이터 Firestore 의 products 가격을 읽어 기준 금액을 계산한다
async function expectedAmount(customData) {
  const items = (customData && customData.items) || [];
  const db = getFirestore();
  let sum = 0;
  for (const item of items) {
    const snap = await db.collection("products").doc(item.id).get();
    if (!snap.exists) throw new Error(`products/${item.id} 문서를 찾을 수 없습니다`);
    sum += snap.data().price * item.qty;
  }
  return sum;
}

// 검증을 통과한 결제만 orders 에 주문 문서 한 장으로 남긴다 - 문서 이름은 결제 ID
// create() 는 같은 이름의 문서가 이미 있으면 덮어쓰지 않고 실패한다
async function createOrder(paymentId, customData, expected, paidAmount, paidAt) {
  const ref = getFirestore().collection("orders").doc(paymentId);
  try {
    await ref.create({
      paymentId,
      userId: (customData && customData.userId) || "",
      items: (customData && customData.items) || [],
      totalPrice: expected,
      paidAmount,
      paidAt,
      status: "paid",
      createdAt: FieldValue.serverTimestamp()
    });
    console.log(`주문 생성: ${paymentId}`);
  } catch (error) {
    if (error.code === 6 || error.code === "already-exists") {
      console.log(`이미 있는 주문 - 건너뜀: ${paymentId}`);
    } else {
      throw error;
    }
  }
}

// 포트원이 보내는 웹훅을 받는다 - type 과 data.paymentId 를 한 줄로 찍고 200 으로 답한다
exports.portoneWebhook = onRequest({ secrets: [portoneApiSecret] }, async (req, res) => {
  const body = req.body || {};
  const paymentId = body.data && body.data.paymentId;
  console.log(`type=${body.type} paymentId=${paymentId}`);

  // 받은 결제 ID 로 포트원 V2 API 에 그 결제를 다시 조회해 금액을 확인한다
  if (paymentId) {
    try {
      const response = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `PortOne ${portoneApiSecret.value()}` }
      });
      const text = await response.text();

      if (!response.ok) {
        console.log(`조회 실패: 상태 코드 ${response.status} ${text}`);
      } else {
        const payment = JSON.parse(text);
        const customData = readCustomData(payment.customData);
        const paidAmount = payment.amount && payment.amount.total;
        console.log(`결제 상태: ${payment.status}`);
        console.log(`결제 금액: ${paidAmount}`);
        console.log(`customData: ${JSON.stringify(customData)}`);

        const expected = await expectedAmount(customData);
        if (payment.status === "PAID" && paidAmount === expected) {
          console.log(`검증 통과: ${paymentId} 기준 금액 ${expected} 결제 금액 ${paidAmount}`);
          // paidAt 은 포트원에서 다시 조회한 결제에 적힌 결제 완료 시각 - 없으면 빈 글자
          await createOrder(paymentId, customData, expected, paidAmount, payment.paidAt || "");
        } else {
          console.log(`금액 불일치: ${paymentId} 기준 금액 ${expected} 결제 금액 ${paidAmount}`);
        }
      }
    } catch (error) {
      console.log(`확인 중 오류: ${error.message}`);
    }
  }

  res.status(200).send("ok");
});

// 실습 188 - shopPing : 바깥에서 주소로 불러 함수가 깨어 있는지 보는 HTTP 함수
exports.shopPing = onRequest({ region: "us-central1" }, (req, res) => {
  const now = new Date().toISOString();
  res.send("하루상점 함수가 깨어 있습니다 · " + now);
});

// 실습 189 - calcOrderTotal : 상품 ID 와 수량만 받아 Firestore 가격으로 금액을 센다
exports.calcOrderTotal = onCall({ region: "us-central1" }, async (request) => {
  // 확인 1. 로그인 - 함수 안에서는 보안 규칙이 돌지 않으니 코드가 직접 본다
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다");
  }

  // 확인 2. 수량이 말이 되는지 - 1 이상의 정수만 받는다
  const productId = request.data && request.data.productId;
  const quantity = request.data && request.data.quantity;
  if (typeof productId !== "string" || productId === "" || productId.includes("/")) {
    throw new HttpsError("invalid-argument", "productId 가 올바르지 않습니다");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new HttpsError("invalid-argument", "quantity 는 1 이상 정수여야 합니다");
  }

  // 확인 3. 가격은 Firestore 에서 읽는다 - 화면이 price 를 보내도 쓰지 않는다
  const snap = await getFirestore().collection("products").doc(productId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "상품이 없습니다: " + productId);
  }
  return { totalPrice: snap.get("price") * quantity };
});

// askShopBot : 손님 질문 하나를 받아 Gemini 답 하나를 돌려준다 (앞 대화는 기억하지 않는다)
const NOT_KNOWN = "그건 제가 아직 모르는 내용이에요";

exports.askShopBot = onCall({ region: "us-central1", secrets: [geminiApiKey] }, async (request) => {
  // 로그인 안 했으면 거절한다
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다");
  }

  const question = request.data && request.data.question;
  if (typeof question !== "string" || question.trim() === "" || question.length > 300) {
    throw new HttpsError("invalid-argument", "question 은 1자 이상 300자 이하의 글자여야 합니다");
  }

  // 근거는 Firestore products 의 상품 이름 · 가격뿐이다 (숨긴 상품은 뺀다)
  const snap = await getFirestore().collection("products").get();
  const lines = snap.docs
    .map((d) => d.data())
    .filter((p) => p.isVisible !== false && p.name && typeof p.price === "number")
    .map((p) => `- ${p.name}: ${p.price}원`);

  const instruction =
    "너는 GOAT상점의 안내 도우미야. 아래 상품 목록(이름 · 가격)만 근거로 한국어로 짧게 답해. " +
    `목록에 없는 것은 지어내지 말고 "${NOT_KNOWN}" 라고만 답해.\n\n상품 목록:\n` +
    (lines.length ? lines.join("\n") : "(비어 있음)");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey.value() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ role: "user", parts: [{ text: question.trim() }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
      })
    }
  );

  if (!response.ok) {
    // 키가 새지 않게 상태 코드만 남긴다
    console.log(`askShopBot: Gemini 응답 실패 상태 코드 ${response.status}`);
    throw new HttpsError("unavailable", "지금은 답을 가져오지 못했어요. 잠시 뒤에 다시 물어봐 주세요");
  }

  const result = await response.json();
  const parts = result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts;
  const answer = parts ? parts.map((part) => part.text || "").join("").trim() : "";
  return { answer: answer || NOT_KNOWN };
});

Object.assign(exports, require("./automation"));

Object.assign(exports, require("./admin"));
