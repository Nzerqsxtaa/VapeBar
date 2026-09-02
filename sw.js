self.addEventListener('install', (e) => {
    console.log('[Service Worker] Установлен');
});

self.addEventListener('fetch', (e) => {
    // Пустой обработчик (заглушка), он обязателен для появления кнопки PWA в Android
});
