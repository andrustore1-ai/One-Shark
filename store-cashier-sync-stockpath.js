/* store-cashier-sync.js - Final robust link between store orders and cashier stock/invoices */
(function(){
  "use strict";
  const CASHIER_CLIENTS_PATH = "DFDFG_clients";
  const STORE_PRODUCTS_PATH = "productsMohanad";
  const STORE_SETTINGS_PATH = "settingsMohanad/storeMohanad";

  const clean = v => String(v ?? "").trim();
  const asArray = v => Array.isArray(v) ? v : [];
  const asList = v => Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []);
  const safeKey = key => clean(key).replace(/[.#$/[\]]/g, "_");
  const byId = id => document.getElementById(id);
  const toast = msg => typeof window.toast === "function" ? window.toast(msg) : alert(msg);
  const overlay = on => typeof window.showOverlay === "function" ? window.showOverlay(on) : (typeof window.setOverlayLoading === "function" ? window.setOverlayLoading(on) : null);

  function db(){ return window.rtdb || (window.firebase && window.firebase.database && window.firebase.database()); }
  function productsPath(){ return window.PATHS?.products || STORE_PRODUCTS_PATH; }
  function ordersPath(){ return window.PATHS?.orders || "ordersMohanad"; }
  function storeSettingsPath(){ return window.PATHS?.store || STORE_SETTINGS_PATH; }
  function normalizeHexColor(value){
    const raw = clean(value || "#cccccc");
    if(/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
    if(/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
    return "#cccccc";
  }
  function makeKey(value, fallback="key"){
    const raw = clean(value) || fallback;
    try { return btoa(unescape(encodeURIComponent(raw))).replace(/[=+/]/g,"_"); }
    catch { return raw.toLowerCase().replace(/\s+/g,"_").replace(/[^\u0600-\u06FFa-z0-9_]/g,"") || fallback; }
  }
  function colorKey(c){ return clean(c?.key || c?.id) || makeKey(`${c?.name || "لون"}|${c?.code || c?.colorCode || ""}`, "color"); }
  function normalizeMatrix(product){
    const raw = asList(product?.variantMatrix);
    if(raw.length){
      return raw.map(r => ({
        size: clean(r.size || r.name || "بدون مقاس") || "بدون مقاس",
        colors: asList(r.colors).map(c => ({
          key: colorKey(c),
          name: clean(c.name || c.colorName || "لون") || "لون",
          code: normalizeHexColor(c.code || c.colorCode || "#cccccc"),
          image: clean(c.image || c.imageUrl || ""),
          stock: Math.max(0, Number(c.stock ?? c.qty ?? 0))
        })).filter(c => c.name)
      })).filter(r => r.size && r.colors.length);
    }
    const variants = asList(product?.variants);
    if(variants.length){
      return variants.map(v => ({
        size: clean(v.name || v.size || "بدون مقاس") || "بدون مقاس",
        colors: [{key:"default", name:"افتراضي", code:"#cccccc", image:"", stock:Math.max(0, Number(v.qty ?? v.stock ?? 0))}]
      }));
    }
    const stock = Math.max(0, Number(product?.stock ?? product?.inventoryTotal ?? 0));
    return stock ? [{size:"بدون مقاس", colors:[{key:"default", name:"افتراضي", code:"#cccccc", image:"", stock}]}] : [];
  }
  function matrixTotal(matrix){ return asList(matrix).reduce((s,r)=>s+asList(r.colors).reduce((x,c)=>x+Math.max(0, Number(c.stock||0)),0),0); }
  function flattenVariants(matrix){ return asList(matrix).map(r => ({name:r.size || "بدون مقاس", qty:asList(r.colors).reduce((s,c)=>s+Math.max(0, Number(c.stock||0)),0)})).filter(v=>v.name); }
  function extractColors(matrix){
    const map = new Map();
    asList(matrix).forEach(r => asList(r.colors).forEach(c => {
      const k = colorKey(c);
      if(!map.has(k)) map.set(k, {key:k, name:c.name || "لون", code:normalizeHexColor(c.code), images:c.image ? [c.image] : []});
    }));
    return [...map.values()];
  }
  function productStockPayload(product){
    const matrix = normalizeMatrix(product);
    return {
      variantMatrix: matrix,
      variants: flattenVariants(matrix),
      colorOptions: extractColors(matrix),
      sizes: matrix.map(r => r.size),
      stock: matrixTotal(matrix),
      inventoryTotal: matrixTotal(matrix),
      updatedAt: Date.now()
    };
  }
  async function getObjectList(path){
    const snap = await db().ref(path).get();
    const raw = snap.val() || {};
    return Object.entries(raw).map(([key,v]) => ({ ...(v || {}), id: clean(v?.id || key), _key: key, firebaseKey: key }));
  }
  async function getStoreProductById(id){
    const wanted = clean(id);
    if(!wanted) return null;
    const snap = await db().ref(`${productsPath()}/${wanted}`).get();
    if(snap.exists()) return { ...(snap.val() || {}), id: clean(snap.val()?.id || wanted), _key: wanted, firebaseKey: wanted };
    const list = await getObjectList(productsPath());
    return list.find(p => clean(p.id) === wanted || clean(p._key) === wanted || clean(p.firebaseKey) === wanted) || null;
  }
  async function resolveCashierKey(){
    let key = clean(byId("storeCashierLicenseKey")?.value || window.storeCache?.cashierLicenseKey || "");
    if(key) return key;
    try{
      const snap = await db().ref(storeSettingsPath()).get();
      key = clean(snap.val()?.cashierLicenseKey || "");
      if(key){
        window.storeCache = { ...(window.storeCache || {}), cashierLicenseKey:key };
        if(byId("storeCashierLicenseKey")) byId("storeCashierLicenseKey").value = key;
      }
    }catch{}
    return key;
  }
  function cashierBasePath(key){ return key ? `${CASHIER_CLIENTS_PATH}/${safeKey(key)}` : ""; }
  function cashierProductsPath(key){ return key ? `${cashierBasePath(key)}/products` : ""; }
  function cashierInvoicesPath(key){ return key ? `${cashierBasePath(key)}/invoices` : ""; }
  function cashierCountersPath(key){ return key ? `${cashierBasePath(key)}/counters` : ""; }

  function updateSyncStatus(message, ok=true){
    const el = byId("cashierBarcodeSyncStatus");
    if(!el) return;
    el.textContent = message || "";
    el.className = ok ? "hint mt-2 text-emerald-700 font-black" : "hint mt-2 text-red-600 font-black";
  }
  async function findCashierProductByBarcode(barcode, keyArg){
    const code = clean(barcode);
    const key = keyArg || await resolveCashierKey();
    if(!code || !key) return null;
    const list = await getObjectList(cashierProductsPath(key));
    return list.find(p => [p.code,p.barcode,p.cashierBarcode].map(clean).includes(code)) || null;
  }
  window.findCashierProductByBarcode = findCashierProductByBarcode;

  window.importCashierProductToStoreForm = async function importCashierProductToStoreForm(barcodeArg, options={}){
    const barcode = clean(barcodeArg || byId("productBarcode")?.value);
    if(!barcode) return null;
    const key = await resolveCashierKey();
    if(!key){ updateSyncStatus("أدخل مفتاح الكاشير في إعدادات المتجر أولاً", false); if(!options.silent) toast("أدخل مفتاح الكاشير في إعدادات المتجر أولاً"); return null; }
    const found = await findCashierProductByBarcode(barcode, key);
    if(!found){ updateSyncStatus("لم يتم العثور على منتج بهذا الباركود في الكاشير", false); if(!options.silent) toast("لم يتم العثور على المنتج في الكاشير"); return null; }
    const matrix = normalizeMatrix(found);
    const colors = extractColors(matrix);
    const sizes = matrix.map(r => r.size);
    if(byId("productBarcode")) byId("productBarcode").value = clean(found.code || found.barcode || found.cashierBarcode || barcode);
    if(byId("productNameAr") && !clean(byId("productNameAr").value)) byId("productNameAr").value = clean(found.name || "");
    if(byId("productPrice") && !Number(byId("productPrice").value || 0)) byId("productPrice").value = Number(found.price || 0);
    if(typeof window.clearProductColorBuilder === "function") window.clearProductColorBuilder();
    colors.forEach(color => typeof window.addProductColorImageBuilder === "function" && window.addProductColorImageBuilder({ name: color.name, code: color.code, image: asList(color.images)[0] || "" }));
    if(typeof window.fillProductSizesBuilder === "function") window.fillProductSizesBuilder(sizes);
    if(typeof window.renderProductVariantStockBuilder === "function") window.renderProductVariantStockBuilder(matrix);
    if(byId("productColorOptions")) byId("productColorOptions").value = JSON.stringify(colors, null, 2);
    if(byId("productSizes")) byId("productSizes").value = JSON.stringify(sizes, null, 2);
    if(byId("productVariantMatrix")) byId("productVariantMatrix").value = JSON.stringify(matrix, null, 2);
    window.__lastCashierImportedFields = { cashierProductId: found.id, cashierProductKey: found._key || found.firebaseKey || found.id, cashierLicenseKey:key, cashierBarcode: barcode, barcode, variantMatrix:matrix, variants:flattenVariants(matrix), colorOptions:colors, sizes, inventoryTotal:matrixTotal(matrix) };
    updateSyncStatus(`تم جلب ${sizes.length} مقاس و ${colors.length} لون من الكاشير`, true);
    if(!options.silent) toast("تم جلب المقاسات والألوان والمخزون من الكاشير");
    return window.__lastCashierImportedFields;
  };
  function bindBarcodeAutoImport(){
    const input = byId("productBarcode");
    if(!input || input.dataset.cashierAutoImportBound === "1") return;
    input.dataset.cashierAutoImportBound = "1";
    let timer = null;
    const run = () => { clearTimeout(timer); timer = setTimeout(()=>{ const code = clean(input.value); if(code) window.importCashierProductToStoreForm(code, {silent:false}); }, 450); };
    input.addEventListener("change", run);
    input.addEventListener("blur", run);
    input.addEventListener("paste", () => setTimeout(run, 80));
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindBarcodeAutoImport); else bindBarcodeAutoImport();

  window.syncProductToCashier = async function syncProductToCashier(productId, product){
    const key = await resolveCashierKey();
    const barcode = clean(product?.cashierBarcode || product?.barcode || product?.code);
    if(!key || !barcode || !productId) return;
    const found = await findCashierProductByBarcode(barcode, key);
    const imported = window.__lastCashierImportedFields || {};
    const cashierKey = clean(found?._key || found?.firebaseKey || imported.cashierProductKey || product?.cashierProductKey || product?.cashierProductId || (barcode ? `bc_${safeKey(barcode)}` : `store_${productId}`));
    const cashierId = clean(found?.id || imported.cashierProductId || product?.cashierProductId || cashierKey);
    const matrix = normalizeMatrix(product);
    const payload = {
      ...(found || {}),
      id: cashierId,
      name: product.nameAr || product.name || product.nameEn || found?.name || "منتج متجر",
      code: barcode,
      barcode,
      price: Number(product.price || found?.price || 0),
      cost: Number(product.cost || found?.cost || 0),
      storeId: found?.storeId || product.cashierStoreId || "default",
      linkedStoreProductId: productId,
      linkedFromStore: true,
      ...productStockPayload(product),
      updatedAt: new Date().toISOString(),
      createdAt: found?.createdAt || new Date().toISOString()
    };
    await db().ref(`${cashierProductsPath(key)}/${cashierKey}`).update({ ...payload, id: cashierId, _key: cashierKey, firebaseKey: cashierKey });
    await db().ref(`${productsPath()}/${productId}`).update({
      cashierProductId: cashierId,
      cashierProductKey: cashierKey,
      cashierLicenseKey: key,
      cashierBarcode: barcode,
      barcode,
      ...productStockPayload(product)
    });
  };

  function findRow(matrix, size){
    const wanted = clean(size) || "بدون مقاس";
    return asList(matrix).find(r => clean(r.size) === wanted) || (asList(matrix).length === 1 ? asList(matrix)[0] : null);
  }
  function findColor(row, line){
    const colors = asList(row?.colors);
    const key = clean(line.colorKey || line.selectedColorKey || line.variantKey || "");
    const name = clean(line.colorName || line.selectedColorName || line.selectedColor || "");
    const code = normalizeHexColor(line.colorCode || line.selectedColorCode || "");
    return colors.find(c => key && clean(c.key) === key)
      || colors.find(c => name && clean(c.name) === name && normalizeHexColor(c.code) === code)
      || colors.find(c => name && clean(c.name) === name)
      || (colors.length === 1 ? colors[0] : null);
  }
  function mutateStock(product, line, direction){
    const matrix = normalizeMatrix(product);
    if(!matrix.length){
      const current = Math.max(0, Number(product?.stock || product?.inventoryTotal || 0));
      const delta = Number(direction) * Number(line.qty || 1);
      const next = current + delta;
      if(next < 0) throw new Error(`المخزون غير كافٍ: ${product?.name || product?.nameAr || line.productName || "منتج"}. المتاح ${current} والمطلوب ${Math.abs(delta)}`);
      return { ...product, stock:next, inventoryTotal:next, updatedAt:Date.now() };
    }
    const row = findRow(matrix, line.size || line.selectedSize || line.selectedVariant || "");
    const color = findColor(row, line);
    if(!row || !color) throw new Error(`لم يتم العثور على المقاس/اللون: ${product?.name || product?.nameAr || line.productName || "منتج"} / ${line.size || "مقاس"} / ${line.colorName || "لون"}`);
    const current = Math.max(0, Number(color.stock || 0));
    const delta = Number(direction) * Number(line.qty || 1);
    const next = current + delta;
    if(next < 0) throw new Error(`المخزون غير كافٍ: ${product?.name || product?.nameAr || line.productName || "منتج"}. المتاح ${current} والمطلوب ${Math.abs(delta)}`);
    color.stock = next;
    return { ...product, variantMatrix:matrix, variants:flattenVariants(matrix), colorOptions:extractColors(matrix), sizes:matrix.map(r=>r.size), stock:matrixTotal(matrix), inventoryTotal:matrixTotal(matrix), updatedAt:Date.now() };
  }
  function orderItems(order){
    if(asArray(order?.items).length) return asArray(order.items);
    if(asArray(order?.products).length) return asArray(order.products);
    if(asArray(order?.cartItems).length) return asArray(order.cartItems);
    if(order?.product && typeof order.product === "object") return [order.product];
    return [];
  }
  function orderLines(order){
    const groups = new Map();
    orderItems(order).forEach(item => {
      const units = asArray(item.unitSelections);
      const qty = Math.max(1, Number(item.qty || item.quantity || units.length || 1));
      const expanded = units.length ? units.map(u => ({
        size: clean(u.size || item.selectedSize || item.selectedVariant || "بدون مقاس") || "بدون مقاس",
        colorKey: clean(u.colorKey || u.selectedColorKey || item.selectedColorKey || item.colorKey || ""),
        colorName: clean(u.colorName || u.selectedColorName || item.selectedColorName || item.selectedColor || item.colorName || ""),
        colorCode: normalizeHexColor(u.colorCode || u.selectedColorCode || item.selectedColorCode || item.colorCode || ""),
        qty: 1
      })) : Array.from({length:qty}, () => ({
        size: clean(item.selectedSize || item.selectedVariant || item.size || "بدون مقاس") || "بدون مقاس",
        colorKey: clean(item.selectedColorKey || item.colorKey || ""),
        colorName: clean(item.selectedColorName || item.selectedColor || item.colorName || ""),
        colorCode: normalizeHexColor(item.selectedColorCode || item.colorCode || ""),
        qty: 1
      }));
      expanded.forEach(u => {
        const code = clean(item.cashierBarcode || item.barcode || item.code || "");
        const pid = clean(item.id || item.productId || "");
        const key = [pid, code, u.size, u.colorKey || u.colorName, u.colorCode].join("__");
        if(!groups.has(key)) groups.set(key, { item, productId:pid, barcode:code, productName:item.nameAr || item.name || item.nameEn || pid || code, ...u, qty:0 });
        groups.get(key).qty += 1;
      });
    });
    return [...groups.values()];
  }
  async function findStoreProduct(line){
    const pid = clean(line.productId || line.item?.id || line.item?.productId || "");
    if(pid){ const direct = await getStoreProductById(pid); if(direct) return direct; }
    const code = clean(line.barcode || line.item?.cashierBarcode || line.item?.barcode || line.item?.code || "");
    const cid = clean(line.item?.cashierProductId || "");
    const list = await getObjectList(productsPath());
    return list.find(p => cid && [p.cashierProductId,p.cashierProductKey,p.id,p._key].map(clean).includes(cid))
      || list.find(p => pid && [p.id,p._key,p.firebaseKey].map(clean).includes(pid))
      || list.find(p => code && [p.cashierBarcode,p.barcode,p.code].map(clean).includes(code))
      || null;
  }
  function makeCashierMirrorProduct(storeProduct, line, key){
    const code = clean(line?.barcode || line?.item?.cashierBarcode || line?.item?.barcode || line?.item?.code || storeProduct?.cashierBarcode || storeProduct?.barcode || storeProduct?.code || "");
    const storeId = clean(storeProduct?._key || storeProduct?.firebaseKey || storeProduct?.id || line?.productId || line?.item?.productId || line?.item?.id || "");
    const cashierKey = clean(storeProduct?.cashierProductKey || line?.item?.cashierProductKey || "") || (code ? `bc_${safeKey(code)}` : `store_${safeKey(storeId || Date.now())}`);
    const matrix = normalizeMatrix(storeProduct || line?.item || {});
    return {
      ...(storeProduct || {}),
      id: clean(storeProduct?.cashierProductId || cashierKey),
      _key: cashierKey,
      firebaseKey: cashierKey,
      code,
      barcode: code,
      cashierBarcode: code,
      name: storeProduct?.name || storeProduct?.nameAr || line?.productName || line?.item?.name || "منتج متجر",
      linkedStoreProductId: storeId,
      linkedFromStore: true,
      cashierLicenseKey: key || "",
      variantMatrix: matrix,
      variants: flattenVariants(matrix),
      colorOptions: extractColors(matrix),
      sizes: matrix.map(r=>r.size),
      stock: matrixTotal(matrix),
      inventoryTotal: matrixTotal(matrix),
      updatedAt: Date.now()
    };
  }
  async function ensureCashierMirrorProduct(line, storeProduct, key){
    if(!key || !storeProduct) return null;
    const mirror = makeCashierMirrorProduct(storeProduct, line, key);
    const path = `${cashierProductsPath(key)}/${mirror._key}`;
    const snap = await db().ref(path).get().catch(()=>null);
    if(!snap || !snap.exists()){
      await db().ref(path).update(mirror);
      await db().ref(`${productsPath()}/${storeProduct._key || storeProduct.firebaseKey || storeProduct.id}`).update({
        cashierProductKey: mirror._key,
        cashierProductId: mirror.id,
        cashierLicenseKey: key,
        cashierBarcode: mirror.barcode,
        barcode: mirror.barcode,
        updatedAt: Date.now()
      }).catch(()=>{});
    }
    return mirror;
  }
  async function findCashierProduct(line, storeProduct, key){
    if(!key) return null;
    const list = await getObjectList(cashierProductsPath(key));
    const code = clean(line.barcode || line.item?.cashierBarcode || line.item?.barcode || line.item?.code || storeProduct?.cashierBarcode || storeProduct?.barcode || storeProduct?.code || "");
    const cid = clean(line.item?.cashierProductId || storeProduct?.cashierProductId || "");
    const ckey = clean(line.item?.cashierProductKey || storeProduct?.cashierProductKey || storeProduct?.cashierProductId || "");
    const storeId = clean(storeProduct?._key || storeProduct?.firebaseKey || storeProduct?.id || line.productId || line.item?.productId || line.item?.id || "");
    const found = list.find(p => ckey && [p._key,p.firebaseKey,p.id,p.cashierProductKey].map(clean).includes(ckey))
      || list.find(p => cid && [p.id,p._key,p.firebaseKey,p.cashierProductId].map(clean).includes(cid))
      || list.find(p => code && [p.code,p.barcode,p.cashierBarcode].map(clean).includes(code))
      || list.find(p => storeId && clean(p.linkedStoreProductId) === storeId)
      || null;
    if(found) return found;
    return await ensureCashierMirrorProduct(line, storeProduct, key);
  }
  function productMatchScore(p, product, line){
    const wantedBarcode = clean(line?.barcode || line?.item?.cashierBarcode || line?.item?.barcode || line?.item?.code || product?.cashierBarcode || product?.barcode || product?.code || "");
    const wantedId = clean(product?.id || line?.productId || line?.item?.id || line?.item?.productId || "");
    const wantedKey = clean(product?._key || product?.firebaseKey || product?.cashierProductKey || line?.item?.cashierProductKey || "");
    const wantedCashierId = clean(line?.item?.cashierProductId || product?.cashierProductId || "");
    if(wantedKey && clean(p._key) === wantedKey) return 100;
    if(wantedCashierId && (clean(p.id) === wantedCashierId || clean(p._key) === wantedCashierId)) return 95;
    if(wantedBarcode && [p.code,p.barcode,p.cashierBarcode].map(clean).includes(wantedBarcode)) return 90;
    if(wantedId && (clean(p.id) === wantedId || clean(p._key) === wantedId || clean(p.linkedStoreProductId) === wantedId)) return 80;
    return 0;
  }

  async function resolveExistingProductKey(listPath, product, line){
    const candidates = [product?._key, product?.firebaseKey, product?.cashierProductKey, product?.id, line?.item?.cashierProductKey, line?.item?.cashierProductId, line?.productId]
      .map(clean).filter(Boolean);
    for(const candidate of [...new Set(candidates)]){
      try{
        const snap = await db().ref(`${listPath}/${candidate}`).get();
        if(snap.exists()) return candidate;
      }catch{}
    }
    const list = await getObjectList(listPath);
    let best = null;
    let bestScore = 0;
    list.forEach(p => {
      const score = productMatchScore(p, product, line);
      if(score > bestScore){ best = p; bestScore = score; }
    });
    return best?._key || best?.firebaseKey || "";
  }

  async function transactionProduct(listPath, product, line, direction){
    let key = await resolveExistingProductKey(listPath, product, line);
    const code = clean(line?.barcode || line?.item?.cashierBarcode || line?.item?.barcode || line?.item?.code || product?.cashierBarcode || product?.barcode || product?.code || "");
    if(!key){
      key = clean(product?._key || product?.firebaseKey || product?.cashierProductKey || product?.cashierProductId || "") || (code ? `bc_${safeKey(code)}` : `auto_${Date.now()}`);
    }
    const path = `${listPath}/${key}`;
    const initialProduct = {
      ...(product || {}),
      id: clean(product?.id || product?.cashierProductId || key),
      _key: key,
      firebaseKey: key,
      code: clean(product?.code || code),
      barcode: clean(product?.barcode || code),
      cashierBarcode: clean(product?.cashierBarcode || code)
    };
    let failure = "";
    let updated = null;
    await new Promise((resolve,reject)=>{
      db().ref(path).transaction(current => {
        try{
          const base = current ? { ...(current || {}), id: clean(current?.id || product?.id || key), _key:key, firebaseKey:key } : initialProduct;
          updated = mutateStock(base, line, direction);
          return { ...updated, id: clean(updated?.id || base.id || key), _key:key, firebaseKey:key };
        }catch(e){ failure = e?.message || "تعذر تعديل المخزون"; return; }
      }, (error, committed, snap) => {
        if(error) reject(error);
        else if(!committed) reject(new Error(failure || "تعذر تعديل المخزون"));
        else { updated = { ...(snap.val() || {}), id: clean(snap.val()?.id || product?.id || key), _key:key, firebaseKey:key }; resolve(); }
      }, false);
    });
    return updated;
  }
  async function syncStoreFromCashier(cashierProduct, storeProduct, key){
    const matrix = normalizeMatrix(cashierProduct);
    const code = clean(cashierProduct.code || cashierProduct.barcode || cashierProduct.cashierBarcode || storeProduct?.cashierBarcode || storeProduct?.barcode || "");
    const payload = { cashierProductId:cashierProduct.id || storeProduct?.cashierProductId || "", cashierProductKey:cashierProduct._key || cashierProduct.firebaseKey || storeProduct?.cashierProductKey || "", cashierLicenseKey:key || "", cashierBarcode:code, barcode:code, variantMatrix:matrix, variants:flattenVariants(matrix), colorOptions:extractColors(matrix), sizes:matrix.map(r=>r.size), stock:matrixTotal(matrix), inventoryTotal:matrixTotal(matrix), updatedAt:Date.now() };
    const targetId = storeProduct?._key || storeProduct?.firebaseKey || storeProduct?.id;
    if(targetId) await db().ref(`${productsPath()}/${targetId}`).update(payload);
  }
  async function applyOrderStock(order, direction, key){
    const lines = orderLines(order);
    if(!lines.length) return;
    for(const line of lines){
      const storeProduct = await findStoreProduct(line);
      const cashierProduct = await findCashierProduct(line, storeProduct, key);
      if(cashierProduct && (cashierProduct._key || cashierProduct.id)){
        const updatedCashier = await transactionProduct(cashierProductsPath(key), cashierProduct, line, direction);
        await syncStoreFromCashier({ ...(updatedCashier || {}), id:cashierProduct.id, _key:cashierProduct._key || updatedCashier?._key }, storeProduct, key);
      }else if(storeProduct && key){
        const mirror = await ensureCashierMirrorProduct(line, storeProduct, key);
        const updatedCashier = await transactionProduct(cashierProductsPath(key), mirror || storeProduct, line, direction);
        await syncStoreFromCashier({ ...(updatedCashier || {}), id:mirror?.id || storeProduct.cashierProductId, _key:mirror?._key || updatedCashier?._key }, storeProduct, key);
      }else if(storeProduct && (storeProduct._key || storeProduct.id)){
        await transactionProduct(productsPath(), storeProduct, line, direction);
      }else{
        throw new Error(`لم يتم العثور على المنتج للخصم: ${line.productName || line.barcode || "منتج"}`);
      }
    }
  }
  async function getCashierSettings(key){ try{ const snap = await db().ref(`${cashierBasePath(key)}/settings`).get(); return snap.val() || {}; }catch{return{};} }
  async function ensureCashierStoreId(key, preferred){
    const base = cashierBasePath(key);
    if(!base) return "default";
    const wanted = clean(preferred);
    const storesRef = db().ref(`${base}/stores`);
    const snap = await storesRef.get().catch(()=>null);
    const raw = snap && snap.exists() ? (snap.val() || {}) : {};
    const entries = Object.entries(raw);
    if(wanted){
      const match = entries.find(([id,v]) => clean(id) === wanted || clean(v?.id) === wanted);
      if(match) return clean(match[1]?.id || match[0]);
    }
    if(entries.length){
      const [id, v] = entries[0];
      const sid = clean(v?.id || id || "default") || "default";
      if(clean(v?.id) !== sid) await storesRef.child(id).update({ id:sid }).catch(()=>{});
      return sid;
    }
    await storesRef.child("default").update({ id:"default", name:"المحل الرئيسي", createdAt:Date.now(), updatedAt:Date.now() }).catch(()=>{});
    return "default";
  }
  async function findExistingCashierInvoiceId(orderId, key){
    if(!key || !orderId) return "";
    const snap = await db().ref(cashierInvoicesPath(key)).get().catch(()=>null);
    if(!snap || !snap.exists()) return "";
    const raw = snap.val() || {};
    const found = Object.entries(raw).find(([id, inv]) => clean(inv?.storeOrderId) === clean(orderId) || clean(inv?.sourceOrderId) === clean(orderId));
    return found ? clean(found[1]?.id || found[0]) : "";
  }
  async function nextInvoiceNumber(key){
    let next = Date.now();
    await new Promise(resolve=>{
      db().ref(`${cashierCountersPath(key)}/invoiceAutoNumber`).transaction(current => { next = Number(current || 0) + 1; return next; }, ()=>resolve(), false);
    });
    return String(next || Date.now());
  }
  async function createCashierInvoice(orderId, order, key){
    if(!key) return "";
    const invPath = cashierInvoicesPath(key);
    const existingId = await findExistingCashierInvoiceId(orderId, key);
    if(existingId) return existingId;

    const settings = await getCashierSettings(key);
    const items = [];
    let storeId = clean(order.cashierStoreId || order.storeId || "");

    for(const item of orderItems(order)){
      const probe = { item, productId:clean(item.id || item.productId), barcode:clean(item.cashierBarcode || item.barcode || item.code) };
      const storeProduct = await findStoreProduct(probe);
      const cashierProduct = await findCashierProduct(probe, storeProduct, key);
      if(cashierProduct?.storeId) storeId = clean(cashierProduct.storeId);
      else if(storeProduct?.cashierStoreId) storeId = clean(storeProduct.cashierStoreId);

      const matrix = normalizeMatrix(cashierProduct || storeProduct || item);
      const units = asArray(item.unitSelections);
      const qty = Math.max(1, Number(item.qty || item.quantity || units.length || 1));
      const first = units[0] || {};
      const price = Number(item.price ?? item.salePrice ?? cashierProduct?.price ?? storeProduct?.price ?? 0);
      const cost = Number(cashierProduct?.cost ?? cashierProduct?.buyPrice ?? storeProduct?.cost ?? storeProduct?.buyPrice ?? item.cost ?? 0);
      items.push({
        lineKey:`${cashierProduct?._key || cashierProduct?.id || item.id || item.productId || item.barcode || items.length}_${items.length}`,
        id:clean(cashierProduct?.id || cashierProduct?._key || item.cashierProductId || item.id || item.productId || item.barcode || `store_item_${items.length}`),
        cashierProductKey:clean(cashierProduct?._key || cashierProduct?.firebaseKey || storeProduct?.cashierProductKey || item.cashierProductKey || ""),
        name:cashierProduct?.name || item.nameAr || item.name || item.nameEn || storeProduct?.nameAr || storeProduct?.name || "طلب متجر",
        code:clean(cashierProduct?.code || cashierProduct?.barcode || item.cashierBarcode || item.barcode || item.code || storeProduct?.cashierBarcode || storeProduct?.barcode || "STORE"),
        price,
        cost,
        stock:Number(cashierProduct?.stock ?? storeProduct?.stock ?? 0),
        variants:flattenVariants(matrix),
        variantMatrix:matrix,
        selectedVariant:first.size || item.selectedSize || item.selectedVariant || "",
        selectedSize:first.size || item.selectedSize || item.selectedVariant || "",
        selectedColorKey:first.colorKey || item.selectedColorKey || "",
        selectedColorName:first.colorName || item.selectedColorName || item.selectedColor || "",
        selectedColorCode:first.colorCode || item.selectedColorCode || "",
        unitSelections:units,
        qty,
        total: price * qty,
        totalCost: cost * qty
      });
    }

    if(!items.length) throw new Error("لا توجد منتجات داخل الطلب لإنشاء فاتورة الكاشير");

    storeId = await ensureCashierStoreId(key, storeId || items.find(i=>i.storeId)?.storeId || "default");
    const subtotal = Number(order.pricing?.subtotal ?? order.subtotal ?? items.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||1),0));
    const discount = Number(order.pricing?.discountTotal ?? order.discount ?? 0);
    const shipping = Number(order.pricing?.shippingTotal ?? order.shippingTotal ?? 0);
    const total = Number(order.pricing?.total ?? order.amountIls ?? order.total ?? Math.max(0, subtotal - discount + shipping));
    const invoiceId = await nextInvoiceNumber(key);
    const totalCost = items.reduce((s,i)=>s+Number(i.cost||0)*Number(i.qty||1),0);
    const invoice = {
      id:String(invoiceId),
      storeId,
      date:new Date().toISOString(),
      customer:"عميل متجر",
      customerName:"عميل متجر",
      phone:order.customerPhone || order.phone || order.guestPhone || "",
      payment:"store",
      paymentMethod:"store",
      status:"paid",
      paid:true,
      notes:`طلب متجر رقم ${order.trackingCode || orderId}`,
      discountType:"fixed",
      discountRaw:discount,
      discount,
      transferAccountType:"",
      transferAccountName:"",
      currencyName:settings.currencyName || "شيكل",
      currencySymbol:settings.currencySymbol || "₪",
      items,
      subtotal,
      shipping,
      total,
      totalCost,
      profit: total - totalCost,
      source:"store",
      sourceOrderId:orderId,
      storeOrderId:orderId,
      trackingCode:order.trackingCode || "",
      createdAt:new Date().toISOString(),
      updatedAt:Date.now()
    };
    await db().ref(`${invPath}/${invoiceId}`).set(invoice);
    await db().ref(`${cashierBasePath(key)}/storeOrders/${orderId}`).update({ invoiceId:String(invoiceId), status:"paid", total, createdAt:Date.now() }).catch(()=>{});
    return String(invoiceId);
  }
  async function acquireLock(orderId){
    let ok = false;
    await new Promise((resolve,reject)=>{
      db().ref(`${ordersPath()}/${orderId}/stockSyncLock`).transaction(current=>{
        if(current && String(current).startsWith("processing_")) return;
        ok = true;
        return `processing_${Date.now()}`;
      }, (err, committed)=> err ? reject(err) : resolve(committed && ok), false);
    });
    return ok;
  }
  async function releaseLock(orderId){ try{ await db().ref(`${ordersPath()}/${orderId}/stockSyncLock`).remove(); }catch{} }
  window.updateOrderStatus = async function updateOrderStatusFinal(orderId, status){
    overlay(true);
    let locked = false;
    try{
      const orderRef = db().ref(`${ordersPath()}/${orderId}`);
      const snap = await orderRef.get();
      if(!snap.exists()) throw new Error("الطلب غير موجود");
      let order = { ...(snap.val() || {}), id:orderId };
      const key = await resolveCashierKey();
      const shouldDeduct = ["approved", "delivered"].includes(status);
      const updates = { status, updatedAt:Date.now() };
      if(shouldDeduct){
        locked = await acquireLock(orderId);
        if(!locked) throw new Error("المزامنة تعمل الآن لهذا الطلب، جرّب بعد ثوانٍ");
        const fresh = await orderRef.get();
        order = { ...(fresh.val() || {}), id:orderId };
        if(order.inventoryDeducted !== true){
          await applyOrderStock(order, -1, key);
          updates.inventoryDeducted = true;
          updates.inventoryDeductedAt = order.inventoryDeductedAt || Date.now();
          if(key){ updates.cashierInventoryDeducted = true; updates.cashierInventoryDeductedAt = order.cashierInventoryDeductedAt || Date.now(); }
        }
        if(key){
          const currentInvoiceId = clean(order.cashierInvoiceId || "");
          const currentExists = currentInvoiceId ? await db().ref(`${cashierInvoicesPath(key)}/${currentInvoiceId}`).get().then(s=>s.exists()).catch(()=>false) : false;
          if(order.cashierInvoiceCreated !== true || !currentExists){
            const invoiceId = await createCashierInvoice(orderId, order, key);
            if(invoiceId){ updates.cashierInvoiceCreated = true; updates.cashierInvoiceId = invoiceId; updates.cashierInvoiceCreatedAt = Date.now(); }
          }
        }
      }
      await orderRef.update(updates);
      if(locked) await releaseLock(orderId);
      if(typeof window.loadAllData === "function") await window.loadAllData();
      toast(shouldDeduct ? "تم تحديث الطلب وخصم المخزون ومزامنة الكاشير وإنشاء الفاتورة" : "تم تحديث حالة الطلب");
    }catch(e){
      console.error("stock sync/order status failed", e);
      if(locked) await releaseLock(orderId);
      toast(e?.message || "فشل تحديث الطلب أو مزامنة المخزون");
    }finally{ overlay(false); }
  };

  window.ensureCashierInvoiceForStoreOrder = async function ensureCashierInvoiceForStoreOrder(orderId){
    const key = await resolveCashierKey();
    if(!key) throw new Error("أدخل مفتاح الكاشير في إعدادات المتجر أولاً");
    const orderRef = db().ref(`${ordersPath()}/${orderId}`);
    const snap = await orderRef.get();
    if(!snap.exists()) throw new Error("الطلب غير موجود");
    const order = { ...(snap.val() || {}), id:orderId };
    const invoiceId = await createCashierInvoice(orderId, order, key);
    await orderRef.update({ cashierInvoiceCreated:true, cashierInvoiceId:invoiceId, cashierInvoiceCreatedAt:Date.now(), updatedAt:Date.now() });
    toast(`تم إنشاء فاتورة الكاشير رقم ${invoiceId}`);
    return invoiceId;
  };

  function startCashierInvoiceAutoRepair(){
    if(window.__cashierInvoiceAutoRepairStarted) return;
    window.__cashierInvoiceAutoRepairStarted = true;
    try{
      db().ref(ordersPath()).on("child_changed", async snap => {
        const order = { ...(snap.val() || {}), id:snap.key };
        if(!["approved","delivered"].includes(clean(order.status))) return;
        const key = await resolveCashierKey();
        if(!key) return;
        const invoiceId = clean(order.cashierInvoiceId || "");
        const exists = invoiceId ? await db().ref(`${cashierInvoicesPath(key)}/${invoiceId}`).get().then(s=>s.exists()).catch(()=>false) : false;
        if(order.cashierInvoiceCreated === true && exists) return;
        try{
          const made = await createCashierInvoice(snap.key, order, key);
          if(made) await db().ref(`${ordersPath()}/${snap.key}`).update({ cashierInvoiceCreated:true, cashierInvoiceId:made, cashierInvoiceCreatedAt:Date.now(), updatedAt:Date.now() });
        }catch(e){ console.warn("auto cashier invoice repair skipped", e); }
      });
    }catch(e){ console.warn("cashier invoice auto repair listener failed", e); }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", startCashierInvoiceAutoRepair); else startCashierInvoiceAutoRepair();
})();
