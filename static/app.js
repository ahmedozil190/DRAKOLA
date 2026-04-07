const tg = window.Telegram.WebApp;
tg.expand();

// DOM Elements
const loader = document.getElementById('loader');
const sideMenu = document.getElementById('side-menu');
const pageTitle = document.getElementById('page-title');

document.addEventListener('DOMContentLoaded', () => {
    // Initial Setup
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('avatar-circle').innerText = user.first_name?.[0]?.toUpperCase() || 'A';
    }

    loadInitialData();
});

// Sidebar & Navigation
function toggleMenu() {
    tg.HapticFeedback.impactOccurred('light');
    sideMenu.classList.toggle('active');
}

function switchNav(viewId) {
    tg.HapticFeedback.selectionChanged();
    sideMenu.classList.remove('active');
    
    // Update Title
    const titles = {
        'overview': 'Overview',
        'settings': 'Settings',
        'channels': 'Channels'
    };
    pageTitle.innerText = titles[viewId];

    // Update UI Active States
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(viewId)) item.classList.add('active');
    });

    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${viewId}-section`).classList.add('active');
}

async function loadInitialData() {
    showLoader(true);
    try {
        const statsRes = await fetch('/api/stats');
        const stats = await statsRes.json();
        
        const settingsRes = await fetch('/api/settings');
        const settings = await settingsRes.json();

        populateStats(stats);
        populateSettings(settings);
    } catch (err) {
        console.error("Data fetch error:", err);
    } finally {
        setTimeout(() => showLoader(false), 500);
    }
}

function populateStats(stats) {
    // Mapping our backend stats to the Gmail Farmer Style IDs
    document.getElementById('stat-total-users').innerText = stats.total_users || 0;
    document.getElementById('stat-banned-users').innerText = stats.banned_users || 0;
    
    // Tasks section mapping
    document.getElementById('stat-total-tasks').innerText = stats.total_orders || 0;
    document.getElementById('stat-completed-tasks').innerText = stats.completed_orders || 0;
    document.getElementById('stat-active-tasks').innerText = stats.active_orders || 0;
    document.getElementById('stat-cancelled-tasks').innerText = stats.cancelled_orders || 0;
}

function populateSettings(settings) {
    document.getElementById('transfer-fee-input').value = settings.transfer_fee;
    document.getElementById('daily-gift-input').value = settings.daily_gift_amount;
    document.getElementById('min-transfer-input').value = settings.min_transfer_amount;
    renderChannels(settings.channels);
}

function renderChannels(channels) {
    const list = document.getElementById('channels-list');
    list.innerHTML = '';
    channels.forEach(ch => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.padding = '15px';
        div.style.marginBottom = '10px';
        div.style.flexDirection = 'row';
        div.style.minHeight = 'auto';
        div.innerHTML = `
            <div style="flex: 1;">
                <p style="font-size: 0.9rem; font-weight: 600;">${ch.id}</p>
                <p style="font-size: 0.7rem; color: #8b8e9f;">${ch.link}</p>
            </div>
            <i class="fas fa-trash" style="color: #ef4444; cursor: pointer;" onclick="deleteChannel('${ch.id}')"></i>
        `;
        list.appendChild(div);
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
    if (res.ok) tg.showAlert("Configuration saved successfully! ✨");
}

async function addNewChannel() {
    const id = document.getElementById('new-channel-id').value;
    const link = document.getElementById('new-channel-link').value;
    if (!id || !link) return;

    await fetch('/api/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, link })
    });
    loadInitialData();
}

async function deleteChannel(id) {
    if (confirm("Delete this channel?")) {
        await fetch('/api/channels/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        loadInitialData();
    }
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}
