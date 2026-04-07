const tg = window.Telegram.WebApp;

// Show app when ready
tg.ready();
tg.expand();

// DOM Elements
const loader = document.getElementById('loader');
const appContainer = document.querySelector('.app-container');
const totalUsersEl = document.getElementById('total_users');
const totalPointsEl = document.getElementById('total-points');
const activeOrdersEl = document.getElementById('active-orders');
const adminNameEl = document.getElementById('admin-name');
const adminAvatarEl = document.getElementById('admin-avatar');

// Inputs
const transferFeeInp = document.getElementById('transfer_fee');
const dailyGiftInp = document.getElementById('daily_gift_amount');
const minTransferInp = document.getElementById('min_transfer_amount');
const newChIdInp = document.getElementById('new-ch-id');
const newChLinkInp = document.getElementById('new-ch-link');

// Buttons
const saveSettingsBtn = document.getElementById('save-settings');
const addChannelBtn = document.getElementById('add-channel-btn');
const refreshBtn = document.getElementById('refresh-btn');

let statsChart;

async function loadData() {
    try {
        // Load Stats
        const statsRes = await fetch('/api/stats');
        const stats = await statsRes.json();
        
        document.getElementById('total-users').innerText = stats.total_users;
        document.getElementById('total-points').innerText = stats.total_points;
        document.getElementById('active-orders').innerText = stats.active_orders;

        // Load Settings & Channels
        const settingsRes = await fetch('/api/settings');
        const settings = await settingsRes.json();
        
        transferFeeInp.value = settings.transfer_fee;
        dailyGiftInp.value = settings.daily_gift_amount;
        minTransferInp.value = settings.min_transfer_amount;

        renderChannels(settings.channels);
        renderChart(stats);

        // Update UI with User Info
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const user = tg.initDataUnsafe.user;
            adminNameEl.innerText = `أهلاً بك، ${user.first_name}`;
            if (user.photo_url) adminAvatarEl.src = user.photo_url;
        }

        loader.style.display = 'none';
        appContainer.style.display = 'block';

    } catch (err) {
        console.error("Error loading data:", err);
        tg.showAlert("فشل جلب البيانات من الخادم! تأكد من تشغيل البوت.");
    }
}

function renderChannels(channels) {
    const list = document.getElementById('channels-list');
    list.innerHTML = "";
    channels.forEach(ch => {
        const item = document.createElement('div');
        item.className = "channel-item";
        item.innerHTML = `
            <div class="channel-info">
                <h4>${ch.id}</h4>
                <p>${ch.link}</p>
            </div>
            <button class="del-ch-btn" onclick="deleteChannel('${ch.id}')"><i class="fas fa-trash-alt"></i></button>
        `;
        list.appendChild(item);
    });
}

function renderChart(stats) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    
    if (statsChart) statsChart.destroy();
    
    statsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['المستخدمين', 'التمويلات'],
            datasets: [{
                data: [stats.total_users, stats.active_orders],
                backgroundColor: ['#58a6ff', '#238636'],
                borderColor: '#0d1117',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f0f6fc' } }
            }
        }
    });
}

// Save Settings
saveSettingsBtn.addEventListener('click', async () => {
    const data = {
        transfer_fee: parseInt(transferFeeInp.value),
        daily_gift_amount: parseInt(dailyGiftInp.value),
        min_transfer_amount: parseInt(minTransferInp.value)
    };

    const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        tg.HapticFeedback.notificationOccurred('success');
        tg.showScanQrPopup({ text: "تم حفظ الإعدادات بنجاح! ✅" }); // Using a trick to show notification
        setTimeout(() => tg.closeScanQrPopup(), 1500);
    }
});

// Add Channel
addChannelBtn.addEventListener('click', async () => {
    const id = newChIdInp.value;
    const link = newChLinkInp.value;
    
    if (!id || !link) return;

    await fetch('/api/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, link })
    });

    newChIdInp.value = "";
    newChLinkInp.value = "";
    loadData();
});

// Delete Channel (Global scope to handle onclick)
window.deleteChannel = async (id) => {
    await fetch('/api/channels/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    loadData();
};

refreshBtn.addEventListener('click', loadData);

// Initial Load
loadData();
