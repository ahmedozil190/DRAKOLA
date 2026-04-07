const tg = window.Telegram.WebApp;
tg.expand();

// Theme Configuration
const chartTheme = {
    primary: '#38bdf8',
    secondary: '#818cf8',
    accent: '#fbbf24',
    grid: 'rgba(255, 255, 255, 0.05)',
    text: '#94a3b8'
};

document.addEventListener('DOMContentLoaded', () => {
    // Set Admin Info from TG
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('admin-name').innerText = user.first_name || 'المشرف';
        if (user.photo_url) {
            document.getElementById('admin-photo').src = user.photo_url;
        }
    }

    loadData();

    // Refresh Button logic
    document.getElementById('refresh-btn').addEventListener('click', () => {
        tg.HapticFeedback.impactOccurred('medium');
        loadData();
    });
});

// Navigation Logic
function switchTab(tabId) {
    tg.HapticFeedback.selectionChanged();
    
    // Update Tabs UI
    document.querySelectorAll('.tab-item').forEach(item => {
        item.classList.remove('active');
        if (item.innerText.includes(tabId === 'overview' ? 'الإحصائيات' : tabId === 'settings' ? 'الإعدادات' : 'القنوات')) {
            item.classList.add('active');
        }
    });

    // Update Sections
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${tabId}-section`).classList.add('active');
}

async function loadData() {
    showLoader(true);
    try {
        const statsRes = await fetch('/api/stats');
        const stats = await statsRes.json();
        
        const settingsRes = await fetch('/api/settings');
        const settings = await settingsRes.json();

        updateStats(stats);
        updateSettings(settings);
        renderCharts(stats.user_growth);
        renderChannels(settings.channels);
    } catch (err) {
        console.error("Failed to load data:", err);
        tg.showAlert("فشل في تحميل البيانات. تأكد من اتصالك.");
    } finally {
        setTimeout(() => showLoader(false), 500);
    }
}

function updateStats(stats) {
    animateValue("stat-total-users", stats.total_users);
    animateValue("stat-total-balance", stats.total_balance);
    animateValue("stat-total-orders", stats.total_orders);
    animateValue("stat-pending-orders", stats.pending_orders);
}

function updateSettings(settings) {
    document.getElementById('transfer-fee-input').value = settings.transfer_fee;
    document.getElementById('daily-gift-input').value = settings.daily_gift_amount;
    document.getElementById('min-transfer-input').value = settings.min_transfer_amount;
}

function renderChannels(channels) {
    const list = document.getElementById('channels-list');
    list.innerHTML = '';
    
    channels.forEach(ch => {
        const div = document.createElement('div');
        div.className = 'channel-pill glass';
        div.innerHTML = `
            <div class="info">
                <h4>${ch.id}</h4>
                <p>${ch.link}</p>
            </div>
            <button class="action-btn btn-danger" onclick="deleteChannel('${ch.id}')">
                <i class="fas fa-trash"></i>
            </button>
        `;
        list.appendChild(div);
    });
}

// Charts Customization
let usersChart = null;
function renderCharts(data) {
    const ctx = document.getElementById('usersChart').getContext('2d');
    
    if (usersChart) usersChart.destroy();

    // Create Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');

    usersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'المستخدمين الجدد',
                data: data.values,
                borderColor: chartTheme.primary,
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: chartTheme.primary,
                pointBorderColor: '#fff',
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#38bdf8',
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    grid: { color: chartTheme.grid },
                    ticks: { color: chartTheme.text, font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: chartTheme.text, font: { size: 10 } }
                }
            }
        }
    });
}

// Actions
async function saveSettings() {
    const data = {
        transfer_fee: parseFloat(document.getElementById('transfer-fee-input').value),
        daily_gift_amount: parseFloat(document.getElementById('daily-gift-input').value),
        min_transfer_amount: parseFloat(document.getElementById('min-transfer-input').value)
    };

    tg.HapticFeedback.impactOccurred('medium');
    const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        tg.showScanQrPopup({ text: "تم حفظ الإعدادات بنجاح! ✨" }); // Just a fancy way to show success or use showPopup
        setTimeout(() => tg.closeScanQrPopup(), 1500);
    }
}

async function addNewChannel() {
    const id = document.getElementById('new-channel-id').value;
    const link = document.getElementById('new-channel-link').value;

    if (!id || !link) return tg.showAlert("يرجى إكمال البيانات");

    const res = await fetch('/api/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, link })
    });

    if (res.ok) {
        document.getElementById('new-channel-id').value = '';
        document.getElementById('new-channel-link').value = '';
        loadData();
    }
}

async function deleteChannel(id) {
    tg.showConfirm(`هل أنت متأكد من حذف القناة ${id}؟`, async (ok) => {
        if (ok) {
            const res = await fetch('/api/channels/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) loadData();
        }
    });
}

// Utility Functions
function showLoader(show) {
    document.getElementById('loader').style.opacity = show ? '1' : '0';
    setTimeout(() => {
        document.getElementById('loader').style.display = show ? 'flex' : 'none';
    }, show ? 0 : 400);
}

function animateValue(id, value) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const duration = 800;
    const startValue = parseInt(obj.innerText.replace(/,/g, '')) || 0;
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerText = Math.floor(progress * (value - startValue) + startValue).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
