// v45 - User Management Header & Numbered Index Cards
const tg = window.Telegram.WebApp;
tg.expand();

// DOM Elements
const loader = document.getElementById('loader');
const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');
const pageTitle = document.getElementById('page-title');

// --- Global UI Logic (v34) ---
function openAddSaleModal() {
    const modal = document.getElementById('add-sale-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.style.pointerEvents = 'auto';
        modal.style.zIndex = '10000';
    }
}

function closeAddSaleModal() {
    const modal = document.getElementById('add-sale-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
        modal.style.pointerEvents = 'none';
        modal.classList.remove('active');
    }
}

function openAddExpenseModal() {
    const modal = document.getElementById('add-expense-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.style.pointerEvents = 'auto';
        modal.style.zIndex = '10000';
    }
}

function closeAddExpenseModal() {
    const modal = document.getElementById('add-expense-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
        modal.style.pointerEvents = 'none';
        modal.classList.remove('active');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initial Setup
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('avatar-circle').innerText = user.first_name?.[0]?.toUpperCase() || 'A';
    }

    // -- Instant Rendering from Cache (v58) --
    const cachedStats = localStorage.getItem('last_stats');
    const cachedUsers = localStorage.getItem('last_users');

    if (cachedStats && cachedUsers) {
        try {
            console.log("🚀 Rendering instant data from cache...");
            const stats = JSON.parse(cachedStats);
            allUsers = JSON.parse(cachedUsers);
            renderStats(stats);
            applyUserFilter();
            // hideLoader() will clear the infinite spinner safely (v58)
            hideLoader();
        } catch (e) {
            console.error("Cache corrupted:", e);
        }
    }

    // Safety fallback: ensure loader is hidden after 4s no matter what
    setTimeout(() => hideLoader(), 4000);

    // Always start at 'overview' on every fresh open
    switchNav('overview');

    // Fetch fresh data in background
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

    // Reset settings sub-views to main menu when entering settings
    if (viewId === 'settings') {
        hideSettingsSubView();
    }

    // Update Title
    const titles = {
        'overview': 'Overview',
        'settings': 'Settings',
        'channels': 'Channels',
        'users': 'User Management',
        'broadcast': 'Broadcast',
        'finance': 'Finance'
    };
    pageTitle.innerText = titles[viewId];

    if (viewId === 'users') {
        loadUsers();
    } else if (viewId === 'finance') {
        loadFinanceData();
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

        // Cache stats for next time
        localStorage.setItem('last_stats', JSON.stringify(stats));
    } catch (err) {
        console.error("Data fetch error:", err);
    } finally {
        // Always ensure loader is hidden after initial load
        hideLoader();
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

    // Bot Name (v59)
    if (document.getElementById('bot-name-input')) {
        document.getElementById('bot-name-input').value = settings.bot_name || "Billion Bot";
    }

    // Broadcast Stats (v44)
    if (document.getElementById('stat-broadcast-global')) {
        document.getElementById('stat-broadcast-global').innerText = settings.total_global || 0;
        document.getElementById('stat-broadcast-targeted').innerText = settings.total_targeted || 0;
    }

    // Dynamic Side Menu Title 
    const sideMenuTitle = document.querySelector('.side-menu-title');
    if (sideMenuTitle) {
        sideMenuTitle.innerText = settings.bot_name || "Billion Bot Plus";
    }

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
        min_transfer_amount: parseFloat(document.getElementById('min-transfer-input').value),
        bot_name: document.getElementById('bot-name-input')?.value || "Billion Bot"
    };

    tg.HapticFeedback.impactOccurred('medium');
    try {
        const res = await fetch('/api/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showSuccessPopup("Settings Saved!", "Your configuration has been updated successfully. ✨");
        }
    } catch (err) {
        console.error("Save error:", err);
    }
}

// ========== Settings Sub-view Navigation (v59) ==========
function showSettingsSubView(viewId) {
    tg.HapticFeedback.impactOccurred('medium');
    document.getElementById('settings-main-menu').style.display = 'none';

    // Hide all subviews first
    document.getElementById('subview-bot-name').style.display = 'none';
    document.getElementById('subview-prices').style.display = 'none';
    document.getElementById('subview-channels-config').style.display = 'none';

    // Show selected subview
    document.getElementById(`subview-${viewId}`).style.display = 'block';

    // If channels, sync them
    if (viewId === 'channels-config') {
        syncChannelsToSubview();
    }
}

function hideSettingsSubView() {
    // If we're already on the main menu, don't do anything
    if (document.getElementById('settings-main-menu').style.display === 'block') return;

    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('settings-main-menu').style.display = 'block';
    document.getElementById('subview-bot-name').style.display = 'none';
    document.getElementById('subview-prices').style.display = 'none';
    document.getElementById('subview-channels-config').style.display = 'none';
}

function syncChannelsToSubview() {
    const mainList = document.getElementById('channels-list').innerHTML;
    const subList = document.getElementById('subview-channels-list');
    if (subList) {
        subList.innerHTML = mainList;
    }
}

async function addNewChannelSubview() {
    const channelId = document.getElementById('subview-new-channel-id').value;
    const channelLink = document.getElementById('subview-new-channel-link').value;

    if (!channelId || !channelLink) return;

    // Reuse main function logic by setting its inputs and calling it
    document.getElementById('new-channel-id').value = channelId;
    document.getElementById('new-channel-link').value = channelLink;
    await addNewChannel();

    // Clear subview inputs
    document.getElementById('subview-new-channel-id').value = '';
    document.getElementById('subview-new-channel-link').value = '';

    // Refresh subview list after a short delay
    setTimeout(syncChannelsToSubview, 800);
}

// ========== Broadcast Logic (v60) ==========
async function sendBroadcast(mode) {
    let endpoint = '/api/broadcast/all';
    let data = {};

    if (mode === 'all') {
        const msg = document.getElementById('broadcast-all-msg').value;
        if (!msg) return tg.showAlert("Please enter a message!");
        data = { message: msg };
    } else {
        const userId = document.getElementById('broadcast-user-id').value;
        const msg = document.getElementById('broadcast-user-msg').value;
        if (!userId || !msg) return tg.showAlert("Please fill id and message!");
        endpoint = '/api/broadcast/user';
        data = { user_id: userId, message: msg };
    }

    tg.HapticFeedback.impactOccurred('medium');
    showLoader(true);

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            const successMsg = mode === 'all'
                ? `Broadcast sent to all users! ✨`
                : "Message delivered! ✈️";

            showSuccessPopup("Broadcast Sent!", successMsg);

            if (mode === 'all') document.getElementById('broadcast-all-msg').value = '';
            else {
                document.getElementById('broadcast-user-id').value = '';
                document.getElementById('broadcast-user-msg').value = '';
            }
        } else {
            tg.showAlert(`Error: ${result.message || "Something went wrong"}`);
        }
    } catch (err) {
        console.error("Broadcast error:", err);
        tg.showAlert("Failed to send broadcast.");
    } finally {
        hideLoader();
    }
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

function triggerSearch() {
    const query = document.getElementById('user-search').value.trim();
    const resetBtn = document.getElementById('reset-search-container');

    if (query) {
        resetBtn.style.display = 'flex';
    } else {
        resetBtn.style.display = 'none';
    }

    filterUsers();
}

function resetSearch() {
    document.getElementById('user-search').value = '';
    document.getElementById('reset-search-container').style.display = 'none';
    filterUsers();
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
            <div style="padding: 45px 20px 30px 20px; text-align: center; color: #94a3b8; font-size: 0.9rem; font-weight: 500; font-style: italic;">
                No users found.
            </div>
        `;
        return;
    }

    users.forEach((user, idx) => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.onclick = () => openUserManageModal(user);

        card.innerHTML = `
            <div class="user-card-index">${idx + 1}</div>
            <div class="user-all-info-list" style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Account Status (v44 - High Contrast) -->
                <div class="user-stat-row" 
                     style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); 
                            border: 1px solid rgba(255, 255, 255, 0.08);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Account Status</span>
                    <div style="font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px; color: ${user.is_banned ? '#ef4444' : '#2ecc71'};">
                        <i class="fas ${user.is_banned ? 'fa-times' : 'fa-check'}"></i>
                        ${user.is_banned ? 'BANNED' : 'ACTIVE'}
                    </div>
                </div>

                <!-- Full Name -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Full Name</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: #ffd700;">${user.first_name}</span>
                </div>

                <!-- Username -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Username</span>
                    <span style="font-size: 0.85rem; font-weight: 600; color: #60a5fa;">@${user.username || 'none'}</span>
                </div>

                <!-- User ID -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">User ID</span>
                    <span style="font-size: 0.85rem; font-weight: 700; color: #f59e0b; font-family: monospace;">${user.user_id}</span>
                </div>

                <!-- Balance -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Balance</span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #60a5fa;">${user.points}</span>
                </div>

                <!-- Spent -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Spent</span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #ef4444;">${user.points_used || 0}</span>
                </div>

                <!-- Earned -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Earned</span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #2ecc71;">${user.points + (user.points_used || 0)}</span>
                </div>

                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Orders Made</span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #c084fc;">${user.orders_count || 0}</span>
                </div>
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
            showSuccessPopup("Points Updated!", "User points have been successfully updated. ✨");
            loadUsers();
        }
    } catch (err) {
        console.error("Add points error:", err);
    }
}

function showLoader(show) {
    if (show) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    } else {
        hideLoader();
    }
}

function hideLoader() {
    if (!loader) return;
    loader.style.opacity = '0';
    setTimeout(() => {
        loader.style.display = 'none';
    }, 300);
}

// ========== Custom Success Modal Logic (v62) ==========
function showSuccessPopup(title, message) {
    document.getElementById('success-title').innerText = title;
    document.getElementById('success-msg').innerText = message;

    // Add active class to show overlay and animate card
    document.getElementById('success-modal').classList.add('active');

    // Success haptic feedback
    tg.HapticFeedback.notificationOccurred('success');
}

function closeSuccessPopup() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('success-modal').classList.remove('active');
}

// ========== Custom User Management Modal (v66) ==========
let currentManagingUser = null;

function openUserManageModal(user) {
    currentManagingUser = user;
    tg.HapticFeedback.impactOccurred('medium');

    document.getElementById('modal-user-name').innerText = user.first_name;
    document.getElementById('modal-user-id').innerText = user.user_id;
    document.getElementById('modal-current-bal').innerText = Math.floor(user.points);
    document.getElementById('modal-total-earned').innerText = user.total_earned || 0; // v73
    document.getElementById('modal-points-input').value = '';

    // Update Ban Button
    const banBtn = document.getElementById('modal-ban-btn');
    banBtn.innerHTML = user.is_banned ? '<i class="fas fa-undo"></i> Unban Account' : '<i class="fas fa-ban"></i> Ban Account';
    banBtn.className = `modal-action-btn btn-ban ${user.is_banned ? 'unban' : ''}`;

    document.getElementById('user-manage-modal').classList.add('active');
}

function closeUserManageModal() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('user-manage-modal').classList.remove('active');
}

async function modalUpdatePoints(type) {
    if (!currentManagingUser) return;

    const inputVal = document.getElementById('modal-points-input').value;
    // v70: Enhanced validation with clear request message
    if (!inputVal || isNaN(inputVal)) {
        return tg.showAlert("Please enter the number of points first! 🖋️");
    }

    let points = parseInt(inputVal);
    if (type === 'sub') points = -points; // Negative for subtraction

    tg.HapticFeedback.impactOccurred('medium');
    showLoader(true);

    try {
        const res = await fetch('/api/users/points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentManagingUser.user_id, points: points })
        });
        if (res.ok) {
            closeUserManageModal(); // Auto-close (v66)
            showSuccessPopup("Updated!", `${Math.abs(points)} points ${type === 'add' ? 'added' : 'subtracted'} successfully. ✨`);
            loadUsers();
        }
    } catch (err) {
        console.error("Points update error:", err);
    } finally {
        hideLoader();
    }
}

async function modalToggleBan() {
    if (!currentManagingUser) return;

    tg.HapticFeedback.impactOccurred('medium');
    showLoader(true);

    try {
        const res = await fetch('/api/users/ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentManagingUser.user_id })
        });
        if (res.ok) {
            closeUserManageModal(); // Auto-close (v66)
            const newStatus = !currentManagingUser.is_banned;
            showSuccessPopup(newStatus ? "User Banned!" : "User Active!", `The account has been ${newStatus ? 'restricted' : 'restored'}. 🛡️`);
            loadUsers();
        }
    } catch (err) {
        console.error("Ban toggle error:", err);
    } finally {
        hideLoader();
    }
}
// --- Finance Dashboard (v26) ---
async function loadFinanceData() {
    showLoader(true);
    try {
        const res = await fetch('/api/finance');
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        renderFinance(data);
    } catch (err) {
        console.error("Finance load error:", err);
        const list = document.getElementById('finance-history-list');
        if (list) list.innerHTML = `<div style="margin: auto; color: #ef4444; font-size: 0.85rem; text-align: center; padding: 20px;">Failed to load data. Please refresh.</div>`;
    } finally {
        hideLoader();
    }
}

function renderFinance(data) {
    if (!data) return;

    // Defensive Stats Rendering
    const stats = data.stats || {};
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    safeSetText('finance-total-revenue', `$${parseFloat(stats.total_revenue || 0).toLocaleString()}`);
    safeSetText('finance-total-sales', stats.total_sales || 0);
    safeSetText('finance-total-expenses', `$${parseFloat(stats.total_expenses || 0).toLocaleString()}`);

    // Render History
    const list = document.getElementById('finance-history-list');
    if (!list) return;
    list.innerHTML = '';

    if (!data.history || data.history.length === 0) {
        list.innerHTML = `
            <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #475569; text-align: center; padding: 20px;">
                <i class="fas fa-receipt" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.3;"></i>
                <div style="font-size: 1.1rem; font-weight: 700; color: #94a3b8;">No transactions found</div>
                <div style="font-size: 0.75rem; margin-top: 5px; opacity: 0.6;">Record your sales and expenses to see them here.</div>
            </div>
        `;
        return;
    }

    data.history.forEach(h => {
        const item = document.createElement('div');
        const isExpense = h.record_type === 'expense';
        item.className = 'user-stat-row';
        item.style.display = 'block';
        item.style.padding = '15px';
        item.style.marginBottom = '12px';
        item.style.background = 'rgba(255,255,255,0.02)';
        item.style.borderRadius = '14px';
        item.style.border = isExpense ? '1px solid rgba(239, 68, 68, 0.1)' : '1px solid rgba(255,255,255,0.03)';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 700; color: ${isExpense ? '#ef4444' : '#2ecc71'}; font-size: 1.1rem;">
                    ${isExpense ? '-' : '+'}$${h.amount_usd}
                </span>
                <span style="font-size: 0.75rem; color: #475569;">${h.created_at}</span>
            </div>
            <div style="color: #cbd5e1; font-size: 0.9rem; margin-bottom: 5px;">${h.description}</div>
            <div style="display: flex; gap: 10px; font-size: 0.8rem;">
                ${!isExpense ? `<span style="color: #60a5fa;"><i class="fas fa-coins"></i> ${h.points_added} Points</span>` : ''}
                ${h.user_id ? `<span style="color: #94a3b8;"><i class="fas fa-user text-xs"></i> ID: ${h.user_id}</span>` : ''}
                <span style="color: #475569; text-transform: uppercase; font-size: 0.65rem; font-weight: 700; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${h.record_type}</span>
            </div>
        `;
        list.appendChild(item);
    });
}

// Modal control functions moved to top (v27)

async function submitSale() {
    const amount = document.getElementById('sale-amount').value;
    const points = document.getElementById('sale-points').value;
    const userId = document.getElementById('sale-user-id').value;
    const note = document.getElementById('sale-note').value;

    if (!amount || !note) {
        alert("Please enter amount and description.");
        return;
    }

    try {
        const res = await fetch('/api/finance/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                points,
                user_id: userId,
                description: note,
                type: 'sale'
            })
        });

        if (res.ok) {
            closeAddSaleModal();
            showSuccessPopup("Sale recorded successfully!");
            loadFinanceData();

            // Clear inputs
            document.getElementById('sale-amount').value = '';
            document.getElementById('sale-points').value = '';
            document.getElementById('sale-user-id').value = '';
            document.getElementById('sale-note').value = '';
        }
    } catch (err) {
        console.error("Sale submission error:", err);
    }
}

async function submitExpense() {
    const amount = document.getElementById('expense-amount').value;
    const note = document.getElementById('expense-note').value;

    if (!amount || !note) {
        alert("Please enter amount and description.");
        return;
    }

    try {
        const res = await fetch('/api/finance/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                description: note,
                type: 'expense'
            })
        });

        if (res.ok) {
            closeAddExpenseModal();
            showSuccessPopup("Expense recorded successfully!");
            loadFinanceData();

            // Clear inputs
            document.getElementById('expense-amount').value = '';
            document.getElementById('expense-note').value = '';
        }
    } catch (err) {
        console.error("Expense submission error:", err);
    }
}
