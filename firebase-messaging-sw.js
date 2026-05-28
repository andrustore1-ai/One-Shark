/* firebase-messaging-sw.js */
const CACHE_NAME = "bbbb-store-pwa-v20260528_invoice1-stockpath-final3";
const APP_SHELL = [
  "./",
  "index.html",
  "store.html",
  "login.html",
  "order.html",
  "pay.html",
  "admin.html",
  "admin-core.js",
  "admin2.js",
  "store-cashier-sync-stockpath.js",
  "firebase-config.js",
  "pwa-register.js",
  "app-icon-192.png",
  "app-icon-512.png",
  "manifest.json",
  "manifest.webmanifest"
];

const firebaseConfig5546 = {
  apiKey: "AIzaSyANRh5cSHuNzSJrSRa-vslWownoYos2mT4",
  authDomain: "bbbb-a5332.firebaseapp.com",
  databaseURL: "https://bbbb-a5332-default-rtdb.firebaseio.com",
  projectId: "bbbb-a5332",
  storageBucket: "bbbb-a5332.firebasestorage.app",
  messagingSenderId: "261450260086",
  appId: "1:261450260086:web:5aa538c40ea527efb64957",
  measurementId: "G-QMG6J94FBE"
};

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if(request.method !== "GET") return;
  const url = new URL(request.url);

  if(request.mode === "navigate"){
    event.respondWith(
      fetch(request).catch(() => caches.match("index.html"))
    );
    return;
  }

  if(url.origin === self.location.origin){
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => null);
        return response;
      }).catch(() => cached))
    );
  }
});

function normalizeNotificationUrl(url){
  try{
    if(!url) return new URL("admin.html?tab=orders", self.location.origin).href;
    return new URL(url, self.location.origin).href;
  }catch(e){
    return new URL("admin.html?tab=orders", self.location.origin).href;
  }
}

async function openTargetUrl(url){
  const target = normalizeNotificationUrl(url);
  const allClients = await clients.matchAll({ type:"window", includeUncontrolled:true });
  for(const client of allClients){
    try{
      if("navigate" in client){
        const nav = await client.navigate(target);
        if(nav) return nav.focus();
      }
      return client.focus();
    }catch(e){}
  }
  return clients.openWindow(target);
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(openTargetUrl(data.url || data.click_action || data.link));
});

try{
  importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");
  firebase.initializeApp(firebaseConfig5546);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    const data = payload.data || {};
    const orderId = data.orderId || data.order_id || "";
    const title = payload.notification?.title || data.title || "طلب جديد في المتجر";
    const body = payload.notification?.body || data.body || "اضغط لعرض الطلب";
    const url = data.url || data.link || data.click_action || (orderId ? `admin.html?tab=orders&order=${encodeURIComponent(orderId)}` : "admin.html?tab=orders");
    return self.registration.showNotification(title, {
      body,
      icon: data.icon || "app-icon-192.png",
      badge: data.badge || "app-icon-192.png",
      tag: data.tag || (orderId ? `order-${orderId}` : "store-order"),
      renotify: true,
      requireInteraction: true,
      data: { url, orderId }
    });
  });
}catch(e){
  console.warn("Firebase Messaging service worker skipped", e);
}
