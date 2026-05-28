/* cloud-function-send-order-notification.js
   ملف مرجعي اختياري لتشغيل إشعارات FCM عندما يكون تطبيق الأدمن مغلقًا.
   انشره داخل Firebase Cloud Functions في مشروع bbbb-a5332.
   عدّل APP_BASE_URL إذا رفعت الموقع على دومين آخر.
*/

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

const APP_BASE_URL = "https://bbbb-a5332.web.app";
const TOKENS_PATH = "settingsMohanad/adminPushTokensMohanad";
exports.notifyAdminOnNewOrder = functions.database.ref("/ordersMohanad/{orderId}").onCreate(async (snapshot, context) => {
  const order = snapshot.val() || {};
  const orderId = context.params.orderId;
  const total = order?.pricing?.displayTotal || order?.displayAmount || "";
  const name = order?.name || order?.customerName || "زبون";
  const link = `${APP_BASE_URL}/admin.html?tab=orders&order=${encodeURIComponent(orderId)}`;

  const tokensSnap = await admin.database().ref(TOKENS_PATH).once("value");
  const tokens = [];
  tokensSnap.forEach(child => {
    const token = child.child("token").val();
    const enabled = child.child("enabled").val();
    if (token && enabled !== false) tokens.push(token);
  });
  if (!tokens.length) return null;

  const message = {
    tokens,
    notification: {
      title: "طلب جديد في المتجر",
      body: `${name} - ${total}`
    },
    data: {
      orderId: String(orderId),
      title: "طلب جديد في المتجر",
      body: `${name} - ${total}`,
      url: link,
      link
    },
    webpush: {
      fcmOptions: { link },
      notification: {
        icon: `${APP_BASE_URL}/app-icon-192.png`,
        badge: `${APP_BASE_URL}/app-icon-192.png`,
        requireInteraction: true,
        renotify: true,
        tag: `order-${orderId}`
      }
    }
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  const invalid = [];
  response.responses.forEach((result, index) => {
    if (!result.success) invalid.push(tokens[index]);
  });
  if (invalid.length) {
    const updates = {};
    tokensSnap.forEach(child => {
      if (invalid.includes(child.child("token").val())) updates[child.key] = null;
    });
    await admin.database().ref(TOKENS_PATH).update(updates);
  }
  return null;
});
