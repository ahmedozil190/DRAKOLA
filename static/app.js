// v45 - User Management Header & Numbered Index Cards
const tg = window.Telegram.WebApp;
tg.expand();

// DOM Elements
const loader = document.getElementById('loader');
const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');
const pageTitle = document.getElementById('page-title');

// --- Global UI State v116 ---
let currentOrdersPage = 1;
const ordersPerPage = 5;
let allOrdersData = [];
 
// --- Telegram Avatar Colors v141 ---
const TG_AVATAR_COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#a855f7', // Purple
    '#ec4899'  // Pink
];

function getTelegramColor(userId) {
    if (!userId) return '#3b82f6';
    const idNum = parseInt(userId) || 0;
    return TG_AVATAR_COLORS[idNum % TG_AVATAR_COLORS.length];
}

// --- Admin Profile Auto-Refresh (v135) ---
let profileRefreshInterval = null;

// --- Channels State (v58) ---
let currentChannelsPage = 1;
const channelsPerPage = 5;
let allChannelsData = [];

// --- Reports Pagination State (v65) ---
let currentReportsPage = 1;
const reportsPerPage = 5;

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
    // Initial Setup - Admin Profile
    const user = tg.initDataUnsafe?.user;
    if (user) {
        initAdminProfile(user);
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

function scrollToFirstCard(listId) {
    const listElement = document.getElementById(listId);
    const scroller = document.getElementById('app-content-scroller');
    if (scroller && listElement) {
        const listTop = listElement.getBoundingClientRect().top;
        const scrollerTop = scroller.getBoundingClientRect().top;
        const targetScrollTop = scroller.scrollTop + (listTop - scrollerTop) - 20;
        scroller.style.scrollBehavior = 'auto';
        scroller.scrollTop = targetScrollTop;
        setTimeout(() => { scroller.style.scrollBehavior = 'smooth'; }, 50);
    }
}

// v119: Global State Reset Function
function resetDashboardState(viewId) {
    // Reset Scroll (v119 Force Instant)
    const scroller = document.getElementById('app-content-scroller');
    if (scroller) {
        scroller.style.scrollBehavior = 'auto';
        scroller.scrollTop = 0;
        setTimeout(() => { scroller.style.scrollBehavior = 'smooth'; }, 50);
    } else {
        window.scrollTo(0, 0);
    }

    // Reset Users
    userFilter = 'active';
    currentPage = 1;
    const userSearch = document.getElementById('user-search');
    if (userSearch) userSearch.value = '';
    const userResetSearch = document.getElementById('reset-search-container');
    if (userResetSearch) userResetSearch.style.display = 'none';

    // Reset Finance
    currentFinanceFilter = 'sale';
    currentFinancePage = 1;

    // Reset Orders
    currentOrderTab = 'pending';
    currentOrdersPage = 1;
    orderFilterText = '';
    const orderSearch = document.getElementById('order-search');
    if (orderSearch) orderSearch.value = '';
    const resetOrderSearch = document.getElementById('reset-order-search-container');
    if (resetOrderSearch) resetOrderSearch.style.display = 'none';

    // Reset Reports
    currentReportFilter = 'pending';

    // Reset Coupons
    currentCouponFilter = 'active';

    // Reset Channels (v58)
    currentChannelsPage = 1;

    // Sync UI Tabs (v119)
    syncAllTabUI();
}

function syncAllTabUI() {
    // Users
    document.querySelectorAll('#users-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById('tab-active')) document.getElementById('tab-active').classList.add('active');

    // Finance
    document.querySelectorAll('#finance-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById('finance-tab-sale')) document.getElementById('finance-tab-sale').classList.add('active');

    // Orders
    document.querySelectorAll('#orders-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById('order-tab-pending')) document.getElementById('order-tab-pending').classList.add('active');

    // Reports
    document.querySelectorAll('#reports-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById('report-tab-pending')) document.getElementById('report-tab-pending').classList.add('active');

    // Coupons
    document.querySelectorAll('#coupons-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById('coupon-tab-active')) document.getElementById('coupon-tab-active').classList.add('active');
}

function switchNav(viewId) {
    tg.HapticFeedback.selectionChanged();

    // Reset Scroll Position (v119 Force Instant)
    const scroller = document.getElementById('app-content-scroller');
    if (scroller) {
        scroller.style.scrollBehavior = 'auto';
        scroller.scrollTop = 0;
        setTimeout(() => { scroller.style.scrollBehavior = 'smooth'; }, 50);
    } else {
        window.scrollTo(0, 0);
    }

    // PERSISTENCE v48: Save current view to session storage
    sessionStorage.setItem('last_view', viewId);

    // Smoothly close menu and overlay
    sideMenu.classList.remove('active');
    menuOverlay.classList.remove('active');

    // Reset Dashboard State (v119)
    resetDashboardState(viewId);

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
        'reports': 'Reports',
        'admin-profile': 'Admin Profile'
    };
    pageTitle.innerText = titles[viewId];

    // Reload Data for specific sections if needed (Pagination already reset to 1)
    if (viewId === 'admin-profile') {
        refreshAdminProfile();
        loadAdmins();
        // v135: Start auto-refresh every 30 seconds while on admin profile
        if (profileRefreshInterval) clearInterval(profileRefreshInterval);
        profileRefreshInterval = setInterval(() => {
            refreshAdminProfile();
            loadAdmins(false); // v136: Refresh list in background (preserves page)
        }, 30000);
    } else {
        // Stop auto-refresh when leaving admin profile page
        if (profileRefreshInterval) {
            clearInterval(profileRefreshInterval);
            profileRefreshInterval = null;
        }
        if (viewId === 'users') {
            loadUsers();
        } else if (viewId === 'finance') {
            currentFinancePage = 1;
            loadFinanceData();
        } else if (viewId === 'coupons') {
            currentCouponsPage = 1;
            loadCoupons();
            const scroller = document.getElementById('app-content-scroller');
            if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (viewId === 'orders') {
            currentOrdersPage = 1;
            loadOrders();
        } else if (viewId === 'reports') {
            loadReports();
        }
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

    // Reports section mapping
    if (document.getElementById('stat-total-reports-home')) {
        document.getElementById('stat-total-reports-home').innerText = stats.total_reports || 0;
        document.getElementById('stat-accepted-reports-home').innerText = stats.accepted_reports || 0;
        document.getElementById('stat-rejected-reports-home').innerText = stats.rejected_reports || 0;
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
    
    // Bot Links
    if (document.getElementById('instruction-link-input')) {
        const iLink = settings.instruction_link || "";
        const rLink = settings.rules_link || "";
        const bLink = settings.buy_points_link || "";

        document.getElementById('instruction-link-input').value = (iLink === "https://") ? "" : iLink;
        document.getElementById('rules-link-input').value = (rLink === "https://") ? "" : rLink;
        document.getElementById('buy-points-link-input').value = (bLink === "https://") ? "" : bLink;
        document.getElementById('support-username-input').value = settings.support_username || "";
    }

    // Points & Rewards
    if (document.getElementById('referral-reward-input')) {
        document.getElementById('referral-reward-input').value = settings.referral_reward || 100;
        document.getElementById('join-reward-input').value = settings.join_reward || 10;
        document.getElementById('member-cost-input').value = settings.member_cost || 15;
        document.getElementById('min-order-members-input').value = settings.min_order_members || 5;
        document.getElementById('min-points-to-order-input').value = settings.min_points_to_order || 300;
        document.getElementById('leave-penalty-input').value = settings.leave_penalty_multiplier || 2;
        document.getElementById('penalty-enabled-toggle').checked = (settings.penalty_enabled !== false);
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

    allChannelsData = [...(settings.channels || [])].reverse();
    renderChannels();
}

function prevChannelsPage() {
    if (currentChannelsPage > 1) {
        currentChannelsPage--;
        tg.HapticFeedback.impactOccurred('light');
        renderChannels();
        scrollToFirstCard('channels-list');
    }
}

function nextChannelsPage() {
    const total = allChannelsData.length;
    const maxPage = Math.ceil(total / channelsPerPage);
    if (currentChannelsPage < maxPage) {
        currentChannelsPage++;
        tg.HapticFeedback.impactOccurred('light');
        renderChannels();
        scrollToFirstCard('channels-list');
    }
}

function renderChannels() {
    const list = document.getElementById('channels-list');
    const paginationContainer = document.getElementById('channels-pagination-container');
    const pageInfo = document.getElementById('channels-page-info');
    const prevBtn = document.getElementById('channels-prev-btn');
    const nextBtn = document.getElementById('channels-next-btn');

    if (!list) return;
    list.innerHTML = '';

    const channels = allChannelsData;
    const total = channels.length;

    if (total === 0) {
        list.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 0.9rem;">No managed channels yet.</div>`;
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }

    // Pagination Logic
    const maxPage = Math.max(1, Math.ceil(total / channelsPerPage));
    if (currentChannelsPage > maxPage) currentChannelsPage = maxPage;

    const start = (currentChannelsPage - 1) * channelsPerPage;
    const end = start + channelsPerPage;
    const paginated = channels.slice(start, end);

    if (total > channelsPerPage) {
        if (paginationContainer) {
            paginationContainer.style.display = 'flex';
            if (pageInfo) pageInfo.innerText = `Page ${currentChannelsPage} of ${maxPage}`;

            // Exact Users Matching Logic
            if (prevBtn) {
                prevBtn.style.opacity = currentChannelsPage === 1 ? '0.3' : '1';
                prevBtn.style.pointerEvents = currentChannelsPage === 1 ? 'none' : 'auto';
            }
            if (nextBtn) {
                nextBtn.style.opacity = currentChannelsPage === maxPage ? '0.3' : '1';
                nextBtn.style.pointerEvents = currentChannelsPage === maxPage ? 'none' : 'auto';
            }
        }
    } else {
        if (paginationContainer) paginationContainer.style.display = 'none';
    }

    paginated.forEach((ch, index) => {
        const absoluteIndex = start + index + 1;
        const div = document.createElement('div');
        div.className = 'card user-card'; // Matching Users Card Class
        div.style.padding = '18px';
        div.style.paddingTop = '25px'; // Force same padding as Users
        div.style.background = 'rgba(255, 255, 255, 0.02)';
        div.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        div.style.borderRadius = '16px';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '12px';
        // Position relative is already in .user-card from index.html

        div.innerHTML = `
            <!-- Exact Users Numbering Style (v59) -->
            <div class="user-card-index">${absoluteIndex}</div>

            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">
                <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; flex-shrink: 0; margin-top: 2px;">Username</span>
                <span style="font-size: 0.95rem; font-weight: 700; color: #ffd700; word-break: break-all; text-align: right;">${ch.id}</span>
            </div>
            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Link</span>
                <span style="font-size: 0.85rem; color: #3b82f6; word-break: break-all; font-family: monospace; max-width: 60%; text-align: right;">${ch.link}</span>
            </div>
            <div style="margin-top: 5px;">
                <button class="modal-action-btn btn-sub" onclick="deleteChannel('${ch.id}')" 
                        style="width: 100%; justify-content: center; padding: 14px; font-size: 0.9rem; border-radius: 14px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">
                    <i class="fas fa-trash-alt"></i> Delete Channel
                </button>
            </div>
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
        bot_name: document.getElementById('bot-name-input')?.value || "Billion Bot",
        instruction_link: document.getElementById('instruction-link-input')?.value || "",
        rules_link: document.getElementById('rules-link-input')?.value || "",
        buy_points_link: document.getElementById('buy-points-link-input')?.value || "",
        support_username: document.getElementById('support-username-input')?.value || "",
        referral_reward: parseInt(document.getElementById('referral-reward-input')?.value || 100),
        join_reward: parseInt(document.getElementById('join-reward-input')?.value || 10),
        member_cost: parseInt(document.getElementById('member-cost-input')?.value || 15),
        min_order_members: parseInt(document.getElementById('min-order-members-input')?.value || 5),
        min_points_to_order: parseInt(document.getElementById('min-points-to-order-input')?.value || 300),
        leave_penalty_multiplier: parseInt(document.getElementById('leave-penalty-input')?.value || 2),
        penalty_enabled: document.getElementById('penalty-enabled-toggle')?.checked
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

            // Instantly update sidebar title (v121 Fix)
            const sideMenuTitle = document.querySelector('.side-menu-title');
            if (sideMenuTitle) {
                sideMenuTitle.innerText = data.bot_name;
            }
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
    document.getElementById('subview-bot-profile').style.display = 'none';
    document.getElementById('subview-prices').style.display = 'none';
    document.getElementById('subview-channels-config').style.display = 'none';
    document.getElementById('subview-points').style.display = 'none';
    document.getElementById('subview-penalty').style.display = 'none';

    // Show selected subview
    document.getElementById(`subview-${viewId}`).style.display = 'block';
}

function hideSettingsSubView() {
    // If we're already on the main menu, don't do anything
    if (document.getElementById('settings-main-menu').style.display === 'block') return;

    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('settings-main-menu').style.display = 'block';
    document.getElementById('subview-bot-profile').style.display = 'none';
    document.getElementById('subview-prices').style.display = 'none';
    document.getElementById('subview-points').style.display = 'none';
    document.getElementById('subview-channels-config').style.display = 'none';
    document.getElementById('subview-penalty').style.display = 'none';
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
    const idInput = document.getElementById('new-channel-id');
    const linkInput = document.getElementById('new-channel-link');
    const id = idInput.value;
    const link = linkInput.value;
    if (!id || !link) return;

    const res = await fetch('/api/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, link })
    });

    if (res.ok) {
        showSuccessPopup("Channel Added!", "The new channel has been added to your subscription list successfully. ✨");
        // Clear inputs immediately
        idInput.value = '';
        linkInput.value = '';
        loadInitialData();
    } else {
        tg.showAlert("Failed to add channel. Please check the ID and Link.");
    }
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
let userFilter = 'active';
let currentPage = 1;
const usersPerPage = 5;
let totalFilteredCount = 0;

async function loadUsers() {
    showLoader(true);
    try {
        const res = await fetch('/api/users');
        allUsers = await res.json();

        // Sorting: Newest First (High ID First) v117
        allUsers.sort((a, b) => b.user_id - a.user_id);

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
    if (userFilter === 'active') {
        filtered = allUsers.filter(u => !u.is_banned);
    } else if (userFilter === 'banned') {
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
        scrollToFirstCard('users-list');
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalFilteredCount / usersPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        tg.HapticFeedback.impactOccurred('light');
        applyUserFilter();
        scrollToFirstCard('users-list');
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
                <b>No users found currently!</b>
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

    const modal = document.getElementById('confirm-modal');
    modal.style.display = 'flex'; // Force display (v131)
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    tg.HapticFeedback.notificationOccurred('warning');
}

function closeConfirmPopup(confirmed = false) {
    if (!confirmed) tg.HapticFeedback.impactOccurred('light');
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none'; // Ensure hidden v131
    }, 300);
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
let currentFinanceFilter = 'sale';

function setFinanceFilter(filter) {
    currentFinanceFilter = filter;
    currentFinancePage = 1;
    document.querySelectorAll('#finance-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(`finance-tab-${filter}`);
    if (target) target.classList.add('active');
    renderFinance();
}

async function loadFinanceData() {
    showLoader(true);
    try {
        const res = await fetch('/api/finance');
        if (!res.ok) throw new Error("API error");
        financeDataCache = await res.json();

        // Sorting: Newest First (High ID/Recent date first) v117
        if (financeDataCache.history) {
            financeDataCache.history.sort((a, b) => b.id - a.id);
        }

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

    // Filter by type (v117)
    let filteredHistory = data.history || [];
    if (currentFinanceFilter === 'sale') {
        filteredHistory = filteredHistory.filter(h => h.record_type === 'sale');
    } else if (currentFinanceFilter === 'expense') {
        filteredHistory = filteredHistory.filter(h => h.record_type === 'expense');
    }

    // Pagination Logic (v59)
    const totalTransactions = filteredHistory.length;
    const totalPages = Math.ceil(totalTransactions / financePerPage);
    if (currentFinancePage > totalPages && totalPages > 0) currentFinancePage = totalPages;

    const start = (currentFinancePage - 1) * financePerPage;
    const end = start + financePerPage;
    const pagedHistory = filteredHistory.slice(start, end);

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
        scrollToFirstCard('finance-history-list');
    }
}

function nextFinancePage() {
    if (!financeDataCache) return;
    const totalPages = Math.ceil(financeDataCache.history.length / financePerPage);
    if (currentFinancePage < totalPages) {
        currentFinancePage++;
        tg.HapticFeedback.impactOccurred('light');
        renderFinance();
        scrollToFirstCard('finance-history-list');
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
    const scroller = document.getElementById('app-content-scroller');
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadCoupons() {
    try {
        const res = await fetch('/api/coupons');
        if (!res.ok) return;
        const data = await res.json();

        // Sorting: Newest First (High ID weight or Date) v117
        data.coupons.sort((a, b) => b.id - a.id);

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
        scrollToFirstCard('coupons-list-container');
    }
}

function nextCouponsPage() {
    // We need the latest data to know total pages, but loadCoupons handles it.
    // However, for immediate UI feedback:
    currentCouponsPage++;
    tg.HapticFeedback.impactOccurred('light');
    loadCoupons();
    scrollToFirstCard('coupons-list-container');
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
async function loadOrders() {
    try {
        const response = await fetch(`/api/orders?t=${new Date().getTime()}`);
        const orders = await response.json();

        // Sorting: Newest First (High ID first) v117
        orders.sort((a, b) => b.order_id - a.order_id);

        allOrdersData = orders; // Cache for pagination

        // Update summary stats v115
        if (document.getElementById('orders-stat-total')) {
            document.getElementById('orders-stat-total').innerText = orders.length;
            document.getElementById('orders-stat-active').innerText = orders.filter(o => o.status === 'active').length;
            document.getElementById('orders-stat-completed').innerText = orders.filter(o => o.status === 'completed').length;
            document.getElementById('orders-stat-cancelled').innerText = orders.filter(o => o.status === 'cancelled').length;
        }

        applyOrdersPagination();
    } catch (e) {
        console.error("Failed to load orders:", e);
    }
}

let orderFilterText = '';
let currentOrderTab = 'pending';

function setOrderFilter(filter) {
    currentOrderTab = filter;
    currentOrdersPage = 1;
    document.querySelectorAll('#orders-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(`order-tab-${filter}`);
    if (target) target.classList.add('active');
    applyOrdersPagination();
}

function triggerOrderSearch() {
    const query = document.getElementById('order-search').value.trim();
    const resetBtn = document.getElementById('reset-order-search-container');

    if (query) {
        resetBtn.style.display = 'flex';
    } else {
        resetBtn.style.display = 'none';
        orderFilterText = '';
        applyOrdersPagination();
        return;
    }

    orderFilterText = query.toLowerCase();

    // Global Search Auto-Switch (v119)
    if (orderFilterText) {
        // Try finding match across all data to auto-switch tab
        const match = allOrdersData.find(o =>
            (o.chat_name && o.chat_name.toLowerCase().includes(orderFilterText)) ||
            (o.chat_username && o.chat_username.toLowerCase().includes(orderFilterText.replace('@', ''))) ||
            (o.order_id && o.order_id.toString().includes(orderFilterText)) ||
            (o.user_id && o.user_id.toString().includes(orderFilterText))
        );

        if (match) {
            let targetTab = 'pending';
            if (match.status === 'completed') targetTab = 'finished';
            else if (match.status === 'cancelled') targetTab = 'rejected';

            if (targetTab !== currentOrderTab) {
                currentOrderTab = targetTab;
                // Sync UI
                document.querySelectorAll('#orders-section .tab-btn').forEach(btn => btn.classList.remove('active'));
                const btn = document.getElementById(`order-tab-${targetTab}`);
                if (btn) btn.classList.add('active');
            }
        }
    }

    tg.HapticFeedback.impactOccurred('light');
    currentOrdersPage = 1; // Reset to page 1
    applyOrdersPagination();
}

function resetOrderSearch() {
    document.getElementById('order-search').value = '';
    document.getElementById('reset-order-search-container').style.display = 'none';
    orderFilterText = '';
    tg.HapticFeedback.impactOccurred('light');
    currentOrdersPage = 1;
    applyOrdersPagination();
}

function applyOrdersPagination() {
    let filteredOrders = allOrdersData;

    // Apply tab filter (v117)
    if (currentOrderTab === 'pending') {
        filteredOrders = filteredOrders.filter(o => o.status === 'active');
    } else if (currentOrderTab === 'finished') {
        filteredOrders = filteredOrders.filter(o => o.status === 'completed');
    } else if (currentOrderTab === 'rejected') {
        filteredOrders = filteredOrders.filter(o => o.status === 'cancelled');
    }

    // Apply search filter if active
    if (orderFilterText) {
        const cleanFilter = orderFilterText.replace('@', '');
        filteredOrders = filteredOrders.filter(o =>
            (o.user_id && o.user_id.toString().includes(orderFilterText)) ||
            (o.chat_name && o.chat_name.toLowerCase().includes(orderFilterText)) ||
            (o.chat_username && o.chat_username.toLowerCase().includes(cleanFilter)) ||
            (o.chat_username && ('@' + o.chat_username.toLowerCase()).includes(orderFilterText))
        );
    }

    const totalOrders = filteredOrders.length;
    const totalPages = Math.ceil(totalOrders / ordersPerPage);

    // Safety check for empty results or page bounds
    if (currentOrdersPage > totalPages && totalPages > 0) currentOrdersPage = totalPages;
    if (currentOrdersPage < 1) currentOrdersPage = 1;

    const start = (currentOrdersPage - 1) * ordersPerPage;
    const end = start + ordersPerPage;
    const pagedOrders = filteredOrders.slice(start, end);

    // Update Pagination UI
    const container = document.getElementById('orders-pagination-container');
    const prevBtn = document.getElementById('orders-prev-btn');
    const nextBtn = document.getElementById('orders-next-btn');
    const pageInfo = document.getElementById('orders-page-info');

    if (totalOrders > ordersPerPage) {
        container.style.display = 'flex';
        pageInfo.innerText = `Page ${currentOrdersPage} of ${totalPages || 1}`;

        prevBtn.style.opacity = currentOrdersPage === 1 ? '0.3' : '1';
        prevBtn.style.pointerEvents = currentOrdersPage === 1 ? 'none' : 'auto';

        nextBtn.style.opacity = currentOrdersPage === totalPages ? '0.3' : '1';
        nextBtn.style.pointerEvents = currentOrdersPage === totalPages ? 'none' : 'auto';
    } else {
        container.style.display = 'none';
    }

    renderOrders(pagedOrders);
}

function prevOrdersPage() {
    if (currentOrdersPage > 1) {
        currentOrdersPage--;
        tg.HapticFeedback.impactOccurred('light');
        applyOrdersPagination();
        scrollToFirstCard('orders-list-table');
    }
}

function nextOrdersPage() {
    const totalPages = Math.ceil(allOrdersData.length / ordersPerPage);
    if (currentOrdersPage < totalPages) {
        currentOrdersPage++;
        tg.HapticFeedback.impactOccurred('light');
        applyOrdersPagination();
        scrollToFirstCard('orders-list-table');
    }
}

function renderOrders(orders) {
    const list = document.getElementById('orders-list-table');
    if (!list) return;
    list.innerHTML = '';

    if (orders.length === 0) {
        list.innerHTML = `
            <div style="padding: 60px 20px 40px 20px; text-align: center; color: #94a3b8; font-size: 0.95rem; font-weight: 500;">
                <div style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.5;">📊</div>
                <b>No orders found!</b><br>
                <p style="margin-top: 8px; font-size: 0.85rem; opacity: 0.8;">• The orders list is currently empty.</p>
            </div>
        `;
        return;
    }

    const startIdx = (currentOrdersPage - 1) * ordersPerPage;

    orders.forEach((o, idx) => {
        const progress = o.required_members > 0 ? Math.round((o.current_members / o.required_members) * 100) : 0;
        const statusColor = o.status === 'active' ? '#10b981' : (o.status === 'completed' ? '#3b82f6' : '#ef4444');

        const card = document.createElement('div');
        card.className = 'user-card';
        card.style.marginBottom = '20px';

        card.innerHTML = `
            <div class="user-card-index">${startIdx + idx + 1}</div>
            <div class="user-all-info-list" style="display: flex; flex-direction: column; gap: 8px;">
                
                <!-- 1. Status -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Order Status</span>
                    <div style="font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px; color: ${statusColor};">
                        <i class="fas ${o.status === 'active' ? 'fa-check' : (o.status === 'completed' ? 'fa-check-double' : 'fa-times')}"></i>
                        ${o.status.toUpperCase()}
                    </div>
                </div>

                <!-- 2. Group / Channel Name -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-tag" style="color: #94a3b8; font-size: 0.8rem;"></i>
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">${['group', 'supergroup'].includes(o.chat_type) ? 'Group Name' : 'Channel Name'}</span>
                    </div>
                    <span style="font-size: 0.9rem; font-weight: 700; color: #ffd700;">${o.chat_name}</span>
                </div>

                <!-- 3. Group Username -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-at" style="color: #94a3b8; font-size: 0.8rem;"></i>
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Username</span>
                    </div>
                    <span style="font-size: 0.85rem; font-weight: 600; color: #60a5fa;">@${o.chat_username || 'no_username'}</span>
                </div>

                <!-- 4. Owner ID -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-id-badge" style="color: #94a3b8; font-size: 0.8rem;"></i>
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Owner ID</span>
                    </div>
                    <span style="font-size: 0.85rem; font-weight: 700; color: #f59e0b; font-family: monospace;">${o.user_id}</span>
                </div>

                <!-- 5. Required -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-users" style="color: #94a3b8; font-size: 0.8rem;"></i>
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Required Members</span>
                    </div>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #c084fc;">${o.required_members}</span>
                </div>

                <!-- 6. Current -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-user-check" style="color: #94a3b8; font-size: 0.8rem;"></i>
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Current Members</span>
                    </div>
                    <span style="font-size: 0.95rem; font-weight: 700; color: #2ecc71;">${o.current_members || 0}</span>
                </div>

                <!-- 7. Progress -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-chart-line" style="color: #94a3b8; font-size: 0.8rem;"></i>
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Execution Progress</span>
                    </div>
                    <span style="color: #06b6d4; font-size: 0.9rem; font-weight: 800;">${progress}%</span>
                </div>

                <!-- Actions -->
                <div style="display: flex; gap: 8px; margin-top: 5px;">
                    <button onclick="updateOrderStatus(${o.id}, '${o.status === 'active' ? 'cancelled' : 'active'}')" 
                        style="flex: 1; padding: 12px; background: linear-gradient(135deg, ${o.status === 'active' ? '#ef4444, #b91c1c' : '#3b82f6, #1d4ed8'}); color: #fff; border: none; border-radius: 12px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 12px ${o.status === 'active' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'};">
                        ${o.status === 'active' ? '<i class="fas fa-times"></i> Reject' : '<i class="fas fa-check"></i> Approve'}
                    </button>
                    <button onclick="updateOrderStatus(${o.id}, 'delete')" 
                        style="padding: 12px 18px; background: #1a1d24; color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; font-size: 0.9rem; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

async function updateOrderStatus(orderId, status) {
    if (status === 'delete' && !confirm("Are you sure you want to delete this order?")) return;

    try {
        const response = await fetch('/api/orders/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: orderId, status: status })
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
let currentReportFilter = 'pending';
let allReportsData = [];

function setReportFilter(filter) {
    currentReportFilter = filter;
    currentReportsPage = 1;
    document.querySelectorAll('#reports-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`report-tab-${filter}`).classList.add('active');
    renderReports(allReportsData);
}

async function loadReports() {
    try {
        const response = await fetch(`/api/reports?t=${new Date().getTime()}`);
        const reports = await response.json();
        allReportsData = reports;
        renderReports(reports);
    } catch (e) {
        console.error("Failed to load reports:", e);
    }
}

function renderReports(reports) {
    // 1. Grouping by Order ID
    const grouped = {};
    reports.forEach(r => {
        if (!grouped[r.order_id]) {
            grouped[r.order_id] = {
                order_id: r.order_id,
                chat_name: r.chat_name,
                chat_username: r.chat_username,
                chat_type: r.chat_type,
                created_at: r.created_at,
                status: r.status, // default to whatever first report has
                count: 0
            };
        }
        grouped[r.order_id].count++;
        // If any report is pending, the whole group is considered pending
        if (r.status === 'pending') {
            grouped[r.order_id].status = 'pending';
        }
    });

    const finalReports = Object.values(grouped).sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        // Newest First within same status (v117)
        return b.order_id - a.order_id;
    });

    if (document.getElementById('reports-stat-total')) {
        const accepted = finalReports.filter(r => r.status === 'accepted').length;
        const rejected = finalReports.filter(r => r.status === 'rejected').length;
        document.getElementById('reports-stat-total').innerText = finalReports.length;
        document.getElementById('reports-stat-accepted').innerText = accepted;
        document.getElementById('reports-stat-rejected').innerText = rejected;
    }

    const container = document.getElementById('reports-list-table');
    if (!container) return;

    // Filter by tab
    const filteredReports = finalReports.filter(r => r.status === currentReportFilter);

    if (!filteredReports || filteredReports.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px 20px 40px 20px; text-align: center; color: #94a3b8; font-size: 0.95rem; font-weight: 500;">
                <div style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.5;">📋</div>
                <b>No reports found!</b><br>
                <p style="margin-top: 8px; font-size: 0.85rem; opacity: 0.8;">• The reports list is currently empty.</p>
            </div>
        `;
        // hide pagination
        const pc = document.getElementById('reports-pagination-container');
        if (pc) pc.style.display = 'none';
        return;
    }

    // --- Pagination slice (v65) ---
    const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
    if (currentReportsPage > totalPages) currentReportsPage = totalPages;
    const start = (currentReportsPage - 1) * reportsPerPage;
    const pageReports = filteredReports.slice(start, start + reportsPerPage);

    // Update pagination UI
    const pc = document.getElementById('reports-pagination-container');
    const pageInfo = document.getElementById('reports-page-info');
    const prevBtn = document.getElementById('reports-prev-btn');
    const nextBtn = document.getElementById('reports-next-btn');
    if (pc) {
        pc.style.display = filteredReports.length > reportsPerPage ? 'flex' : 'none';
    }
    if (pageInfo) pageInfo.innerText = `Page ${currentReportsPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentReportsPage === 1;
    if (nextBtn) nextBtn.disabled = currentReportsPage === totalPages;

    container.innerHTML = '';

    pageReports.forEach((r, idx) => {
        const globalIdx = start + idx;
        const statusColor = r.status === 'accepted' ? '#10b981' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b');
        const isGroup = r.chat_type === 'supergroup' || r.chat_type === 'group';
        const nameLabel = 'Name';
        const usernameLabel = 'Username';

        const card = document.createElement('div');
        card.className = 'user-card';
        card.style.marginBottom = '20px';

        card.innerHTML = `
            <div class="user-card-index">${globalIdx + 1}</div>
            <div class="user-all-info-list" style="display: flex; flex-direction: column; gap: 8px;">
                
                <!-- Status row (v118) -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Status</span>
                    <div style="font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px; color: ${statusColor}; text-transform: uppercase;">
                        ${r.status}
                    </div>
                </div>

                <!-- Target Channel Name -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">${nameLabel}</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: #60a5fa;">${r.chat_name}</span>
                </div>

                <!-- Target Username -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">${usernameLabel}</span>
                    <span style="font-size: 0.85rem; font-weight: 600; color: #c084fc;">${r.chat_username ? '@' + r.chat_username : 'No Username'}</span>
                </div>

                <!-- Report Count -->
                <div class="user-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500;">Report Count</span>
                    <span style="font-size: 1.1rem; font-weight: 800; color: #ef4444;">${r.count}</span>
                </div>

                <!-- Action Buttons -->
                ${r.status === 'pending' ? `
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button onclick="updateReportStatus(${r.order_id}, 'accepted')" 
                        style="flex: 1; padding: 12px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 12px; font-size: 0.9rem; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-check" style="margin-right: 5px;"></i> Accept
                    </button>
                    <button onclick="updateReportStatus(${r.order_id}, 'rejected')" 
                        style="flex: 1; padding: 12px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: #fff; border: none; border-radius: 12px; font-size: 0.9rem; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-times" style="margin-right: 5px;"></i> Reject
                    </button>
                </div>
                ` : (r.status === 'rejected' ? `
                <!-- Stylized Rejected Status (v118 Match Coupon Style) -->
                <div style="margin-top: 5px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: center; align-items: center; gap: 10px; opacity: 0.7;">
                    <i class="fas fa-times-circle" style="color: #64748b; font-size: 0.9rem;"></i>
                    <span style="font-size: 0.8rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">REJECTED</span>
                </div>
                ` : `
                <!-- Stylized Accepted Status (v118) -->
                <div style="margin-top: 5px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <i class="fas fa-check-circle" style="color: #10b981; font-size: 0.9rem;"></i>
                    <span style="font-size: 0.8rem; color: #10b981; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">ACCEPTED</span>
                </div>
                `)}
            </div>
        `;
        container.appendChild(card);
    });
}

async function updateReportStatus(orderId, status) {
    tg.HapticFeedback.impactOccurred('medium');
    try {
        const response = await fetch('/api/reports/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, status: status })
        });
        if (response.ok) {
            tg.HapticFeedback.notificationOccurred('success');
            loadReports();
        }
    } catch (e) {
        console.error("Update failed:", e);
    }
}

// --- Reports Pagination Functions (v65) ---
function prevReportsPage() {
    if (currentReportsPage > 1) {
        currentReportsPage--;
        renderReports(allReportsData);
        scrollToFirstCard('reports-list-table');
    }
}

function nextReportsPage() {
    const filtered = getFilteredReports();
    const totalPages = Math.ceil(filtered.length / reportsPerPage);
    if (currentReportsPage < totalPages) {
        currentReportsPage++;
        renderReports(allReportsData);
        scrollToFirstCard('reports-list-table');
    }
}

function getFilteredReports() {
    if (!allReportsData || allReportsData.length === 0) return [];
    const grouped = {};
    allReportsData.forEach(r => {
        if (!grouped[r.order_id]) {
            grouped[r.order_id] = { ...r, count: 0 };
        }
        grouped[r.order_id].count++;
        if (r.status === 'pending') grouped[r.order_id].status = 'pending';
    });

    return Object.values(grouped).filter(r => r.status === currentReportFilter);
}

// --- Admin Profile Rendering ---
function initAdminProfile(user) {
    const avatarChars = user.first_name ? user.first_name.substring(0, 2).toUpperCase() : 'AD';
    const avatarCircle = document.getElementById('avatar-circle');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileGlow = document.getElementById('profile-avatar-glow');

    const resetAvatar = (el) => {
        if (!el) return;
        el.innerText = '';
        el.style.backgroundImage = 'none';
        el.style.background = ''; // Clear shorthand
        el.style.backgroundColor = '';
        el.style.backgroundSize = '';
        el.style.backgroundPosition = '';
        el.style.boxShadow = ''; // Clear custom glows if any
    };

    if (profileGlow) {
        profileGlow.style.background = 'linear-gradient(135deg, #3b82f6, #8b5cf6)'; // Default
    }

    resetAvatar(avatarCircle);
    resetAvatar(profileAvatar);

    if (user.photo_url) {
        if (avatarCircle) {
            avatarCircle.style.backgroundImage = `url('${user.photo_url}')`;
            avatarCircle.style.backgroundSize = 'cover';
            avatarCircle.style.backgroundPosition = 'center';
            avatarCircle.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.1)';
        }
        if (profileAvatar) {
            profileAvatar.style.backgroundImage = `url('${user.photo_url}')`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
            profileAvatar.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        }
        if (profileGlow) {
            // Stronger white glow for photos
            profileGlow.style.background = 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)';
        }
    } else {
        const bgColor = getTelegramColor(user.id || user.user_id);
        if (avatarCircle) {
            avatarCircle.style.background = bgColor;
            avatarCircle.innerText = avatarChars;
            avatarCircle.style.boxShadow = `0 4px 15px ${bgColor}66`; 
        }
        if (profileAvatar) {
            profileAvatar.style.background = bgColor;
            profileAvatar.innerText = avatarChars;
            profileAvatar.style.boxShadow = `0 8px 25px ${bgColor}66`;
        }
        if (profileGlow) {
            // Match the deterministic color
            profileGlow.style.background = bgColor;
            profileGlow.style.opacity = '0.3';
        }
    }

    // v134: Fade in avatar after state is set (eliminates flash)
    if (profileAvatar) {
        setTimeout(() => { profileAvatar.style.opacity = '1'; }, 50);
    }
    if (avatarCircle) {
        setTimeout(() => { avatarCircle.style.opacity = '1'; }, 50);
    }

    const fullName = user.first_name || 'Admin';
    document.getElementById('profile-name').innerText = fullName;
    document.getElementById('profile-username').innerText = user.username ? '@' + user.username : 'No Username';
    document.getElementById('profile-id').innerText = user.id || user.user_id;
}

async function refreshAdminProfile() {
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }

    const user = tg.initDataUnsafe?.user;
    if (!user) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/profile?user_id=${user.id}&t=${Date.now()}`);
        if (res.ok) {
            const freshUser = await res.json();
            initAdminProfile(freshUser);
        } else {
            // Fallback to initData if API fails
            initAdminProfile(user);
        }
    } catch (err) {
        console.error("Profile refresh error:", err);
        initAdminProfile(user);
    }
}

// --- Admin Management Functions (v132 - Paginated) ---
let currentAdminsPage = 1;
const ADMINS_PER_PAGE = 5;
let allAdmins = [];

async function loadAdmins(resetPage = true) {
    try {
        const res = await fetch(`/api/admins?t=${Date.now()}`);
        allAdmins = await res.json();
        if (resetPage) currentAdminsPage = 1;
        renderAdmins();
    } catch (err) {
        console.error("Admins load error:", err);
    }
}

function renderAdmins() {
    const list = document.getElementById('admins-list');
    if (!list) return;
    list.innerHTML = '';

    if (allAdmins.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: #475569; padding: 25px; font-size: 0.85rem; background: rgba(0,0,0,0.1); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.05);">No sub-admins added yet.</div>`;
        const paginationContainer = document.getElementById('admins-pagination-container');
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(allAdmins.length / ADMINS_PER_PAGE);
    const start = (currentAdminsPage - 1) * ADMINS_PER_PAGE;
    const paged = allAdmins.slice(start, start + ADMINS_PER_PAGE);

    paged.forEach((admin, idx) => {
        const displayIndex = start + idx + 1;
        const adminCard = document.createElement('div');
        adminCard.className = 'user-card';
        adminCard.style.background = 'rgba(255, 255, 255, 0.02)';
        adminCard.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        adminCard.style.borderRadius = '24px';
        adminCard.style.padding = '20px';
        adminCard.style.marginBottom = '0';
        adminCard.style.display = 'flex';
        adminCard.style.flexDirection = 'column';
        adminCard.style.gap = '8px';
        adminCard.style.position = 'relative';

        adminCard.innerHTML = `
            <!-- Number Badge (same as user cards) -->
            <div class="user-card-index" style="width: 28px; height: 28px; font-size: 0.8rem; top: -14px;">${displayIndex}</div>

            <!-- Boxed Row 1: Full Name -->
            <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">Full Name</span>
                <span style="font-size: 0.95rem; font-weight: 800; color: #ffd700;">${admin.first_name || 'Admin'}</span>
            </div>

            <!-- Boxed Row 2: Username -->
            <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">Username</span>
                <span style="font-size: 0.95rem; font-weight: 800; color: #60a5fa;">${admin.username ? '@'+admin.username : '---'}</span>
            </div>

            <!-- Boxed Row 3: User ID -->
            <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">User ID</span>
                <span style="font-size: 0.95rem; font-weight: 800; color: #f59e0b; font-family: monospace;">${admin.user_id}</span>
            </div>

            <!-- Boxed Row 4: Delete Action -->
            <div onclick="removeAdmin('${admin.user_id}')" 
                 style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.15); padding: 15px; border-radius: 12px; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: 0.3s; margin-top: 5px;">
                <span style="font-size: 0.85rem; color: #ef4444; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Delete Administrator</span>
            </div>
        `;
        list.appendChild(adminCard);
    });

    // Update pagination
    const paginationContainer = document.getElementById('admins-pagination-container');
    const pageInfo = document.getElementById('admins-page-info');
    const prevBtn = document.getElementById('admins-prev-btn');
    const nextBtn = document.getElementById('admins-next-btn');

    if (totalPages > 1) {
        paginationContainer.style.display = 'flex';
        pageInfo.innerText = `Page ${currentAdminsPage} of ${totalPages}`;
        prevBtn.disabled = currentAdminsPage === 1;
        prevBtn.style.opacity = currentAdminsPage === 1 ? '0.3' : '1';
        nextBtn.disabled = currentAdminsPage === totalPages;
        nextBtn.style.opacity = currentAdminsPage === totalPages ? '0.3' : '1';
    } else {
        paginationContainer.style.display = 'none';
    }
}

function prevAdminsPage() {
    if (currentAdminsPage > 1) {
        currentAdminsPage--;
        tg.HapticFeedback.impactOccurred('light');
        renderAdmins();
        scrollToFirstCard('admins-list');
    }
}

function nextAdminsPage() {
    const totalPages = Math.ceil(allAdmins.length / ADMINS_PER_PAGE);
    if (currentAdminsPage < totalPages) {
        currentAdminsPage++;
        tg.HapticFeedback.impactOccurred('light');
        renderAdmins();
        scrollToFirstCard('admins-list');
    }
}


async function addAdmin() {
    const idInput = document.getElementById('new-admin-id');
    const userId = idInput.value;
    if (!userId) return tg.showAlert("Please enter a User ID!");

    tg.HapticFeedback.impactOccurred('medium');
    showLoader(true);

    try {
        const res = await fetch('/api/admins/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        const result = await res.json();

        if (res.ok) {
            idInput.value = '';
            showSuccessPopup("Admin Added!", "The user has been granted administrative permissions. ✨");
            loadAdmins();
        } else {
            showErrorPopup("User Not Found", result.message || "The user must start the bot first before being added as an admin.");
        }
    } catch (err) {
        console.error("Add admin error:", err);
        showErrorPopup("Network Error", "Please check your connection and try again.");
    } finally {
        hideLoader();
    }
}

async function removeAdmin(userId) {
    // Removed debug alert as requested (v131)
    console.log("🚀 removeAdmin triggered for ID:", userId);
    
    showConfirmPopup(
        "Remove Administrator",
        `Are you sure you want to revoke admin permissions for user ID: ${userId}?`,
        async () => {
            tg.HapticFeedback.impactOccurred('medium');
            showLoader(true);
            try {
                const res = await fetch('/api/admins/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId })
                });
                
                if (res.ok) {
                    showSuccessPopup("Deleted!", "Administrator revoked. ✨");
                    loadAdmins();
                } else {
                    const result = await res.json();
                    showErrorPopup("Action Failed", result.message || "Could not remove administrator.");
                }
            } catch (err) {
                console.error("❌ Fetch error:", err);
                showErrorPopup("Network Error", "Please try again.");
            } finally {
                hideLoader();
            }
        }
    );
}
