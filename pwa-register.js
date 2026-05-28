/* pwa-register.js - تثبيت التطبيق مرة واحدة + Service Worker */
(function(){
  "use strict";

  const SW_FILE = "firebase-messaging-sw.js";
  const INSTALL_SEEN_KEY = "store_pwa_install_prompt_seen_v3";
  const INSTALL_DONE_KEY = "store_pwa_installed_v3";
  const SECURE = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  let deferredPrompt = null;
  let installCard = null;
  let installed = false;

  function isStandalone(){
    return window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
      window.navigator.standalone === true;
  }

  function hasSeenInstall(){
    return localStorage.getItem(INSTALL_SEEN_KEY) === "1" || localStorage.getItem(INSTALL_DONE_KEY) === "1";
  }

  function markInstallSeen(){
    try{ localStorage.setItem(INSTALL_SEEN_KEY, "1"); }catch(e){}
  }

  function injectStyle(){
    if(document.getElementById("pwaInstallStyle")) return;
    const style = document.createElement("style");
    style.id = "pwaInstallStyle";
    style.textContent = `
      .pwa-install-card{position:fixed;left:14px;right:14px;bottom:14px;z-index:99999;display:none;align-items:center;gap:12px;padding:12px;border-radius:22px;background:rgba(7,16,24,.96);border:1px solid rgba(255,255,255,.14);box-shadow:0 22px 60px rgba(0,0,0,.36);backdrop-filter:blur(14px);font-family:Cairo,system-ui,sans-serif;direction:rtl;color:#fff;max-width:460px;margin-inline:auto;}
      .pwa-install-card.show{display:flex;animation:pwaSlide .22s ease-out both;}
      @keyframes pwaSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
      .pwa-install-icon{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;overflow:hidden;background:#fff;flex:0 0 auto;}
      .pwa-install-icon img{width:100%;height:100%;object-fit:cover;}
      .pwa-install-text{min-width:0;flex:1;}
      .pwa-install-title{font-size:14px;font-weight:900;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .pwa-install-sub{font-size:11px;font-weight:800;opacity:.72;line-height:1.4;margin-top:1px;}
      .pwa-install-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto;}
      .pwa-install-btn{border:0;border-radius:14px;background:linear-gradient(135deg,#f37021,#ff9d55);color:#fff;font-size:12px;font-weight:900;padding:10px 13px;cursor:pointer;box-shadow:0 10px 28px rgba(243,112,33,.32);font-family:inherit;}
      .pwa-install-close{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;border-radius:12px;width:36px;height:36px;cursor:pointer;font-size:20px;line-height:1;font-family:inherit;}
      .pwa-install-toast{position:fixed;left:16px;right:16px;bottom:86px;z-index:100000;display:none;max-width:520px;margin-inline:auto;padding:12px 14px;border-radius:18px;background:#071018;color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 50px rgba(0,0,0,.34);font-family:Cairo,system-ui,sans-serif;direction:rtl;font-size:12px;font-weight:800;line-height:1.8;}
      .pwa-install-toast.show{display:block;}
      @media (min-width:720px){.pwa-install-card{right:auto;left:22px;width:420px}.pwa-install-toast{right:auto;left:22px;width:420px}}
    `;
    document.head.appendChild(style);
  }

  function getAppName(){
    const fromTitle = (document.title || "").split("|")[0].trim();
    const brand = document.getElementById("storeName")?.textContent?.trim() ||
      document.getElementById("brandTitle")?.textContent?.trim() ||
      document.getElementById("homeStoreName")?.textContent?.trim() ||
      document.querySelector("[data-store-name]")?.textContent?.trim();
    return brand || fromTitle || "المتجر";
  }

  function makeInstallCard(){
    if(installCard) return installCard;
    injectStyle();
    const card = document.createElement("div");
    card.className = "pwa-install-card";
    card.id = "pwaInstallCard";
    card.innerHTML = `
      <div class="pwa-install-icon"><img src="app-icon-192.png" alt=""></div>
      <div class="pwa-install-text">
        <div class="pwa-install-title">ثبت التطبيق على الشاشة الرئيسية</div>
        <div class="pwa-install-sub">سوف يفتح كتطبيق مستقل بدون شريط المتصفح</div>
      </div>
      <div class="pwa-install-actions">
        <button class="pwa-install-btn" type="button" id="pwaInstallBtn">تثبيت</button>
        <button class="pwa-install-close" type="button" id="pwaInstallClose" aria-label="إغلاق">×</button>
      </div>
    `;
    const toast = document.createElement("div");
    toast.className = "pwa-install-toast";
    toast.id = "pwaInstallToast";
    document.body.appendChild(card);
    document.body.appendChild(toast);
    installCard = card;

    card.querySelector("#pwaInstallClose")?.addEventListener("click", () => hideInstallCard(true));
    card.querySelector("#pwaInstallBtn")?.addEventListener("click", installApp);
    return card;
  }

  function showToast(message){
    const box = document.getElementById("pwaInstallToast") || document.createElement("div");
    box.className = "pwa-install-toast show";
    box.id = "pwaInstallToast";
    box.innerHTML = message;
    if(!box.parentNode) document.body.appendChild(box);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => box.classList.remove("show"), 6500);
  }

  function showInstallCard(){
    if(installed || isStandalone() || hasSeenInstall()) return;
    const card = makeInstallCard();
    const title = card.querySelector(".pwa-install-title");
    if(title) title.textContent = `ثبت ${getAppName()} كتطبيق`;
    card.classList.add("show");
    markInstallSeen();
  }

  function hideInstallCard(userDismiss){
    if(installCard) installCard.classList.remove("show");
    if(userDismiss) markInstallSeen();
  }

  async function installApp(){
    markInstallSeen();
    if(deferredPrompt){
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      hideInstallCard(false);
      promptEvent.prompt();
      try{
        const choice = await promptEvent.userChoice;
        if(choice && choice.outcome === "accepted"){
          installed = true;
          localStorage.setItem(INSTALL_DONE_KEY, "1");
          showToast("تم إرسال طلب التثبيت. بعد التثبيت افتحه من أيقونة التطبيق وليس من المتصفح.");
        }else{
          showToast("تم إلغاء التثبيت. لن تظهر بطاقة التثبيت مرة ثانية تلقائيًا.");
        }
      }catch(e){
        showToast("لم يكتمل التثبيت. جرّب من قائمة Chrome: تثبيت التطبيق.");
      }
      return;
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
    if(isiOS){
      showToast("على الآيفون: افتح الموقع من Safari ثم مشاركة ثم Add to Home Screen. لن تظهر هذه الرسالة مرة ثانية.");
      return;
    }
    if(!SECURE){
      showToast("التثبيت الحقيقي يحتاج رابط HTTPS أو localhost. ارفع الموقع على Firebase Hosting ثم افتحه من الرابط.");
      return;
    }
    showToast("إذا لم تظهر نافذة التثبيت، افتح Chrome واضغط ⋮ ثم اختر تثبيت التطبيق. لن تظهر بطاقة التثبيت مرة ثانية تلقائيًا.");
  }

  window.addEventListener("beforeinstallprompt", function(event){
    event.preventDefault();
    deferredPrompt = event;
    showInstallCard();
  });

  window.addEventListener("appinstalled", function(){
    installed = true;
    hideInstallCard(false);
    localStorage.setItem(INSTALL_DONE_KEY, "1");
    markInstallSeen();
    showToast("تم تثبيت التطبيق بنجاح.");
  });

  window.storeShowInstallPrompt = function(){
    if(isStandalone() || installed) return;
    if(deferredPrompt){
      const old = localStorage.getItem(INSTALL_SEEN_KEY);
      localStorage.removeItem(INSTALL_SEEN_KEY);
      showInstallCard();
      if(old === "1") localStorage.setItem(INSTALL_SEEN_KEY, "1");
    }else{
      installApp();
    }
  };

  function registerServiceWorker(){
    if(!("serviceWorker" in navigator) || !SECURE) return;
    navigator.serviceWorker.register(SW_FILE, { scope:"./" })
      .then(function(reg){
        window.storeServiceWorkerRegistration = reg;
        try{ reg.update(); }catch(e){}
      })
      .catch(function(err){ console.warn("Service worker registration failed", err); });
  }

  document.addEventListener("DOMContentLoaded", function(){
    makeInstallCard();
  });

  window.addEventListener("load", registerServiceWorker);
})();
