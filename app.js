const nativeTelegram = window.Telegram?.WebApp;
const tg = nativeTelegram || {
    initDataUnsafe: {},
    HapticFeedback: { impactOccurred() {}, selectionChanged() {} },
    ready() {}, expand() {}, close() {},
    showAlert(message) { window.alert(message); },
    addToHomeScreen: null
};
// Оставляем запросы относительными: Vercel проксирует /api на Netrix.
const API_BASE_URL = '';
try { tg.ready(); tg.expand(); } catch (error) { console.warn('Telegram WebApp API недоступен:', error); }

let products = [];
let cart = [];
let currentSelectedProductId = null;
let currentSelectedFlavor = null;
let userBonuses = 0; 
let currentCategory = 'Все';
let searchQuery = '';
let selectedCity = '';
try { selectedCity = localStorage.getItem('vapebar_city') || ''; } catch {}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function apiUrl(path) { return `${API_BASE_URL}${path}`; }

async function apiFetch(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const headers = { ...(options.headers || {}) };
        if (tg.initData) headers['X-Telegram-Init-Data'] = tg.initData;
        const response = await fetch(apiUrl(path), { ...options, headers, signal: controller.signal });
        const raw = await response.text();
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = { detail: raw }; }
        if (!response.ok) {
            const detail = data.detail || data.message || `Ошибка сервера (${response.status})`;
            if (response.status === 401 && detail === 'Откройте приложение через Telegram-бота.') {
                throw new Error('Откройте магазин кнопкой «Открыть магазин» в сообщении бота. Если её нет, отправьте боту /start.');
            }
            throw new Error(detail);
        }
        return data;
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Сервер не ответил за 12 секунд. Попробуйте ещё раз.');
        if (error instanceof TypeError) throw new Error('Не удалось связаться с API. Проверьте интернет и доступность сайта на Vercel и сервера на Netrix.');
        throw error;
    } finally { clearTimeout(timer); }
}

function jsonOptions(data, method = 'POST') {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

function persistCity() {
    try { localStorage.setItem('vapebar_city', selectedCity); }
    catch (error) { console.warn('Не удалось сохранить город на устройстве:', error); }
}

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUid = urlParams.get('uid');
    let urlName = urlParams.get('name') || "Гость";

    if (urlName.includes(' | ')) urlName = urlName.split(' | ')[1];

    const user = tg.initDataUnsafe?.user || { id: urlUid, first_name: urlName, photo_url: null };

    if (user.first_name) {
        let displayName = user.first_name;
        if (displayName.includes(' | ')) displayName = displayName.split(' | ')[1];
        const uName = document.getElementById('u-name');
        if (uName) uName.innerText = displayName;
        const uId = document.getElementById('u-id');
        if (uId) uId.innerText = "ID: " + (user.id || "---");
    }

    const adminIds = [7764501774, 5526616552, 8649568755, 7542257628];
    const currentUserId = Number(tg.initDataUnsafe?.user?.id || 0);
    if (tg.initData && adminIds.includes(currentUserId)) {
        const adminBtn = document.getElementById('admin-btn');
        if(adminBtn) adminBtn.classList.remove('hidden');
    }

    loadCart(); 
    updateCartUI();
    loadProfileData();
    updateCityLabels();
    loadCatalog();
    if (!selectedCity) openCityModal();
});

function updateCityLabels() {
    const label = selectedCity || 'Выберите город';
    const catalogCity = document.getElementById('catalog-city');
    const profileCity = document.getElementById('u-city-display');
    const checkoutCity = document.getElementById('co-city-display');
    if (catalogCity) catalogCity.textContent = label;
    if (profileCity) profileCity.textContent = selectedCity || 'Город не выбран';
    if (checkoutCity) checkoutCity.textContent = selectedCity || 'Не выбран';
}

async function loadCatalog() {
    const grid = document.getElementById('product-grid');
    if (!selectedCity) {
        products = [];
        if (grid) grid.innerHTML = '<div class="info-card" style="grid-column:1/-1;text-align:center;color:var(--gray)">Сначала выберите город — покажем ассортимент и остатки рядом с вами.</div>';
        return;
    }
    if (grid) grid.innerHTML = '<div class="info-card" style="grid-column:1/-1;text-align:center;color:var(--gray)">Загружаем каталог…</div>';
    try {
        products = await apiFetch(`/api/catalog?city=${encodeURIComponent(selectedCity)}`);
        renderProducts();
    } catch (error) {
        if (grid) grid.innerHTML = `<div class="info-card" style="grid-column:1/-1;text-align:center"><b>Каталог пока недоступен</b><p style="color:var(--gray);font-size:13px">${escapeHtml(error.message)}</p><button class="outline-btn" onclick="loadCatalog()">Попробовать снова</button></div>`;
    }
}

function saveCart() {
    try { localStorage.setItem('vapelab_cart', JSON.stringify(cart)); }
    catch (error) { console.warn('Не удалось сохранить корзину на устройстве:', error); }
}
function loadCart() {
    try {
        const saved = localStorage.getItem('vapelab_cart');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) cart = parsed.filter(item => item && Number.isFinite(Number(item.id)) && Number.isFinite(Number(item.price)));
        }
    }
    catch (e) {}
}

function clearCart() {
    cart = []; saveCart();
    try { tg.HapticFeedback?.impactOccurred('medium'); } catch {} updateCartUI();
}

function showTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    if(btn) btn.classList.add('active');
    const search = document.getElementById('search-block');
    if (search) search.classList.toggle('hidden', tabId !== 'catalog');
    if (tabId === 'admin' && getMyId()) loadAdminProducts();
}

function openCityModal() { document.getElementById('city-modal')?.classList.remove('hidden'); }

async function selectCity(city) {
    selectedCity = city;
    persistCity();
    updateCityLabels();
    closeAdmModal('city-modal');
    await loadCatalog();
    const userId = getMyId();
    if (userId) apiFetch('/api/profile/city', jsonOptions({ user_id: userId, city })).catch(error => console.warn('Не удалось сохранить город профиля:', error));
}

function filterCat(cat, btn) {
    document.querySelectorAll('.c-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = cat;
    renderProducts();
}

function handleSearch() {
    searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    let items = products;
    
    if (currentCategory !== 'Все') {
        items = items.filter(p => p.category === currentCategory || p.cat === currentCategory);
    }
    
    if (searchQuery !== '') {
        items = items.filter(p => String(p.name || '').toLowerCase().includes(searchQuery) || (p.description && p.description.toLowerCase().includes(searchQuery)));
    }
    
    if (items.length === 0) {
        grid.innerHTML = `<p style="color: var(--gray); text-align: center; padding: 20px; grid-column: span 2;">Ничего не найдено.</p>`;
        return;
    }

    items.forEach(p => {
        const safeName = escapeHtml(p.name);
        const imageHTML = p.img || p.image_url
            ? `<img src="${escapeHtml(p.img || p.image_url)}" alt="${safeName}" class="product-img" loading="lazy">` 
            : `<div class="product-placeholder">💨</div>`;

        grid.innerHTML += `
            <div class="product-card" onclick="openProductModal(${p.id})" onmousemove="tiltCard(event, this)" onmouseleave="resetCard(this)">
                <div class="card-image-wrapper">
                    <div class="card-bg-waves"></div>
                    ${imageHTML}
                </div>
                <div class="card-info">
                    <div>
                        <h4 class="card-title">${safeName}</h4>
                        <p class="card-specs">${escapeHtml(p.category)}${p.stock > 0 ? ` · ${p.stock} шт.` : ''}</p>
                    </div>
                    <div class="card-price-row">
                        <div class="card-price">${Number(p.price).toLocaleString('ru-RU')} <span>₽</span></div>
                    </div>
                </div>
            </div>`;
    });
}

function openProductModal(id) {
    const p = products.find(i => Number(i.id) === Number(id));
    if (!p) return;
    currentSelectedProductId = id;
    currentSelectedFlavor = null;
    
    const imgContainer = document.getElementById('pm-image-container');
    const imgUrl = p.img || p.image_url;
    
    // Чистая вставка картинки без программного крестика
    if (imgUrl) {
        imgContainer.innerHTML = `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}">`;
    } else {
        imgContainer.innerHTML = `<div class="product-placeholder-large">💨</div>`;
    }
    
    document.getElementById('pm-title').textContent = p.name;
    document.getElementById('pm-price').textContent = Number(p.price).toLocaleString('ru-RU') + ' ₽';
    
    // Чистое описание без повторного заголовка "Описание товара"
    document.getElementById('pm-desc').textContent = p.description || p.desc || `Оригинальный товар из категории «${p.category}».`;

    // Галочка наличия
    const stockInfo = document.getElementById('pm-stock-info');
    if (p.stock > 0) { 
        stockInfo.innerHTML = `<span aria-hidden="true">●</span><span>В наличии: ${p.stock} шт.</span>`; 
    } 
    else { 
        stockInfo.innerHTML = `❌ <span style="color:var(--danger);">Нет в наличии</span>`; 
    }
    
    const flavorsContainer = document.getElementById('pm-flavors-container');
    const flavorList = document.getElementById('pm-flavor-list');
    
    if (p.flavors && p.flavors.length > 0) {
        flavorsContainer.classList.remove('hidden');
        flavorList.innerHTML = '';
        p.flavors.forEach((flavor, index) => {
            const btn = document.createElement('button');
            btn.className = 'flavor-pill';
            const count = p.flavor_stock?.[flavor];
            btn.innerText = count === undefined ? flavor : `${flavor} · ${count} шт.`;
            btn.onclick = () => selectProductFlavor(flavor, btn);
            flavorList.appendChild(btn);
            if(index === 0) selectProductFlavor(flavor, btn); 
        });
    } else {
        flavorsContainer.classList.add('hidden');
    }
    
    const addBtn = document.getElementById('pm-add-btn');
    addBtn.onclick = () => {
        if (p.flavors && p.flavors.length > 0 && !currentSelectedFlavor) { tg.showAlert("Выберите вкус!"); return; }
        addExactProductToCart(p, currentSelectedFlavor);
        closeProductModal();
    };
    
    document.getElementById('product-modal').classList.remove('hidden');
    try { tg.HapticFeedback?.impactOccurred('light'); } catch {}
}

function selectProductFlavor(flavor, btnElement) {
    currentSelectedFlavor = flavor;
    document.querySelectorAll('#pm-flavor-list .flavor-pill').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    try { tg.HapticFeedback?.selectionChanged(); } catch {}
}

function closeProductModal() { document.getElementById('product-modal').classList.add('hidden'); }

function addExactProductToCart(product, flavor) {
    const currentCount = cart.filter(item => Number(item.id) === Number(product.id) && (item.flavor || null) === (flavor || null)).length;
    const available = flavor ? Number(product.flavor_stock?.[flavor] ?? product.stock) : Number(product.stock);
    if (Number.isFinite(available) && currentCount >= available) {
        tg.showAlert("Больше нет в наличии! 😢"); return;
    }
    const finalName = flavor ? `${product.name} (${flavor})` : product.name;
    cart.push({ id: product.id, name: finalName, flavor: flavor || null, price: product.price });
    saveCart(); try { tg.HapticFeedback?.impactOccurred('medium'); } catch {} updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1); saveCart(); try { tg.HapticFeedback?.impactOccurred('light'); } catch {} updateCartUI();
}

function updateCartUI() {
    const badge = document.getElementById('badge');
    if(badge) {
        badge.innerText = cart.length;
        cart.length === 0 ? badge.classList.add('hidden') : badge.classList.remove('hidden');
    }
    const list = document.getElementById('cart-list');
    if(!list) return;
    list.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        list.innerHTML = '<div class="info-card" style="text-align:center;padding:28px 18px"><div style="font-size:28px;margin-bottom:8px">🛍️</div><b>Корзина пока пуста</b><p style="margin:6px 0 0;color:var(--gray);font-size:12px">Загляните в каталог — там найдётся что-то по вкусу.</p></div>';
        const checkoutButton = document.querySelector('#cart-tab .order-btn');
        if (checkoutButton) checkoutButton.disabled = true;
    } else {
        const checkoutButton = document.querySelector('#cart-tab .order-btn');
        if (checkoutButton) checkoutButton.disabled = false;
    }

    if (cart.length > 0) {
        list.innerHTML += `<button onclick="clearCart()" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); padding: 12px; border-radius: 12px; width: 100%; margin-bottom: 15px; font-weight: bold; cursor: pointer;">🗑 Очистить корзину</button>`;
    }
    
    cart.forEach((item, index) => {
        total += item.price;
        const originalProduct = products.find(p => p.id === item.id);
        const imgUrl = originalProduct ? (originalProduct.img || originalProduct.image_url) : null;
        const imageHTML = imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.name)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 10px; flex-shrink: 0;">` : `<div style="width: 60px; height: 60px; border-radius: 10px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">💨</div>`;

        list.innerHTML += `
            <div class="product-card" style="flex-direction: row; padding: 12px; align-items: center; transform: none; box-shadow: none; border: 1px solid var(--border); margin-bottom: 10px;">
                ${imageHTML}
                <div style="flex-grow: 1; padding-left: 12px; text-align: left; overflow: hidden;">
                    <b style="font-size: 13px; color: #fff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.name)}</b>
                    <span style="color: var(--danger); font-weight: 800; font-size: 15px; margin-top: 4px; display: inline-block;">${item.price} ₽</span>
                </div>
                <button style="background: transparent; border: none; color: var(--gray); cursor: pointer; font-size: 20px; margin-left: 10px;" onclick="removeFromCart(${index})"><i class="fa-solid fa-trash"></i></button>
            </div>`;
    });
    const totalEl = document.getElementById('total-price');
    if(totalEl) totalEl.innerText = total + ' ₽';
}

function toggleDelivery() {
    const type = document.getElementById('co-delivery').value;
    const addrGroup = document.getElementById('address-group');
    if (addrGroup) addrGroup.style.display = type === 'Самовывоз' ? 'none' : 'block';
}

function openCheckout() {
    if(cart.length === 0) return tg.showAlert("Сначала добавьте товары в корзину!");
    if(!selectedCity) { openCityModal(); return tg.showAlert("Сначала выберите город."); }
    
    const bonuses = userBonuses;
    const total = cart.reduce((s,i)=>s+i.price, 0);
    const minStep = 10;
    const maxSpend = Math.min(bonuses, total);
    const maxSpendMultiple = Math.floor(maxSpend / minStep) * minStep;
    
    const bonusCheckbox = document.getElementById('co-bonuses');
    if (bonusCheckbox) {
        const parent = bonusCheckbox.parentElement;
        bonusCheckbox.checked = false;
        if (maxSpendMultiple <= 0) {
            parent.style.display = 'none';
        } else {
            parent.style.display = 'flex'; 
            
            const bonusCountDisplay = document.getElementById('co-bonus-count');
            if (bonusCountDisplay) bonusCountDisplay.innerText = maxSpendMultiple + " ₽";
            
            let dynamicInput = document.getElementById('co-bonus-input');
            if (!dynamicInput) {
                dynamicInput = document.createElement('input');
                dynamicInput.type = 'number';
                dynamicInput.id = 'co-bonus-input';
                dynamicInput.step = minStep;
                dynamicInput.min = minStep;
                dynamicInput.style.width = '80px';
                dynamicInput.style.marginLeft = '10px';
                dynamicInput.style.background = 'var(--dark-bg)';
                dynamicInput.style.color = 'var(--text)';
                dynamicInput.style.border = '1px solid var(--border)';
                dynamicInput.style.borderRadius = '6px';
                dynamicInput.style.padding = '4px 8px';
                
                parent.appendChild(dynamicInput);
            }
            bonusCheckbox.onchange = function() {
                dynamicInput.style.display = this.checked ? 'inline-block' : 'none';
                if (this.checked) { dynamicInput.value = dynamicInput.max; dynamicInput.focus(); }
                else dynamicInput.value = '';
            };
            dynamicInput.onchange = function() {
                let val = Math.floor((parseInt(this.value, 10) || 0) / minStep) * minStep;
                val = Math.max(minStep, Math.min(val, Number(this.max)));
                this.value = val;
            };
            dynamicInput.style.display = 'none';
            dynamicInput.max = maxSpendMultiple;
        }
    }

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('checkout-tab').classList.add('active');
    document.getElementById('search-block')?.classList.add('hidden');
    toggleDelivery();
}

function backToCart() {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('cart-tab').classList.add('active');
    document.getElementById('search-block')?.classList.add('hidden');
}

function submitCheckout() {
    const type = document.getElementById('co-delivery').value;
    const addressEl = document.getElementById('co-address');
    const address = addressEl ? addressEl.value.trim() : "Не указан";
    const dateTime = document.getElementById('co-datetime').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const payment = document.getElementById('co-payment').value;
    const age = document.getElementById('co-age').checked;
    
    const total = cart.reduce((s,i)=>s+i.price, 0);
    const minStep = 10;

    let useBonuses = 0;
    const bonusCheckbox = document.getElementById('co-bonuses');
    const dynamicInput = document.getElementById('co-bonus-input'); 

    if (bonusCheckbox && bonusCheckbox.checked) {
        if (dynamicInput && dynamicInput.value) { useBonuses = parseInt(dynamicInput.value) || 0; } 
        else { useBonuses = Math.min(userBonuses, total); }
        useBonuses = Math.floor(useBonuses / minStep) * minStep;
    }

    if(!age) return tg.showAlert("Подтвердите возраст (18+)");
    if(type === 'Доставка' && address.length < 5) return tg.showAlert("Введите точный адрес доставки");
    if(dateTime.length < 3) return tg.showAlert("Укажите желаемую дату и время");
    if(phone.length < 7) return tg.showAlert("Введите корректный номер телефона");

    const userId = getMyId();
    if (!userId) return tg.showAlert("Откройте магазин кнопкой «Открыть магазин» в сообщении бота. Если её нет, отправьте боту /start.");

    const orderData = {
        userId: userId, items: cart, total: total, deliveryType: type,
        address: address, dateTime: dateTime, payment: payment, phone: phone,
        useBonuses: useBonuses > 0, bonusAmount: useBonuses, city: selectedCity
    };

    const btn = document.querySelector('#checkout-tab .order-btn');
    if(btn) { btn.disabled = true; btn.style.opacity = '0.7'; btn.innerText = '⏳ Отправка...'; }

    apiFetch('/api/orders', jsonOptions(orderData))
    .then(result => {
        tg.showAlert(`Заказ #${result.order_id} оформлен. К оплате: ${result.total} ₽`);
        clearCart();
        if (nativeTelegram) tg.close();
        else showTab('catalog', document.querySelector('.tab-btn'));
    })
    .catch(error => {
        if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = 'Подтвердить заказ'; }
        tg.showAlert(`Не удалось оформить заказ: ${error.message}`);
    });
}

function getMyId() {
    return tg.initData ? Number(tg.initDataUnsafe?.user?.id || 0) : 0;
}

function loadProfileData() {
    const userId = getMyId();
    if(!userId) return;
    apiFetch(`/api/profile?user_id=${userId}`)
        .then(data => {
            if (!selectedCity && data.city && data.city !== 'Не выбран') {
                selectedCity = data.city;
                persistCity();
                updateCityLabels();
                closeAdmModal('city-modal');
                loadCatalog();
            }
            userBonuses = data.bonuses || 0; 
            const uVip = document.getElementById('u-vip');
            if(uVip) uVip.innerText = data.vip_name;
            const uSpent = document.getElementById('u-spent');
            if(uSpent) uSpent.innerText = `${data.total_spent} ₽`;
            const nxtLvl = document.getElementById('u-next-lvl');
            if(nxtLvl) {
                if(data.to_next > 0) { nxtLvl.innerText = `До след. уровня: ${data.to_next} ₽`; nxtLvl.style.color = 'var(--gray)'; } 
                else { nxtLvl.innerText = `🌟 Максимальный уровень!`; nxtLvl.style.color = 'var(--accent)'; }
            }
            const uBonuses = document.getElementById('u-bonuses');
            if(uBonuses) uBonuses.innerText = `${userBonuses} ₽`;
            const uCb = document.getElementById('u-cb');
            if(uCb) uCb.innerText = `Кэшбек: ${data.cashback_pct}%`;
            const uRefs = document.getElementById('u-refs');
            if(uRefs) uRefs.innerText = `${data.refs} чел.`;
            
            const uRefLink = document.getElementById('u-ref-link');
            if(uRefLink && data.ref_link) uRefLink.value = data.ref_link;
        })
        .catch(error => console.warn('Не удалось загрузить профиль:', error));
}

async function copyRefLink() {
    const linkInput = document.getElementById('u-ref-link');
    try {
        await navigator.clipboard.writeText(linkInput.value);
    } catch {
        linkInput.select();
        document.execCommand('copy');
    }
    try { tg.HapticFeedback?.impactOccurred('light'); } catch {}
    tg.showAlert("Ссылка скопирована.");
}

function openClientGiveaways() {
    document.getElementById('client-gw-modal').classList.remove('hidden');
    const list = document.getElementById('client-gw-list');
    list.innerHTML = '<p style="text-align:center; color:var(--gray);">Загрузка конкурсов...</p>';
    
    apiFetch(`/api/giveaways?user_id=${getMyId()}`)
    .then(data => {
        if (data.length === 0) { list.innerHTML = '<p style="text-align:center; color:var(--gray);">Нет активных конкурсов</p>'; return; }
        let html = '';
        data.forEach(g => {
            let btnHtml = g.is_participating 
                ? `<button disabled class="order-btn" style="background:var(--dark-bg); color:var(--gray);">✅ Участвуете</button>`
                : `<button onclick="joinGiveaway(${g.id})" class="order-btn">🎁 Участвую</button>`;
            
            html += `<div class="info-card" style="margin-bottom:15px; border-color:var(--border);">
                <h4 style="color:white; margin:0 0 10px 0;">Розыгрыш #${g.id}</h4>
                <p style="color:var(--gray);">${escapeHtml(g.text)}</p>
                <div style="font-size:12px; margin-bottom:10px;">Мест: <b>${g.winners_count}</b> | Участников: <b>${g.parts_count}</b></div>
                ${btnHtml}
            </div>`;
        });
        list.innerHTML = html;
    })
    .catch(error => { list.innerHTML = `<p style="text-align:center;color:var(--gray)">Не удалось загрузить конкурсы: ${escapeHtml(error.message)}</p>`; });
}

function joinGiveaway(gw_id) {
    apiFetch(`/api/giveaways/${gw_id}/join`, jsonOptions({user_id: getMyId()}))
    .then(() => { tg.showAlert("✅ Вы участник!"); openClientGiveaways(); })
    .catch(err => tg.showAlert(`❌ ${err.message}`));
}

function setAdminTabActive(btnId) {
    ['btn-adm-prod', 'btn-adm-stat', 'btn-adm-ord', 'btn-adm-usr', 'btn-adm-gw'].forEach(id => {
        const el = document.getElementById(id); if(el) el.classList.remove('active');
    });
    document.getElementById(btnId).classList.add('active');
    document.getElementById('admin-workspace').innerHTML = '<p style="text-align:center; color:var(--gray);">Загрузка...</p>';
}

function showAdminError(error) {
    const workspace = document.getElementById('admin-workspace');
    if (workspace) workspace.innerHTML = `<div class="info-card" style="text-align:center"><b>Не удалось загрузить данные</b><p style="color:var(--gray);font-size:13px">${escapeHtml(error.message)}</p></div>`;
}

function closeAdmModal(id) { document.getElementById(id).classList.add('hidden'); }
function openAddModal() { document.getElementById('adm-add-modal').classList.remove('hidden'); }

let adminProducts = [];
function loadAdminProducts() {
    setAdminTabActive('btn-adm-prod');
    apiFetch(`/api/admin/products?admin_id=${getMyId()}`)
        .then(data => {
            adminProducts = data;
            let html = `<button class="order-btn" style="margin-bottom:15px;" onclick="openAddModal()"><i class="fa-solid fa-plus"></i> Добавить товар</button>`;
            data.forEach(p => {
                html += `
                <article class="info-card admin-product-card">
                    <div class="admin-product-head">
                        <div class="admin-product-info">
                            <b>${escapeHtml(p.name)}</b>
                            <div class="admin-product-meta"><span>${escapeHtml(p.category)}</span><span>${escapeHtml(p.city)}</span><span>${formatAdminMoney(p.price)}</span></div>
                        </div>
                        <div class="admin-stock-stepper" aria-label="Остаток: ${Number(p.stock) || 0} штук">
                            <button onclick="changeStock(${p.id}, ${p.stock - 1})" aria-label="Уменьшить остаток">−</button>
                            <b>${Number(p.stock) || 0}</b>
                            <button onclick="changeStock(${p.id}, ${p.stock + 1})" aria-label="Увеличить остаток">+</button>
                        </div>
                    </div>
                    <div class="admin-product-actions">
                        <button onclick="openFlavorsModal(${p.id})"><i class="fa-solid fa-layer-group"></i> Вкусы</button>
                        <button onclick="openEditModal(${p.id})"><i class="fa-solid fa-pen"></i> Изменить</button>
                        <button onclick="deleteProduct(${p.id})"><i class="fa-regular fa-trash-can"></i> Удалить</button>
                    </div>
                </article>`;
            });
            document.getElementById('admin-workspace').innerHTML = html;
        })
        .catch(showAdminError);
}

function changeStock(prodId, newStock) {
    if (newStock < 0) return;
    apiFetch(`/api/admin/products/${prodId}/stock?admin_id=${getMyId()}`, jsonOptions({stock: newStock})).then(() => loadAdminProducts()).catch(error => tg.showAlert(`Не удалось изменить остаток: ${error.message}`));
}

function deleteProduct(prodId) {
    if(confirm("Точно удалить товар?")) apiFetch(`/api/admin/products/${prodId}?admin_id=${getMyId()}`, {method: 'DELETE'}).then(() => loadAdminProducts()).catch(error => tg.showAlert(`Не удалось удалить товар: ${error.message}`));
}

async function submitNewProduct() {
    const name = document.getElementById('add-name').value.trim();
    const category = document.getElementById('add-cat').value;
    const price = parseFloat(document.getElementById('add-price').value);
    const stock = parseInt(document.getElementById('add-stock').value) || 0;
    const imgInput = document.getElementById('add-img');
    
    if(!name || !Number.isFinite(price) || price <= 0) return tg.showAlert("Укажите название и цену больше нуля.");
    if(!selectedCity) { openCityModal(); return tg.showAlert("Сначала выберите город для товара."); }

    let image_url = null;
    if (imgInput.files && imgInput.files[0]) {
        const formData = new FormData();
        formData.append('image', imgInput.files[0]);
        try {
            const upload = await apiFetch(`/api/admin/upload-image?admin_id=${getMyId()}`, { method: 'POST', body: formData });
            image_url = upload.url;
        } catch (error) { return tg.showAlert(`Не удалось загрузить фото: ${error.message}`); }
    }

    const data = { name, category, price, stock, image_url, city: selectedCity, description: '' };
    apiFetch(`/api/admin/products?admin_id=${getMyId()}`, jsonOptions(data))
    .then(() => {
        closeAdmModal('adm-add-modal'); loadAdminProducts();
        document.getElementById('add-name').value = ''; document.getElementById('add-price').value = ''; document.getElementById('add-stock').value = '';
        tg.showAlert(`✅ Товар добавлен!`);
    })
    .catch(error => tg.showAlert(`Не удалось добавить товар: ${error.message}`));
}

let currentEditProdId = null;
function openEditModal(id) {
    const p = adminProducts.find(x => x.id === id); currentEditProdId = id;
    document.getElementById('edit-price').value = p.price;
    document.getElementById('edit-desc').value = p.description || '';
    document.getElementById('adm-edit-modal').classList.remove('hidden');
}

function saveProductEdit() {
    const price = parseFloat(document.getElementById('edit-price').value);
    const desc = document.getElementById('edit-desc').value.trim();
    apiFetch(`/api/admin/products/${currentEditProdId}/edit?admin_id=${getMyId()}`, jsonOptions({price, description: desc})).then(() => { closeAdmModal('adm-edit-modal'); loadAdminProducts(); }).catch(error => tg.showAlert(`Не удалось сохранить товар: ${error.message}`));
}

let currentFlavors = {};
function openFlavorsModal(id) {
    const p = adminProducts.find(x => x.id === id); 
    currentEditProdId = id;
    currentFlavors = Object.assign({}, p.flavors || {});
    document.getElementById('flavor-prod-name').innerText = `Вкусы: ${p.name}`;
    renderFlavorsAdmin(); 
    document.getElementById('adm-flavors-modal').classList.remove('hidden');
}

function renderFlavorsAdmin() {
    let html = '';
    for (let [flv, count] of Object.entries(currentFlavors)) {
        const safeFlavor = escapeHtml(flv);
        html += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center; background:var(--dark-bg); padding:8px; border-radius:8px;">
            <span style="color:white; font-size:14px;">${safeFlavor}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <b style="color:var(--text); font-size:14px;">${escapeHtml(count)} шт.</b>
                <button data-delete-flavor="${safeFlavor}" aria-label="Удалить вкус" style="background:var(--danger); border:none; color:white; width:28px; height:28px; border-radius:6px;">✕</button>
            </div>
        </div>`;
    }
    const list = document.getElementById('flavor-list-admin');
    list.innerHTML = html || '<p style="color:var(--gray); font-size:13px; text-align:center;">Вкусов пока нет</p>';
    list.querySelectorAll('[data-delete-flavor]').forEach(button => {
        button.addEventListener('click', () => {
            delete currentFlavors[button.dataset.deleteFlavor];
            renderFlavorsAdmin();
        });
    });
}

function addFlavorRow() {
    const name = document.getElementById('new-flavor-name').value.trim();
    const stock = parseInt(document.getElementById('new-flavor-stock').value) || 1;
    if(name) { 
        currentFlavors[name] = stock; 
        document.getElementById('new-flavor-name').value = ''; 
        document.getElementById('new-flavor-stock').value = '';
        renderFlavorsAdmin(); 
    }
}

function saveFlavors() {
    apiFetch(`/api/admin/products/${currentEditProdId}/flavors?admin_id=${getMyId()}`, jsonOptions({flavors: currentFlavors})).then(() => { closeAdmModal('adm-flavors-modal'); loadAdminProducts(); }).catch(error => tg.showAlert(`Не удалось сохранить вкусы: ${error.message}`));
}

function adminDateTimestamp(dateValue, endOfDay = false) {
    if (!dateValue) return null;
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = endOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
}

function formatAdminMoney(value) {
    return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
}

function loadAdminStats(filters = {}) {
    setAdminTabActive('btn-adm-stat');
    const currentFilters = {
        city: filters.city || 'Все',
        status: filters.status || 'all',
        from: filters.from || '',
        to: filters.to || ''
    };
    const params = new URLSearchParams({ admin_id: String(getMyId()), city: currentFilters.city });
    if (currentFilters.status !== 'all') params.set('status', currentFilters.status);
    if (currentFilters.from && currentFilters.to) {
        params.set('start_ts', String(adminDateTimestamp(currentFilters.from)));
        params.set('end_ts', String(adminDateTimestamp(currentFilters.to, true)));
    }

    apiFetch(`/api/admin/stats?${params}`)
        .then(data => {
            const cities = ['Все', 'Междуреченск', 'Мыски'];
            const cityOptions = cities.map(city => `<option value="${city}" ${city === currentFilters.city ? 'selected' : ''}>${city === 'Все' ? 'Все города' : escapeHtml(city)}</option>`).join('');
            const statusOptions = [
                ['all', 'Все активные заказы'],
                ['completed', 'Выполненные'],
                ['pending', 'Ожидают выполнения']
            ].map(([value, label]) => `<option value="${value}" ${value === currentFilters.status ? 'selected' : ''}>${label}</option>`).join('');

            let statCards;
            if (data.custom) {
                const item = data.custom;
                statCards = `<article class="admin-stat-card primary"><span class="admin-stat-label">Выручка за выбранный период</span><strong class="admin-stat-value">${formatAdminMoney(item.rev)}</strong><span class="admin-stat-detail">Заказов: ${item.cnt} · Средний чек: ${formatAdminMoney(item.aov)}</span></article>`;
            } else {
                const cards = [
                    ['Сегодня', data.day], ['Эта неделя', data.week],
                    ['Этот месяц', data.month], ['Этот год', data.year]
                ];
                statCards = cards.map(([label, item]) => `<article class="admin-stat-card"><span class="admin-stat-label">${label}</span><strong class="admin-stat-value">${formatAdminMoney(item.rev)}</strong><span class="admin-stat-detail">${item.cnt} заказов · чек ${formatAdminMoney(item.aov)}</span></article>`).join('');
                statCards += `<article class="admin-stat-card primary"><span class="admin-stat-label">За всё время</span><strong class="admin-stat-value">${formatAdminMoney(data.total.rev)}</strong><span class="admin-stat-detail">Заказов: ${data.total.cnt} · Средний чек: ${formatAdminMoney(data.total.aov)}</span></article>`;
            }

            document.getElementById('admin-workspace').innerHTML = `
                <section class="info-card admin-filter-card">
                    <h3 class="admin-filter-heading">Фильтры отчёта</h3>
                    <div class="admin-filter-grid">
                        <div class="form-group"><label for="stats-city">Город</label><select id="stats-city" class="form-input">${cityOptions}</select></div>
                        <div class="form-group"><label for="stats-status">Статус заказа</label><select id="stats-status" class="form-input">${statusOptions}</select></div>
                        <div class="form-group"><label for="stats-from">Дата с</label><input id="stats-from" class="form-input" type="date" value="${escapeHtml(currentFilters.from)}"></div>
                        <div class="form-group"><label for="stats-to">Дата по</label><input id="stats-to" class="form-input" type="date" value="${escapeHtml(currentFilters.to)}"></div>
                    </div>
                    <div class="admin-filter-actions">
                        <button class="order-btn" onclick="applyAdminStatsFilters()">Показать отчёт</button>
                        <button class="outline-btn" onclick="resetAdminStatsFilters()">Сбросить</button>
                    </div>
                </section>
                <div class="admin-stat-grid">${statCards}</div>`;
        })
        .catch(showAdminError);
}

function applyAdminStatsFilters() {
    const from = document.getElementById('stats-from').value;
    const to = document.getElementById('stats-to').value;
    if (Boolean(from) !== Boolean(to)) return tg.showAlert('Выберите обе даты периода.');
    if (from && to && from > to) return tg.showAlert('Начало периода должно быть раньше конца.');
    loadAdminStats({
        city: document.getElementById('stats-city').value,
        status: document.getElementById('stats-status').value,
        from,
        to
    });
}

function resetAdminStatsFilters() {
    loadAdminStats({ city: 'Все', status: 'all' });
}

function loadAdminOrders() {
    setAdminTabActive('btn-adm-ord');
    apiFetch(`/api/admin/orders?admin_id=${getMyId()}`)
        .then(data => {
            let html = '';
            data.forEach(o => {
                let statusColor = '#ff7182'; 
                let statusText = 'Ожидает';
                if (o.status === 'completed') {
                    statusColor = '#ff7182'; 
                    statusText = 'Выполнен';
                } else if (o.status === 'cancelled') {
                    statusColor = 'var(--danger)'; 
                    statusText = 'Отменен';
                }

                const isPending = o.status === 'pending';
                
                let itemsHtml = '';
                if (o.items && o.items.length > 0) {
                    itemsHtml = `<div style="font-size:13px; color:white; margin-top:8px; border-top:1px solid var(--border); padding-top:8px;">${o.items.map(i => '• ' + escapeHtml(i)).join('<br>')}</div>`;
                }

                html += `
                <div class="info-card" style="margin-bottom:15px; text-align:left; border-left: 3px solid ${statusColor}; transform:none;">
                    <div style="display:flex; justify-content:space-between;">
                        <h3 style="margin:0; font-size:16px; color:white;">Заказ #${o.id}</h3>
                        <span style="font-size:12px; font-weight:bold; color:${statusColor}">${statusText}</span>
                    </div>
                    <p style="margin:8px 0 4px 0; font-size:13px;"><b>Клиент:</b> ${escapeHtml(o.user_name)} (ID: ${o.user_id})</p>
                    <p style="margin:4px 0; font-size:13px;"><b>Сумма:</b> <span style="color:var(--text); font-weight:bold;">${o.total}₽</span></p>
                    
                    ${itemsHtml}
                    
                    ${isPending ? `<div style="display:flex; gap:10px; margin-top:10px;">
                        <button onclick="changeOrderStatus('${o.id}', 'completed')" class="order-btn" style="flex:1; padding:10px;">✅</button>
                        <button onclick="changeOrderStatus('${o.id}', 'cancelled')" class="order-btn" style="flex:1; background:var(--danger); padding:10px;">❌</button>
                    </div>` : ''}
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html || '<p style="text-align:center; color:var(--gray);">Заказов пока нет</p>';
        })
        .catch(showAdminError);
}

function changeOrderStatus(oid, status) {
    if(confirm("Изменить статус заказа?")) apiFetch(`/api/admin/orders/${oid}/status?admin_id=${getMyId()}`, jsonOptions({status})).then(() => loadAdminOrders()).catch(error => tg.showAlert(`Не удалось обновить заказ: ${error.message}`));
}

function loadAdminUsers() {
    setAdminTabActive('btn-adm-usr');
    apiFetch(`/api/admin/users?admin_id=${getMyId()}`)
        .then(data => {
            let html = '';
            data.forEach(u => {
                html += `<div class="info-card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; transform:none;">
                    <div><b style="color:white;">${escapeHtml(u.name)}</b><br><span style="color:var(--gray); font-size:12px;">ID: ${u.id}</span></div>
                    <div style="text-align:right;"><span style="color:var(--text); font-weight:bold; font-size:16px;">${u.orders}</span><br><span style="color:var(--gray); font-size:11px;">заказов</span></div>
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html;
        })
        .catch(showAdminError);
}

function loadAdminGiveaways() {
    setAdminTabActive('btn-adm-gw');
    apiFetch(`/api/admin/giveaways?admin_id=${getMyId()}`)
        .then(data => {
            let html = `<button class="order-btn" style="margin-bottom:15px;" onclick="document.getElementById('adm-gw-modal').classList.remove('hidden')">🎁 Создать конкурс</button>`;
            data.forEach(g => {
                html += `
                <div class="info-card" style="margin-bottom:10px; transform:none;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <b style="color:white;">Конкурс #${g.id}</b>
                        ${g.is_active ? '<span style="color:var(--accent); font-weight:bold;">Активен</span>' : '<span style="color:var(--gray); font-weight:bold;">Завершен</span>'}
                    </div>
                    <p style="font-size:12px; color:var(--gray); margin-bottom:8px;">${escapeHtml(g.text)}</p>
                    <span style="font-size:13px; color:var(--text);">Участников: <b>${g.parts}</b></span>
                    ${g.is_active ? `<button onclick="rollGiveaway(${g.id})" class="outline-btn" style="margin-top:10px;">🎲 Подвести итоги</button>` : ''}
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html;
        })
        .catch(showAdminError);
}

function submitNewGiveaway() {
    const text = document.getElementById('gw-text').value.trim();
    if(!text) return tg.showAlert("Введите текст конкурса!");
    
    apiFetch(`/api/admin/giveaways?admin_id=${getMyId()}`, jsonOptions({ text, winners_count: parseInt(document.getElementById('gw-winners').value)||1, min_order: parseFloat(document.getElementById('gw-min-order').value)||0, end_date: document.getElementById('gw-end-date').value||'', order_start: 0, order_end: 2000000000 }))
        .then(() => { closeAdmModal('adm-gw-modal'); loadAdminGiveaways(); })
        .catch(error => tg.showAlert(`Не удалось создать конкурс: ${error.message}`));
}

function rollGiveaway(id) {
    if(confirm("Завершить конкурс?")) apiFetch(`/api/admin/giveaways/${id}/roll?admin_id=${getMyId()}`, { method: 'POST' }).then(data => {
        tg.showAlert(`🎉 Победители: ${data.winner_names.join(", ")}`);
        loadAdminGiveaways();
    }).catch(error => tg.showAlert(`Не удалось завершить конкурс: ${error.message}`));
}

const admBtn = document.getElementById('admin-btn');
if (admBtn) { admBtn.addEventListener('click', () => loadAdminProducts()); }

function tiltCard(e, card) {
    const rect = card.getBoundingClientRect();
    let clientX = e.clientX, clientY = e.clientY;
    if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    
    const tiltX = (clientY - rect.top - (rect.height / 2)) / 10;
    const tiltY = ((rect.width / 2) - (clientX - rect.left)) / 10;
    
    card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02, 1.02, 1.02)`;
}

function resetCard(card) {
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    card.style.transition = `transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)`;
    setTimeout(() => { card.style.transition = 'transform 0.1s ease, box-shadow 0.3s ease, border-color 0.3s ease'; }, 400);
}

function installApp() {
    if (tg.addToHomeScreen) {
        tg.addToHomeScreen();
    } else {
        tg.showAlert("Ваша версия Telegram не поддерживает быструю установку на рабочий стол. Пожалуйста, обновите приложение.");
    }
}
