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

    // PERSISTENCE v48: Restore last session view or default to overview
    const lastSessionView = sessionStorage.getItem('last_view') || 'overview';
    switchNav(lastSessionView);

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
    
    // Reset Scroll Position (v83)
    window.scrollTo(0, 0);

    // PERSISTENCE v48: Save current view to session storage
    sessionStorage.setItem('last_view', viewId);

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
        'finance': 'Finance',
        'coupons': 'Coupons',
        'orders': 'Orders',
        'reports': 'Reports'
    };
    pageTitle.innerText = titles[viewId];

    // Reset Pagination to Page 1 when entering sections (v83)
    if (viewId === 'users') {
        currentPage = 1;
        loadUsers();
    } else if (viewId === 'finance') {
        currentFinancePage = 1;
        loadFinanceData();
    } else if (viewId === 'coupons') {
        currentCouponsPage = 1;
        loadCoupons();
    } else if (viewId === 'orders') {
        loadOrders();
    } else if (viewId === 'reports') {
        loadReports();
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

    // Finance section mapping (v112 Robust Fix)
    if (document.getElementById('stat-total-revenue')) {
        const rev = parseFloat(stats.total_revenue || 0);
        const exp = parseFloat(stats.total_expenses || 0);
        const netProfit = rev - exp;

        document.getElementById('stat-total-revenue').innerText = `$${rev.toLocaleString()}`;
        document.getElementById('stat-total-expenses').innerText = `$${exp.toLocaleString()}`;
        document.getElementById('stat-total-sales-count').innerText = stats.total_sales || 0;
        
        // Net Profit logic for Home (v112 Fix)
        const profitHomeEl = document.getElementById('stat-net-profit-home');
        if (profitHomeEl) {
            profitHomeEl.innerText = `$${netProfit.toLocaleString()}`;
            profitHomeEl.style.color = netProfit >= 0 ? '#10b981' : '#ef4444';
        }
    }

    // Broadcast mapping for Home (v112 Fix)
    if (document.getElementById('stat-broadcast-global-home')) {
        document.getElementById('stat-broadcast-global-home').innerText = stats.broadcast_global || 0;
        document.getElementById('stat-broadcast-targeted-home').innerText = stats.broadcast_targeted || 0;
    }

    // Coupons section mapping (v101)
    if (document.getElementById('stat-active-coupons-home')) {
        document.getElementById('stat-active-coupons-home').innerText = stats.active_coupons || 0;
        document.getElementById('stat-finished-coupons-home').innerText = stats.finished_coupons || 0;
    }
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
            // Scroll to top v52: Ensure stats cards are in view and avoid mobile rendering glitches
            window.scrollTo({ top: 0, behavior: 'smooth' });

            const successMsg = mode === 'all'
                ? `Broadcast sent to all users! ✨`
                : "Message delivered! ✈️";

            showSuccessPopup("Broadcast Sent!", successMsg);

            if (mode === 'all') document.getElementById('broadcast-all-msg').value = '';
            else {
                document.getElementById('broadcast-user-id').value = '';
                document.getElementById('broadcast-user-msg').value = '';
            }

            // LIVE UPDATES v48: Refresh counters immediately after broadcast
            loadInitialData(true);
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
    showConfirmPopup(
        "Delete Mandatory Channel",
        `Are you sure you want to delete the channel (${id})? Users will be able to use the bot without subscribing to it.`,
        async () => {
            tg.HapticFeedback.impactOccurred('light');
            await fetch('/api/channels/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            loadInitialData();
            showSuccessPopup("Deleted Successfully", "The channel has been removed from the mandatory subscription list.");
        }
    );
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

    // Update active tab UI v47 - Using classes only
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeTab = document.getElementById(`tab-${filter}`);
    if (activeTab) activeTab.classList.add('active');

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
            <div style="padding: 60px 20px 40px 20px; text-align: center; color: #94a3b8; font-size: 0.95rem; font-weight: 500;">
                <div style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.5;">🔍</div>
                <b>No users found currently!</b><br>
                <p style="margin-top: 8px; font-size: 0.85rem; opacity: 0.8;">• It seems the list is empty or there are no search results.</p>
                <p style="font-size: 0.85rem; opacity: 0.8;">• Make sure to check the filter or search query.</p>
            </div>
        `;
        return;
    }

    const startIdx = (currentPage - 1) * usersPerPage;

    users.forEach((user, idx) => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.onclick = () => openUserManageModal(user);

        card.innerHTML = `
            <div class="user-card-index">${startIdx + idx + 1}</div>
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
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Full Name</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: #ffd700;">${user.first_name}</span>
                </div>

                <!-- Username -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Username</span>
                    <span style="font-size: 0.85rem; font-weight: 600; color: #60a5fa;">@${user.username || 'none'}</span>
                </div>

                <!-- User ID -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">User ID</span>
                    <span style="font-size: 0.85rem; font-weight: 700; color: #f59e0b; font-family: monospace;">${user.user_id}</span>
                </div>

                <!-- Balance -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Balance</span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #60a5fa;">${user.points}</span>
                </div>

                <!-- Spent -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Spent</span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #ef4444;">${user.points_used || 0}</span>
                </div>

                <!-- Earned -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Earned</span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #2ecc71;">${user.points + (user.points_used || 0)}</span>
                </div>

                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05);">
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
function showSuccessPopup(title, message = "") {
    document.getElementById('success-title').innerText = title;
    document.getElementById('success-msg').innerText = message || "";

    // Add active class to show overlay and animate card
    document.getElementById('success-modal').classList.add('active');

    // Success haptic feedback
    tg.HapticFeedback.notificationOccurred('success');
}

function closeSuccessPopup() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('success-modal').classList.remove('active');
}

// ========== Custom Error Modal Logic (v54) ==========
function showErrorPopup(title, message = "") {
    document.getElementById('error-title').innerText = title;
    document.getElementById('error-msg').innerText = message || "";
    document.getElementById('error-modal').classList.add('active');
    tg.HapticFeedback.notificationOccurred('error');
}

function closeErrorPopup() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('error-modal').classList.remove('active');
}

// ========== Clipboard Logic (v97) ==========
function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        tg.HapticFeedback.notificationOccurred('success');
        // Simple visual feedback: using the success popup for consistency
        showSuccessPopup("Copied!", "Coupon code has been copied to clipboard 📋");
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

// ========== Custom Confirmation Modal Logic (v93) ==========
let onConfirmAction = null;

function showConfirmPopup(title, message, onConfirm) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-msg').innerText = message;
    onConfirmAction = onConfirm;
    
    const confirmBtn = document.getElementById('confirm-yes-btn');
    confirmBtn.onclick = () => {
        if (onConfirmAction) onConfirmAction();
        closeConfirmPopup(true);
    };
    
    document.getElementById('confirm-modal').classList.add('active');
    tg.HapticFeedback.notificationOccurred('warning');
}

function closeConfirmPopup(confirmed = false) {
    if (!confirmed) tg.HapticFeedback.impactOccurred('light');
    document.getElementById('confirm-modal').classList.remove('active');
    onConfirmAction = null;
}

// ========== Inline Error Logic (v55) ==========
function showInlineError(message) {
    const alert = document.getElementById('modal-error-alert');
    const text = document.getElementById('modal-error-text');
    text.innerText = message;
    alert.style.display = 'flex';
    tg.HapticFeedback.notificationOccurred('error');
}

function hideInlineError() {
    document.getElementById('modal-error-alert').style.display = 'none';
}

// ========== Custom User Management Modal (v66) ==========
let currentManagingUser = null;

function openUserManageModal(user) {
    currentManagingUser = user;
    hideInlineError(); // v55: Clear previous errors
    tg.HapticFeedback.impactOccurred('medium');

    document.getElementById('modal-user-name').innerText = user.first_name;
    document.getElementById('modal-user-id').innerText = user.user_id;
    document.getElementById('modal-current-bal').innerText = Math.floor(user.points);
    document.getElementById('modal-points-input').value = '';

    // Update Ban Button
    const banBtn = document.getElementById('modal-ban-btn');
    banBtn.innerHTML = user.is_banned ? '<i class="fas fa-undo"></i> Unban Account' : '<i class="fas fa-ban"></i> Ban Account';
    banBtn.className = `modal-action-btn btn-ban ${user.is_banned ? 'unban' : ''}`;

    // v55: Auto-hide error alert when typing
    const pointsInput = document.getElementById('modal-points-input');
    pointsInput.oninput = () => hideInlineError();

    document.getElementById('user-manage-modal').classList.add('active');
}

function closeUserManageModal() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('user-manage-modal').classList.remove('active');
}

async function modalUpdatePoints(type) {
    if (!currentManagingUser) return;

    const inputVal = document.getElementById('modal-points-input').value;
    // v55: Using Inline Alert (Arabic) inside the panel above the input
    if (!inputVal || isNaN(inputVal) || parseInt(inputVal) === 0) {
        return showInlineError("Please enter the number of points first! 🖋️");
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
// v59: Finance Pagination State
let financeDataCache = null;
let currentFinancePage = 1;
const financePerPage = 5;

async function loadFinanceData() {
    showLoader(true);
    try {
        const res = await fetch('/api/finance');
        if (!res.ok) throw new Error("API error");
        financeDataCache = await res.json();
        currentFinancePage = 1;
        renderFinance();
    } catch (err) {
        console.error("Finance load error:", err);
        const list = document.getElementById('finance-history-list');
        if (list) list.innerHTML = `<div style="margin: auto; color: #ef4444; font-size: 0.85rem; text-align: center; padding: 20px;">Failed to load data. Please refresh.</div>`;
    } finally {
        hideLoader();
    }
}

function renderFinance() {
    if (!financeDataCache) return;
    const data = financeDataCache;

    // Defensive Stats Rendering
    const stats = data.stats || {};
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    const rev = parseFloat(stats.total_revenue || 0);
    const exp = parseFloat(stats.total_expenses || 0);
    const net = rev - exp;

    safeSetText('finance-total-revenue', `$${rev.toLocaleString()}`);
    safeSetText('finance-total-sales', stats.total_sales || 0);
    safeSetText('finance-total-expenses', `$${exp.toLocaleString()}`);
    
    const profitEl = document.getElementById('finance-stat-profit');
    if (profitEl) {
        profitEl.innerText = `$${net.toLocaleString()}`;
        profitEl.style.color = net >= 0 ? '#2ecc71' : '#ef4444';
    }

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
        document.getElementById('finance-pagination-container').style.display = 'none';
        return;
    }

    // Pagination Logic (v59)
    const totalTransactions = data.history.length;
    const totalPages = Math.ceil(totalTransactions / financePerPage);
    if (currentFinancePage > totalPages && totalPages > 0) currentFinancePage = totalPages;

    const start = (currentFinancePage - 1) * financePerPage;
    const end = start + financePerPage;
    const pagedHistory = data.history.slice(start, end);

    // UI Pagination Updates
    const paginationContainer = document.getElementById('finance-pagination-container');
    const prevBtn = document.getElementById('finance-prev-btn');
    const nextBtn = document.getElementById('finance-next-btn');
    const pageInfo = document.getElementById('finance-page-info');

    if (totalTransactions > financePerPage) {
        paginationContainer.style.display = 'flex';
        pageInfo.innerText = `Page ${currentFinancePage} of ${totalPages || 1}`;

        prevBtn.style.opacity = currentFinancePage === 1 ? '0.3' : '1';
        prevBtn.style.pointerEvents = currentFinancePage === 1 ? 'none' : 'auto';

        nextBtn.style.opacity = (currentFinancePage === totalPages || totalPages === 0) ? '0.3' : '1';
        nextBtn.style.pointerEvents = (currentFinancePage === totalPages || totalPages === 0) ? 'none' : 'auto';
    } else {
        paginationContainer.style.display = 'none';
    }

    pagedHistory.forEach((h, index) => {
        const item = document.createElement('div');
        const isExpense = h.record_type === 'expense';
        item.className = 'user-card'; // v59 Match User Cards
        item.style.cursor = 'default';
        item.style.marginBottom = '25px';
        item.style.textAlign = 'left';

        const amountColor = isExpense ? '#ef4444' : '#10b981';
        const amountPrefix = isExpense ? '-' : '+';
        const typeStr = isExpense ? 'Expense' : 'Sale';

        let html = `
            <div class="user-card-index">${start + index + 1}</div>
            <div class="user-all-info-list" style="display: flex; flex-direction: column; gap: 8px;">
        `;

        html += `
            <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Amount</span>
                <span style="font-size: 1.1rem; font-weight: 800; color: ${amountColor};">${amountPrefix}$${parseFloat(h.amount_usd).toLocaleString()}</span>
            </div>
        `;

        if (!isExpense && h.user_id) {
            html += `
            <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">User ID</span>
                <span style="font-size: 0.9rem; font-weight: 600; color: #f59e0b; font-family: monospace;">${h.user_id}</span>
            </div>
            `;
        }

        html += `
            <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Reason</span>
                <span style="font-size: 0.9rem; font-weight: 600; color: #fbbf24; text-align: right; max-width: 60%;">${h.description || '-'}</span>
            </div>
            <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Type</span>
                <span style="font-size: 0.9rem; font-weight: 800; color: ${isExpense ? '#ef4444' : '#a855f7'}; text-transform: uppercase;">${typeStr}</span>
            </div>
            <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Date</span>
                <span style="font-size: 0.85rem; color: #60a5fa; font-weight: 600;">${h.created_at}</span>
            </div>
            </div>

        `;

        item.innerHTML = html;
        list.appendChild(item);
    });
}

// Finance Pagination Helpers v59
function prevFinancePage() {
    if (currentFinancePage > 1) {
        currentFinancePage--;
        tg.HapticFeedback.impactOccurred('light');
        renderFinance();
        window.scrollTo({ top: document.getElementById('finance-section').offsetTop - 100, behavior: 'smooth' });
    }
}

function nextFinancePage() {
    if (!financeDataCache) return;
    const totalPages = Math.ceil(financeDataCache.history.length / financePerPage);
    if (currentFinancePage < totalPages) {
        currentFinancePage++;
        tg.HapticFeedback.impactOccurred('light');
        renderFinance();
        window.scrollTo({ top: document.getElementById('finance-section').offsetTop - 100, behavior: 'smooth' });
    }
}

// Modal control functions moved to top (v27)

async function submitSale() {
    const amount = document.getElementById('sale-amount').value;
    const points = document.getElementById('sale-points').value;
    const userId = document.getElementById('sale-user-id').value;
    let note = document.getElementById('sale-note').value;
    if (note === 'Other') {
        note = document.getElementById('sale-note-other').value;
    }

    if (!amount || !note || !userId) {
        const alertBox = document.getElementById('sale-alert');
        alertBox.innerHTML = '<i class="fas fa-exclamation-circle" style="margin-right: 5px;"></i> Please fill in all required fields.';
        alertBox.style.background = 'rgba(239, 68, 68, 0.1)';
        alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        alertBox.style.color = '#ef4444';
        alertBox.style.padding = '12px';
        alertBox.style.borderRadius = '12px';
        alertBox.style.fontSize = '0.85rem';
        alertBox.style.fontWeight = '600';
        alertBox.style.textAlign = 'center';
        alertBox.style.display = 'block';
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
            document.getElementById('sale-note').value = 'New Deposit';
            document.getElementById('sale-dropdown-selected').innerText = 'New Deposit';
            document.getElementById('sale-note-other').value = '';
            document.getElementById('sale-other-container').style.display = 'none';
        }
    } catch (err) {
        console.error("Sale submission error:", err);
    }
}

async function submitExpense() {
    const amount = document.getElementById('expense-amount').value;
    let note = document.getElementById('expense-note').value;
    if (note === 'Other') {
        note = document.getElementById('expense-note-other').value;
    }

    if (!amount || !note) {
        const alertBox = document.getElementById('expense-alert');
        alertBox.innerHTML = '<i class="fas fa-exclamation-circle" style="margin-right: 5px;"></i> Please enter amount and reason.';
        alertBox.style.background = 'rgba(239, 68, 68, 0.1)';
        alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        alertBox.style.color = '#ef4444';
        alertBox.style.padding = '12px';
        alertBox.style.borderRadius = '12px';
        alertBox.style.fontSize = '0.85rem';
        alertBox.style.fontWeight = '600';
        alertBox.style.textAlign = 'center';
        alertBox.style.display = 'block';
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
            document.getElementById('expense-note').value = 'Prize';
            document.getElementById('expense-dropdown-selected').innerText = 'Prize';
            document.getElementById('expense-note-other').value = '';
            document.getElementById('expense-other-container').style.display = 'none';
        }
    } catch (err) {
        console.error("Expense submission error:", err);
    }
}

// Custom Dropdown Logic for Finance Modals (v67)
function toggleSaleDropdown() {
    const list = document.getElementById('sale-dropdown-list');
    const icon = document.getElementById('sale-dropdown-icon');
    if (list.style.display === 'none') {
        list.style.display = 'flex';
        icon.style.transform = 'rotate(180deg)';
    } else {
        list.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

function selectSaleOption(value) {
    document.getElementById('sale-note').value = value;
    document.getElementById('sale-dropdown-selected').innerText = value;
    document.getElementById('sale-other-container').style.display = (value === 'Other') ? 'block' : 'none';
    document.getElementById('sale-alert').style.display = 'none';
    toggleSaleDropdown();
}

function toggleExpenseDropdown() {
    const list = document.getElementById('expense-dropdown-list');
    const icon = document.getElementById('expense-dropdown-icon');
    if (list.style.display === 'none') {
        list.style.display = 'flex';
        icon.style.transform = 'rotate(180deg)';
    } else {
        list.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

function selectExpenseOption(value) {
    document.getElementById('expense-note').value = value;
    document.getElementById('expense-dropdown-selected').innerText = value;
    document.getElementById('expense-other-container').style.display = (value === 'Other') ? 'block' : 'none';
    document.getElementById('expense-alert').style.display = 'none';
    toggleExpenseDropdown();
}

// Coupons Logic (v69 Backend Integration)
async function generateCoupon() {
    const points = document.getElementById('coupon-points').value;
    const uses = document.getElementById('coupon-uses').value;

    if (!points || !uses) {
        showErrorPopup("Missing Info", "Please enter points value and max uses.");
        return;
    }

    tg.HapticFeedback.impactOccurred('medium');
    showLoader(true);

    try {
        const res = await fetch('/api/coupons/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points, uses, code: "" })
        });

        if (res.ok) {
            const data = await res.json();
            showSuccessPopup("Coupon Created", `Your coupon code (${data.code}) has been generated successfully.`);

            document.getElementById('coupon-points').value = '';
            document.getElementById('coupon-uses').value = '';
            loadCoupons();
        } else {
            showErrorPopup("Error", "Failed to create coupon.");
        }
    } catch (err) {
        console.error(err);
        showErrorPopup("Error", "Could not connect to server.");
    } finally {
        hideLoader();
    }
}

let currentCouponFilter = 'active';
let currentCouponsPage = 1;
const couponsPerPage = 5;

function setCouponFilter(type) {
    currentCouponFilter = type;
    currentCouponsPage = 1; // Reset to page 1 on filter change
    document.getElementById('coupon-tab-active').classList.toggle('active', type === 'active');
    document.getElementById('coupon-tab-finished').classList.toggle('active', type === 'finished');
    loadCoupons();
}

async function loadCoupons() {
    try {
        const res = await fetch('/api/coupons');
        if (!res.ok) return;
        const data = await res.json();

        const listContainer = document.getElementById('coupons-list-container');

        const activeCoupons = data.coupons.filter(c => c.is_active && c.current_uses < c.max_uses);
        const finishedCoupons = data.coupons.filter(c => !c.is_active || c.current_uses >= c.max_uses);

        // Update Coupons Page Top Stats (v102)
        if (document.getElementById('coupon-stat-active')) {
            document.getElementById('coupon-stat-active').innerText = activeCoupons.length;
            document.getElementById('coupon-stat-finished').innerText = finishedCoupons.length;
        }

        const filteredList = currentCouponFilter === 'active' ? activeCoupons : finishedCoupons;

        // Pagination logic
        const totalCount = filteredList.length;
        const totalPages = Math.ceil(totalCount / couponsPerPage);
        if (currentCouponsPage > totalPages && totalPages > 0) currentCouponsPage = totalPages;

        const start = (currentCouponsPage - 1) * couponsPerPage;
        const end = start + couponsPerPage;
        const pagedCoupons = filteredList.slice(start, end);

        // Update Pagination UI
        const paginationContainer = document.getElementById('coupons-pagination-container');
        const prevBtn = document.getElementById('coupons-prev-btn');
        const nextBtn = document.getElementById('coupons-next-btn');
        const pageInfo = document.getElementById('coupons-page-info');

        if (totalCount > couponsPerPage) {
            paginationContainer.style.display = 'flex';
            pageInfo.innerText = `Page ${currentCouponsPage} of ${totalPages || 1}`;
            prevBtn.style.opacity = currentCouponsPage === 1 ? '0.3' : '1';
            prevBtn.style.pointerEvents = currentCouponsPage === 1 ? 'none' : 'auto';
            nextBtn.style.opacity = (currentCouponsPage === totalPages || totalPages === 0) ? '0.3' : '1';
            nextBtn.style.pointerEvents = (currentCouponsPage === totalPages || totalPages === 0) ? 'none' : 'auto';
        } else {
            paginationContainer.style.display = 'none';
        }

        function createRow(c, isFinished, displayIndex) {
            const div = document.createElement('div');
            div.className = 'user-card';
            div.style.padding = '25px 20px 20px 20px'; // Top padding for the index badge
            div.style.marginBottom = '25px'; // Increased margin for spacing
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.gap = '8px';
            div.style.position = 'relative';
            div.style.cursor = 'default';

            div.innerHTML = `
                <!-- Card Index Badge (v76) -->
                <div class="user-card-index" style="width: 28px; height: 28px; font-size: 0.8rem; top: -14px;">${displayIndex}</div>

                <!-- Boxed Info Fields -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Coupon Box (v97: Click to Copy) -->
                    <div onclick="copyToClipboard('${c.code}')" 
                         style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s;">
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Coupon</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-family: monospace; font-size: 1rem; font-weight: 800; color: #22d3ee;">${c.code}</span>
                            <i class="far fa-copy" style="font-size: 0.8rem; color: #22d3ee; opacity: 0.6;"></i>
                        </div>
                    </div>

                    <!-- Points Box -->
                    <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Points</span>
                        <span style="font-size: 0.95rem; font-weight: 700; color: #ffd700;">${c.points}</span>
                    </div>

                    <!-- Uses Box -->
                    <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Uses</span>
                        <span style="font-size: 0.95rem; font-weight: 700; color: #f59e0b;">${c.current_uses} / ${c.max_uses}</span>
                    </div>

                    <!-- Date Box -->
                    <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Date</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: #60a5fa;">${c.created_at}</span>
                    </div>

                    ${!isFinished ? `
                    <!-- Delete Box Action -->
                    <div onclick="deleteCoupon('${c.code}')" style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: center; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s;">
                        <i class="fas fa-trash" style="color: #ef4444; font-size: 0.9rem;"></i>
                        <span style="font-size: 0.8rem; color: #ef4444; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Delete Coupon</span>
                    </div>` : `
                    <!-- Deactivated Status Box (v77 Restored) -->
                    <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: center; align-items: center; gap: 10px; opacity: 0.7;">
                        <i class="fas fa-check-circle" style="color: #64748b; font-size: 0.9rem;"></i>
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Finished / Inactive</span>
                    </div>
                    `}
                </div>
            `;
            return div;
        }

        listContainer.innerHTML = '';
        if (pagedCoupons.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 50px 20px; text-align: center;">
                    <i class="fas fa-folder-open" style="font-size: 3rem; color: #1e293b; margin-bottom: 15px;"></i>
                    <p style="color: #64748b; font-size: 0.9rem;">No ${currentCouponFilter} coupons found.</p>
                </div>`;
        } else {
            pagedCoupons.forEach((c, idx) => {
                const displayIndex = start + idx + 1;
                listContainer.appendChild(createRow(c, currentCouponFilter === 'finished', displayIndex));
            });
        }

    } catch (err) {
        console.error("Load coupons error:", err);
    }
}

function prevCouponsPage() {
    if (currentCouponsPage > 1) {
        currentCouponsPage--;
        tg.HapticFeedback.impactOccurred('light');
        loadCoupons();
    }
}

function nextCouponsPage() {
    // We need the latest data to know total pages, but loadCoupons handles it.
    // However, for immediate UI feedback:
    currentCouponsPage++;
    tg.HapticFeedback.impactOccurred('light');
    loadCoupons();
}



async function deleteCoupon(code) {
    showConfirmPopup(
        "Delete Coupon", 
        `Are you sure you want to delete this coupon (${code})? This action cannot be undone.`,
        async () => {
            tg.HapticFeedback.impactOccurred('light');
            showLoader(true);

            try {
                const res = await fetch('/api/coupons/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                if (res.ok) {
                    showSuccessPopup("Deleted Successfully", "The coupon has been deactivated and removed from active pools.");
                    loadCoupons();
                }
            } catch (err) {
                console.error(err);
            } finally {
                hideLoader();
            }
        }
    );
}
// --- Orders Management (v113) ---
async def loadOrders() {
    try {
        const response = await fetch('/api/orders');
        const orders = await response.json();
        renderOrders(orders);
    } catch (e) {
        console.error("Failed to load orders:", e);
    }
}

function renderOrders(orders) {
    const container = document.getElementById('orders-list-table');
    if (!container) return;
    
    if (!orders || orders.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">No orders found</div>';
        return;
    }
    
    container.innerHTML = orders.map(o => {
        const statusColor = o.status === 'active' ? '#3b82f6' : (o.status === 'completed' ? '#10b981' : '#ef4444');
        return `
            <div class="card" style="margin-bottom: 12px; padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <div style="font-weight: 800; color: #fff; font-size: 0.95rem;">${o.chat_name}</div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">Owner ID: ${o.user_id}</div>
                    </div>
                    <div style="padding: 4px 10px; border-radius: 6px; background: ${statusColor}22; color: ${statusColor}; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">
                        ${o.status}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div style="color: #94a3b8; font-size: 0.8rem;">Required: <span style="color: #fff; font-weight: 700;">${o.required_members}</span></div>
                    <div style="color: #94a3b8; font-size: 0.8rem;">Current: <span style="color: #fff; font-weight: 700;">${o.current_members}</span></div>
                    <div style="color: #94a3b8; font-size: 0.8rem;">Progress: <span style="color: #fff; font-weight: 700;">${Math.round((o.current_members/o.required_members)*100)}%</span></div>
                </div>
                <div style="display: flex; gap: 8px;">
                    ${o.status === 'active' ? 
                        `<button onclick="updateOrderStatus(${o.id}, 'cancelled')" style="flex: 1; padding: 8px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">Cancel</button>` : 
                        `<button onclick="updateOrderStatus(${o.id}, 'active')" style="flex: 1; padding: 8px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">Activate</button>`
                    }
                    <button onclick="updateOrderStatus(${o.id}, 'delete')" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; font-size: 0.8rem; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async def updateOrderStatus(orderId, status) {
    if (status === 'delete' && !confirm("Are you sure you want to delete this order?")) return;
    
    try {
        const response = await fetch('/api/orders/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: orderId, status: status})
        });
        if (response.ok) {
            tg.HapticFeedback.notificationOccurred('success');
            loadOrders();
        }
    } catch (e) {
        console.error("Update failed:", e);
    }
}

// --- Reports Management (v113) ---
async def loadReports() {
    try {
        const response = await fetch('/api/reports');
        const reports = await response.json();
        renderReports(reports);
    } catch (e) {
        console.error("Failed to load reports:", e);
    }
}

function renderReports(reports) {
    const container = document.getElementById('reports-list-table');
    if (!container) return;
    
    if (!reports || reports.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">No reports found</div>';
        return;
    }
    
    container.innerHTML = reports.map(r => `
        <div class="card" style="margin-bottom: 12px; padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-weight: 800; color: #fff; font-size: 0.95rem;">Report #${r.id}</div>
                <div style="font-size: 0.75rem; color: #64748b;">${r.created_at}</div>
            </div>
            <div style="margin-bottom: 15px;">
                <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 4px;">Reported by: <span style="color: #fff; font-weight: 700;">${r.user_name}</span></div>
                <div style="font-size: 0.85rem; color: #94a3b8;">Target Channel: <span style="color: #3b82f6; font-weight: 700;">${r.chat_name}</span></div>
            </div>
            <button onclick="dismissReport(${r.id})" style="width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.05); color: #fff; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fas fa-check-circle"></i> Dismiss Report
            </button>
        </div>
    `).join('');
}

async def dismissReport(reportId) {
    try {
        const response = await fetch('/api/reports/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: reportId})
        });
        if (response.ok) {
            tg.HapticFeedback.notificationOccurred('success');
            loadReports();
        }
    } catch (e) {
        console.error("Dismiss failed:", e);
    }
}
