/* admin-core.js - نواة لوحة تحكم المتجر */
(function(){
  "use strict";

  const $ = (id) => document.getElementById(id);
  const asArray = (v) => Array.isArray(v) ? v : [];
  const asList = (v) => Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []);
  const clean = (v) => String(v ?? "").trim();

  window.PATHS = window.ADMIN_PATHS_5546 || {
    admin: "settingsMohanad/adminMohanad",
    store: FIREBASE_PATHS_5546.settingsStore,
    banners: FIREBASE_PATHS_5546.settingsBanners,
    categories: FIREBASE_PATHS_5546.categories,
    products: FIREBASE_PATHS_5546.products,
    paymentMethods: FIREBASE_PATHS_5546.settingsPaymentMethods,
    orders: FIREBASE_PATHS_5546.orders,
    adminNotifications: FIREBASE_PATHS_5546.adminNotifications || "settingsMohanad/adminNotificationsMohanad",
    adminPushTokens: "settingsMohanad/adminPushTokensMohanad",
    menuItems: "settingsMohanad/sidebarMenuMohanad",
    pageSections: "settingsMohanad/pageSectionsMohanad",
    shippingZones: "settingsMohanad/shippingZonesMohanad",
    globalCheckoutFields: "settingsMohanad/globalCheckoutFieldsMohanad",
    socialLinks: "settingsMohanad/socialLinksMohanad"
  };
  window.KNOWN_COLORS = window.KNOWN_COLORS_5546 || [];

  const ADMIN_SESSION_KEY = "storeMohanad_admin_session";
  const HOME_SECTIONS = [
    { id: "sports", ar: "ملابس رياضية", en: "Sportswear" },
    { id: "casual", ar: "ملابس كاجوال", en: "Casual Wear" }
  ];

  const SECTION_SETTING_DEFS = {
    sports: { prefix: "sectionSports", ar: "ملابس رياضية" },
    casual: { prefix: "sectionCasual", ar: "ملابس كاجوال" }
  };
  const SECTION_SETTING_TEXT_FIELDS = [
    "topBannerUrl",
    "homeHeroImageUrl",
    "homeKickerAr",
    "homeTitleAr",
    "homeSubtitleAr",
    "announcementTextAr",
    "exchangePolicyAr",
    "trustCardsAr",
    "customerReviewsAr"
  ];
  const SECTION_SETTING_SELECT_FIELDS = ["announcementEnabled", "enableCodGlobal"];

  function cap(value){ return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1); }
  function getSectionInputId(sectionId, field){
    const prefix = SECTION_SETTING_DEFS[sectionId]?.prefix;
    return prefix ? `${prefix}${cap(field)}` : "";
  }
  function parseInheritedBool(value){
    if(value === "true") return true;
    if(value === "false") return false;
    return undefined;
  }
  function fillSectionSettingsForm(sectionId){
    const settings = ((window.storeCache || {}).sectionSettings || {})[sectionId] || {};
    SECTION_SETTING_TEXT_FIELDS.forEach(field => {
      const el = $(getSectionInputId(sectionId, field));
      if(el) el.value = settings[field] || "";
    });
    SECTION_SETTING_SELECT_FIELDS.forEach(field => {
      const el = $(getSectionInputId(sectionId, field));
      if(el) el.value = typeof settings[field] === "boolean" ? String(settings[field]) : "inherit";
    });
  }
  function collectSectionSettingsForm(sectionId){
    const payload = {};
    SECTION_SETTING_TEXT_FIELDS.forEach(field => {
      const value = clean($(getSectionInputId(sectionId, field))?.value);
      if(value) payload[field] = value;
    });
    SECTION_SETTING_SELECT_FIELDS.forEach(field => {
      const parsed = parseInheritedBool($(getSectionInputId(sectionId, field))?.value);
      if(typeof parsed === "boolean") payload[field] = parsed;
    });
    return payload;
  }

  window.escapeHtml = function escapeHtml(value){
    return String(value ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  };

  window.str = clean;
  window.money = function money(v){ return `${Number(v || 0).toFixed(2)} ₪`; };
  window.formatDate = function formatDate(ts){
    if(!ts) return "-";
    try{ return new Date(Number(ts)).toLocaleString("ar-EG"); }catch{ return "-"; }
  };
  window.statusInfo = function statusInfo(status){
    const s = String(status || "pending").toLowerCase();
    if(s === "approved") return { text:"تمت الموافقة", cls:"status-approved" };
    if(s === "delivered") return { text:"تم التسليم", cls:"status-delivered" };
    if(s === "rejected") return { text:"مرفوض", cls:"status-rejected" };
    return { text:"قيد الانتظار", cls:"status-pending" };
  };
  window.makeAutoKeyFromLabel = function makeAutoKeyFromLabel(label, fallback = "field"){
    const source = clean(label) || fallback;
    const normalized = source.toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\u0600-\u06FFa-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return `${normalized || fallback}_${Math.random().toString(36).slice(2,6)}`;
  };

  window.toast = function toast(msg){
    const old = document.querySelector(".admin-toast");
    if(old) old.remove();
    const el = document.createElement("div");
    el.className = "admin-toast";
    el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;background:#111827;color:#fff;padding:12px 18px;border-radius:999px;font-weight:900;box-shadow:0 16px 34px rgba(0,0,0,.18);max-width:90vw;text-align:center";
    el.textContent = msg || "تم";
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = ".2s"; setTimeout(() => el.remove(), 220); }, 2000);
  };

  window.setOverlayLoading = function setOverlayLoading(on){
    const el = $("loadingOverlay");
    if(el) el.style.display = on ? "flex" : "none";
  };

  window.openPreviewModal = function openPreviewModal(title, html){
    if($("previewModalTitle")) $("previewModalTitle").textContent = title || "معاينة";
    if($("previewModalBody")) $("previewModalBody").innerHTML = html || "";
    if($("previewModal")) $("previewModal").style.display = "flex";
  };
  window.closePreviewModal = function closePreviewModal(){
    if($("previewModal")) $("previewModal").style.display = "none";
  };

  window.getHomeSectionLabel = function getHomeSectionLabel(id, lang = "ar"){
    const found = HOME_SECTIONS.find(s => s.id === id) || HOME_SECTIONS[0];
    return lang === "en" ? found.en : found.ar;
  };
  window.getCategoryHomeSectionById = function getCategoryHomeSectionById(categoryId){
    const cat = (window.categoriesCache || []).find(c => String(c.id) === String(categoryId));
    return cat?.homeSection || "sports";
  };

  function normalizeObjArray(raw, mapper){
    return Object.entries(raw || {}).map(([id, v]) => mapper(id, v || {}));
  }

  function normalizeCategories(raw){
    return normalizeObjArray(raw, (id, v) => ({
      id,
      name: v.name || v.nameAr || "",
      nameAr: v.nameAr || v.name || "",
      nameEn: v.nameEn || "",
      image: v.image || "",
      icon: v.icon || "shirt",
      homeSection: v.homeSection || v.mainSection || "sports",
      order: Number(v.order || 0),
      enabled: v.enabled !== false,
      createdAt: Number(v.createdAt || 0),
      updatedAt: Number(v.updatedAt || 0)
    })).sort((a,b) => (a.order - b.order) || (a.createdAt - b.createdAt));
  }

  function normalizeProducts(raw){
    return normalizeObjArray(raw, (id, v) => ({
      id,
      categoryId: v.categoryId || v.category || "",
      category: v.category || v.categoryId || "",
      homeSection: v.homeSection || v.mainSection || "",
      name: v.name || v.nameAr || "",
      nameAr: v.nameAr || v.name || "",
      nameEn: v.nameEn || "",
      desc: v.desc || v.descAr || "",
      descAr: v.descAr || v.desc || "",
      descEn: v.descEn || "",
      price: Number(v.price || 0),
      oldPrice: Number(v.oldPrice || 0),
      couponCode: v.couponCode || "",
      couponDiscountAmount: Number(v.couponDiscountAmount || v.couponDiscount || 0),
      couponEnabled: v.couponEnabled === true,
      image1: v.image1 || v.image || v.front || "",
      image2: v.image2 || v.back || "",
      images: asArray(v.images),
      colorOptions: asArray(v.colorOptions),
      sizes: asArray(v.sizes),
      variantMatrix: asList(v.variantMatrix),
      inventoryTotal: Number(v.inventoryTotal || 0),
      shippingFee: Number(v.shippingFee || 0),
      freeShipping: v.freeShipping === true,
      enableCod: v.enableCod !== false,
      enableShipping: v.enableShipping !== false,
      order: Number(v.order || 0),
      enabled: v.enabled !== false,
      createdAt: Number(v.createdAt || 0),
      updatedAt: Number(v.updatedAt || 0)
    })).sort((a,b) => (a.order - b.order) || (b.createdAt - a.createdAt));
  }

  function normalizePaymentMethods(raw){
    return normalizeObjArray(raw, (id, v) => ({
      id,
      name: v.name || v.nameAr || "",
      nameAr: v.nameAr || v.name || "",
      nameEn: v.nameEn || "",
      image: v.image || "",
      enabled: v.enabled !== false,
      isCod: v.isCod === true,
      order: Number(v.order || 0),
      copyFields: asArray(v.copyFields),
      extraImages: asArray(v.extraImages),
      payerFields: asArray(v.payerFields),
      createdAt: Number(v.createdAt || 0)
    })).sort((a,b) => (a.order - b.order) || (a.createdAt - b.createdAt));
  }

  function normalizeOrders(raw){
    return normalizeObjArray(raw, (id, v) => ({ id, ...v })).sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }

  function normalizeShippingZones(raw){
    return normalizeObjArray(raw, (id, v) => ({
      id,
      name: v.name || v.nameAr || "",
      nameAr: v.nameAr || v.name || "",
      nameEn: v.nameEn || "",
      price: Number(v.price || 0),
      order: Number(v.order || 0),
      enabled: v.enabled !== false,
      createdAt: Number(v.createdAt || 0)
    })).sort((a,b) => (a.order - b.order) || (a.createdAt - b.createdAt));
  }

  function normalizeSections(raw){
    return normalizeObjArray(raw, (id, v) => ({
      id,
      type: v.type || "banner",
      title: v.title || v.titleAr || "",
      titleAr: v.titleAr || v.title || "",
      titleEn: v.titleEn || "",
      placement: v.placement || "after_categories",
      homeSection: v.homeSection || v.mainSection || "sports",
      link: v.link || "#",
      image: v.image || "",
      images: asArray(v.images),
      order: Number(v.order || 0),
      enabled: v.enabled !== false,
      createdAt: Number(v.createdAt || 0)
    })).sort((a,b) => (a.order - b.order) || (a.createdAt - b.createdAt));
  }

  function normalizeMenu(raw){
    return normalizeObjArray(raw, (id, v) => ({
      id,
      title: v.title || v.titleAr || "",
      titleAr: v.titleAr || v.title || "",
      titleEn: v.titleEn || "",
      type: v.type || "link",
      value: v.value || "",
      popupHtml: v.popupHtml || "",
      order: Number(v.order || 0),
      enabled: v.enabled !== false,
      createdAt: Number(v.createdAt || 0)
    })).sort((a,b) => (a.order - b.order) || (a.createdAt - b.createdAt));
  }

  function normalizeSocial(raw){
    return normalizeObjArray(raw, (id, v) => ({
      id,
      platform: v.platform || "website",
      url: v.url || v.link || "",
      order: Number(v.order || 0),
      enabled: v.enabled !== false,
      createdAt: Number(v.createdAt || 0)
    })).sort((a,b) => (a.order - b.order) || (a.createdAt - b.createdAt));
  }

  async function getAdminData(){
    const snap = await window.rtdb.ref(window.PATHS.admin).get();
    let admin = snap.val();
    if(!admin){
      admin = window.DEFAULT_ADMIN_5546 || { email:"oskar@gmail.com", password:"0000", mustChange:true, updatedAt:Date.now() };
      await window.rtdb.ref(window.PATHS.admin).set(admin);
    }
    return admin;
  }

  function setScreen(logged){
    if($("loginScreen")) $("loginScreen").classList.toggle("hidden", !!logged);
    if($("adminScreen")) $("adminScreen").classList.toggle("hidden", !logged);
  }

  window.adminLogin = async function adminLogin(){
    setOverlayLoading(true);
    try{
      const email = clean($("adminEmail")?.value);
      const password = clean($("adminPassword")?.value);
      const admin = await getAdminData();
      if(email !== clean(admin.email) || password !== clean(admin.password)){
        toast("بيانات الأدمن غير صحيحة");
        return;
      }
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      if(admin.mustChange === true){
        if($("forceChangeWrap")) $("forceChangeWrap").style.display = "flex";
      }
      setScreen(true);
      await loadAllData();
      await enableFirebaseMessagingToken();
      startOrderNotifications();
      handleAdminDeepLink();
      toast("تم تسجيل الدخول");
    }catch(e){
      console.error(e);
      toast("فشل تسجيل الدخول");
    }finally{ setOverlayLoading(false); }
  };

  window.logoutAdmin = function logoutAdmin(){
    stopOrderNotifications();
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setScreen(false);
    if($("forceChangeWrap")) $("forceChangeWrap").style.display = "none";
  };

  window.forceChangeAdminCredentials = async function forceChangeAdminCredentials(){
    const email = clean($("forceNewEmail")?.value);
    const pass = clean($("forceNewPassword")?.value);
    const confirm = clean($("forceConfirmPassword")?.value);
    if(!email || !pass){ toast("أدخل البريد وكلمة المرور الجديدة"); return; }
    if(pass !== confirm){ toast("كلمة المرور غير متطابقة"); return; }
    setOverlayLoading(true);
    try{
      await window.rtdb.ref(window.PATHS.admin).set({ email, password:pass, mustChange:false, updatedAt:Date.now() });
      if($("forceChangeWrap")) $("forceChangeWrap").style.display = "none";
      toast("تم حفظ بيانات الأدمن الجديدة");
    }catch(e){ console.error(e); toast("فشل حفظ بيانات الأدمن"); }
    finally{ setOverlayLoading(false); }
  };

  window.updateAdminCredentials = async function updateAdminCredentials(){
    const currentEmail = clean($("adminCurrentEmail")?.value);
    const currentPassword = clean($("adminCurrentPassword")?.value);
    const newEmail = clean($("adminNewEmail")?.value) || currentEmail;
    const newPass = clean($("adminNewPassword")?.value) || currentPassword;
    const confirm = clean($("adminConfirmPassword")?.value) || newPass;
    if(!currentEmail || !currentPassword){ toast("أدخل البريد وكلمة المرور الحالية"); return; }
    if(newPass !== confirm){ toast("تأكيد كلمة المرور غير مطابق"); return; }
    setOverlayLoading(true);
    try{
      const admin = await getAdminData();
      if(currentEmail !== clean(admin.email) || currentPassword !== clean(admin.password)){
        toast("البيانات الحالية غير صحيحة");
        return;
      }
      await window.rtdb.ref(window.PATHS.admin).update({ email:newEmail, password:newPass, mustChange:false, updatedAt:Date.now() });
      toast("تم تحديث بيانات الأدمن");
      if($("adminCurrentEmail")) $("adminCurrentEmail").value = "";
      if($("adminNewEmail")) $("adminNewEmail").value = "";
      if($("adminCurrentPassword")) $("adminCurrentPassword").value = "";
      if($("adminNewPassword")) $("adminNewPassword").value = "";
      if($("adminConfirmPassword")) $("adminConfirmPassword").value = "";
    }catch(e){ console.error(e); toast("فشل تحديث بيانات الأدمن"); }
    finally{ setOverlayLoading(false); }
  };

  window.setTab = function setTab(tab){
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    const panel = $(`panel-${tab}`);
    if(panel) panel.classList.add("active");
    document.querySelectorAll(".tab-btn[id^='tab']").forEach(btn => {
      btn.classList.remove("active"); btn.classList.add("inactive");
    });
    const map = { checkoutFields:"CheckoutFields" };
    const id = `tab${map[tab] || (tab.charAt(0).toUpperCase() + tab.slice(1))}`;
    if($(id)){
      $(id).classList.remove("inactive");
      $(id).classList.add("active");
    }
  };

  window.loadAllData = async function loadAllData(){
    setOverlayLoading(true);
    try{
      const keys = ["store","banners","categories","products","paymentMethods","orders","menuItems","pageSections","shippingZones","globalCheckoutFields","socialLinks","admin"];
      const snaps = await Promise.all(keys.map(k => window.rtdb.ref(window.PATHS[k]).get()));
      const data = Object.fromEntries(keys.map((k,i) => [k, snaps[i].val()]));

      window.storeCache = data.store || {};
      window.bannersCache = data.banners || {};
      window.categoriesCache = normalizeCategories(data.categories || {});
      window.productsCache = normalizeProducts(data.products || {});
      window.paymentsCache = normalizePaymentMethods(data.paymentMethods || {});
      window.ordersCache = normalizeOrders(data.orders || {});
      window.menuItemsCache = normalizeMenu(data.menuItems || {});
      window.pageSectionsCache = normalizeSections(data.pageSections || {});
      window.shippingZonesCache = normalizeShippingZones(data.shippingZones || {});
      window.globalCheckoutFieldsCache = asArray(data.globalCheckoutFields);
      window.socialLinksCache = normalizeSocial(data.socialLinks || {});
      window.adminCache = data.admin || {};

      fillStoreForm();
      fillAdminForm();
      renderDashboard();
      renderPathsBox();
      renderCategoryIcons();
      renderCategoriesList();
      populateCategorySelects();
      renderCheckoutFieldsBuilder(window.globalCheckoutFieldsCache);
      renderShippingList();
      renderSectionsList();
      renderMenuList();
      renderSocialLinksList();
      if(typeof window.renderProductsList === "function") window.renderProductsList();
      if(typeof window.renderPaymentsList === "function") window.renderPaymentsList();
      if(typeof window.renderOrdersList === "function") window.renderOrdersList();
    }catch(e){
      console.error(e);
      toast("فشل تحميل البيانات");
    }finally{ setOverlayLoading(false); }
  };

  function fillAdminForm(){
    // الحقول تبقى فارغة وتعرض تلميحات فقط، بدون كشف البريد أو كلمة المرور المحفوظة.
    if($("adminCurrentEmail")) $("adminCurrentEmail").value = "";
    if($("adminCurrentPassword")) $("adminCurrentPassword").value = "";
    if($("adminNewEmail")) $("adminNewEmail").value = "";
    if($("adminNewPassword")) $("adminNewPassword").value = "";
    if($("adminConfirmPassword")) $("adminConfirmPassword").value = "";
  }

  function fillStoreForm(){
    const s = window.storeCache || {};
    const b = window.bannersCache || {};
    if($("storeNameAr")) $("storeNameAr").value = s.storeNameAr || s.storeName || "";
    if($("storeNameEn")) $("storeNameEn").value = s.storeNameEn || "";
    if($("storeDescAr")) $("storeDescAr").value = s.storeDescAr || s.descriptionAr || "";
    if($("storeDescEn")) $("storeDescEn").value = s.storeDescEn || s.descriptionEn || "";
    if($("storeLogoUrl")) $("storeLogoUrl").value = s.storeLogoUrl || "";
    if($("storeTopBannerUrl")) $("storeTopBannerUrl").value = b.topBannerUrl || s.topBannerUrl || "";
    if($("homeHeroImageUrl")) $("homeHeroImageUrl").value = s.homeHeroImageUrl || "";
    if($("homeKickerAr")) $("homeKickerAr").value = s.homeKickerAr || "مجموعة الموسم الجديد";
    if($("homeKickerEn")) $("homeKickerEn").value = s.homeKickerEn || "New Season Collection";
    if($("homeTitleAr")) $("homeTitleAr").value = s.homeTitleAr || "أناقة بلا حدود.\nراحة بلا تنازلات.";
    if($("homeTitleEn")) $("homeTitleEn").value = s.homeTitleEn || "Limitless Style.\nNo-Compromise Comfort.";
    if($("homeSubtitleAr")) $("homeSubtitleAr").value = s.homeSubtitleAr || "اكتشف مجموعتنا الحصرية من الملابس الرياضية والكاجوال";
    if($("homeSubtitleEn")) $("homeSubtitleEn").value = s.homeSubtitleEn || "Explore our exclusive sportswear and casual wear collection";
    if($("announcementEnabled")) $("announcementEnabled").value = s.announcementEnabled === false ? "false" : "true";
    if($("announcementTextAr")) $("announcementTextAr").value = s.announcementTextAr || "اطلب 3 بلايز وتوصيل مجاني";
    if($("announcementTextEn")) $("announcementTextEn").value = s.announcementTextEn || "Order 3 shirts and get free delivery";
    if($("exchangePolicyAr")) $("exchangePolicyAr").value = s.exchangePolicyAr || "سياسة تبديل خلال 24 ساعة. تكلفة تبديل الطلب على الزبون. في حال وجود أي أضرار في القطعة لا يمكن التبديل.";
    if($("exchangePolicyEn")) $("exchangePolicyEn").value = s.exchangePolicyEn || "Exchange within 24 hours. Exchange delivery cost is paid by the customer. Damaged pieces cannot be exchanged.";
    if($("trustCardsAr")) $("trustCardsAr").value = s.trustCardsAr || "شحن مجاني|عند شراء 3 قطع\nشحن سريع|خلال 24-48 ساعة\nاستبدال خلال 24 ساعة|وفقاً لسياسة المتجر\nدفع آمن|بنك فلسطين - جوال باي";
    if($("trustCardsEn")) $("trustCardsEn").value = s.trustCardsEn || "Free delivery|When buying 3 pieces\nFast shipping|Within 24-48 hours\n24h exchange|According to store policy\nSecure payment|Bank of Palestine - Jawwal Pay";
    if($("customerReviewsAr")) $("customerReviewsAr").value = s.customerReviewsAr || "";
    if($("customerReviewsEn")) $("customerReviewsEn").value = s.customerReviewsEn || "";
    if($("enableCodGlobal")) $("enableCodGlobal").value = s.enableCodGlobal === false ? "false" : "true";
    if($("storeWhatsappEnabled")) $("storeWhatsappEnabled").value = s.whatsappEnabled === false ? "false" : "true";
    if($("storeWhatsappNumber")) $("storeWhatsappNumber").value = s.whatsappNumber || "";
    if($("storeWhatsappMessage")) $("storeWhatsappMessage").value = s.whatsappMessage || "مرحباً، أريد الاستفسار عن المنتجات";
    if($("storeFcmVapidKey")) $("storeFcmVapidKey").value = s.fcmVapidKey || window.FCM_VAPID_KEY_5546 || "";
    if($("storeCashierLicenseKey")) $("storeCashierLicenseKey").value = s.cashierLicenseKey || "";
    fillSectionSettingsForm("sports");
    fillSectionSettingsForm("casual");
  }

  window.saveStoreSettings = async function saveStoreSettings(){
    const payload = {
      storeName: clean($("storeNameAr")?.value),
      storeNameAr: clean($("storeNameAr")?.value),
      storeNameEn: clean($("storeNameEn")?.value),
      storeDescAr: clean($("storeDescAr")?.value),
      storeDescEn: clean($("storeDescEn")?.value),
      storeLogoUrl: clean($("storeLogoUrl")?.value),
      topBannerUrl: clean($("storeTopBannerUrl")?.value),
      homeHeroImageUrl: clean($("homeHeroImageUrl")?.value),
      homeKickerAr: clean($("homeKickerAr")?.value),
      homeKickerEn: clean($("homeKickerEn")?.value),
      homeTitleAr: clean($("homeTitleAr")?.value),
      homeTitleEn: clean($("homeTitleEn")?.value),
      homeSubtitleAr: clean($("homeSubtitleAr")?.value),
      homeSubtitleEn: clean($("homeSubtitleEn")?.value),
      announcementEnabled: $("announcementEnabled")?.value !== "false",
      announcementTextAr: clean($("announcementTextAr")?.value),
      announcementTextEn: clean($("announcementTextEn")?.value),
      exchangePolicyAr: clean($("exchangePolicyAr")?.value),
      exchangePolicyEn: clean($("exchangePolicyEn")?.value),
      trustCardsAr: clean($("trustCardsAr")?.value),
      trustCardsEn: clean($("trustCardsEn")?.value),
      customerReviewsAr: clean($("customerReviewsAr")?.value),
      customerReviewsEn: clean($("customerReviewsEn")?.value),
      enableCodGlobal: $("enableCodGlobal")?.value !== "false",
      whatsappEnabled: $("storeWhatsappEnabled")?.value !== "false",
      whatsappNumber: clean($("storeWhatsappNumber")?.value).replace(/[^0-9]/g, ""),
      whatsappMessage: clean($("storeWhatsappMessage")?.value) || "مرحباً، أريد الاستفسار عن المنتجات",
      fcmVapidKey: clean($("storeFcmVapidKey")?.value),
      cashierLicenseKey: clean($("storeCashierLicenseKey")?.value),
      sectionSettings: {
        sports: collectSectionSettingsForm("sports"),
        casual: collectSectionSettingsForm("casual")
      },
      updatedAt: Date.now()
    };
    setOverlayLoading(true);
    try{
      await Promise.all([
        window.rtdb.ref(window.PATHS.store).update(payload),
        window.rtdb.ref(window.PATHS.banners).update({ topBannerUrl: payload.topBannerUrl, updatedAt:Date.now() })
      ]);
      await loadAllData();
      toast("تم حفظ إعدادات المتجر");
    }catch(e){ console.error(e); toast("فشل حفظ إعدادات المتجر"); }
    finally{ setOverlayLoading(false); }
  };

  function renderDashboard(){
    if($("statCategories")) $("statCategories").textContent = (window.categoriesCache || []).length;
    if($("statProducts")) $("statProducts").textContent = (window.productsCache || []).length;
    if($("statPayments")) $("statPayments").textContent = (window.paymentsCache || []).length;
    if($("statShippingZones")) $("statShippingZones").textContent = (window.shippingZonesCache || []).length;
    const box = $("dashboardOrders");
    if(box){
      const latest = (window.ordersCache || []).slice(0,5);
      box.innerHTML = latest.length ? latest.map(o => {
        const st = statusInfo(o.status);
        return `<div class="mini-card flex items-center justify-between gap-3"><div><div class="font-black text-sm text-[#14454d]">${escapeHtml(o.name || o.customerName || o.customerEmail || "طلب")}</div><div class="text-xs text-gray-400 font-bold mt-1">${formatDate(o.createdAt)} | ${escapeHtml(o.paymentMethodName || "-")}</div></div><span class="status-badge ${st.cls}">${st.text}</span></div>`;
      }).join("") : `<div class="empty">لا توجد طلبات حالياً</div>`;
    }
  }

  function renderPathsBox(){
    if($("pathsBox")) $("pathsBox").textContent = JSON.stringify(window.PATHS, null, 2);
  }

  window.renderCategoryIcons = function renderCategoryIcons(){
    const grid = $("categoryIconsGrid");
    if(!grid) return;
    const selected = clean($("categoryIcon")?.value) || "shirt";
    grid.innerHTML = (window.CATEGORY_ICONS_5546 || []).map(icon => `
      <button type="button" class="icon-option ${selected === icon.key ? 'active' : ''}" onclick="selectCategoryIcon('${icon.key}')">
        ${icon.svg}<span>${escapeHtml(icon.label)}</span>
      </button>
    `).join("");
    renderCategoryVisualPreview();
  };

  window.selectCategoryIcon = function selectCategoryIcon(key){
    if($("categoryIcon")) $("categoryIcon").value = key;
    renderCategoryIcons();
  };

  window.renderCategoryVisualPreview = function renderCategoryVisualPreview(){
    const box = $("categoryVisualPreview");
    if(!box) return;
    const img = clean($("categoryImage")?.value);
    const iconKey = clean($("categoryIcon")?.value) || "shirt";
    if(img){
      box.innerHTML = `<img src="${escapeHtml(img)}" alt="preview">`;
    }else{
      const found = (window.CATEGORY_ICONS_5546 || []).find(i => i.key === iconKey);
      box.innerHTML = found ? found.svg : "";
    }
  };

  window.resetCategoryForm = function resetCategoryForm(){
    ["categoryEditId","categoryNameAr","categoryNameEn","categoryImage","categoryOrder"].forEach(id => { if($(id)) $(id).value = ""; });
    if($("categoryIcon")) $("categoryIcon").value = "shirt";
    if($("categoryEnabled")) $("categoryEnabled").value = "true";
    if($("categoryHomeSection")) $("categoryHomeSection").value = "sports";
    renderCategoryIcons();
  };

  window.saveCategory = async function saveCategory(){
    const id = clean($("categoryEditId")?.value);
    const payload = {
      name: clean($("categoryNameAr")?.value),
      nameAr: clean($("categoryNameAr")?.value),
      nameEn: clean($("categoryNameEn")?.value),
      image: clean($("categoryImage")?.value),
      icon: clean($("categoryIcon")?.value) || "shirt",
      homeSection: clean($("categoryHomeSection")?.value) || "sports",
      order: Number($("categoryOrder")?.value || 0),
      enabled: $("categoryEnabled")?.value !== "false",
      updatedAt: Date.now()
    };
    if(!payload.nameAr){ toast("أدخل اسم القسم بالعربي"); return; }
    setOverlayLoading(true);
    try{
      if(id) await window.rtdb.ref(`${window.PATHS.categories}/${id}`).update(payload);
      else await window.rtdb.ref(window.PATHS.categories).push({ ...payload, createdAt:Date.now() });
      resetCategoryForm();
      await loadAllData();
      toast("تم حفظ القسم");
    }catch(e){ console.error(e); toast("فشل حفظ القسم"); }
    finally{ setOverlayLoading(false); }
  };

  window.editCategory = function editCategory(id){
    const c = (window.categoriesCache || []).find(x => x.id === id);
    if(!c) return;
    if($("categoryEditId")) $("categoryEditId").value = c.id;
    if($("categoryNameAr")) $("categoryNameAr").value = c.nameAr || c.name || "";
    if($("categoryNameEn")) $("categoryNameEn").value = c.nameEn || "";
    if($("categoryImage")) $("categoryImage").value = c.image || "";
    if($("categoryIcon")) $("categoryIcon").value = c.icon || "shirt";
    if($("categoryHomeSection")) $("categoryHomeSection").value = c.homeSection || "sports";
    if($("categoryOrder")) $("categoryOrder").value = c.order || 0;
    if($("categoryEnabled")) $("categoryEnabled").value = c.enabled ? "true" : "false";
    renderCategoryIcons();
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  window.deleteCategory = async function deleteCategory(id){
    if(!confirm("حذف هذا القسم؟")) return;
    setOverlayLoading(true);
    try{
      await window.rtdb.ref(`${window.PATHS.categories}/${id}`).remove();
      await loadAllData();
      toast("تم حذف القسم");
    }catch(e){ console.error(e); toast("فشل حذف القسم"); }
    finally{ setOverlayLoading(false); }
  };

  window.renderCategoriesList = function renderCategoriesList(){
    const box = $("categoriesList");
    if(!box) return;
    const items = window.categoriesCache || [];
    box.innerHTML = items.length ? items.map(c => `
      <div class="mini-card flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl border bg-white overflow-hidden flex items-center justify-center text-[#14454d]">
            ${c.image ? `<img src="${escapeHtml(c.image)}" class="w-full h-full object-cover" alt="">` : ((window.CATEGORY_ICONS_5546 || []).find(i => i.key === c.icon)?.svg || "")}
          </div>
          <div>
            <div class="font-black text-sm">${escapeHtml(c.nameAr || c.name)} / ${escapeHtml(c.nameEn || "-")}</div>
            <div class="text-xs text-gray-400 font-bold mt-1">${getHomeSectionLabel(c.homeSection)} | ${c.enabled ? "مفعل" : "معطل"} | ترتيب: ${Number(c.order || 0)}</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary" onclick="editCategory('${c.id}')">تعديل</button>
          <button class="btn btn-danger" onclick="deleteCategory('${c.id}')">حذف</button>
        </div>
      </div>
    `).join("") : `<div class="empty">لا توجد أقسام</div>`;
  };

  window.populateCategorySelects = function populateCategorySelects(){
    const cats = window.categoriesCache || [];
    const opts = cats.map(c => `<option value="${escapeHtml(c.id)}" data-section="${escapeHtml(c.homeSection || 'sports')}">${escapeHtml(c.nameAr || c.name || c.id)} - ${escapeHtml(getHomeSectionLabel(c.homeSection))}</option>`).join("");
    if($("productCategoryId")){
      const old = $("productCategoryId").value;
      $("productCategoryId").innerHTML = opts || `<option value="">لا توجد أقسام</option>`;
      if(old) $("productCategoryId").value = old;
      $("productCategoryId").onchange = function(){
        const sec = getCategoryHomeSectionById(this.value);
        if($("productHomeSection")) $("productHomeSection").value = sec;
      };
      if(!$("productCategoryId").value && cats[0]) $("productCategoryId").value = cats[0].id;
      if($("productHomeSection") && $("productCategoryId").value) $("productHomeSection").value = getCategoryHomeSectionById($("productCategoryId").value);
    }
    if($("productsFilterCategory")){
      const old = $("productsFilterCategory").value;
      $("productsFilterCategory").innerHTML = `<option value="all">كل الأقسام</option>${opts}`;
      $("productsFilterCategory").value = old || "all";
    }
    if($("menuType")){
      // تسهيل نسخ id القسم عند إنشاء عنصر قائمة من نوع category
    }
  };

  // Product slider images builder
  window.clearProductSliderImages = function clearProductSliderImages(){
    const wrap = $("productSliderImagesBuilder");
    if(wrap) wrap.innerHTML = "";
    if($("productExtraImages")) $("productExtraImages").value = "";
  };
  window.addProductSliderImageBuilder = function addProductSliderImageBuilder(url = ""){
    if(typeof url === "object" && url) url = url.url || url.image || "";
    const wrap = $("productSliderImagesBuilder");
    if(!wrap) return;
    const el = document.createElement("div");
    el.className = "builder-item product-slider-image-item";
    el.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div><label class="label">رابط صورة السلايدر</label><input class="field product-slider-image-url" value="${escapeHtml(url)}" placeholder="https://example.com/slide.jpg" oninput="collectProductSliderImages(true)"></div>
        <button type="button" class="btn btn-danger" onclick="this.closest('.product-slider-image-item').remove(); collectProductSliderImages(true)">حذف</button>
      </div>`;
    wrap.appendChild(el);
    collectProductSliderImages(true);
  };
  window.collectProductSliderImages = function collectProductSliderImages(writeHidden = true){
    const urls = [...document.querySelectorAll(".product-slider-image-url")].map(input => clean(input.value)).filter(Boolean);
    if(writeHidden && $("productExtraImages")) $("productExtraImages").value = urls.join("\n");
    return urls;
  };
  window.fillProductSliderImages = function fillProductSliderImages(images = []){
    clearProductSliderImages();
    asArray(images).forEach(url => addProductSliderImageBuilder(url));
    collectProductSliderImages(true);
  };

  // Checkout fields
  window.resetCheckoutFieldsBuilder = function resetCheckoutFieldsBuilder(){
    renderCheckoutFieldsBuilder([]);
  };
  window.addCheckoutFieldBuilder = function addCheckoutFieldBuilder(data = {}){
    const wrap = $("checkoutFieldsBuilder");
    if(!wrap) return;
    const el = document.createElement("div");
    el.className = "builder-item checkout-field-item";
    el.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="label">اسم الحقل عربي</label><input class="field checkout-label-ar" value="${escapeHtml(data.labelAr || data.label || '')}" placeholder="مثال: رقم الجوال" oninput="renderCheckoutFieldsPreview()"></div>
        <div><label class="label">اسم الحقل إنجليزي</label><input class="field checkout-label-en" value="${escapeHtml(data.labelEn || '')}" placeholder="Phone" oninput="renderCheckoutFieldsPreview()"></div>
        <div><label class="label">التلميح عربي</label><input class="field checkout-placeholder-ar" value="${escapeHtml(data.placeholderAr || data.placeholder || '')}" placeholder="اكتب رقم الجوال" oninput="renderCheckoutFieldsPreview()"></div>
        <div><label class="label">التلميح إنجليزي</label><input class="field checkout-placeholder-en" value="${escapeHtml(data.placeholderEn || '')}" placeholder="Enter phone" oninput="renderCheckoutFieldsPreview()"></div>
        <div><label class="label">النوع</label><select class="field checkout-type" onchange="renderCheckoutFieldsPreview()"><option value="field" ${data.type !== 'textarea' ? 'selected' : ''}>حقل نص</option><option value="textarea" ${data.type === 'textarea' ? 'selected' : ''}>مربع نص</option></select></div>
        <div><label class="label">إجباري</label><select class="field checkout-required" onchange="renderCheckoutFieldsPreview()"><option value="true" ${data.required !== false ? 'selected' : ''}>نعم</option><option value="false" ${data.required === false ? 'selected' : ''}>لا</option></select></div>
      </div>
      <button type="button" class="btn btn-danger mt-3" onclick="this.closest('.checkout-field-item').remove(); renderCheckoutFieldsPreview();">حذف</button>`;
    wrap.appendChild(el);
    renderCheckoutFieldsPreview();
  };
  window.collectCheckoutFields = function collectCheckoutFields(){
    return [...document.querySelectorAll(".checkout-field-item")].map(item => {
      const labelAr = clean(item.querySelector(".checkout-label-ar")?.value);
      return {
        type: item.querySelector(".checkout-type")?.value || "field",
        key: makeAutoKeyFromLabel(labelAr, "checkout"),
        label: labelAr,
        labelAr,
        labelEn: clean(item.querySelector(".checkout-label-en")?.value),
        placeholder: clean(item.querySelector(".checkout-placeholder-ar")?.value),
        placeholderAr: clean(item.querySelector(".checkout-placeholder-ar")?.value),
        placeholderEn: clean(item.querySelector(".checkout-placeholder-en")?.value),
        required: item.querySelector(".checkout-required")?.value !== "false"
      };
    }).filter(x => x.labelAr);
  };
  window.renderCheckoutFieldsBuilder = function renderCheckoutFieldsBuilder(fields = []){
    const wrap = $("checkoutFieldsBuilder");
    if(!wrap) return;
    wrap.innerHTML = "";
    asArray(fields).forEach(addCheckoutFieldBuilder);
    renderCheckoutFieldsPreview();
  };
  window.renderCheckoutFieldsPreview = function renderCheckoutFieldsPreview(){
    const box = $("checkoutFieldsPreviewBox");
    if(!box) return;
    const fields = collectCheckoutFields();
    if($("globalCheckoutFields")) $("globalCheckoutFields").value = JSON.stringify(fields, null, 2);
    box.innerHTML = fields.length ? fields.map(f => `<div class="preview-pay-box"><div class="preview-pay-title">${escapeHtml(f.labelAr)} ${f.required ? '*' : ''}</div><div class="text-xs text-gray-400 font-bold mt-1">${escapeHtml(f.placeholderAr || '-')}</div></div>`).join("") : `<div class="empty">لا توجد حقول</div>`;
  };
  window.saveGlobalCheckoutFields = async function saveGlobalCheckoutFields(){
    const fields = collectCheckoutFields();
    setOverlayLoading(true);
    try{
      await window.rtdb.ref(window.PATHS.globalCheckoutFields).set(fields);
      await loadAllData();
      toast("تم حفظ حقول الإدخال");
    }catch(e){ console.error(e); toast("فشل حفظ الحقول"); }
    finally{ setOverlayLoading(false); }
  };
  window.openCheckoutFieldsPreviewModal = function openCheckoutFieldsPreviewModal(){
    const fields = collectCheckoutFields();
    openPreviewModal("معاينة حقول الإدخال", fields.length ? fields.map(f => `<div class="preview-pay-box mb-3"><div class="preview-pay-title">${escapeHtml(f.labelAr)}</div><input class="field mt-2" placeholder="${escapeHtml(f.placeholderAr || '')}"></div>`).join("") : `<div class="empty">لا توجد حقول</div>`);
  };

  // Shipping
  window.resetShippingForm = function resetShippingForm(){
    ["shippingEditId","shippingNameAr","shippingNameEn","shippingPrice","shippingOrder"].forEach(id => { if($(id)) $(id).value = ""; });
    if($("shippingEnabled")) $("shippingEnabled").value = "true";
  };
  window.saveShippingZone = async function saveShippingZone(){
    const id = clean($("shippingEditId")?.value);
    const payload = {
      name: clean($("shippingNameAr")?.value),
      nameAr: clean($("shippingNameAr")?.value),
      nameEn: clean($("shippingNameEn")?.value),
      price: Number($("shippingPrice")?.value || 0),
      order: Number($("shippingOrder")?.value || 0),
      enabled: $("shippingEnabled")?.value !== "false",
      updatedAt: Date.now()
    };
    if(!payload.nameAr){ toast("أدخل اسم منطقة التوصيل"); return; }
    setOverlayLoading(true);
    try{
      if(id) await window.rtdb.ref(`${window.PATHS.shippingZones}/${id}`).update(payload);
      else await window.rtdb.ref(window.PATHS.shippingZones).push({ ...payload, createdAt:Date.now() });
      resetShippingForm(); await loadAllData(); toast("تم حفظ منطقة التوصيل");
    }catch(e){ console.error(e); toast("فشل حفظ منطقة التوصيل"); }
    finally{ setOverlayLoading(false); }
  };
  window.editShippingZone = function editShippingZone(id){
    const z = (window.shippingZonesCache || []).find(x => x.id === id); if(!z) return;
    if($("shippingEditId")) $("shippingEditId").value = z.id;
    if($("shippingNameAr")) $("shippingNameAr").value = z.nameAr || z.name || "";
    if($("shippingNameEn")) $("shippingNameEn").value = z.nameEn || "";
    if($("shippingPrice")) $("shippingPrice").value = z.price || 0;
    if($("shippingOrder")) $("shippingOrder").value = z.order || 0;
    if($("shippingEnabled")) $("shippingEnabled").value = z.enabled ? "true" : "false";
    window.scrollTo({ top:0, behavior:"smooth" });
  };
  window.deleteShippingZone = async function deleteShippingZone(id){
    if(!confirm("حذف منطقة التوصيل؟")) return;
    setOverlayLoading(true);
    try{ await window.rtdb.ref(`${window.PATHS.shippingZones}/${id}`).remove(); await loadAllData(); toast("تم الحذف"); }
    catch(e){ console.error(e); toast("فشل الحذف"); }
    finally{ setOverlayLoading(false); }
  };
  window.renderShippingList = function renderShippingList(){
    const box = $("shippingList"); if(!box) return;
    const items = window.shippingZonesCache || [];
    box.innerHTML = items.length ? items.map(z => `<div class="mini-card flex items-center justify-between gap-3"><div><div class="font-black text-sm">${escapeHtml(z.nameAr || z.name)} / ${escapeHtml(z.nameEn || '-')}</div><div class="text-xs text-gray-400 font-bold mt-1">${money(z.price)} | ${z.enabled ? 'مفعل' : 'معطل'} | ترتيب: ${Number(z.order || 0)}</div></div><div class="flex gap-2"><button class="btn btn-secondary" onclick="editShippingZone('${z.id}')">تعديل</button><button class="btn btn-danger" onclick="deleteShippingZone('${z.id}')">حذف</button></div></div>`).join("") : `<div class="empty">لا توجد مناطق توصيل</div>`;
  };
  window.previewShippingInputs = function previewShippingInputs(){
    openPreviewModal("معاينة منطقة التوصيل", `<div class="preview-pay-box"><div class="preview-pay-title">${escapeHtml(clean($("shippingNameAr")?.value) || 'منطقة التوصيل')}</div><div class="text-sm font-black mt-2">${money(Number($("shippingPrice")?.value || 0))}</div></div>`);
  };

  // Sections/Banners
  window.resetSectionForm = function resetSectionForm(){
    ["sectionEditId","sectionTitleAr","sectionTitleEn","sectionLink","sectionImage","sectionImages","sectionOrder"].forEach(id => { if($(id)) $(id).value = ""; });
    if($("sectionType")) $("sectionType").value = "banner";
    if($("sectionHomeSection")) $("sectionHomeSection").value = "sports";
    if($("sectionPlacement")) $("sectionPlacement").value = "after_categories";
    if($("sectionEnabled")) $("sectionEnabled").value = "true";
  };
  window.saveSection = async function saveSection(){
    const id = clean($("sectionEditId")?.value);
    const images = clean($("sectionImages")?.value).split("\n").map(clean).filter(Boolean);
    const image = clean($("sectionImage")?.value);
    const payload = {
      type: clean($("sectionType")?.value) || "banner",
      title: clean($("sectionTitleAr")?.value),
      titleAr: clean($("sectionTitleAr")?.value),
      titleEn: clean($("sectionTitleEn")?.value),
      placement: clean($("sectionPlacement")?.value) || "after_categories",
      homeSection: clean($("sectionHomeSection")?.value) || "sports",
      link: clean($("sectionLink")?.value) || "#",
      image,
      images: images.length ? images : (image ? [image] : []),
      order: Number($("sectionOrder")?.value || 0),
      enabled: $("sectionEnabled")?.value !== "false",
      updatedAt: Date.now()
    };
    if(!payload.image && !payload.images.length){ toast("أدخل صورة أو صور السلايدر"); return; }
    setOverlayLoading(true);
    try{
      if(id) await window.rtdb.ref(`${window.PATHS.pageSections}/${id}`).update(payload);
      else await window.rtdb.ref(window.PATHS.pageSections).push({ ...payload, createdAt:Date.now() });
      resetSectionForm(); await loadAllData(); toast("تم حفظ البانر/السلايدر");
    }catch(e){ console.error(e); toast("فشل الحفظ"); }
    finally{ setOverlayLoading(false); }
  };
  window.editSection = function editSection(id){
    const s = (window.pageSectionsCache || []).find(x => x.id === id); if(!s) return;
    if($("sectionEditId")) $("sectionEditId").value = s.id;
    if($("sectionType")) $("sectionType").value = s.type || "banner";
    if($("sectionTitleAr")) $("sectionTitleAr").value = s.titleAr || s.title || "";
    if($("sectionTitleEn")) $("sectionTitleEn").value = s.titleEn || "";
    if($("sectionPlacement")) $("sectionPlacement").value = s.placement || "after_categories";
    if($("sectionHomeSection")) $("sectionHomeSection").value = s.homeSection || "sports";
    if($("sectionLink")) $("sectionLink").value = s.link || "#";
    if($("sectionImage")) $("sectionImage").value = s.image || "";
    if($("sectionImages")) $("sectionImages").value = asArray(s.images).join("\n");
    if($("sectionOrder")) $("sectionOrder").value = s.order || 0;
    if($("sectionEnabled")) $("sectionEnabled").value = s.enabled ? "true" : "false";
    window.scrollTo({ top:0, behavior:"smooth" });
  };
  window.deleteSection = async function deleteSection(id){
    if(!confirm("حذف هذا العنصر؟")) return;
    setOverlayLoading(true);
    try{ await window.rtdb.ref(`${window.PATHS.pageSections}/${id}`).remove(); await loadAllData(); toast("تم الحذف"); }
    catch(e){ console.error(e); toast("فشل الحذف"); }
    finally{ setOverlayLoading(false); }
  };
  window.renderSectionsList = function renderSectionsList(){
    const box = $("sectionsList"); if(!box) return;
    const items = window.pageSectionsCache || [];
    box.innerHTML = items.length ? items.map(s => `<div class="mini-card flex items-center justify-between gap-3"><div class="flex items-center gap-3"><img src="${escapeHtml(s.image || asArray(s.images)[0] || 'https://via.placeholder.com/80') }" class="w-16 h-12 rounded-xl object-cover border"><div><div class="font-black text-sm">${escapeHtml(s.titleAr || s.title || s.type)}</div><div class="text-xs text-gray-400 font-bold mt-1">${escapeHtml(getHomeSectionLabel(s.homeSection || 'sports'))} | ${escapeHtml(s.type)} | ${escapeHtml(s.placement)} | ${s.enabled ? 'مفعل' : 'معطل'}</div></div></div><div class="flex gap-2"><button class="btn btn-secondary" onclick="editSection('${s.id}')">تعديل</button><button class="btn btn-danger" onclick="deleteSection('${s.id}')">حذف</button></div></div>`).join("") : `<div class="empty">لا توجد عناصر</div>`;
  };

  // Sidebar Menu
  window.resetMenuForm = function resetMenuForm(){
    ["menuEditId","menuTitleAr","menuTitleEn","menuValue","menuPopupHtml","menuOrder"].forEach(id => { if($(id)) $(id).value = ""; });
    if($("menuType")) $("menuType").value = "link";
    if($("menuEnabled")) $("menuEnabled").value = "true";
  };
  window.saveMenuItem = async function saveMenuItem(){
    const id = clean($("menuEditId")?.value);
    const payload = {
      title: clean($("menuTitleAr")?.value),
      titleAr: clean($("menuTitleAr")?.value),
      titleEn: clean($("menuTitleEn")?.value),
      type: clean($("menuType")?.value) || "link",
      value: clean($("menuValue")?.value),
      popupHtml: $("menuPopupHtml")?.value || "",
      order: Number($("menuOrder")?.value || 0),
      enabled: $("menuEnabled")?.value !== "false",
      updatedAt: Date.now()
    };
    if(!payload.titleAr){ toast("أدخل اسم عنصر القائمة"); return; }
    setOverlayLoading(true);
    try{
      if(id) await window.rtdb.ref(`${window.PATHS.menuItems}/${id}`).update(payload);
      else await window.rtdb.ref(window.PATHS.menuItems).push({ ...payload, createdAt:Date.now() });
      resetMenuForm(); await loadAllData(); toast("تم حفظ عنصر القائمة");
    }catch(e){ console.error(e); toast("فشل الحفظ"); }
    finally{ setOverlayLoading(false); }
  };
  window.editMenuItem = function editMenuItem(id){
    const m = (window.menuItemsCache || []).find(x => x.id === id); if(!m) return;
    if($("menuEditId")) $("menuEditId").value = m.id;
    if($("menuTitleAr")) $("menuTitleAr").value = m.titleAr || m.title || "";
    if($("menuTitleEn")) $("menuTitleEn").value = m.titleEn || "";
    if($("menuType")) $("menuType").value = m.type || "link";
    if($("menuValue")) $("menuValue").value = m.value || "";
    if($("menuPopupHtml")) $("menuPopupHtml").value = m.popupHtml || "";
    if($("menuOrder")) $("menuOrder").value = m.order || 0;
    if($("menuEnabled")) $("menuEnabled").value = m.enabled ? "true" : "false";
    window.scrollTo({ top:0, behavior:"smooth" });
  };
  window.deleteMenuItem = async function deleteMenuItem(id){
    if(!confirm("حذف عنصر القائمة؟")) return;
    setOverlayLoading(true);
    try{ await window.rtdb.ref(`${window.PATHS.menuItems}/${id}`).remove(); await loadAllData(); toast("تم الحذف"); }
    catch(e){ console.error(e); toast("فشل الحذف"); }
    finally{ setOverlayLoading(false); }
  };
  window.renderMenuList = function renderMenuList(){
    const box = $("menuList"); if(!box) return;
    const items = window.menuItemsCache || [];
    box.innerHTML = items.length ? items.map(m => `<div class="mini-card flex items-center justify-between gap-3"><div><div class="font-black text-sm">${escapeHtml(m.titleAr || m.title)} / ${escapeHtml(m.titleEn || '-')}</div><div class="text-xs text-gray-400 font-bold mt-1">${escapeHtml(m.type)} | ${escapeHtml(m.value || '-')} | ${m.enabled ? 'مفعل' : 'معطل'}</div></div><div class="flex gap-2"><button class="btn btn-secondary" onclick="editMenuItem('${m.id}')">تعديل</button><button class="btn btn-danger" onclick="deleteMenuItem('${m.id}')">حذف</button></div></div>`).join("") : `<div class="empty">لا توجد عناصر قائمة</div>`;
  };

  // Social
  window.resetSocialForm = function resetSocialForm(){
    ["socialEditId","socialUrl","socialOrder"].forEach(id => { if($(id)) $(id).value = ""; });
    if($("socialPlatform")) $("socialPlatform").value = "facebook";
    if($("socialEnabled")) $("socialEnabled").value = "true";
  };
  window.saveSocialLink = async function saveSocialLink(){
    const id = clean($("socialEditId")?.value);
    const payload = {
      platform: clean($("socialPlatform")?.value) || "website",
      url: clean($("socialUrl")?.value),
      order: Number($("socialOrder")?.value || 0),
      enabled: $("socialEnabled")?.value !== "false",
      updatedAt: Date.now()
    };
    if(!payload.url){ toast("أدخل الرابط"); return; }
    setOverlayLoading(true);
    try{
      if(id) await window.rtdb.ref(`${window.PATHS.socialLinks}/${id}`).update(payload);
      else await window.rtdb.ref(window.PATHS.socialLinks).push({ ...payload, createdAt:Date.now() });
      resetSocialForm(); await loadAllData(); toast("تم حفظ رابط التواصل");
    }catch(e){ console.error(e); toast("فشل الحفظ"); }
    finally{ setOverlayLoading(false); }
  };
  window.editSocialLink = function editSocialLink(id){
    const s = (window.socialLinksCache || []).find(x => x.id === id); if(!s) return;
    if($("socialEditId")) $("socialEditId").value = s.id;
    if($("socialPlatform")) $("socialPlatform").value = s.platform || "website";
    if($("socialUrl")) $("socialUrl").value = s.url || "";
    if($("socialOrder")) $("socialOrder").value = s.order || 0;
    if($("socialEnabled")) $("socialEnabled").value = s.enabled ? "true" : "false";
    window.scrollTo({ top:0, behavior:"smooth" });
  };
  window.deleteSocialLink = async function deleteSocialLink(id){
    if(!confirm("حذف رابط التواصل؟")) return;
    setOverlayLoading(true);
    try{ await window.rtdb.ref(`${window.PATHS.socialLinks}/${id}`).remove(); await loadAllData(); toast("تم الحذف"); }
    catch(e){ console.error(e); toast("فشل الحذف"); }
    finally{ setOverlayLoading(false); }
  };
  window.renderSocialLinksList = function renderSocialLinksList(){
    const box = $("socialLinksList"); if(!box) return;
    const items = window.socialLinksCache || [];
    box.innerHTML = items.length ? items.map(s => `<div class="mini-card flex items-center justify-between gap-3"><div><div class="font-black text-sm">${escapeHtml(s.platform)}</div><div class="text-xs text-gray-400 font-bold mt-1 break-all">${escapeHtml(s.url)} | ${s.enabled ? 'مفعل' : 'معطل'}</div></div><div class="flex gap-2"><button class="btn btn-secondary" onclick="editSocialLink('${s.id}')">تعديل</button><button class="btn btn-danger" onclick="deleteSocialLink('${s.id}')">حذف</button></div></div>`).join("") : `<div class="empty">لا توجد روابط</div>`;
  };


  let orderNotificationStarted = false;
  let orderNotificationRef = null;
  let orderNotificationHandler = null;
  let knownOrderIdsForNotification = new Set();
  let knownFirebaseNotificationIds = new Set();
  let foregroundMessagingAttached = false;

  function isAdminSessionActive(){
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  }

  function isSecureNotificationContext(){
    return window.isSecureContext === true || location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  function stopOrderNotifications(){
    try{
      if(orderNotificationRef && orderNotificationHandler){
        orderNotificationRef.off("child_added", orderNotificationHandler);
      }
    }catch(e){}
    orderNotificationRef = null;
    orderNotificationHandler = null;
    orderNotificationStarted = false;
  }

  function requestNotificationPermissionFromClick(){
    if(typeof Notification === "undefined") return Promise.resolve("unsupported");
    if(Notification.permission !== "default") return Promise.resolve(Notification.permission);
    return new Promise(resolve => {
      try{
        const result = Notification.requestPermission(value => resolve(value || Notification.permission));
        if(result && typeof result.then === "function"){
          result.then(value => resolve(value || Notification.permission)).catch(() => resolve(Notification.permission));
        }
      }catch(e){
        resolve(Notification.permission || "denied");
      }
    });
  }

  function playOrderBeep(){
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    }catch(e){}
  }

  function buildOrderAdminUrl(orderId){
    const url = new URL("admin.html", window.location.href);
    url.searchParams.set("tab", "orders");
    if(orderId) url.searchParams.set("order", String(orderId));
    return url.href;
  }

  function openOrderDetails(orderId){
    try{
      if(typeof setTab === "function") setTab("orders");
      if(typeof window.setOrdersFilter === "function") window.setOrdersFilter("all");
      const target = String(orderId || new URLSearchParams(location.search).get("order") || "");
      if(!target) return;
      setTimeout(() => {
        const details = document.getElementById(`order-details-${target}`);
        if(details){
          details.classList.add("open");
          details.scrollIntoView({ behavior:"smooth", block:"center" });
          const row = details.closest(".order-summary-row");
          if(row){
            row.style.boxShadow = "0 0 0 4px rgba(243,112,33,.18)";
            row.style.borderColor = "#f37021";
            setTimeout(() => { row.style.boxShadow = ""; row.style.borderColor = ""; }, 2600);
          }
        }
      }, 220);
    }catch(e){ console.warn("openOrderDetails failed", e); }
  }
  window.openOrderDetails = openOrderDetails;

  function handleAdminDeepLink(){
    try{
      const params = new URLSearchParams(location.search);
      const tab = params.get("tab");
      const orderId = params.get("order");
      if(tab && typeof setTab === "function") setTab(tab);
      if(orderId) openOrderDetails(orderId);
    }catch(e){}
  }

  async function ensureMessagingServiceWorker(){
    if(!navigator.serviceWorker || !isSecureNotificationContext()) return null;
    const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js", { scope:"./" });
    window.storeServiceWorkerRegistration = reg;
    try{ await navigator.serviceWorker.ready; }catch(e){}
    return reg;
  }

  async function showServiceWorkerNotification(title, options){
    if(!isAdminSessionActive()) return false;
    if(typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    const payload = {
      body: options?.body || "",
      icon: options?.icon || "app-icon-192.png",
      badge: options?.badge || "app-icon-192.png",
      tag: options?.tag || `store-order-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      data: options?.data || {}
    };
    try{
      const reg = await ensureMessagingServiceWorker();
      if(reg?.showNotification){
        await reg.showNotification(title, payload);
        return true;
      }
    }catch(e){}
    try{
      const n = new Notification(title, payload);
      n.onclick = () => {
        const url = payload?.data?.url || buildOrderAdminUrl(payload?.data?.orderId || "");
        window.focus();
        if(payload?.data?.orderId) openOrderDetails(payload.data.orderId);
        else window.location.href = url;
      };
      return true;
    }catch(e){ return false; }
  }

  function getFcmVapidKey(){
    const s = window.storeCache || {};
    return clean(s.fcmVapidKey || window.FCM_VAPID_KEY_5546 || "");
  }

  function attachForegroundFirebaseMessages(messaging){
    if(foregroundMessagingAttached || !messaging || typeof messaging.onMessage !== "function") return;
    foregroundMessagingAttached = true;
    messaging.onMessage(payload => {
      const data = payload.data || {};
      const orderId = data.orderId || data.order_id || "";
      const title = payload.notification?.title || data.title || "طلب جديد في المتجر";
      const body = payload.notification?.body || data.body || "اضغط لعرض الطلب";
      const url = data.url || data.link || data.click_action || buildOrderAdminUrl(orderId);
      toast(title);
      playOrderBeep();
      showServiceWorkerNotification(title, { body, tag: orderId ? `order-${orderId}` : "store-order", data:{ url, orderId } });
      if(orderId) setTimeout(() => openOrderDetails(orderId), 300);
    });
  }

  async function enableFirebaseMessagingToken(showMessages){
    if(!isAdminSessionActive()) return false;
    if(typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    if(!isSecureNotificationContext()) return false;
    if(!window.firebase || typeof firebase.messaging !== "function") return false;

    const vapidKey = getFcmVapidKey();
    if(!vapidKey){
      if(showMessages) toast("تم السماح للإشعارات، لكن إشعارات Firebase بالخلفية تحتاج VAPID Key من إعدادات Firebase Cloud Messaging");
      return false;
    }

    try{
      const registration = await ensureMessagingServiceWorker();
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: registration });
      if(!token){
        if(showMessages) toast("لم يتم إنشاء Firebase Token. تأكد من VAPID Key");
        return false;
      }
      const tokenKey = token.replace(/[.#$\[\]/]/g, "_");
      await window.rtdb.ref(`${window.PATHS.adminPushTokens || "settingsMohanad/adminPushTokensMohanad"}/${tokenKey}`).update({
        token,
        enabled: true,
        platform: "web",
        userAgent: navigator.userAgent || "",
        standalone: window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true,
        updatedAt: Date.now()
      });
      attachForegroundFirebaseMessages(messaging);
      if(showMessages) toast("تم ربط إشعارات Firebase بنجاح");
      return true;
    }catch(e){
      console.warn("FCM token registration skipped", e);
      if(showMessages) toast("تعذر ربط Firebase Messaging. تأكد من VAPID Key وأن الموقع يعمل على HTTPS");
      return false;
    }
  }

  window.enableAdminNotificationsNow = async function enableAdminNotificationsNow(){
    if(!isAdminSessionActive()){ toast("سجل دخول الأدمن أولاً"); return; }
    try{
      if(!isSecureNotificationContext()){ toast("الإشعارات تحتاج فتح الموقع من رابط HTTPS وليس ملف مباشر"); return; }
      if(typeof Notification === "undefined") { toast("المتصفح لا يدعم الإشعارات"); return; }
      if(Notification.permission === "denied"){
        toast("الإشعارات محظورة من إعدادات المتصفح. افتح إعدادات الموقع ثم فعّل Notifications = Allow");
        return;
      }

      const permission = await requestNotificationPermissionFromClick();
      if(permission !== "granted"){
        toast("لم يتم السماح بالإشعارات. اضغط سماح عند ظهور نافذة المتصفح");
        return;
      }

      await ensureMessagingServiceWorker();
      await enableFirebaseMessagingToken(true);
      startOrderNotifications();
      await showServiceWorkerNotification("تم تفعيل إشعارات الطلبات", {
        body: "أي طلب جديد سيظهر هنا ويفتح صفحة الطلب عند الضغط.",
        tag: "notifications-enabled",
        data: { url: buildOrderAdminUrl("") }
      });
      toast("تم تفعيل إشعارات الطلبات");
    }catch(e){ console.error(e); toast("تعذر تفعيل الإشعارات"); }
  };

  function fireOrderNotification(orderId, order){
    if(!isAdminSessionActive()) return;
    const title = order?.title || "طلب جديد في المتجر";
    const body = order?.body || `${order?.name || order?.customerName || "زبون"} - ${order?.pricing?.displayTotal || order?.displayAmount || order?.total || ""}`;
    const url = order?.url || buildOrderAdminUrl(orderId);
    toast(title);
    playOrderBeep();
    showServiceWorkerNotification(title, {
      body,
      tag: `order-${orderId}`,
      data: { url, orderId: String(orderId || "") }
    });
  }

  async function startOrderNotifications(){
    if(!isAdminSessionActive() || orderNotificationStarted || !window.rtdb) return;
    orderNotificationStarted = true;
    const notificationsPath = window.PATHS?.adminNotifications || "settingsMohanad/adminNotificationsMohanad";
    orderNotificationRef = window.rtdb.ref(notificationsPath).limitToLast(50);
    try{
      const existing = await orderNotificationRef.get();
      existing.forEach(child => knownFirebaseNotificationIds.add(String(child.key || "")));
    }catch(e){}
    orderNotificationHandler = snap => {
      if(!isAdminSessionActive()){
        stopOrderNotifications();
        return;
      }
      const notificationId = String(snap.key || "");
      const data = snap.val() || {};
      if(!notificationId || knownFirebaseNotificationIds.has(notificationId)) return;
      knownFirebaseNotificationIds.add(notificationId);
      const orderId = String(data.orderId || data.order_id || "");
      if(orderId && knownOrderIdsForNotification.has(orderId)) return;
      if(orderId) knownOrderIdsForNotification.add(orderId);
      fireOrderNotification(orderId, data);
      setTimeout(() => {
        if(isAdminSessionActive()) loadAllData();
      }, 400);
    };
    orderNotificationRef.on("child_added", orderNotificationHandler);
  }

  function boot(){
    renderCategoryIcons();
    resetCategoryForm();
    resetShippingForm();
    resetSectionForm();
    resetMenuForm();
    resetSocialForm();
    renderCheckoutFieldsBuilder([]);
    if(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"){
      setScreen(true);
      loadAllData().then(() => { enableFirebaseMessagingToken(); startOrderNotifications(); handleAdminDeepLink(); });
    }else{
      setScreen(false);
    }
  }

  window.addEventListener("load", boot);
})();
