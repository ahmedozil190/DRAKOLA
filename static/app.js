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

    // Restore last view or default to overview
    const savedView = localStorage.getItem('currentView') || 'overview';
    switchNav(savedView);
    
    // Silent load on refresh to avoid data "disappearing/appearing"
    loadInitialData(true);
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

    // Save current view for persistence
    localStorage.setItem('currentView', viewId);

    // Update Title
    const titles = {
        'overview': 'Overview',
        'settings': 'Settings',
        'channels': 'Channels',
        'users': 'User Management'
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

async function loadInitialData(silent = false) {
    if (!silent) showLoader(true);
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
        if (!silent) setTimeout(() => showLoader(false), 500);
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

let allUsers = [];
let userFilter = 'all';
let currentPage = 1;
const usersPerPage = 5;
let totalFilteredCount = 0;

async function loadUsers() {
    showLoader(true);
    try {
        const res = await fetch('/api/users');
        allUsers = await res.json();

        // Update top stats
        const total = allUsers.length;
        const banned = allUsers.filter(u => u.is_banned).length;
        document.getElementById('user-stat-total').innerText = total;
        document.getElementById('user-stat-banned').innerText = banned;

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

    // Update active tab UI
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${filter}`).classList.add('active');

    // Styling the inactive/active tabs manually if needed, but classes are better
    document.getElementById('tab-all').style.background = filter === 'all' ? 'var(--clr-blue)' : 'rgba(255,255,255,0.05)';
    document.getElementById('tab-all').style.color = filter === 'all' ? '#fff' : 'var(--text-muted)';

    document.getElementById('tab-banned').style.background = filter === 'banned' ? 'var(--clr-blue)' : 'rgba(255,255,255,0.05)';
    document.getElementById('tab-banned').style.color = filter === 'banned' ? '#fff' : 'var(--text-muted)';

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

    totalFilteredCount = filtered.length;
    const totalPages = Math.ceil(totalFilteredCount / usersPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

    // Slice for pagination
    const start = (currentPage - 1) * usersPerPage;
    const end = start + usersPerPage;
    const pagedUsers = filtered.slice(start, end);

    document.getElementById('users-count-badge').innerText = `${totalFilteredCount} results`;
    
    // Pagination UI Updates
    const paginationContainer = document.getElementById('pagination-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');

    if (totalFilteredCount > usersPerPage) {
        paginationContainer.style.display = 'flex';
        pageInfo.innerText = `Page ${currentPage} of ${totalPages || 1}`;
        
        // Dim disabled arrows
        prevBtn.style.opacity = currentPage === 1 ? '0.3' : '1';
        prevBtn.style.pointerEvents = currentPage === 1 ? 'none' : 'auto';
        
        nextBtn.style.opacity = (currentPage === totalPages || totalPages === 0) ? '0.3' : '1';
        nextBtn.style.pointerEvents = (currentPage === totalPages || totalPages === 0) ? 'none' : 'auto';
    } else {
        paginationContainer.style.display = 'none';
    }

    renderUsers(pagedUsers);
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        tg.HapticFeedback.impactOccurred('light');
        applyUserFilter();
        window.scrollTo({ top: document.getElementById('users-section').offsetTop - 100, behavior: 'smooth' });
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalFilteredCount / usersPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        tg.HapticFeedback.impactOccurred('light');
        applyUserFilter();
        window.scrollTo({ top: document.getElementById('users-section').offsetTop - 100, behavior: 'smooth' });
    }
}

function filterUsers() {
    tg.HapticFeedback.impactOccurred('light');
    applyUserFilter();
}

function renderUsers(users) {
    const list = document.getElementById('users-list');
    list.innerHTML = '';

    if (users.length === 0) {
        list.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: #ffffff; font-size: 1.05rem; font-weight: 500;">
                No users found.
            </div>
        `;
        return;
    }

    users.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.onclick = () => tg.HapticFeedback.impactOccurred('light');

        card.innerHTML = `
            <div class="user-card-header">
                <div class="user-card-title">${user.first_name}</div>
                <div class="verified-icon" onclick="toggleBan('${user.user_id}'); event.stopPropagation();" style="background: ${user.is_banned ? '#ef4444' : '#2ecc71'}; cursor: pointer;">
                    <i class="fas ${user.is_banned ? 'fa-times' : 'fa-check'}"></i>
                </div>
            </div>
            
            <div class="user-card-sub">
                <div class="user-card-username">@${user.username || 'unknown'}</div>
                <div class="user-card-id">ID: ${user.user_id}</div>
            </div>
            
            <div class="user-card-divider"></div>
            
            <div class="user-stats-grid">
                <div class="user-stat-item" onclick="promptAddPoints('${user.user_id}'); event.stopPropagation();">
                    <div class="user-stat-label">Balance</div>
                    <div class="user-stat-value balance">$${(user.points / 100).toFixed(2)}</div>
                </div>
                <div class="user-stat-item">
                    <div class="user-stat-label">Hold</div>
                    <div class="user-stat-value hold">$0.00</div>
                </div>
                <div class="user-stat-item">
                    <div class="user-stat-label">Tasks</div>
                    <div class="user-stat-value tasks">${user.transfers_count}</div>
                </div>
            </div>
            
            <div class="user-card-dashed">
                <div class="withdrawn-label">Total Withdrawn:</div>
                <div class="withdrawn-value">$${((user.points_used || 0) / 100).toFixed(2)}</div>
            </div>
        `;
        list.appendChild(card);
    });
}

async function toggleBan(userId) {
    tg.HapticFeedback.impactOccurred('medium');
    try {
        const res = await fetch('/api/users/ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        if (res.ok) {
            loadUsers();
        }
    } catch (err) {
        console.error("Ban toggle error:", err);
    }
}

async function promptAddPoints(userId) {
    const points = prompt("Enter points to add (negative to remove):");
    if (points === null || points === "" || isNaN(points)) return;

    tg.HapticFeedback.impactOccurred('medium');
    try {
        const res = await fetch('/api/users/points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, points: parseInt(points) })
        });
        if (res.ok) {
            tg.showAlert("Points updated! ✨");
            loadUsers();
        }
    } catch (err) {
        console.error("Add points error:", err);
    }
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}
