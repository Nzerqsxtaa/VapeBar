let tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let products = [];
let cart = [];
let currentSelectedProductId = null;
let currentSelectedFlavor = null;
let userBonuses = 0; 
let currentCategory = 'Все';
let searchQuery = '';

window.onload = () => {
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
    const currentUserId = parseInt(urlUid) || user?.id;
    if (adminIds.includes(currentUserId)) {
        const adminBtn = document.getElementById('admin-btn');
        if(adminBtn) adminBtn.classList.remove('hidden');
    }

    loadCart(); 
    updateCartUI();
    loadProfileData();
    
    fetch(`/api/catalog`)
        .then(response => response.json())
        .then(data => { products = data; renderProducts(); })
        .catch(error => console.error("Ошибка загрузки каталога:", error));
};

function saveCart() { localStorage.setItem('vapelab_cart', JSON.stringify(cart)); }
function loadCart() {
    try { let saved = localStorage.getItem('vapelab_cart'); if (saved) cart = JSON.parse(saved); } 
    catch (e) {}
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
        items = items.filter(p => p.name.toLowerCase().includes(searchQuery) || (p.description && p.description.toLowerCase().includes(searchQuery)));
    }
    
    if (items.length === 0) {
        grid.innerHTML = `<p style="color: var(--gray); text-align: center; padding: 20px; grid-column: span 2;">Ничего не найдено.</p>`;
        return;
    }

    items.forEach(p => {
        const imageHTML = p.img || p.image_url
            ? `<img src="${p.img || p.image_url}" alt="${p.name}" class="product-img">` 
            : `<div class="product-placeholder">💨</div>`;

        grid.innerHTML += `
            <div class="product-card" onclick="openProductModal(${p.id})" onmousemove="tiltCard(event, this)" onmouseleave="resetCard(this)">
                <div class="card-image-wrapper">
                    <div class="card-bg-waves"></div>
                    <div class="heart-icon"><i class="fa-solid fa-heart"></i></div>
                    ${imageHTML}
                </div>
                <div class="card-info">
                    <div>
                        <h4 class="card-title">${p.name}</h4>
                        <p class="card-specs">${p.category}</p>
                    </div>
                    <div class="card-price-row">
                        <div class="card-price">${p.price} <span>₽</span></div>
                    </div>
                </div>
            </div>`;
    });
}

function openProductModal(id) {
    const p = products.find(i => i.id === id);
    if (!p) return;
    currentSelectedProductId = id;
    currentSelectedFlavor = null;
    
    const imgContainer = document.getElementById('pm-image-container');
    const imgUrl = p.img || p.image_url;
    
    // Чистая вставка картинки без программного крестика
    if (imgUrl) {
        imgContainer.innerHTML = `<img src="${imgUrl}" alt="${p.name}">`;
    } else {
        imgContainer.innerHTML = `<div class="product-placeholder-large">💨</div>`;
    }
    
    document.getElementById('pm-title').innerText = p.name;
    document.getElementById('pm-price').innerText = p.price + ' ₽';
    
    // Чистое описание без повторного заголовка "Описание товара"
    document.getElementById('pm-desc').innerHTML = `<span style="color: var(--gray); line-height: 1.4; font-size: 14px;">${p.description || p.desc || 'Оригинальный товар из категории «' + p.category + '».'}</span>`;

    // Галочка наличия
    const stockInfo = document.getElementById('pm-stock-info');
    if (p.stock > 0) { 
        stockInfo.innerHTML = `<span style="background: #25d366; color: #fff; padding: 2px 5px; border-radius: 4px; font-size: 10px; display: inline-flex; align-items: center; justify-content: center;">✔</span><span style="color:#25d366;">В наличии: ${p.stock} шт.</span>`; 
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
            btn.innerText = flavor;
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
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function selectProductFlavor(flavor, btnElement) {
    currentSelectedFlavor = flavor;
    document.querySelectorAll('.flavor-pill').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

function closeProductModal() { document.getElementById('product-modal').classList.add('hidden'); }

function addExactProductToCart(product, flavor) {
    const currentCount = cart.filter(item => item.id === product.id).length;
    if (product.stock !== undefined && currentCount >= product.stock) {
        tg.showAlert("Больше нет в наличии! 😢"); return;
    }
    const finalName = flavor ? `${product.name} (${flavor})` : product.name;
    cart.push({ id: product.id, name: finalName, price: product.price });
    saveCart(); tg.HapticFeedback.impactOccurred('medium'); updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1); saveCart(); tg.HapticFeedback.impactOccurred('light'); updateCartUI();
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
        list.innerHTML += `<button onclick="clearCart()" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); padding: 12px; border-radius: 12px; width: 100%; margin-bottom: 15px; font-weight: bold; cursor: pointer;">🗑 Очистить корзину</button>`;
    }
    
    cart.forEach((item, index) => {
        total += item.price;
        const originalProduct = products.find(p => p.id === item.id);
        const imgUrl = originalProduct ? (originalProduct.img || originalProduct.image_url) : null;
        const imageHTML = imgUrl ? `<img src="${imgUrl}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 10px; flex-shrink: 0;">` : `<div style="width: 60px; height: 60px; border-radius: 10px; background: #080a10; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">💨</div>`;

        list.innerHTML += `
            <div class="product-card" style="flex-direction: row; padding: 12px; align-items: center; transform: none; box-shadow: none; border: 1px solid var(--border); margin-bottom: 10px;">
                ${imageHTML}
                <div style="flex-grow: 1; padding-left: 12px; text-align: left; overflow: hidden;">
                    <b style="font-size: 13px; color: #fff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</b>
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
    
    const bonuses = userBonuses;
    const total = cart.reduce((s,i)=>s+i.price, 0);
    const minStep = 10;
    const maxSpend = Math.min(bonuses, total);
    const maxSpendMultiple = Math.floor(maxSpend / minStep) * minStep;
    
    const bonusCheckbox = document.getElementById('co-bonuses');
    if (bonusCheckbox) {
        const parent = bonusCheckbox.parentElement;
        if (maxSpendMultiple <= 0) {
            parent.style.display = 'none';
        } else {
            parent.style.display = 'flex'; 
            bonusCheckbox.checked = false;
            
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
                
                bonusCheckbox.addEventListener('change', function() {
                    dynamicInput.style.display = this.checked ? 'inline-block' : 'none';
                    if (this.checked) { dynamicInput.value = maxSpendMultiple; dynamicInput.focus(); } 
                    else { dynamicInput.value = ''; }
                });
                
                dynamicInput.addEventListener('change', function() {
                    let val = parseInt(this.value) || 0;
                    val = Math.floor(val / minStep) * minStep; 
                    if (val > maxSpendMultiple) val = maxSpendMultiple;
                    if (val < minStep) val = minStep;
                    this.value = val;
                });
            }
            dynamicInput.style.display = 'none';
            dynamicInput.max = maxSpendMultiple;
        }
    }

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('checkout-tab').classList.add('active');
    toggleDelivery();
}

function backToCart() {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('cart-tab').classList.add('active');
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

    const userId = parseInt(new URLSearchParams(window.location.search).get('uid')) || (tg.initDataUnsafe?.user?.id);

    const orderData = {
        userId: userId, items: cart, total: total, deliveryType: type,
        address: address, dateTime: dateTime, payment: payment, phone: phone, useBonuses: useBonuses 
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
        tg.showAlert("❌ Сбой при отправке. Проверьте соединение.");
    });
}

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
            userBonuses = data.bonuses || 0; 
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
            if(uBonuses) uBonuses.innerText = `${userBonuses} ₽`;
            const uCb = document.getElementById('u-cb');
            if(uCb) uCb.innerText = `Кэшбек: ${data.cashback_pct}%`;
            const uRefs = document.getElementById('u-refs');
            if(uRefs) uRefs.innerText = `${data.refs} чел.`;
            
            const uRefLink = document.getElementById('u-ref-link');
            if(uRefLink) uRefLink.value = `https://t.me/vapelab2_bot?start=ref_${userId}`;
        });
}

function copyRefLink() {
    const linkInput = document.getElementById('u-ref-link');
    linkInput.select(); document.execCommand("copy");
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    tg.showAlert("✅ Ссылка скопирована!");
}

function openClientGiveaways() {
    document.getElementById('client-gw-modal').classList.remove('hidden');
    const list = document.getElementById('client-gw-list');
    list.innerHTML = '<p style="text-align:center; color:var(--gray);">Загрузка конкурсов...</p>';
    
    fetch(`/api/giveaways?user_id=${getMyId()}`)
    .then(res => res.json())
    .then(data => {
        if (data.length === 0) { list.innerHTML = '<p style="text-align:center; color:var(--gray);">Нет активных конкурсов</p>'; return; }
        let html = '';
        data.forEach(g => {
            let btnHtml = g.is_participating 
                ? `<button disabled class="order-btn" style="background:var(--dark-bg); color:var(--gray);">✅ Участвуете</button>`
                : `<button onclick="joinGiveaway(${g.id})" class="order-btn">🎁 Участвую</button>`;
            
            html += `<div class="info-card" style="margin-bottom:15px; border-color:var(--border);">
                <h4 style="color:white; margin:0 0 10px 0;">Розыгрыш #${g.id}</h4>
                <p style="color:var(--gray);">${g.text}</p>
                <div style="font-size:12px; margin-bottom:10px;">Мест: <b>${g.winners_count}</b> | Участников: <b>${g.parts_count}</b></div>
                ${btnHtml}
            </div>`;
        });
        list.innerHTML = html;
    });
}

function joinGiveaway(gw_id) {
    fetch(`/api/giveaways/${gw_id}/join`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user_id: getMyId()}) })
    .then(async res => { if (!res.ok) throw new Error((await res.json()).detail); return res.json(); })
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

function closeAdmModal(id) { document.getElementById(id).classList.add('hidden'); }
function openAddModal() { document.getElementById('adm-add-modal').classList.remove('hidden'); }

let adminProducts = [];
function loadAdminProducts() {
    setAdminTabActive('btn-adm-prod');
    fetch(`/api/admin/products?admin_id=${getMyId()}`)
        .then(res => res.json())
        .then(data => {
            adminProducts = data;
            let html = `<button class="order-btn" style="margin-bottom:15px;" onclick="openAddModal()">➕ Добавить товар</button>`;
            data.forEach(p => {
                html += `
                <div class="info-card" style="margin-bottom:10px; transform: none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div>
                            <b style="color:var(--text);">${p.name}</b><br>
                            <span style="color:var(--gray); font-size:12px;">${p.category} | ${p.price}₽</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button onclick="changeStock(${p.id}, ${p.stock - 1})" style="background:var(--dark-bg); border:1px solid var(--gray); color:white; width:30px; height:30px; border-radius:8px;">-</button>
                            <b style="color:var(--text);">${p.stock}</b>
                            <button onclick="changeStock(${p.id}, ${p.stock + 1})" style="background:var(--dark-bg); border:1px solid var(--gray); color:white; width:30px; height:30px; border-radius:8px;">+</button>
                        </div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="openFlavorsModal(${p.id})" style="flex:1; background:transparent; border:1px solid var(--gray); color:white; padding:6px; border-radius:8px; font-size:12px;">Вкусы</button>
                        <button onclick="openEditModal(${p.id})" style="flex:1; background:transparent; border:1px solid var(--gray); color:var(--gray); padding:6px; border-radius:8px; font-size:12px;">Изм.</button>
                        <button onclick="deleteProduct(${p.id})" style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:6px; border-radius:8px; font-size:12px;">Удал.</button>
                    </div>
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html;
        });
}

function changeStock(prodId, newStock) {
    if (newStock < 0) return;
    fetch(`/api/admin/products/${prodId}/stock?admin_id=${getMyId()}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({stock: newStock}) }).then(() => loadAdminProducts());
}

function deleteProduct(prodId) {
    if(confirm("Точно удалить товар?")) fetch(`/api/admin/products/${prodId}?admin_id=${getMyId()}`, {method: 'DELETE'}).then(() => loadAdminProducts());
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
        tg.showAlert("⏳ Загружаем фото...");
        const formData = new FormData(); formData.append('image', imgInput.files[0]); formData.append('key', '967a6dda6211a62b5f6915a39548b309'); 
        try {
            const imgRes = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
            image_url = (await imgRes.json()).data.url;
        } catch (e) { return tg.showAlert("❌ Ошибка фото."); }
    }

    const data = { name, category, price, stock, image_url };
    fetch(`/api/admin/products?admin_id=${getMyId()}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) })
    .then(() => {
        closeAdmModal('adm-add-modal'); loadAdminProducts();
        document.getElementById('add-name').value = ''; document.getElementById('add-price').value = ''; document.getElementById('add-stock').value = '';
        tg.showAlert(`✅ Товар добавлен!`);
    });
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
    fetch(`/api/admin/products/${currentEditProdId}/edit?admin_id=${getMyId()}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({price, description: desc}) }).then(() => { closeAdmModal('adm-edit-modal'); loadAdminProducts(); });
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
        html += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center; background:var(--dark-bg); padding:8px; border-radius:8px;">
            <span style="color:white; font-size:14px;">${flv}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <b style="color:var(--text); font-size:14px;">${count} шт.</b>
                <button onclick="delete currentFlavors['${flv}']; renderFlavorsAdmin()" style="background:var(--danger); border:none; color:white; width:28px; height:28px; border-radius:6px;">✕</button>
            </div>
        </div>`;
    }
    document.getElementById('flavor-list-admin').innerHTML = html || '<p style="color:var(--gray); font-size:13px; text-align:center;">Вкусов пока нет</p>';
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
    fetch(`/api/admin/products/${currentEditProdId}/flavors?admin_id=${getMyId()}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({flavors: currentFlavors}) }).then(() => { closeAdmModal('adm-flavors-modal'); loadAdminProducts(); });
}

function loadAdminStats() {
    setAdminTabActive('btn-adm-stat');
    fetch(`/api/admin/stats?admin_id=${getMyId()}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('admin-workspace').innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div class="info-card" style="margin:0; text-align:center;"><span style="color:var(--gray); font-size:12px;">Сегодня</span><br><b style="color:var(--text); font-size:18px;">${data.day.rev} ₽</b></div>
                    <div class="info-card" style="margin:0; text-align:center;"><span style="color:var(--gray); font-size:12px;">Неделя</span><br><b style="color:var(--text); font-size:18px;">${data.week.rev} ₽</b></div>
                </div>
                <div class="info-card" style="text-align:center; border: 1px solid var(--border);">
                    <span style="color:var(--gray); font-size:12px;">ВЫРУЧКА (ВСЕГО)</span><br>
                    <b style="color:var(--accent); font-size:24px;">${data.total.rev} ₽</b><br>
                    <span style="color:var(--gray); font-size:12px;">Заказов: ${data.total.cnt}</span>
                </div>`;
        });
}

function loadAdminOrders() {
    setAdminTabActive('btn-adm-ord');
    fetch(`/api/admin/orders?admin_id=${getMyId()}`)
        .then(res => res.json())
        .then(data => {
            let html = '';
            data.forEach(o => {
                let statusColor = '#ffb84d'; 
                let statusText = 'Ожидает';
                if (o.status === 'completed') {
                    statusColor = '#4caf50'; 
                    statusText = 'Выполнен';
                } else if (o.status === 'cancelled') {
                    statusColor = 'var(--danger)'; 
                    statusText = 'Отменен';
                }

                const isPending = o.status === 'pending';
                
                let itemsHtml = '';
                if (o.items && o.items.length > 0) {
                    itemsHtml = `<div style="font-size:13px; color:white; margin-top:8px; border-top:1px solid var(--border); padding-top:8px;">${o.items.map(i => '• ' + i).join('<br>')}</div>`;
                }

                html += `
                <div class="info-card" style="margin-bottom:15px; text-align:left; border-left: 3px solid ${statusColor}; transform:none;">
                    <div style="display:flex; justify-content:space-between;">
                        <h3 style="margin:0; font-size:16px; color:white;">Заказ #${o.id}</h3>
                        <span style="font-size:12px; font-weight:bold; color:${statusColor}">${statusText}</span>
                    </div>
                    <p style="margin:8px 0 4px 0; font-size:13px;"><b>Клиент:</b> ${o.user_name} (ID: ${o.user_id})</p>
                    <p style="margin:4px 0; font-size:13px;"><b>Сумма:</b> <span style="color:var(--text); font-weight:bold;">${o.total}₽</span></p>
                    
                    ${itemsHtml}
                    
                    ${isPending ? `<div style="display:flex; gap:10px; margin-top:10px;">
                        <button onclick="changeOrderStatus('${o.id}', 'completed')" class="order-btn" style="flex:1; background:#4caf50; padding:10px;">✅</button>
                        <button onclick="changeOrderStatus('${o.id}', 'cancelled')" class="order-btn" style="flex:1; background:var(--danger); padding:10px;">❌</button>
                    </div>` : ''}
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html || '<p style="text-align:center; color:var(--gray);">Заказов пока нет</p>';
        });
}

function changeOrderStatus(oid, status) {
    if(confirm("Изменить статус заказа?")) fetch(`/api/admin/orders/${oid}/status?admin_id=${getMyId()}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status}) }).then(() => loadAdminOrders());
}

function loadAdminUsers() {
    setAdminTabActive('btn-adm-usr');
    fetch(`/api/admin/users?admin_id=${getMyId()}`)
        .then(res => res.json())
        .then(data => {
            let html = '';
            data.forEach(u => {
                html += `<div class="info-card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; transform:none;">
                    <div><b style="color:white;">${u.name}</b><br><span style="color:var(--gray); font-size:12px;">ID: ${u.id}</span></div>
                    <div style="text-align:right;"><span style="color:var(--text); font-weight:bold; font-size:16px;">${u.orders}</span><br><span style="color:var(--gray); font-size:11px;">заказов</span></div>
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html;
        });
}

function loadAdminGiveaways() {
    setAdminTabActive('btn-adm-gw');
    fetch(`/api/admin/giveaways?admin_id=${getMyId()}`)
        .then(res => res.json())
        .then(data => {
            let html = `<button class="order-btn" style="margin-bottom:15px;" onclick="document.getElementById('adm-gw-modal').classList.remove('hidden')">🎁 Создать конкурс</button>`;
            data.forEach(g => {
                html += `
                <div class="info-card" style="margin-bottom:10px; transform:none;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <b style="color:white;">Конкурс #${g.id}</b>
                        ${g.is_active ? '<span style="color:#4caf50; font-weight:bold;">Активен</span>' : '<span style="color:var(--gray); font-weight:bold;">Завершен</span>'}
                    </div>
                    <p style="font-size:12px; color:var(--gray); margin-bottom:8px;">${g.text}</p>
                    <span style="font-size:13px; color:var(--text);">Участников: <b>${g.parts}</b></span>
                    ${g.is_active ? `<button onclick="rollGiveaway(${g.id})" class="outline-btn" style="margin-top:10px;">🎲 Подвести итоги</button>` : ''}
                </div>`;
            });
            document.getElementById('admin-workspace').innerHTML = html;
        });
}

function submitNewGiveaway() {
    const text = document.getElementById('gw-text').value.trim();
    if(!text) return tg.showAlert("Введите текст конкурса!");
    
    fetch(`/api/admin/giveaways?admin_id=${getMyId()}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ text, winners_count: parseInt(document.getElementById('gw-winners').value)||1, min_order: parseFloat(document.getElementById('gw-min-order').value)||0, end_date: document.getElementById('gw-end-date').value||'', order_start: 0, order_end: 2000000000 })
    }).then(() => { closeAdmModal('adm-gw-modal'); loadAdminGiveaways(); });
}

function rollGiveaway(id) {
    if(confirm("Завершить конкурс?")) fetch(`/api/admin/giveaways/${id}/roll?admin_id=${getMyId()}`, { method: 'POST' }).then(async res => {
        const data = await res.json();
        tg.showAlert(`🎉 Победители: ${data.winner_names.join(", ")}`);
        loadAdminGiveaways();
    }).catch(() => tg.showAlert("❌ Ошибка: В розыгрыше нет участников!"));
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
