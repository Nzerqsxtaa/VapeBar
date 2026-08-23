let tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let products = [];
let cart = [];
let currentSelectedProductId = null;
let userCity = localStorage.getItem('vapebar_city');

window.onload = () => {
    checkCity();
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

        const avatarImg = document.getElementById('u-avatar');
        const avatarFallback = document.getElementById('u-avatar-fallback');
        
        if (user.photo_url) {
            if (avatarImg) {
                avatarImg.src = user.photo_url;
                avatarImg.style.display = 'block';
                if (avatarFallback) avatarFallback.style.display = 'none';
            }
        } else {
            if (avatarFallback) {
                const firstLetter = displayName.replace(/[^a-zA-Zа-яА-Я]/g, '').charAt(0).toUpperCase() || '👤';
                avatarFallback.innerText = firstLetter;
                if (avatarImg) avatarImg.style.display = 'none';
                avatarFallback.style.display = 'flex';
            }
        }
    }

    if (urlUid === "7764501774" || user?.id === 7764501774) {
        const adminBtn = document.getElementById('admin-btn');
        if(adminBtn) adminBtn.classList.remove('hidden');
    }

    loadCart(); 
    updateCartUI();
    loadProfileData();

    fetch('/api/catalog')
        .then(response => response.json())
        .then(data => {
            products = data; 
            renderProducts(); 
        })
        .catch(error => {
            console.error("Ошибка загрузки каталога:", error);
            const grid = document.getElementById('product-grid');
            if(grid) grid.innerHTML = '<p style="color: white; text-align: center; padding: 20px; grid-column: span 2;">Сервер временно недоступен. Пожалуйста, перезапустите бота.</p>';
        });
};

function checkCity() {
    if (!userCity) document.getElementById('city-modal').classList.remove('hidden');
    else updateCityDisplay();
}

function selectCity(city) {
    userCity = city;
    localStorage.setItem('vapebar_city', city);
    document.getElementById('city-modal').classList.add('hidden');
    updateCityDisplay();
}

function openCityModal() { document.getElementById('city-modal').classList.remove('hidden'); }

function updateCityDisplay() {
    const pDisplay = document.getElementById('u-city-display');
    if(pDisplay) pDisplay.innerText = userCity;
    const cDisplay = document.getElementById('co-city-display');
    if(cDisplay) cDisplay.innerText = userCity;
}

function saveCart() { localStorage.setItem('cloud_store_cart', JSON.stringify(cart)); }
function loadCart() {
    try {
        let saved = localStorage.getItem('cloud_store_cart');
        if (saved) cart = JSON.parse(saved);
    } catch (e) {}
}

function clearCart() {
    cart = []; saveCart();
    tg.HapticFeedback.impactOccurred('medium'); updateCartUI();
}

function showTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    if(btn) btn.classList.add('active');
}

function filterCat(cat, btn) {
    document.querySelectorAll('.c-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProducts(cat);
}

function renderProducts(f = 'Все') {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    grid.innerHTML = '';
    const items = f === 'Все' ? products : products.filter(p => p.category === f || p.cat === f);
    
    items.forEach(p => {
        const imageHTML = p.img || p.image_url
            ? `<img src="${p.img || p.image_url}" alt="${p.name}" class="product-image">` 
            : `<div class="product-placeholder">💨</div>`;

        grid.innerHTML += `
            <div class="product-card">
                <div onclick="openProductModal(${p.id})" style="cursor: pointer;">
                    ${imageHTML}
                    <div class="p-info"><b>${p.name}</b><br><span>${p.price} ₽</span></div>
                </div>
                <button class="add-btn" onclick="addToCartClick(${p.id})">+</button>
            </div>`;
    });
}

function addToCartClick(id) {
    const p = products.find(i => i.id === id);
    if (p.flavors && p.flavors.length > 0) {
        currentSelectedProductId = id;
        showFlavorModal(p);
    } else { addExactProductToCart(p, null); }
}

function showFlavorModal(product) {
    document.getElementById('modal-title').innerText = product.name;
    const list = document.getElementById('flavor-list');
    list.innerHTML = '';
    product.flavors.forEach(flavor => {
        list.innerHTML += `<button class="flavor-btn" onclick="selectFlavor('${flavor}')">${flavor}</button>`;
    });
    document.getElementById('flavor-modal').classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('light');
}

function selectFlavor(flavor) {
    const p = products.find(i => i.id === currentSelectedProductId);
    addExactProductToCart(p, flavor);
    closeModal();
}

function closeModal() { 
    document.getElementById('flavor-modal').classList.add('hidden'); 
    document.getElementById('city-modal').classList.add('hidden');
}

function addExactProductToCart(product, flavor) {
    const currentCount = cart.filter(item => item.id === product.id).length;
    if (product.stock !== undefined && currentCount >= product.stock) {
        tg.showAlert("Больше нет в наличии на складе! 😢"); return;
    }
    const finalName = flavor ? `${product.name} (${flavor})` : product.name;
    cart.push({ id: product.id, name: finalName, price: product.price });
    saveCart(); tg.HapticFeedback.impactOccurred('medium'); updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1); saveCart();
    tg.HapticFeedback.impactOccurred('light'); updateCartUI();
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

    if (cart.length > 0) {
        list.innerHTML += `<button onclick="clearCart()" style="background: #ff0000; color: white; border: none; padding: 12px; border-radius: 12px; width: 100%; margin-bottom: 15px; font-weight: bold; font-size: 16px; cursor: pointer; box-shadow: 0 4px 10px rgba(255, 0, 0, 0.2);">🗑 Очистить корзину</button>`;
    }
    
    cart.forEach((item, index) => {
        total += item.price;
        const originalProduct = products.find(p => p.id === item.id);
        const imgUrl = originalProduct ? (originalProduct.img || originalProduct.image_url) : null;
        const imageHTML = imgUrl 
            ? `<img src="${imgUrl}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 10px; flex-shrink: 0;">` 
            : `<div style="width: 60px; height: 60px; border-radius: 10px; background: #140a0a; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">💨</div>`;

        list.innerHTML += `
            <div class="product-card" style="display: flex; flex-direction: row; width: 100%; padding: 12px; align-items: center; box-sizing: border-box; margin-bottom: 10px; background: #140a0a; border-radius: 16px; border: 1px solid #1f0f0f;">
                ${imageHTML}
                <div style="flex-grow: 1; padding-left: 12px; text-align: left; overflow: hidden;">
                    <b style="font-size: 14px; color: #fff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</b>
                    <span style="color: var(--accent); font-weight: 800; font-size: 15px; margin-top: 4px; display: inline-block;">${item.price} ₽</span>
                </div>
                <button style="background: #ff0000; border: none; width: 34px; height: 34px; border-radius: 10px; color: white; cursor: pointer; flex-shrink: 0; margin-left: 10px;" onclick="removeFromCart(${index})">❌</button>
            </div>`;
    });
    
    const totalEl = document.getElementById('total-price');
    if(totalEl) totalEl.innerText = total + ' ₽';
}

function openCheckout() {
    if(cart.length === 0) return tg.showAlert("Сначала добавьте товары в корзину!");
    if(!userCity) { tg.showAlert("Пожалуйста, выберите город в профиле!"); return openCityModal(); }
    
    const urlParams = new URLSearchParams(window.location.search);
    const bonuses = parseInt(urlParams.get('bonuses') || '0');
    document.getElementById('co-bonus-count').innerText = bonuses + " ₽";
    if(bonuses <= 0) document.getElementById('bonus-group').style.display = 'none';

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('checkout-tab').classList.add('active');
}

function backToCart() {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('cart-tab').classList.add('active');
}

function submitCheckout() {
    const type = "Самовывоз";
    const dateTime = document.getElementById('co-datetime').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const payment = document.getElementById('co-payment').value;
    const age = document.getElementById('co-age').checked;
    
    const bonusesCheckbox = document.getElementById('co-bonuses');
    const useBonuses = bonusesCheckbox ? bonusesCheckbox.checked : false;
    
    const total = cart.reduce((s,i)=>s+i.price, 0);

    if(!age) return tg.showAlert("Для оформления заказа необходимо подтвердить возраст (18+)");
    if(dateTime.length < 3) return tg.showAlert("Пожалуйста, укажите желаемую дату и время");
    if(phone.length < 7) return tg.showAlert("Пожалуйста, введите корректный номер телефона");
    if(!userCity) return tg.showAlert("Сначала выберите город!");

    const urlParams = new URLSearchParams(window.location.search);
    const userId = parseInt(urlParams.get('uid')) || (tg.initDataUnsafe?.user?.id);

    const orderData = {
        userId: userId, items: cart, total: total, deliveryType: type,
        city: userCity, address: "Точка в городе " + userCity, dateTime: dateTime,
        payment: payment, phone: phone, useBonuses: useBonuses
    };

    const btn = document.querySelector('#checkout-tab .order-btn');
    if(btn) { btn.disabled = true; btn.style.opacity = '0.7'; btn.innerText = '⏳ Отправка...'; }

    fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData)
    })
    .then(async response => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    })
    .then(result => {
        tg.showAlert("Заказ #" + result.order_id + " успешно оформлен!");
        clearCart(); tg.close();
    })
    .catch(error => {
        if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = 'Подтвердить заказ'; }
        tg.showAlert("❌ Сбой при отправке: " + error.message);
    });
}

function openProductModal(id) {
    const p = products.find(i => i.id === id);
    if (!p) return;
    
    const imgContainer = document.getElementById('pm-image-container');
    const imgUrl = p.img || p.image_url;
    if (imgUrl) imgContainer.innerHTML = `<img src="${imgUrl}" alt="${p.name}">`;
    else imgContainer.innerHTML = `<div class="product-placeholder-large">💨</div>`;
    
    document.getElementById('pm-title').innerText = p.name;
    document.getElementById('pm-category').innerText = p.cat || p.category;
    document.getElementById('pm-price').innerText = p.price + ' ₽';
    
    let descText = "";
    if (p.desc && p.desc.trim() !== "") descText = p.desc + "\n\n";
    else if (p.description && p.description.trim() !== "") descText = p.description + "\n\n";
    else descText = `Оригинальный товар из категории «${p.cat || p.category}».\n\n`;
    
    if (p.stock > 0) descText += `✅ В наличии на складе: ${p.stock} шт.`;
    else descText += `⚠️ Заканчивается`;
    
    document.getElementById('pm-desc').innerText = descText;
    
    const addBtn = document.getElementById('pm-add-btn');
    addBtn.onclick = () => { closeProductModal(); addToCartClick(p.id); };
    
    document.getElementById('product-modal').classList.remove('hidden');
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function closeProductModal() { document.getElementById('product-modal').classList.add('hidden'); }

/* --- ПРОФИЛЬ --- */
function getMyId() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('uid')) || (tg.initDataUnsafe?.user?.id) || 0;
}

function loadProfileData() {
    const userId = getMyId();
    if(!userId) return;
    
    fetch(`/api/profile?user_id=${userId}`)
        .then(res => res.json())
        .then(data => {
            const uVip = document.getElementById('u-vip');
            if(uVip) uVip.innerText = data.vip_name;
            const uSpent = document.getElementById('u-spent');
            if(uSpent) uSpent.innerText = `${data.total_spent} ₽`;
            const nxtLvl = document.getElementById('u-next-lvl');
            if(nxtLvl) {
                if(data.to_next > 0) { nxtLvl.innerText = `До след. уровня: ${data.to_next} ₽`; nxtLvl.style.color = 'var(--gray)'; } 
                else { nxtLvl.innerText = `🌟 Максимальный уровень!`; nxtLvl.style.color = '#ffb84d'; }
            }
            const uBonuses = document.getElementById('u-bonuses');
            if(uBonuses) uBonuses.innerText = `${data.bonuses} ₽`;
            const uCb = document.getElementById('u-cb');
            if(uCb) uCb.innerText = `Кэшбек: ${data.cashback_pct}%`;
            const uRefs = document.getElementById('u-refs');
            if(uRefs) uRefs.innerText = `${data.refs} чел.`;
            const uRefLink = document.getElementById('u-ref-link');
            if(uRefLink) uRefLink.value = `https://t.me/CloudeHelper51_bot?start=ref_${userId}`;
        })
        .catch(e => console.log('Ошибка профиля:', e));
}

function copyRefLink() {
    const linkInput = document.getElementById('u-ref-link');
    linkInput.select(); document.execCommand("copy");
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    tg.showAlert("✅ Реферальная ссылка скопирована!");
}

/* --- АДМИНКА --- */
function setAdminTabActive(btnId) {
    ['btn-adm-prod', 'btn-adm-stat', 'btn-adm-ord', 'btn-adm-usr'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('active');
    });
    document.getElementById(btnId).classList.add('active');
    document.getElementById('admin-workspace').innerHTML = '<p style="text-align:center; color:var(--gray);">Загрузка...</p>';
}

function closeAdmModal(id) { document.getElementById(id).classList.add('hidden'); }

function openAddModal() {
    try {
        document.getElementById('adm-add-modal').classList.remove('hidden');
    } catch(e) {
        tg.showAlert("Ошибка интерфейса: " + e.message);
    }
}

let adminProducts = [];
function loadAdminProducts() {
    setAdminTabActive('btn-adm-prod');
    fetch(`/api/admin/products?admin_id=${getMyId()}`)
        .then(res => res.json())
        .then(data => {
            adminProducts = data;
            // ⚡ ИСПОЛЬЗУЕМ ФУНКЦИЮ openAddModal
            let html = `<button class="order-btn" style="margin-bottom:15px;" onclick="openAddModal()">➕ Добавить товар</button>`;
            data.forEach(p => {
                html += `
                <div class="info-card" style="margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div style="text-align:left;">
                            <b style="color:var(--text);">${p.name}</b><br>
                            <span style="color:var(--gray); font-size:12px;">${p.category} | ${p.price}₽</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button onclick="changeStock(${p.id}, ${p.stock - 1})" style="background:var(--card); border:1px solid var(--gray); color:white; width:30px; height:30px; border-radius:8px;">-</button>
                            <b style="color:var(--accent); min-width:20px; text-align:center;">${p.stock}</b>
                            <button onclick="changeStock(${p.id}, ${p.stock + 1})" style="background:var(--card); border:1px solid var(--gray); color:white; width:30px; height:30px; border-radius:8px;">+</button>
                        </div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="openFlavorsModal(${p.id})" style="flex:1; background:transparent; border:1px solid var(--accent); color:var(--accent); padding:6px; border-radius:8px; font-size:12px;">Вкусы</button>
                        <button onclick="openEditModal(${p.id})" style="flex:1; background:transparent; border:1px solid var(--gray); color:var(--gray); padding:6px; border-radius:8px; font-size:12px;">✏️ Изм.</button>
                        <button onclick="deleteProduct(${p.id})" style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:6px; border-radius:8px; font-size:12px;">🗑 Удал.</button>
                    </div>
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html || '<p>Склад пуст</p>';
        })
        .catch(err => tg.showAlert("Ошибка загрузки склада: " + err.message));
}

function changeStock(prodId, newStock) {
    if (newStock < 0) return;
    fetch(`/api/admin/products/${prodId}/stock?admin_id=${getMyId()}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({stock: newStock})
    }).then(() => loadAdminProducts());
}

function deleteProduct(prodId) {
    if(!confirm("Точно удалить товар?")) return;
    fetch(`/api/admin/products/${prodId}?admin_id=${getMyId()}`, {method: 'DELETE'}).then(() => loadAdminProducts());
}

async function submitNewProduct() {
    const name = document.getElementById('add-name').value.trim();
    const category = document.getElementById('add-cat').value;
    const price = parseFloat(document.getElementById('add-price').value);
    const stock = parseInt(document.getElementById('add-stock').value) || 0;
    const imgInput = document.getElementById('add-img');
    
    if(!name || isNaN(price)) return tg.showAlert("Заполните название и цену!");

    let image_url = null;
    if (imgInput.files && imgInput.files[0]) {
        tg.showAlert("⏳ Загружаем фото... Пожалуйста, подождите.");
        const formData = new FormData();
        formData.append('image', imgInput.files[0]);
        formData.append('key', '967a6dda6211a62b5f6915a39548b309'); 
        try {
            const imgRes = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
            const imgData = await imgRes.json();
            if (imgData.success) image_url = imgData.data.url;
            else return tg.showAlert("❌ Ошибка сервера при загрузке фото.");
        } catch (e) {
            return tg.showAlert("❌ Ошибка сети. Не удалось загрузить фото.");
        }
    }

    const data = { name, category, price, stock, image_url };
    fetch(`/api/admin/products?admin_id=${getMyId()}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
    })
    .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    })
    .then(() => {
        closeAdmModal('adm-add-modal'); 
        loadAdminProducts();
        document.getElementById('add-name').value = ''; document.getElementById('add-price').value = '';
        document.getElementById('add-stock').value = ''; document.getElementById('add-img').value = '';
        tg.showAlert("✅ Товар успешно добавлен!");
    })
    .catch(err => {
        tg.showAlert("❌ Ошибка сервера: " + err.message);
    });
}

let currentEditProdId = null;
function openEditModal(id) {
    const p = adminProducts.find(x => x.id === id);
    currentEditProdId = id;
    document.getElementById('edit-price').value = p.price;
    document.getElementById('edit-desc').value = p.description || '';
    document.getElementById('adm-edit-modal').classList.remove('hidden');
}

function saveProductEdit() {
    const price = parseFloat(document.getElementById('edit-price').value);
    const desc = document.getElementById('edit-desc').value.trim();
    if(isNaN(price)) return tg.showAlert("Укажите цену!");
    fetch(`/api/admin/products/${currentEditProdId}/edit?admin_id=${getMyId()}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({price: price, description: desc})
    }).then(() => { closeAdmModal('adm-edit-modal'); loadAdminProducts(); });
}

let currentFlavors = {};
function openFlavorsModal(id) {
    const p = adminProducts.find(x => x.id === id);
    currentEditProdId = id; currentFlavors = Object.assign({}, p.flavors || {});
    document.getElementById('flavor-prod-name').innerText = `Вкусы: ${p.name}`;
    renderFlavorsAdmin(); document.getElementById('adm-flavors-modal').classList.remove('hidden');
}

function renderFlavorsAdmin() {
    let html = '';
    for (let [flv, count] of Object.entries(currentFlavors)) {
        html += `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center; background:var(--card); padding:8px; border-radius:8px; border:1px solid var(--gray);">
            <span style="color:white; font-size:14px;">${flv}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <b style="color:var(--accent); font-size:14px;">${count} шт.</b>
                <button onclick="delete currentFlavors['${flv}']; renderFlavorsAdmin()" style="background:var(--danger); border:none; color:white; width:28px; height:28px; border-radius:6px;">✕</button>
            </div>
        </div>`;
    }
    document.getElementById('flavor-list-admin').innerHTML = html || '<p style="color:var(--gray); font-size:13px; text-align:center;">Вкусов пока нет</p>';
}

function addFlavorRow() {
    const name = document.getElementById('new-flavor-name').value.trim();
    const stock = parseInt(document.getElementById('new-flavor-stock').value);
    if(!name || isNaN(stock)) return tg.showAlert("Введите название и количество!");
    currentFlavors[name] = stock;
    document.getElementById('new-flavor-name').value = ''; document.getElementById('new-flavor-stock').value = '';
    renderFlavorsAdmin();
}

function saveFlavors() {
    fetch(`/api/admin/products/${currentEditProdId}/flavors?admin_id=${getMyId()}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({flavors: currentFlavors})
    }).then(() => { closeAdmModal('adm-flavors-modal'); loadAdminProducts(); });
}

function loadAdminStats() {
    setAdminTabActive('btn-adm-stat');
    fetch(`/api/admin/stats?admin_id=${getMyId()}`)
        .then(async res => {
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        })
        .then(data => {
            let html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div class="info-card" style="margin:0; text-align:center;">
                    <span style="color:var(--gray); font-size:12px;">Сегодня</span><br>
                    <b style="color:var(--text); font-size:18px;">${data.day.rev} ₽</b><br>
                    <span style="color:var(--accent); font-size:11px;">Ср. чек: ${data.day.aov} ₽</span>
                </div>
                <div class="info-card" style="margin:0; text-align:center;">
                    <span style="color:var(--gray); font-size:12px;">Неделя</span><br>
                    <b style="color:var(--text); font-size:18px;">${data.week.rev} ₽</b><br>
                    <span style="color:var(--accent); font-size:11px;">Ср. чек: ${data.week.aov} ₽</span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div class="info-card" style="margin:0; text-align:center;">
                    <span style="color:var(--gray); font-size:12px;">Месяц</span><br>
                    <b style="color:var(--text); font-size:18px;">${data.month.rev} ₽</b><br>
                    <span style="color:var(--accent); font-size:11px;">Ср. чек: ${data.month.aov} ₽</span>
                </div>
                <div class="info-card" style="margin:0; text-align:center;">
                    <span style="color:var(--gray); font-size:12px;">Год</span><br>
                    <b style="color:var(--text); font-size:18px;">${data.year.rev} ₽</b><br>
                    <span style="color:var(--accent); font-size:11px;">Ср. чек: ${data.year.aov} ₽</span>
                </div>
            </div>
            <div class="info-card" style="text-align:center; border: 1px solid var(--accent);">
                <span style="color:var(--gray); font-size:12px;">ВСЕГО ВЫРУЧКИ</span><br>
                <b style="color:var(--accent); font-size:24px;">${data.total.rev} ₽</b><br>
                <span style="color:var(--gray); font-size:12px;">Выполнено заказов: ${data.total.cnt}</span>
            </div>
            `;
            document.getElementById('admin-workspace').innerHTML = html;
        })
        .catch(err => tg.showAlert("❌ Ошибка загрузки статистики: " + err.message));
}

function loadAdminOrders() {
    setAdminTabActive('btn-adm-ord');
    fetch(`/api/admin/orders?admin_id=${getMyId()}`)
        .then(async res => {
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        })
        .then(data => {
            let html = '';
            data.forEach(o => {
                const isPending = o.status === 'pending';
                const statusColor = isPending ? '#ffb84d' : (o.status === 'completed' ? '#4caf50' : 'var(--danger)');
                const statusText = isPending ? 'Ожидает' : (o.status === 'completed' ? 'Выполнен' : 'Отменен');
                let btns = isPending ? `
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button onclick="changeOrderStatus('${o.id}', 'completed')" style="flex:1; background:#4caf50; color:white; border:none; padding:8px; border-radius:8px; cursor:pointer;">✅ Выполнить</button>
                        <button onclick="changeOrderStatus('${o.id}', 'cancelled')" style="flex:1; background:var(--danger); color:white; border:none; padding:8px; border-radius:8px; cursor:pointer;">❌ Отменить</button>
                    </div>` : '';

                html += `
                <div class="info-card" style="margin-bottom:15px; text-align:left; border-left: 3px solid ${statusColor};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; color:var(--text); font-size:16px;">Заказ #${o.id}</h3>
                        <span style="color:${statusColor}; font-size:12px; font-weight:bold;">${statusText}</span>
                    </div>
                    <p style="margin:8px 0 4px 0; font-size:13px;"><b>Клиент:</b> ${o.user_name} (ID: ${o.user_id})</p>
                    <p style="margin:4px 0; font-size:13px;"><b>Тип:</b> ${o.type} | <b>Тел:</b> ${o.phone}</p>
                    <p style="margin:4px 0; font-size:13px;"><b>Сумма:</b> <span style="color:var(--accent); font-weight:bold;">${o.total}₽</span></p>
                    <hr style="border-color:var(--gray); margin:10px 0;">
                    <p style="margin:0; font-size:12px; color:var(--gray); line-height:1.6;">${o.items.join('<br>')}</p>
                    ${btns}
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html || '<p>Заказов пока нет</p>';
        })
        .catch(err => tg.showAlert("❌ Ошибка загрузки заказов: " + err.message));
}

function changeOrderStatus(oid, status) {
    if(!confirm("Изменить статус заказа?")) return;
    fetch(`/api/admin/orders/${oid}/status?admin_id=${getMyId()}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status: status})
    }).then(() => loadAdminOrders());
}

function loadAdminUsers() {
    setAdminTabActive('btn-adm-usr');
    fetch(`/api/admin/users?admin_id=${getMyId()}`)
        .then(res => res.json())
        .then(data => {
            let html = '';
            data.forEach(u => {
                html += `
                <div class="info-card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="text-align:left;">
                        <b style="color:var(--text);">${u.name}</b><br>
                        <span style="color:var(--gray); font-size:12px;">ID: ${u.id}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:var(--accent); font-weight:bold;">${u.orders}</span><br>
                        <span style="color:var(--gray); font-size:11px;">заказов</span>
                    </div>
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html || '<p>База пуста</p>';
        });
}

const admBtn = document.getElementById('admin-btn');
if (admBtn) { admBtn.addEventListener('click', () => loadAdminProducts()); }
