let tg = window.Telegram.WebApp;

// ⚠️ УКАЖИ ЗДЕСЬ АДРЕС СВОЕГО PTERODACTYL СЕРВЕРА (Обязательно с https://)
const API_URL = ""https://cleat-unhealthy-pastime.ngrok-free.dev";

tg.ready();
tg.expand();

let products = [];
let cart = [];
let currentSelectedProductId = null;
let userCity = localStorage.getItem('vapebar_city');

window.onload = () => {
    // 1. Проверяем город
    checkCity();

    // 2. Инициализация пользователя
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

    // 3. Загрузка каталога с БЭКЕНДА
    const fetchUrl = API_URL ? `${API_URL}/api/catalog` : '/api/catalog';
    fetch(fetchUrl)
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

/* --- ЛОГИКА ГОРОДОВ --- */
function checkCity() {
    if (!userCity) {
        document.getElementById('city-modal').classList.remove('hidden');
    } else {
        updateCityDisplay();
    }
}

function selectCity(city) {
    userCity = city;
    localStorage.setItem('vapebar_city', city);
    document.getElementById('city-modal').classList.add('hidden');
    updateCityDisplay();
}

function openCityModal() {
    document.getElementById('city-modal').classList.remove('hidden');
}

function updateCityDisplay() {
    const pDisplay = document.getElementById('u-city-display');
    if(pDisplay) pDisplay.innerText = userCity;
    const cDisplay = document.getElementById('co-city-display');
    if(cDisplay) cDisplay.innerText = userCity;
}

/* --- КОРЗИНА И ТОВАРЫ --- */
function saveCart() { localStorage.setItem('cloud_store_cart', JSON.stringify(cart)); }
function loadCart() {
    try {
        let saved = localStorage.getItem('cloud_store_cart');
        if (saved) cart = JSON.parse(saved);
    } catch (e) { console.error("Ошибка", e); }
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
    } else {
        addExactProductToCart(p, null);
    }
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
        tg.showAlert("Больше нет в наличии на складе! 😢");
        return;
    }
    const finalName = flavor ? `${product.name} (${flavor})` : product.name;
    cart.push({ id: product.id, name: finalName, price: product.price });
    saveCart();
    tg.HapticFeedback.impactOccurred('medium');
    updateCartUI();
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
    if(!userCity) {
        tg.showAlert("Пожалуйста, выберите город в профиле!");
        return openCityModal();
    }
    
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
        userId: userId,
        items: cart,
        total: total,
        deliveryType: type,
        city: userCity,
        address: "Точка в городе " + userCity,
        dateTime: dateTime,
        payment: payment,
        phone: phone,
        useBonuses: useBonuses
    };

    const btn = document.querySelector('#checkout-tab .order-btn');
    if(btn) {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.innerText = '⏳ Отправка...';
    }

    const fetchUrl = API_URL ? `${API_URL}/api/orders` : '/api/orders';
    fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === "success") {
            tg.showAlert("Заказ #" + result.order_id + " успешно оформлен!");
            clearCart();
            tg.close();
        } else {
            if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = 'Подтвердить заказ'; }
            tg.showAlert("Ошибка оформления заказа.");
        }
    })
    .catch(error => {
        if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = 'Подтвердить заказ'; }
        tg.showAlert("Сбой при отправке заказа.");
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
    addBtn.onclick = () => {
        closeProductModal();
        addToCartClick(p.id);
    };
    
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
    
    const fetchUrl = API_URL ? `${API_URL}/api/profile?user_id=${userId}` : `/api/profile?user_id=${userId}`;
    fetch(fetchUrl)
        .then(res => res.json())
        .then(data => {
            const uVip = document.getElementById('u-vip');
            if(uVip) uVip.innerText = data.vip_name;
            
            const uSpent = document.getElementById('u-spent');
            if(uSpent) uSpent.innerText = `${data.total_spent} ₽`;
            
            const nxtLvl = document.getElementById('u-next-lvl');
            if(nxtLvl) {
                if(data.to_next > 0) {
                    nxtLvl.innerText = `До след. уровня: ${data.to_next} ₽`;
                    nxtLvl.style.color = 'var(--gray)';
                } else {
                    nxtLvl.innerText = `🌟 Максимальный уровень!`;
                    nxtLvl.style.color = '#ffb84d';
                }
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
    linkInput.select();
    document.execCommand("copy");
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    tg.showAlert("✅ Реферальная ссылка скопирована!");
}
