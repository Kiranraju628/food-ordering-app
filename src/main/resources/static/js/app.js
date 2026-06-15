// ==========================================================================
// GourmetGo Frontend Application Engine
// ==========================================================================

const API_BASE = "/api";

// Global App State
const state = {
    token: localStorage.getItem("token") || null,
    user: JSON.parse(localStorage.getItem("user")) || null,
    roles: JSON.parse(localStorage.getItem("roles")) || [],
    activeRole: localStorage.getItem("activeRole") || null,
    cart: { items: [], subTotal: 0.0, discount: 0.0, couponCode: null },
    addresses: [],
    restaurants: [],
    selectedRestaurant: null,
    activeSubView: "restaurants", // restaurants, menu, tracking, history, addresses
    currentTrackedOrderId: null,
    trackingInterval: null
};

// ==========================================================================
// API Client / Fetch Wrapper
// ==========================================================================
async function apiCall(endpoint, method = "GET", body = null) {
    const headers = {
        "Content-Type": "application/json"
    };
    if (state.token) {
        headers["Authorization"] = `Bearer ${state.token}`;
    }
    const config = { method, headers };
    if (body) {
        config.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        // Handle 401 Unauthorized (invalid/expired token)
        if (response.status === 401) {
            showToast("Session expired. Please log in again.", "danger");
            logout();
            throw new Error("Unauthorized");
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await response.json();
        } else {
            const text = await response.text();
            if (!response.ok) throw new Error(text || "Request failed");
            return text;
        }
    } catch (error) {
        console.error("API Call error:", error);
        throw error;
    }
}

// ==========================================================================
// Helper Utilities & Toasts
// ==========================================================================
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "fa-circle-check";
    if (type === "danger") icon = "fa-circle-exclamation";
    else if (type === "warning") icon = "fa-triangle-exclamation";

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease reverse";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// Session Controls (Login / Logout / Tab Toggles)
// ==========================================================================
function initSession(token, user, roles) {
    state.token = token;
    state.user = user;
    state.roles = roles;
    
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("roles", JSON.stringify(roles));

    // Choose first role by default
    let defaultRole = roles[0];
    // If user has multiple roles, prioritize
    if (roles.includes("ROLE_ADMIN")) defaultRole = "ROLE_ADMIN";
    else if (roles.includes("ROLE_RESTAURANT")) defaultRole = "ROLE_RESTAURANT";
    else if (roles.includes("ROLE_DELIVERY")) defaultRole = "ROLE_DELIVERY";

    selectRole(defaultRole);
}

function selectRole(role) {
    state.activeRole = role;
    localStorage.setItem("activeRole", role);

    document.getElementById("main-header").classList.remove("hidden");
    document.getElementById("header-username").innerText = state.user.username;
    
    let roleLabel = "Customer";
    if (role === "ROLE_ADMIN") roleLabel = "Admin";
    else if (role === "ROLE_RESTAURANT") roleLabel = "Store Owner";
    else if (role === "ROLE_DELIVERY") roleLabel = "Rider";
    document.getElementById("header-role").innerText = roleLabel;

    renderRoleNavigation();
    switchView();
}

function renderRoleNavigation() {
    const nav = document.getElementById("role-nav");
    nav.innerHTML = "";
    const ul = document.createElement("ul");
    ul.className = "nav-links";

    if (state.activeRole === "ROLE_CUSTOMER") {
        ul.innerHTML = `
            <li><a class="nav-link active" onclick="setCustomerSubView('restaurants')"><i class="fa-solid fa-utensils"></i> Restaurants</a></li>
            <li><a class="nav-link" onclick="setCustomerSubView('history')"><i class="fa-solid fa-history"></i> My Orders</a></li>
            <li><a class="nav-link" onclick="setCustomerSubView('addresses')"><i class="fa-solid fa-location-dot"></i> Addresses</a></li>
        `;
    } else if (state.activeRole === "ROLE_RESTAURANT") {
        ul.innerHTML = `
            <li><a class="nav-link active" onclick="setRestaurantTab('orders')"><i class="fa-solid fa-receipt"></i> Orders</a></li>
            <li><a class="nav-link" onclick="setRestaurantTab('menu')"><i class="fa-solid fa-clipboard-list"></i> Menu CRUD</a></li>
        `;
    } else if (state.activeRole === "ROLE_DELIVERY") {
        ul.innerHTML = `
            <li><a class="nav-link active" onclick="setDeliveryTab('pending')"><i class="fa-solid fa-bell"></i> Job Requests</a></li>
            <li><a class="nav-link" onclick="setDeliveryTab('active')"><i class="fa-solid fa-motorcycle"></i> Active Delivery</a></li>
            <li><a class="nav-link" onclick="setDeliveryTab('history')"><i class="fa-solid fa-clock-rotate-left"></i> History</a></li>
        `;
    } else if (state.activeRole === "ROLE_ADMIN") {
        ul.innerHTML = `
            <li><a class="nav-link active" onclick="setAdminTab('stats')"><i class="fa-solid fa-chart-line"></i> Dashboard</a></li>
            <li><a class="nav-link" onclick="setAdminTab('users')"><i class="fa-solid fa-users"></i> Users</a></li>
            <li><a class="nav-link" onclick="setAdminTab('rests')"><i class="fa-solid fa-store"></i> Approvals</a></li>
            <li><a class="nav-link" onclick="setAdminTab('orders')"><i class="fa-solid fa-truck-ramp-box"></i> Orders</a></li>
            <li><a class="nav-link" onclick="setAdminTab('coupons')"><i class="fa-solid fa-tags"></i> Coupons</a></li>
        `;
    }

    // Role switcher dropdown if user has multiple roles
    if (state.roles.length > 1) {
        const li = document.createElement("li");
        li.style.marginLeft = "20px";
        let options = state.roles.map(r => {
            let label = r === "ROLE_CUSTOMER" ? "Customer" : r === "ROLE_ADMIN" ? "Admin" : r === "ROLE_RESTAURANT" ? "Owner" : "Rider";
            return `<option value="${r}" ${r === state.activeRole ? 'selected' : ''}>As: ${label}</option>`;
        }).join("");
        
        li.innerHTML = `
            <select class="form-select" onchange="selectRole(this.value)" style="padding: 4px 10px; font-size:12px; height:auto;">
                ${options}
            </select>
        `;
        ul.appendChild(li);
    }

    nav.appendChild(ul);
    setupNavHighlighting();
}

function setupNavHighlighting() {
    const links = document.querySelectorAll(".nav-link");
    links.forEach(link => {
        link.addEventListener("click", function() {
            links.forEach(l => l.classList.remove("active"));
            this.classList.add("active");
        });
    });
}

function logout() {
    state.token = null;
    state.user = null;
    state.roles = [];
    state.activeRole = null;
    clearInterval(state.trackingInterval);

    localStorage.clear();
    sessionStorage.clear();
    
    document.getElementById("main-header").classList.add("hidden");
    switchView();
}

function switchView() {
    // Hide all main portal sections
    document.getElementById("auth-view").classList.add("hidden");
    document.getElementById("customer-view").classList.add("hidden");
    document.getElementById("restaurant-view").classList.add("hidden");
    document.getElementById("delivery-view").classList.add("hidden");
    document.getElementById("admin-view").classList.add("hidden");

    if (!state.token) {
        document.getElementById("auth-view").classList.remove("hidden");
        return;
    }

    if (state.activeRole === "ROLE_CUSTOMER") {
        document.getElementById("customer-view").classList.remove("hidden");
        setCustomerSubView("restaurants");
        loadCart();
        startNotificationPolling();
    } else if (state.activeRole === "ROLE_RESTAURANT") {
        document.getElementById("restaurant-view").classList.remove("hidden");
        setRestaurantTab("orders");
        startNotificationPolling();
    } else if (state.activeRole === "ROLE_DELIVERY") {
        document.getElementById("delivery-view").classList.remove("hidden");
        setDeliveryTab("pending");
        startNotificationPolling();
    } else if (state.activeRole === "ROLE_ADMIN") {
        document.getElementById("admin-view").classList.remove("hidden");
        setAdminTab("stats");
    }
}

// ==========================================================================
// REGISTRATION AND LOGIN EVENT BINDINGS
// ==========================================================================
document.getElementById("tab-login").addEventListener("click", () => {
    document.getElementById("tab-login").classList.add("active");
    document.getElementById("tab-register").classList.remove("active");
    document.getElementById("login-form").classList.remove("hidden");
    document.getElementById("register-form").classList.add("hidden");
});

document.getElementById("tab-register").addEventListener("click", () => {
    document.getElementById("tab-register").classList.add("active");
    document.getElementById("tab-login").classList.remove("active");
    document.getElementById("register-form").classList.remove("hidden");
    document.getElementById("login-form").classList.add("hidden");
});

document.getElementById("reg-role").addEventListener("change", (e) => {
    document.querySelectorAll(".role-fields").forEach(f => f.classList.add("hidden"));
    if (e.target.value === "RESTAURANT") {
        document.getElementById("restaurant-fields").classList.remove("hidden");
    } else if (e.target.value === "DELIVERY") {
        document.getElementById("delivery-fields").classList.remove("hidden");
    }
});

// Login Form Submit
document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    
    try {
        const response = await apiCall("/auth/login", "POST", { username, password });
        showToast(`Welcome back, ${response.username}!`, "success");
        initSession(response.token, { username: response.username, email: response.email, id: response.userId }, response.roles);
    } catch (err) {
        showToast(err.message || "Invalid credentials", "danger");
    }
});

// Registration Form Submit
document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        username: document.getElementById("reg-username").value,
        email: document.getElementById("reg-email").value,
        password: document.getElementById("reg-password").value,
        phone: document.getElementById("reg-phone").value,
        role: document.getElementById("reg-role").value,
        vehicleNumber: document.getElementById("reg-rider-vehicle").value,
        restaurantName: document.getElementById("reg-rest-name").value,
        restaurantAddress: document.getElementById("reg-rest-address").value,
        restaurantDescription: document.getElementById("reg-rest-desc").value
    };

    try {
        await apiCall("/auth/register", "POST", payload);
        showToast("Registration successful! Please login.", "success");
        document.getElementById("tab-login").click();
    } catch (err) {
        showToast(err.message || "Registration failed", "danger");
    }
});

// Logout Binding
document.getElementById("logout-btn").addEventListener("click", logout);

// ==========================================================================
// CUSTOMER PORTAL FLOW
// ==========================================================================
function setCustomerSubView(subview) {
    state.activeSubView = subview;
    clearInterval(state.trackingInterval);
    
    document.getElementById("restaurant-list-section").classList.add("hidden");
    document.getElementById("menu-section").classList.add("hidden");
    document.getElementById("tracking-section").classList.add("hidden");
    document.getElementById("history-section").classList.add("hidden");
    document.getElementById("addresses-section").classList.add("hidden");
    document.getElementById("customer-cart-sidebar").classList.remove("hidden");

    if (subview === "restaurants") {
        document.getElementById("restaurant-list-section").classList.remove("hidden");
        loadRestaurants();
    } else if (subview === "menu") {
        document.getElementById("menu-section").classList.remove("hidden");
        renderMenu();
    } else if (subview === "tracking") {
        document.getElementById("tracking-section").classList.remove("hidden");
        document.getElementById("customer-cart-sidebar").classList.add("hidden");
        renderTracking();
    } else if (subview === "history") {
        document.getElementById("history-section").classList.remove("hidden");
        document.getElementById("customer-cart-sidebar").classList.add("hidden");
        loadOrderHistory();
    } else if (subview === "addresses") {
        document.getElementById("addresses-section").classList.remove("hidden");
        document.getElementById("customer-cart-sidebar").classList.add("hidden");
        loadAddresses();
    }
}

// 1. Browse Restaurants
async function loadRestaurants() {
    try {
        const rests = await apiCall("/customer/restaurants");
        state.restaurants = rests;
        const grid = document.getElementById("restaurants-grid");
        grid.innerHTML = "";

        if (rests.length === 0) {
            grid.innerHTML = "<p class='empty-text'>No registered and approved restaurants found.</p>";
            return;
        }

        rests.forEach(r => {
            const card = document.createElement("div");
            card.className = "card-item";
            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500'}" class="card-img" alt="${r.name}">
                </div>
                <div class="card-body">
                    <h3 class="card-title">${r.name}</h3>
                    <p class="card-desc">${r.description}</p>
                    <p class="small-text"><i class="fa-solid fa-location-dot"></i> ${r.address}</p>
                    <div class="card-footer">
                        <span class="rating-badge"><i class="fa-solid fa-star"></i> 4.5</span>
                        <button class="btn btn-secondary" onclick="viewRestaurantMenu(${r.id})">View Menu</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        showToast("Failed to load restaurants", "danger");
    }
}

// Search Binding
document.getElementById("food-search-input").addEventListener("input", async (e) => {
    const val = e.target.value.trim();
    const clearBtn = document.getElementById("search-clear-btn");
    
    if (val.length === 0) {
        clearBtn.classList.add("hidden");
        loadRestaurants();
        return;
    }
    
    clearBtn.classList.remove("hidden");
    try {
        const results = await apiCall(`/customer/food/search?query=${val}`);
        const grid = document.getElementById("restaurants-grid");
        grid.innerHTML = "";

        if (results.length === 0) {
            grid.innerHTML = "<p class='empty-text'>No dishes match your search.</p>";
            return;
        }

        results.forEach(item => {
            const card = document.createElement("div");
            card.className = "card-item";
            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500'}" class="card-img" alt="${item.name}">
                </div>
                <div class="card-body">
                    <h3 class="card-title">${item.name}</h3>
                    <p class="card-desc">${item.description}</p>
                    <p class="small-text"><i class="fa-solid fa-store"></i> Sold by: ${item.restaurant.name}</p>
                    <div class="card-footer">
                        <span class="card-price">₹${item.price}</span>
                        <button class="btn btn-primary" onclick="addToCartDirect(${item.id}, '${item.restaurant.name}')"><i class="fa-solid fa-plus"></i> Add to Cart</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        showToast("Search failed", "danger");
    }
});

document.getElementById("search-clear-btn").addEventListener("click", () => {
    document.getElementById("food-search-input").value = "";
    document.getElementById("search-clear-btn").classList.add("hidden");
    loadRestaurants();
});

// 2. View Menu
async function viewRestaurantMenu(restId) {
    const rest = state.restaurants.find(r => r.id === restId);
    state.selectedRestaurant = rest;
    setCustomerSubView("menu");
}

async function renderMenu() {
    const rest = state.selectedRestaurant;
    if (!rest) return;

    // Load Banner
    const banner = document.getElementById("restaurant-banner");
    banner.innerHTML = `
        <div class="glass-card" style="background: rgba(22, 27, 38, 0.5);">
            <h1>${rest.name}</h1>
            <p>${rest.description}</p>
            <p style="margin-top: 10px; font-size:13px; color: var(--text-muted);">
                <i class="fa-solid fa-location-dot"></i> ${rest.address} | <i class="fa-solid fa-phone"></i> ${rest.phone || 'N/A'}
            </p>
        </div>
    `;

    try {
        const menuItems = await apiCall(`/customer/restaurants/${rest.id}/menu`);
        const grid = document.getElementById("menu-grid");
        grid.innerHTML = "";

        if (menuItems.length === 0) {
            grid.innerHTML = "<p class='empty-text'>This restaurant has no menu items yet.</p>";
            return;
        }

        // Render categories
        const catContainer = document.getElementById("menu-categories-container");
        catContainer.innerHTML = `
            <span class="category-chip active" onclick="filterMenuByCategory('ALL')">All Dishes</span>
            <span class="category-chip" onclick="filterMenuByCategory('Starters')">Starters</span>
            <span class="category-chip" onclick="filterMenuByCategory('Main Course')">Main Course</span>
            <span class="category-chip" onclick="filterMenuByCategory('Desserts')">Desserts</span>
            <span class="category-chip" onclick="filterMenuByCategory('Beverages')">Beverages</span>
        `;

        state.currentMenu = menuItems;
        renderMenuItems(menuItems);
    } catch (err) {
        showToast("Failed to load menu", "danger");
    }
}

function renderMenuItems(items) {
    const grid = document.getElementById("menu-grid");
    grid.innerHTML = "";
    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "card-item";
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500'}" class="card-img" alt="${item.name}">
            </div>
            <div class="card-body">
                <h3 class="card-title">${item.name}</h3>
                <p class="card-desc">${item.description}</p>
                <div class="card-footer">
                    <span class="card-price">₹${item.price}</span>
                    <button class="btn btn-primary" onclick="addToCart(${item.id})"><i class="fa-solid fa-plus"></i> Add to Cart</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterMenuByCategory(categoryName) {
    // Styling chips
    document.querySelectorAll(".category-chip").forEach(chip => {
        if (chip.innerText.includes(categoryName)) chip.classList.add("active");
        else chip.classList.remove("active");
    });

    if (categoryName === "ALL") {
        renderMenuItems(state.currentMenu);
    } else {
        const filtered = state.currentMenu.filter(i => i.category.name === categoryName);
        renderMenuItems(filtered);
    }
}

document.getElementById("menu-back-btn").addEventListener("click", () => {
    setCustomerSubView("restaurants");
});

// 3. Cart & Basket Logic
async function loadCart() {
    try {
        const cartData = await apiCall("/customer/cart");
        const container = document.getElementById("cart-items-container");
        container.innerHTML = "";
        
        const items = cartData.items || [];
        state.cart.items = items;
        state.cart.subTotal = cartData.subTotal;
        recalculateTotals();

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-cart-state">
                    <i class="fa-solid fa-basket-shopping"></i>
                    <p>Your cart is empty.</p>
                </div>
            `;
            document.getElementById("checkout-btn").disabled = true;
            return;
        }

        document.getElementById("checkout-btn").disabled = false;
        
        items.forEach(item => {
            const row = document.createElement("div");
            row.className = "cart-item-row";
            row.innerHTML = `
                <div class="cart-item-info">
                    <p class="cart-item-name">${item.foodItem.name}</p>
                    <p class="cart-item-price">₹${item.foodItem.price}</p>
                </div>
                <div class="quantity-controls">
                    <button class="qty-btn" onclick="updateQty(${item.id}, -1)">-</button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
                </div>
                <button class="icon-btn" onclick="deleteCartItem(${item.id})" style="font-size:14px;"><i class="fa-solid fa-trash"></i></button>
            `;
            container.appendChild(row);
        });
    } catch (err) {
        console.error("Cart error", err);
    }
}

async function addToCart(foodItemId) {
    try {
        await apiCall("/customer/cart/add", "POST", { foodItemId, quantity: 1 });
        showToast("Dish added to your basket!", "success");
        loadCart();
    } catch (err) {
        showToast(err.message || "Failed to add item", "danger");
    }
}

async function addToCartDirect(foodItemId, restName) {
    // If different restaurant is detected, backend will clear. Notify user.
    if (state.cart.items.length > 0) {
        const currentRest = state.cart.items[0].foodItem.restaurant.name;
        if (currentRest !== restName) {
            if (!confirm(`Your cart contains items from '${currentRest}'. Do you want to discard your cart and add items from '${restName}'?`)) {
                return;
            }
        }
    }
    addToCart(foodItemId);
}

async function updateQty(itemId, delta) {
    const item = state.cart.items.find(i => i.id === itemId);
    if (!item) return;
    
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
        deleteCartItem(itemId);
        return;
    }

    try {
        await apiCall("/customer/cart/add", "POST", { foodItemId: item.foodItem.id, quantity: delta });
        loadCart();
    } catch (err) {
        showToast("Quantity update failed", "danger");
    }
}

async function deleteCartItem(itemId) {
    try {
        await apiCall(`/customer/cart/remove/${itemId}`, "DELETE");
        showToast("Item removed from basket", "success");
        loadCart();
    } catch (err) {
        showToast("Delete failed", "danger");
    }
}

document.getElementById("clear-cart-btn").addEventListener("click", async () => {
    if (state.cart.items.length === 0) return;
    if (!confirm("Are you sure you want to clear your basket?")) return;
    try {
        await apiCall("/customer/cart/clear", "DELETE");
        showToast("Basket cleared", "success");
        loadCart();
    } catch (err) {
        showToast("Clear failed", "danger");
    }
});

// Coupons logic
document.getElementById("apply-coupon-btn").addEventListener("click", async () => {
    const code = document.getElementById("coupon-code").value.trim().toUpperCase();
    if (!code) return;

    // Set coupon in state and recalculate
    state.cart.couponCode = code;
    recalculateTotals();
});

function recalculateTotals() {
    const sub = state.cart.subTotal;
    let disc = 0.0;
    const msg = document.getElementById("applied-coupon-msg");

    if (state.cart.couponCode) {
        // Simple client simulation, checkout endpoint processes it securely
        if (state.cart.couponCode === "WELCOME50") {
            disc = sub * 0.50;
            if (disc > 100.0) disc = 100.0;
            msg.innerText = "WELCOME50 coupon applied! 50% discount (max ₹100)";
            msg.classList.remove("hidden");
        } else if (state.cart.couponCode === "SUPERDISCOUNT") {
            disc = sub * 0.20;
            if (disc > 250.0) disc = 250.0;
            msg.innerText = "SUPERDISCOUNT applied! 20% discount (max ₹250)";
            msg.classList.remove("hidden");
        } else {
            msg.innerText = "Unknown, expired, or invalid coupon code.";
            msg.className = "coupon-success danger";
            msg.classList.remove("hidden");
            state.cart.couponCode = null;
        }
    } else {
        msg.classList.add("hidden");
    }

    state.cart.discount = disc;
    const finalTotal = Math.max(0, sub - disc);

    document.getElementById("cart-subtotal").innerText = `₹${sub.toFixed(2)}`;
    if (disc > 0) {
        document.getElementById("cart-discount-line").classList.remove("hidden");
        document.getElementById("cart-discount").innerText = `-₹${disc.toFixed(2)}`;
    } else {
        document.getElementById("cart-discount-line").classList.add("hidden");
    }
    document.getElementById("cart-total").innerText = `₹${finalTotal.toFixed(2)}`;
}

// 4. Checkout and Placement
document.getElementById("checkout-btn").addEventListener("click", async () => {
    // Open checkout modal
    const modal = document.getElementById("checkout-modal");
    modal.classList.remove("hidden");
    
    // Load customer addresses in dropdown
    try {
        const addresses = await apiCall("/customer/addresses");
        state.addresses = addresses;
        const select = document.getElementById("checkout-address-select");
        select.innerHTML = "";
        
        if (addresses.length === 0) {
            select.innerHTML = "<option value=''>-- Please add an address in Address tab --</option>";
            document.getElementById("place-order-confirm-btn").disabled = true;
            return;
        }
        
        document.getElementById("place-order-confirm-btn").disabled = false;
        addresses.forEach(addr => {
            select.innerHTML += `
                <option value="${addr.street}, ${addr.city}, ${addr.state} - ${addr.zipCode}">${addr.street}, ${addr.city}</option>
            `;
        });
    } catch (err) {
        showToast("Failed to retrieve addresses", "danger");
    }
});

document.getElementById("place-order-confirm-btn").addEventListener("click", async () => {
    const addressSelect = document.getElementById("checkout-address-select");
    const addressVal = addressSelect.value;
    
    if (!addressVal) {
        showToast("Please add/select a delivery address", "warning");
        return;
    }

    const payMethod = document.querySelector('input[name="pay-method"]:checked').value;
    
    const payload = {
        paymentMethod: payMethod,
        deliveryAddress: addressVal,
        couponCode: state.cart.couponCode
    };

    try {
        const orderResult = await apiCall("/customer/checkout", "POST", payload);
        showToast("Order placed successfully! Redirecting to tracking...", "success");
        document.getElementById("checkout-modal").classList.add("hidden");
        
        // Reset Cart state
        state.cart = { items: [], subTotal: 0.0, discount: 0.0, couponCode: null };
        document.getElementById("coupon-code").value = "";
        
        // Navigate to tracking
        state.currentTrackedOrderId = orderResult.orderId;
        setCustomerSubView("tracking");
    } catch (err) {
        showToast(err.message || "Failed to place order", "danger");
    }
});

// 5. Track Order Status & Reviews
async function renderTracking() {
    if (!state.currentTrackedOrderId) {
        document.getElementById("tracking-stepper").innerHTML = "<p class='empty-text'>No active order currently tracked.</p>";
        return;
    }

    document.getElementById("track-order-id").innerText = `#${state.currentTrackedOrderId}`;
    
    // Refresh function
    const refreshTracking = async () => {
        try {
            const data = await apiCall(`/customer/orders/${state.currentTrackedOrderId}`);
            const order = data.order;
            const stepper = document.getElementById("tracking-stepper");
            stepper.innerHTML = "";

            const statuses = ["CREATED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
            const currentIdx = statuses.indexOf(order.status);
            
            const stepLabels = {
                CREATED: { title: "Order Created", desc: "Your order is registered in the system." },
                ACCEPTED: { title: "Restaurant Confirmed", desc: "The kitchen has acknowledged your request." },
                PREPARING: { title: "Cooking Delicacy", desc: "Our chef is preparing your fresh meal." },
                READY_FOR_PICKUP: { title: "Food Ready", desc: "Food is packaged and awaiting delivery rider." },
                OUT_FOR_DELIVERY: { title: "Out for Delivery", desc: "Rider is heading to your location." },
                DELIVERED: { title: "Delivered", desc: "Enjoy your delicious hot meal!" }
            };

            if (order.status === "CANCELLED") {
                stepper.innerHTML = `
                    <div class="step-item active">
                        <div class="step-marker" style="border-color: var(--danger);"><i class="fa-solid fa-xmark" style="color:var(--danger)"></i></div>
                        <div class="step-content">
                            <h4 class="step-title" style="color: var(--danger)">Cancelled</h4>
                            <p class="step-desc">This order has been cancelled.</p>
                        </div>
                    </div>
                `;
                clearInterval(state.trackingInterval);
                return;
            }

            statuses.forEach((status, idx) => {
                let statusClass = "";
                let icon = "";
                if (idx < currentIdx) {
                    statusClass = "completed";
                    icon = "<i class='fa-solid fa-check'></i>";
                } else if (idx === currentIdx) {
                    statusClass = "active";
                }
                
                const step = document.createElement("div");
                step.className = `step-item ${statusClass}`;
                step.innerHTML = `
                    <div class="step-marker">${icon}</div>
                    <div class="step-content">
                        <h4 class="step-title">${stepLabels[status].title}</h4>
                        <p class="step-desc">${stepLabels[status].desc}</p>
                    </div>
                `;
                stepper.appendChild(step);
            });

            // Delivery Partner Info
            const riderCard = document.getElementById("tracking-driver-info");
            if (order.deliveryPartner) {
                riderCard.classList.remove("hidden");
                riderCard.innerHTML = `
                    <div class="glass-card" style="margin-top:20px; border-color: var(--accent-cyan);">
                        <h4><i class="fa-solid fa-motorcycle"></i> Assigned Rider</h4>
                        <p><strong>Name:</strong> ${order.deliveryPartner.user.username}</p>
                        <p><strong>Vehicle:</strong> ${order.deliveryPartner.vehicleNumber}</p>
                        <p><strong>Rider Rating:</strong> ★ ${order.deliveryPartner.rating.toFixed(1)}</p>
                    </div>
                `;
            } else {
                riderCard.classList.add("hidden");
            }

            // If delivered, clear interval and show review panel
            if (order.status === "DELIVERED") {
                clearInterval(state.trackingInterval);
                // Check if already reviewed
                try {
                    const reviewStatus = await apiCall(`/customer/orders/${order.id}`); // This is raw details, let's look at order
                    // Show rating panel if review not submitted
                    document.getElementById("order-rating-card").classList.remove("hidden");
                } catch(e) {}
            }
        } catch (err) {
            console.error("Tracking update error", err);
        }
    };

    // Run immediately
    refreshTracking();
    // Poll every 5 seconds
    state.trackingInterval = setInterval(refreshTracking, 5000);
}

// Rating Select Interaction
let selectedRating = 0;
document.querySelectorAll(".star-btn").forEach(btn => {
    btn.addEventListener("click", function() {
        selectedRating = parseInt(this.getAttribute("data-value"));
        // Render highlighted stars
        document.querySelectorAll(".star-btn").forEach(star => {
            const val = parseInt(star.getAttribute("data-value"));
            if (val <= selectedRating) {
                star.className = "fa-solid fa-star star-btn";
            } else {
                star.className = "fa-regular fa-star star-btn";
            }
        });
    });
});

document.getElementById("submit-rating-btn").addEventListener("click", async () => {
    if (selectedRating === 0) {
        showToast("Please select a star rating", "warning");
        return;
    }
    const comment = document.getElementById("rating-comment").value.trim();

    try {
        await apiCall(`/customer/orders/${state.currentTrackedOrderId}/rate`, "POST", { rating: selectedRating, comment });
        showToast("Thank you for your rating!", "success");
        document.getElementById("order-rating-card").classList.add("hidden");
        // Reset stars
        selectedRating = 0;
        document.querySelectorAll(".star-btn").forEach(star => star.className = "fa-regular fa-star star-btn");
        document.getElementById("rating-comment").value = "";
    } catch (err) {
        showToast(err.message || "Failed to submit review", "danger");
    }
});

// 6. Order History List
async function loadOrderHistory() {
    try {
        const orders = await apiCall("/customer/orders");
        const list = document.getElementById("orders-history-list");
        list.innerHTML = "";

        if (orders.length === 0) {
            list.innerHTML = "<p class='empty-text'>You haven't placed any orders yet.</p>";
            return;
        }

        orders.forEach(o => {
            const dateStr = new Date(o.createdAt).toLocaleString();
            let statusColor = "var(--text-muted)";
            if (o.status === "DELIVERED") statusColor = "var(--success)";
            else if (o.status === "CANCELLED") statusColor = "var(--danger)";
            else if (o.status === "OUT_FOR_DELIVERY") statusColor = "var(--accent-cyan)";

            const card = document.createElement("div");
            card.className = "glass-card";
            card.style.marginBottom = "15px";
            card.innerHTML = `
                <div class="cart-item-row">
                    <div>
                        <h3>Order #${o.id}</h3>
                        <p class="small-text">${dateStr}</p>
                        <p style="font-size:13px; margin-top:5px;"><i class="fa-solid fa-store"></i> ${o.restaurant.name}</p>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="color: var(--accent-cyan); font-size:18px;">₹${o.totalAmount.toFixed(2)}</h4>
                        <span style="font-size: 11px; font-weight:700; color: ${statusColor}; border: 1px solid ${statusColor}; padding:2px 8px; border-radius:4px;">
                            ${o.status}
                        </span>
                    </div>
                </div>
                <div style="margin-top: 15px; display:flex; gap:10px;">
                    <button class="btn btn-secondary" onclick="trackOrderDirect(${o.id})">Track Status</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        showToast("Failed to load order history", "danger");
    }
}

function trackOrderDirect(orderId) {
    state.currentTrackedOrderId = orderId;
    setCustomerSubView("tracking");
}

// 7. Customer Address Management
async function loadAddresses() {
    try {
        const addresses = await apiCall("/customer/addresses");
        state.addresses = addresses;
        const grid = document.getElementById("addresses-grid");
        grid.innerHTML = "";

        if (addresses.length === 0) {
            grid.innerHTML = "<p class='empty-text'>No saved addresses found. Add one below!</p>";
            return;
        }

        addresses.forEach(addr => {
            const card = document.createElement("div");
            card.className = "glass-card";
            card.innerHTML = `
                <h4><i class="fa-solid fa-location-dot" style="color:var(--primary)"></i> Delivery Address</h4>
                <p style="margin-top: 10px;">${addr.street}</p>
                <p>${addr.city}, ${addr.state} - ${addr.zipCode}</p>
                <p class="small-text">${addr.country}</p>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        showToast("Addresses loading failed", "danger");
    }
}

document.getElementById("add-address-btn").addEventListener("click", () => {
    document.getElementById("address-modal").classList.remove("hidden");
});

document.getElementById("address-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        street: document.getElementById("addr-street").value,
        city: document.getElementById("addr-city").value,
        state: document.getElementById("addr-state").value,
        zipCode: document.getElementById("addr-zip").value,
        country: document.getElementById("addr-country").value
    };

    try {
        await apiCall("/customer/addresses/add", "POST", payload);
        showToast("New address added successfully!", "success");
        document.getElementById("address-modal").classList.add("hidden");
        // Reset form
        document.getElementById("address-form").reset();
        loadAddresses();
    } catch (err) {
        showToast("Failed to add address", "danger");
    }
});

// ==========================================================================
// RESTAURANT PORTAL FLOW
// ==========================================================================
function setRestaurantTab(tab) {
    document.querySelectorAll(".portal-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("rest-orders-section").classList.add("hidden");
    document.getElementById("rest-menu-section").classList.add("hidden");

    if (tab === "orders") {
        document.getElementById("tab-rest-orders").classList.add("active");
        document.getElementById("rest-orders-section").classList.remove("hidden");
        loadRestaurantOrders();
    } else if (tab === "menu") {
        document.getElementById("tab-rest-menu").classList.add("active");
        document.getElementById("rest-menu-section").classList.remove("hidden");
        loadRestaurantMenu();
    }
}

document.getElementById("tab-rest-orders").addEventListener("click", () => setRestaurantTab("orders"));
document.getElementById("tab-rest-menu").addEventListener("click", () => setRestaurantTab("menu"));

// 1. Manage Restaurant Orders
async function loadRestaurantOrders() {
    try {
        const orders = await apiCall("/restaurant/orders");
        const list = document.getElementById("rest-orders-list");
        list.innerHTML = "";

        if (orders.length === 0) {
            list.innerHTML = "<p class='empty-text'>No incoming orders found.</p>";
            return;
        }

        orders.forEach(async (o) => {
            const dateStr = new Date(o.createdAt).toLocaleString();
            const card = document.createElement("div");
            card.className = "glass-card";
            card.style.marginBottom = "15px";
            
            // Get order items details
            const items = await apiCall(`/restaurant/orders/${o.id}/items`);
            let itemsListHtml = items.map(i => `<li>${i.foodItem.name} <strong>x${i.quantity}</strong></li>`).join("");

            let buttonsHtml = "";
            if (o.status === "CREATED") {
                buttonsHtml = `<button class="btn btn-primary" onclick="updateOrderStatus(${o.id}, 'ACCEPTED')">Accept Order</button>`;
            } else if (o.status === "ACCEPTED") {
                buttonsHtml = `<button class="btn btn-secondary" onclick="updateOrderStatus(${o.id}, 'PREPARING')" style="border-color: var(--primary);">Start Preparing</button>`;
            } else if (o.status === "PREPARING") {
                buttonsHtml = `<button class="btn btn-primary" onclick="updateOrderStatus(${o.id}, 'READY_FOR_PICKUP')">Mark Ready for Pickup</button>`;
            }

            card.innerHTML = `
                <div class="cart-item-row">
                    <div>
                        <h3>Order #${o.id}</h3>
                        <p class="small-text">${dateStr}</p>
                        <p class="small-text" style="color:var(--accent-cyan)">Client: ${o.customer.username} (${o.customer.phone || 'No phone'})</p>
                        <p style="margin-top:10px;"><strong>Deliver to:</strong> ${o.deliveryAddress}</p>
                        <ul style="margin: 10px 0 0 20px; font-size:13px;">
                            ${itemsListHtml}
                        </ul>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="color: var(--accent-cyan); font-size:18px;">₹${o.totalAmount.toFixed(2)}</h4>
                        <span class="rating-badge" style="background:transparent; border:1px solid var(--primary); color:var(--primary); font-size:10px; padding:2px 6px;">
                            ${o.status}
                        </span>
                        <div style="margin-top:15px;">
                            ${buttonsHtml}
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        console.error("Restaurant orders error", err);
    }
}

async function updateOrderStatus(orderId, nextStatus) {
    try {
        await apiCall(`/restaurant/orders/${orderId}/status?status=${nextStatus}`, "PUT");
        showToast(`Order status updated to: ${nextStatus}`, "success");
        loadRestaurantOrders();
    } catch (err) {
        showToast("Failed to update status", "danger");
    }
}

// 2. Restaurant Menu CRUD
async function loadRestaurantMenu() {
    try {
        const menu = await apiCall("/restaurant/menu");
        const grid = document.getElementById("rest-menu-grid");
        grid.innerHTML = "";

        if (menu.length === 0) {
            grid.innerHTML = "<p class='empty-text'>No dishes added to your menu yet.</p>";
            return;
        }

        menu.forEach(item => {
            const card = document.createElement("div");
            card.className = "card-item";
            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500'}" class="card-img" alt="${item.name}">
                </div>
                <div class="card-body">
                    <h3 class="card-title">${item.name}</h3>
                    <p class="card-desc">${item.description}</p>
                    <div style="margin: 5px 0;">
                        <span class="rating-badge" style="font-size:10px; background:var(--bg-secondary); color:var(--text-muted); border:1px solid var(--border-color)">
                            ${item.category.name}
                        </span>
                        <span class="rating-badge" style="font-size:10px; background:${item.available ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)'}; color:${item.available ? 'var(--success)' : 'var(--danger)'};">
                            ${item.available ? 'Available' : 'Unavailable'}
                        </span>
                    </div>
                    <div class="card-footer">
                        <span class="card-price">₹${item.price}</span>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-secondary" onclick="openEditMenuModal(${item.id})" style="padding: 6px 12px; font-size:12px;">Edit</button>
                            <button class="btn btn-text-danger" onclick="deleteMenuItem(${item.id})" style="padding: 6px 12px; font-size:12px;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        showToast("Failed to retrieve menu", "danger");
    }
}

document.getElementById("add-menu-item-btn").addEventListener("click", () => {
    document.getElementById("menu-modal-title").innerText = "Add New Dish";
    document.getElementById("menu-item-id").value = "";
    document.getElementById("menu-item-form").reset();
    document.getElementById("menu-item-available-group").classList.add("hidden");
    document.getElementById("menu-modal").classList.remove("hidden");
});

async function openEditMenuModal(itemId) {
    try {
        // Fetch menu first or find in locally cached items
        const menu = await apiCall("/restaurant/menu");
        const item = menu.find(i => i.id === itemId);
        if (!item) return;

        document.getElementById("menu-modal-title").innerText = "Edit Dish Details";
        document.getElementById("menu-item-id").value = item.id;
        document.getElementById("menu-item-name").value = item.name;
        document.getElementById("menu-item-price").value = item.price;
        document.getElementById("menu-item-category").value = item.category.id;
        document.getElementById("menu-item-image").value = item.imageUrl || "";
        document.getElementById("menu-item-desc").value = item.description;
        document.getElementById("menu-item-available").checked = item.available;
        document.getElementById("menu-item-available-group").classList.remove("hidden");
        
        document.getElementById("menu-modal").classList.remove("hidden");
    } catch (err) {
        showToast("Failed to load dish details", "danger");
    }
}

document.getElementById("menu-item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const itemId = document.getElementById("menu-item-id").value;
    const catId = document.getElementById("menu-item-category").value;
    
    const payload = {
        name: document.getElementById("menu-item-name").value,
        price: parseFloat(document.getElementById("menu-item-price").value),
        description: document.getElementById("menu-item-desc").value,
        imageUrl: document.getElementById("menu-item-image").value || null,
        available: document.getElementById("menu-item-available").checked
    };

    try {
        if (itemId) {
            // Update
            await apiCall(`/restaurant/menu/${itemId}/update?categoryId=${catId}`, "PUT", payload);
            showToast("Dish details updated!", "success");
        } else {
            // Add
            await apiCall(`/restaurant/menu/add?categoryId=${catId}`, "POST", payload);
            showToast("New dish added to menu!", "success");
        }
        document.getElementById("menu-modal").classList.add("hidden");
        loadRestaurantMenu();
    } catch (err) {
        showToast("Failed to save menu item", "danger");
    }
});

async function deleteMenuItem(itemId) {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
        await apiCall(`/restaurant/menu/${itemId}/delete`, "DELETE");
        showToast("Dish deleted from menu", "success");
        loadRestaurantMenu();
    } catch (err) {
        showToast("Failed to delete dish", "danger");
    }
}

// ==========================================================================
// DELIVERY PARTNER PORTAL FLOW
// ==========================================================================
function setDeliveryTab(tab) {
    document.querySelectorAll(".portal-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("del-pending-section").classList.add("hidden");
    document.getElementById("del-active-section").classList.add("hidden");
    document.getElementById("del-history-section").classList.add("hidden");

    if (tab === "pending") {
        document.getElementById("tab-del-pending").classList.add("active");
        document.getElementById("del-pending-section").classList.remove("hidden");
        loadPendingDeliveries();
    } else if (tab === "active") {
        document.getElementById("tab-del-active").classList.add("active");
        document.getElementById("del-active-section").classList.remove("hidden");
        loadActiveDelivery();
    } else if (tab === "history") {
        document.getElementById("tab-del-history").classList.add("active");
        document.getElementById("del-history-section").classList.remove("hidden");
        loadDeliveryHistory();
    }
}

document.getElementById("tab-del-pending").addEventListener("click", () => setDeliveryTab("pending"));
document.getElementById("tab-del-active").addEventListener("click", () => setDeliveryTab("active"));
document.getElementById("tab-del-history").addEventListener("click", () => setDeliveryTab("history"));

// 1. Ready-for-pickup Jobs
async function loadPendingDeliveries() {
    try {
        const jobs = await apiCall("/delivery/pending");
        const list = document.getElementById("del-requests-list");
        list.innerHTML = "";

        if (jobs.length === 0) {
            list.innerHTML = "<p class='empty-text'>No delivery jobs currently available. Check back soon!</p>";
            return;
        }

        jobs.forEach(j => {
            const card = document.createElement("div");
            card.className = "glass-card";
            card.style.marginBottom = "15px";
            card.innerHTML = `
                <div class="cart-item-row">
                    <div>
                        <h3>Job Request #${j.id}</h3>
                        <p style="margin-top:10px;"><strong>Pickup from:</strong> ${j.restaurant.name}</p>
                        <p class="small-text"><i class="fa-solid fa-location-dot"></i> ${j.restaurant.address}</p>
                        <p style="margin-top:5px;"><strong>Deliver to:</strong> ${j.deliveryAddress}</p>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="color:var(--accent-cyan); font-size:18px;">₹${j.totalAmount.toFixed(2)}</h4>
                        <button class="btn btn-primary" onclick="claimDelivery(${j.id})" style="margin-top:15px;">Accept Order</button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        showToast("Failed to load requests", "danger");
    }
}

async function claimDelivery(orderId) {
    try {
        await apiCall(`/delivery/accept/${orderId}`, "POST");
        showToast("Delivery job accepted! Navigate to 'Active Delivery' to complete pickup.", "success");
        setDeliveryTab("active");
    } catch (err) {
        showToast(err.message || "Failed to accept delivery", "danger");
    }
}

// 2. Active Delivery Progressions
async function loadActiveDelivery() {
    try {
        const response = await apiCall("/delivery/active");
        const container = document.getElementById("del-active-card-container");
        container.innerHTML = "";

        if (response.message || !response.order) {
            container.innerHTML = "<p class='empty-text'>No active delivery assigned. Find one under Job Requests.</p>";
            return;
        }

        const delivery = response;
        const o = delivery.order;
        
        let actionBtnHtml = "";
        if (delivery.status === "ASSIGNED") {
            actionBtnHtml = `<button class="btn btn-primary btn-block btn-lg" onclick="pickupDelivery(${o.id})"><i class="fa-solid fa-box-open"></i> Confirm Food Pickup</button>`;
        } else if (delivery.status === "PICKED_UP") {
            actionBtnHtml = `<button class="btn btn-primary btn-block btn-lg" onclick="completeDelivery(${o.id})" style="background:var(--success);"><i class="fa-solid fa-house-circle-check"></i> Mark Delivered</button>`;
        }

        container.innerHTML = `
            <div class="glass-card" style="border-color: var(--accent-cyan); padding: 30px;">
                <div class="cart-item-row" style="border-bottom: 1px solid var(--border-color); padding-bottom: 15px; margin-bottom: 20px;">
                    <div>
                        <h2>Order #${o.id}</h2>
                        <span class="rating-badge" style="background:transparent; border:1px solid var(--accent-cyan); color:var(--accent-cyan)">
                            ${delivery.status}
                        </span>
                    </div>
                    <h3 style="font-size:22px; color:var(--accent-cyan)">₹${o.totalAmount.toFixed(2)}</h3>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 30px;">
                    <div>
                        <h4 style="color:var(--primary); font-size:14px;"><i class="fa-solid fa-shop"></i> PICKUP STORE</h4>
                        <p><strong>${o.restaurant.name}</strong></p>
                        <p class="small-text">${o.restaurant.address}</p>
                        <p class="small-text">Phone: ${o.restaurant.phone}</p>
                    </div>
                    <div>
                        <h4 style="color:var(--primary); font-size:14px;"><i class="fa-solid fa-location-dot"></i> DELIVER TO</h4>
                        <p><strong>Customer: ${o.customer.username}</strong></p>
                        <p class="small-text">${o.deliveryAddress}</p>
                        <p class="small-text">Customer Phone: ${o.customer.phone || 'No phone provided'}</p>
                    </div>
                </div>
                
                ${actionBtnHtml}
            </div>
        `;
    } catch (err) {
        showToast("Failed to load active delivery", "danger");
    }
}

async function pickupDelivery(orderId) {
    try {
        await apiCall(`/delivery/pickup/${orderId}`, "POST");
        showToast("Food picked up! Order status is now Out for Delivery.", "success");
        loadActiveDelivery();
    } catch (err) {
        showToast("Pickup failed", "danger");
    }
}

async function completeDelivery(orderId) {
    try {
        await apiCall(`/delivery/deliver/${orderId}`, "POST");
        showToast("Excellent! Order delivered successfully.", "success");
        setDeliveryTab("history");
    } catch (err) {
        showToast("Failed to complete delivery", "danger");
    }
}

// 3. Delivery History
async function loadDeliveryHistory() {
    try {
        const listData = await apiCall("/delivery/history");
        const list = document.getElementById("del-history-list");
        list.innerHTML = "";

        if (listData.length === 0) {
            list.innerHTML = "<p class='empty-text'>You haven't completed any deliveries yet.</p>";
            return;
        }

        listData.forEach(d => {
            const dateStr = d.deliveryTime ? new Date(d.deliveryTime).toLocaleString() : 'N/A';
            const card = document.createElement("div");
            card.className = "glass-card";
            card.style.marginBottom = "15px";
            card.innerHTML = `
                <div class="cart-item-row">
                    <div>
                        <h3>Order #${d.order.id}</h3>
                        <p class="small-text">Delivered on: ${dateStr}</p>
                        <p style="margin-top:5px; font-size:13px;"><strong>From:</strong> ${d.order.restaurant.name} | <strong>To:</strong> ${d.order.deliveryAddress}</p>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="color:var(--success); font-size:18px;">₹${d.order.totalAmount.toFixed(2)}</h4>
                        <span class="rating-badge" style="font-size:10px; background:rgba(0, 230, 118, 0.15); color:var(--success);">DELIVERED</span>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        showToast("Failed to load history", "danger");
    }
}

// ==========================================================================
// ADMIN PORTAL FLOW
// ==========================================================================
function setAdminTab(tab) {
    document.querySelectorAll(".portal-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("admin-stats-section").classList.add("hidden");
    document.getElementById("admin-users-section").classList.add("hidden");
    document.getElementById("admin-rests-section").classList.add("hidden");
    document.getElementById("admin-orders-section").classList.add("hidden");
    document.getElementById("admin-coupons-section").classList.add("hidden");

    if (tab === "stats") {
        document.getElementById("tab-admin-stats").classList.add("active");
        document.getElementById("admin-stats-section").classList.remove("hidden");
        loadAdminStats();
    } else if (tab === "users") {
        document.getElementById("tab-admin-users").classList.add("active");
        document.getElementById("admin-users-section").classList.remove("hidden");
        loadAdminUsers();
    } else if (tab === "rests") {
        document.getElementById("tab-admin-rests").classList.add("active");
        document.getElementById("admin-rests-section").classList.remove("hidden");
        loadAdminPendingRestaurants();
    } else if (tab === "orders") {
        document.getElementById("tab-admin-orders").classList.add("active");
        document.getElementById("admin-orders-section").classList.remove("hidden");
        loadAdminOrders();
    } else if (tab === "coupons") {
        document.getElementById("tab-admin-coupons").classList.add("active");
        document.getElementById("admin-coupons-section").classList.remove("hidden");
        loadAdminCoupons();
    }
}

document.getElementById("tab-admin-stats").addEventListener("click", () => setAdminTab("stats"));
document.getElementById("tab-admin-users").addEventListener("click", () => setAdminTab("users"));
document.getElementById("tab-admin-rests").addEventListener("click", () => setAdminTab("rests"));
document.getElementById("tab-admin-orders").addEventListener("click", () => setAdminTab("orders"));
document.getElementById("tab-admin-coupons").addEventListener("click", () => setAdminTab("coupons"));

// 1. Dashboard Reports
async function loadAdminStats() {
    try {
        const stats = await apiCall("/admin/reports");
        document.getElementById("admin-stat-revenue").innerText = `₹${stats.totalRevenue.toFixed(2)}`;
        document.getElementById("admin-stat-orders").innerText = stats.totalOrders;
        document.getElementById("admin-stat-users").innerText = stats.totalCustomers + stats.totalOwners + stats.totalRiders;
        document.getElementById("admin-stat-restaurants").innerText = stats.approvedRestaurants;

        document.getElementById("rep-customers").innerText = stats.totalCustomers;
        document.getElementById("rep-owners").innerText = stats.totalOwners;
        document.getElementById("rep-riders").innerText = stats.totalRiders;

        document.getElementById("rep-active-stores").innerText = stats.approvedRestaurants;
        document.getElementById("rep-pending-stores").innerText = stats.pendingRestaurants;
    } catch (err) {
        showToast("Reports loading failed", "danger");
    }
}

// 2. Manage Users
async function loadAdminUsers() {
    try {
        const users = await apiCall("/admin/users");
        const tbody = document.getElementById("admin-users-table-body");
        tbody.innerHTML = "";

        users.forEach(u => {
            const roleLabels = u.roles.map(r => r.name.replace("ROLE_", "")).join(", ");
            const blockBtnText = u.enabled ? "Block" : "Unblock";
            const blockBtnClass = u.enabled ? "btn-text-danger" : "btn-secondary";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${u.id}</td>
                <td><strong>${u.username}</strong></td>
                <td>${u.email}</td>
                <td>${u.phone || 'N/A'}</td>
                <td><span class="user-role">${roleLabels}</span></td>
                <td>
                    <span style="color: ${u.enabled ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">
                        ${u.enabled ? 'ACTIVE' : 'BLOCKED'}
                    </span>
                </td>
                <td>
                    <button class="btn ${blockBtnClass}" onclick="toggleUserBlock(${u.id})" style="padding:4px 8px; font-size:11px;">
                        ${blockBtnText}
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        showToast("Failed to retrieve users list", "danger");
    }
}

async function toggleUserBlock(userId) {
    try {
        const res = await apiCall(`/admin/users/${userId}/block`, "PUT");
        showToast(res, "success");
        loadAdminUsers();
    } catch (err) {
        showToast("Failed to toggle status", "danger");
    }
}

// 3. Restaurant Approvals
async function loadAdminPendingRestaurants() {
    try {
        const listData = await apiCall("/admin/restaurants/pending");
        const list = document.getElementById("admin-pending-rests-list");
        list.innerHTML = "";

        if (listData.length === 0) {
            list.innerHTML = "<p class='empty-text'>No restaurant profiles awaiting approval.</p>";
            return;
        }

        listData.forEach(r => {
            const card = document.createElement("div");
            card.className = "glass-card";
            card.style.marginBottom = "15px";
            card.innerHTML = `
                <div class="cart-item-row">
                    <div>
                        <h3>${r.name}</h3>
                        <p class="small-text">Owner: ${r.owner.username} | Email: ${r.owner.email}</p>
                        <p style="margin-top: 10px;">${r.description}</p>
                        <p class="small-text"><i class="fa-solid fa-location-dot"></i> Address: ${r.address}</p>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="approveRestaurant(${r.id})">Approve Restaurant</button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        showToast("Failed to load approvals", "danger");
    }
}

async function approveRestaurant(restId) {
    try {
        const res = await apiCall(`/admin/restaurants/${restId}/approve`, "PUT");
        showToast(res, "success");
        loadAdminPendingRestaurants();
    } catch (err) {
        showToast("Approval failed", "danger");
    }
}

// 4. Global Orders Manager
async function loadAdminOrders() {
    try {
        const orders = await apiCall("/admin/orders");
        const list = document.getElementById("admin-orders-list");
        list.innerHTML = "";

        if (orders.length === 0) {
            list.innerHTML = "<p class='empty-text'>No orders registered in system.</p>";
            return;
        }

        orders.forEach(o => {
            const dateStr = new Date(o.createdAt).toLocaleString();
            let statusColor = "var(--text-muted)";
            if (o.status === "DELIVERED") statusColor = "var(--success)";
            else if (o.status === "CANCELLED") statusColor = "var(--danger)";

            let cancelBtnHtml = "";
            if (o.status !== "DELIVERED" && o.status !== "CANCELLED") {
                cancelBtnHtml = `<button class="btn btn-text-danger" onclick="cancelOrder(${o.id})" style="padding:4px 8px; font-size:12px;">Cancel Order</button>`;
            }

            const card = document.createElement("div");
            card.className = "glass-card";
            card.style.marginBottom = "15px";
            card.innerHTML = `
                <div class="cart-item-row">
                    <div>
                        <h3>Order #${o.id}</h3>
                        <p class="small-text">${dateStr} | Customer: ${o.customer.username}</p>
                        <p style="margin-top: 5px; font-size:13px;"><strong>Store:</strong> ${o.restaurant.name} | <strong>Dest:</strong> ${o.deliveryAddress}</p>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="color:var(--accent-cyan); font-size:18px;">₹${o.totalAmount.toFixed(2)}</h4>
                        <div style="margin-top:5px; display:flex; align-items:center; gap:10px; justify-content: flex-end;">
                            <span style="font-size:10px; font-weight:700; color:${statusColor}; border:1px solid ${statusColor}; padding:2px 6px; border-radius:4px;">
                                ${o.status}
                            </span>
                            ${cancelBtnHtml}
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        showToast("Failed to load global orders list", "danger");
    }
}

async function cancelOrder(orderId) {
    if (!confirm(`Are you sure you want to cancel order #${orderId}?`)) return;
    try {
        await apiCall(`/admin/orders/${orderId}/cancel`, "PUT");
        showToast(`Order #${orderId} cancelled`, "success");
        loadAdminOrders();
    } catch (err) {
        showToast("Failed to cancel order", "danger");
    }
}

// 5. Coupon Creation
async function loadAdminCoupons() {
    try {
        const coupons = await apiCall("/admin/coupons");
        const tbody = document.getElementById("admin-coupons-table-body");
        tbody.innerHTML = "";

        coupons.forEach(c => {
            const dateStr = new Date(c.expiryDate).toLocaleDateString();
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${c.code}</strong></td>
                <td>${c.discountPercentage}%</td>
                <td>${c.maxDiscount ? '₹' + c.maxDiscount : 'No cap'}</td>
                <td>${dateStr}</td>
                <td>
                    <span style="color:${c.active ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">
                        ${c.active ? 'ACTIVE' : 'EXPIRED'}
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        showToast("Failed to load coupons", "danger");
    }
}

document.getElementById("coupon-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const expiryVal = document.getElementById("cop-expiry").value;
    const payload = {
        code: document.getElementById("cop-code").value.trim().toUpperCase(),
        discountPercentage: parseFloat(document.getElementById("cop-pct").value),
        maxDiscount: document.getElementById("cop-max").value ? parseFloat(document.getElementById("cop-max").value) : null,
        expiryDate: new Date(expiryVal).toISOString()
    };

    try {
        await apiCall("/admin/coupons", "POST", payload);
        showToast("Coupon created successfully!", "success");
        document.getElementById("coupon-form").reset();
        loadAdminCoupons();
    } catch (err) {
        showToast(err.message || "Failed to create coupon", "danger");
    }
});

// ==========================================================================
// NOTIFICATIONS BELL & TRANSACTION POLLING
// ==========================================================================
let notificationPollInterval = null;

function startNotificationPolling() {
    clearInterval(notificationPollInterval);
    
    const fetchNotifications = async () => {
        if (!state.token) return;
        try {
            // Choose customer or general notification retrieval based on role
            // Customer and Restaurant both support notification retrieval
            let endpoint = "/customer/notifications";
            if (state.activeRole === "ROLE_RESTAURANT") endpoint = "/customer/notifications"; // Endpoint is general, maps to user
            
            const notifs = await apiCall(endpoint);
            const badge = document.getElementById("notif-badge");
            const list = document.getElementById("notif-list");
            
            const unread = notifs.filter(n => !n.read);
            
            if (unread.length > 0) {
                badge.innerText = unread.length;
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }

            list.innerHTML = "";
            if (notifs.length === 0) {
                list.innerHTML = "<p class='empty-text'>No notifications</p>";
                return;
            }

            notifs.forEach(n => {
                const dateStr = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const div = document.createElement("div");
                div.className = "dropdown-item";
                div.innerHTML = `
                    <p>${n.message}</p>
                    <span>${dateStr}</span>
                `;
                list.appendChild(div);
            });
        } catch (err) {
            console.error("Notifications poll error", err);
        }
    };

    // Run immediately and poll every 7 seconds
    fetchNotifications();
    notificationPollInterval = setInterval(fetchNotifications, 7000);
}

// Bell toggle dropdown binding
document.getElementById("bell-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = document.getElementById("notif-dropdown");
    dd.classList.toggle("hidden");
});

document.addEventListener("click", () => {
    document.getElementById("notif-dropdown").classList.add("hidden");
});

document.getElementById("clear-notif-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    // Simply hide badge and clear list locally for client
    document.getElementById("notif-badge").classList.add("hidden");
    document.getElementById("notif-list").innerHTML = "<p class='empty-text'>No notifications</p>";
});

// Set default initial view on load
window.addEventListener("DOMContentLoaded", () => {
    switchView();
});
