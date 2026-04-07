const tg = window.Telegram.WebApp;
tg.expand();

// DOM Elements
const loader = document.getElementById('loader');
const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');
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
    menuOverlay.classList.toggle('active');
}

function switchNav(viewId) {
    tg.HapticFeedback.selectionChanged();
    
    // Smoothly close menu and overlay
    sideMenu.classList.remove('active');
    menuOverlay.classList.remove('active');
    
    // Update Title
    const titles = {
        'overview': 'الرئيسية',
        'settings': 'الإعدادات',
        'channels': 'القنوات',
        'users': 'المستخدمين'
    };
    pageTitle.innerText = titles[viewId];
    
    if (viewId === 'users') {
        loadUsers();
    }

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
    document.getElementById('stat-total-users').innerText = stats.total_users || 0;
    document.getElementById('stat-banned-users').innerText = stats.banned_users || 0;
    document.getElementById('stat-completed-tasks').innerText = stats.completed_orders || 0;
    document.getElementById('stat-active-tasks').innerText = stats.active_orders || 0;
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
        div.className = 'glass-card';
        div.style.padding = '15px';
        div.style.marginBottom = '10px';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.innerHTML = `
            <div>
                <p style="font-size: 0.9rem; font-weight: 600;">${ch.id}</p>
                <p style="font-size: 0.7rem; opacity: 0.5;">${ch.link}</p>
            </div>
            <i class="fas fa-trash" style="color: var(--danger); cursor: pointer;" onclick="deleteChannel('${ch.id}')"></i>
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
    if (res.ok) tg.showAlert("تم حفظ الإعدادات بنجاح! ✨");
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
    if (confirm("هل تريد حذف هذه القناة؟")) {
        await fetch('/api/channels/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        loadInitialData();
    }
}

let allUsers = [];
let userFilter = 'all';

async function loadUsers() {
    showLoader(true);
    try {
        const res = await fetch('/api/users');
        allUsers = await res.json();
        applyUserFilter();
    } catch (err) {
        console.error("Users fetch error:", err);
    } finally {
        showLoader(false);
    }
}

function setUserFilter(filter) {
    userFilter = filter;
    tg.HapticFeedback.selectionChanged();
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${filter}`).classList.add('active');
    applyUserFilter();
}

function applyUserFilter() {
    let filtered = allUsers;
    if (userFilter === 'banned') {
        filtered = allUsers.filter(u => u.is_banned);
    }
    
    const query = document.getElementById('user-search').value.toLowerCase();
    if (query) {
        filtered = filtered.filter(u => 
            u.first_name.toLowerCase().includes(query) || 
            u.user_id.toString().includes(query) || 
            (u.username && u.username.toLowerCase().includes(query))
        );
    }
    
    document.getElementById('users-count-badge').innerText = `${filtered.length} results`;
    renderUsers(filtered);
}

function filterUsers() {
    applyUserFilter();
}

function renderUsers(users) {
    const list = document.getElementById('users-list');
    list.innerHTML = '';
    
    if (users.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:2rem; opacity:0.6;">لا يوجد مستخدمين.</div>`;
        return;
    }

    users.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.onclick = () => tg.HapticFeedback.impactOccurred('light');
        
        card.innerHTML = `
            <div class="user-card-header">
                <div class="user-card-title">${user.first_name}</div>
                <div class="verified-icon" onclick="toggleBan('${user.user_id}'); event.stopPropagation();" style="cursor: pointer;">
                    <i class="fa-solid fa-circle-${user.is_banned ? 'xmark' : 'check'}" style="color: ${user.is_banned ? 'var(--danger)' : 'var(--success)'};"></i>
                </div>
            </div>
            
            <div class="user-card-sub">
                <div class="user-card-username">@${user.username || 'unknown'}</div>
                <div class="user-card-id">ID: ${user.user_id}</div>
            </div>
            
            <div class="user-stats-grid">
                <div class="user-stat-item" onclick="promptAddPoints('${user.user_id}'); event.stopPropagation();">
                    <span class="user-stat-label">Balance</span>
                    <span class="user-stat-value balance">$${(user.points / 100).toFixed(2)}</span>
                </div>
                <div class="user-stat-item">
                    <span class="user-stat-label">Hold</span>
                    <span class="user-stat-value hold">$0.00</span>
                </div>
                <div class="user-stat-item">
                    <span class="user-stat-label">Tasks</span>
                    <span class="user-stat-value tasks">${user.transfers_count}</span>
                </div>
            </div>
            
            <div class="user-card-dashed">
                <span class="withdrawn-label">إجمالي السحوبات:</span>
                <span class="withdrawn-value">$${((user.points_used || 0) / 100).toFixed(2)}</span>
            </div>
        `;
        list.appendChild(card);
    });
}

async function toggleBan(userId) {
    tg.HapticFeedback.impactOccurred('medium');
    const res = await fetch('/api/users/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
    });
    if (res.ok) {
        loadUsers();
    }
}

async function promptAddPoints(userId) {
    const points = prompt("أدخل النقاط (استخدم علامة - للخصم):");
    if (points === null || points === "" || isNaN(points)) return;

    tg.HapticFeedback.impactOccurred('medium');
    const res = await fetch('/api/users/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, points: parseInt(points) })
    });
    if (res.ok) {
        tg.showAlert("تم تحديث النقاط! ✨");
        loadUsers();
    }
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}
