// ================= WATCH GALLERY – MAIN JS =================

let allWatches = [];

// ================= PAGE LOAD =================
document.addEventListener("DOMContentLoaded", function () {
    if (typeof fetchWatches === "function") fetchWatches();
    if (typeof setupCategoryFilters === "function") setupCategoryFilters();
    if (typeof setupBrandFilters === "function") setupBrandFilters();
    if (typeof setupHomeReset === "function") setupHomeReset();
    if (typeof setupAuthForms === "function") setupAuthForms();
    if (typeof setupLogout === "function") setupLogout();
    if (typeof setupDarkMode === "function") setupDarkMode();
    if (typeof setupCartRedirect === "function") setupCartRedirect();
    if (typeof setupSearch === "function") setupSearch();
    
});



// ================= FETCH WATCHES =================
function fetchWatches() {
    fetch("/api/watches")
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("watchesContainer");
            if (!container) return;

            container.innerHTML = "";

            if (!data.watches || data.watches.length === 0) {
                container.innerHTML =
                    `<p class="text-center text-muted">No watches available.</p>`;
                return;
            }

            allWatches = data.watches;
            renderWatches(allWatches);
        });
}

// ================= RENDER WATCHES =================
function renderWatches(watches) {
    const container = document.getElementById("watchesContainer");
    container.innerHTML = "";

    watches.forEach(watch => {
        container.insertAdjacentHTML("beforeend", createWatchCard(watch));
    });
}

// ================= WATCH CARD =================
function createWatchCard(watch) {
    const imageUrl = watch.image
        ? watch.image
        : "https://via.placeholder.com/300x220?text=No+Image";

    return `
        <div class="col-md-3 col-sm-6 mb-4 watch-card"
             data-category="${watch.category || ''}"
             data-brand="${watch.brand.toLowerCase()}">

            <div class="card h-100 shadow-sm">
                <img src="${imageUrl}" class="card-img-top"
                    onclick="openWatch(${watch.id})"
                    style="cursor:pointer;height:220px;object-fit:cover;">


                <div class="card-body text-center">
                    <h5>${watch.brand} ${watch.model}</h5>

                    <p class="mb-2">
                        ${
                            watch.discount_price
                            ? `<span class="text-decoration-line-through text-muted me-2">
                                    ₹${watch.price}
                               </span>
                               <span class="fw-bold text-danger">
                                    ₹${watch.discount_price}
                               </span>`
                            : `<span class="fw-bold">₹${watch.price}</span>`
                        }
                    </p>

                    <button class="btn buy-btn w-100 mb-2"
                        onclick="buyNow(${watch.id})">
                        Buy Now
                    </button>

                    <button class="btn buy-btn w-100"
                        onclick="addToCart(${watch.id})">
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ================= BUY NOW =================
function buyNow(watchId) {
    addToCart(watchId);
    window.location.href = "/cart";
}

// ================= CATEGORY FILTER =================
function setupCategoryFilters() {
    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const category = btn.dataset.category.toLowerCase();
            renderWatches(
                allWatches.filter(w =>
                    w.category && w.category.toLowerCase() === category
                )
            );
        });
    });
}

// ================= BRAND FILTER =================
function setupBrandFilters() {
    document.querySelectorAll(".dropdown-item[data-brand]").forEach(item => {
        item.addEventListener("click", () => {
            const brand = item.dataset.brand.toLowerCase();
            renderWatches(
                allWatches.filter(w =>
                    w.brand.toLowerCase().includes(brand)
                )
            );
        });
    });
}

// ================= HOME RESET =================
function setupHomeReset() {
    const home = document.getElementById("homeLink");
    if (home) {
        home.addEventListener("click", () => renderWatches(allWatches));
    }
}

// ================= SEARCH =================
function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        const q = searchInput.value.toLowerCase();
        renderWatches(
            allWatches.filter(w =>
                w.brand.toLowerCase().includes(q) ||
                w.model.toLowerCase().includes(q)
            )
        );
    });
}

// ================= ADD TO CART =================
function addToCart(watchId) {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    const watch = allWatches.find(w => w.id === watchId);
    if (!watch) return;

    const item = cart.find(i => i.id === watchId);
    if (item) item.qty++;
    else {
        cart.push({
            id: watch.id,
            brand: watch.brand,
            model: watch.model,
            price: watch.discount_price || watch.price,
            qty: 1
        });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    alert("Added to cart");
}

// ================= LOGIN / SIGNUP =================
function setupAuthForms() {

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();

            fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: loginEmail.value,
                    password: loginPassword.value
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                        localStorage.setItem("userLoggedIn", "yes");

                        const params = new URLSearchParams(window.location.search);
                        const next = params.get("next");

                        if (next === "cart") {
                            window.location.href = "/cart";
                        } else {
                            window.location.href = "/";
                        }
                 }
                  else {
                    alert(data.message || "Login failed");
                }
            });
        });
    }

    const signupForm = document.getElementById("signupForm");
    if (signupForm) {
        signupForm.addEventListener("submit", function (e) {
            e.preventDefault();

            fetch("/api/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: signupEmail.value,
                    password: signupPassword.value
                })
            })
            .then(res => res.json())   // ✅ FIXED HERE
            .then(data => {
                if (data.status === "success") {
                    alert("Signup successful. Please login.");
                } else {
                    alert(data.message || "Signup failed");
                }
            });
        });
    }
}

// ================= LOGOUT =================
function setupLogout() {
    const logoutLink = document.getElementById("logoutLink");
    if (!logoutLink) return;

    logoutLink.addEventListener("click", function () {
        fetch("/api/logout")
            .then(res => res.json())
            .then(() => {
                localStorage.removeItem("userLoggedIn");
                localStorage.removeItem("cart");
                alert("Logged out");
                window.location.href = "/";
            });
    });
}

// ================= CART REDIRECT =================
function setupCartRedirect() {
    const cartLink = document.querySelector('a[href="/cart"]');
    const authModal = document.getElementById("authModal");

    if (!cartLink || !authModal) return; // important fix

    cartLink.addEventListener("click", function (e) {
        if (!localStorage.getItem("userLoggedIn")) {
            e.preventDefault();
            new bootstrap.Modal(authModal).show();
        }
    });
}

// ================= DARK MODE =================
function setupDarkMode() {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    if (localStorage.getItem("darkMode") === "on") {
        document.body.classList.add("dark-mode");
    }

    toggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        localStorage.setItem(
            "darkMode",
            document.body.classList.contains("dark-mode") ? "on" : "off"
        );
    });
}


// ================= PROFILE SUBMIT =================
const profileForm = document.getElementById("profileForm");

if (profileForm) {
    profileForm.addEventListener("submit", function (e) {
        e.preventDefault();

        fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                full_name: document.getElementById("fullName").value,
                dob: document.getElementById("dob").value,
                address: document.getElementById("address").value,
                contact_no: document.getElementById("contactNo").value
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                alert("Profile saved successfully. Please checkout again.");
                bootstrap.Modal.getInstance(
                    document.getElementById("profileFormModal")
                ).hide();

                window.location.href = "/cart";
            } else {
                alert("Profile update failed");
            }
        });
    });
}


// ================= AUTO OPEN PROFILE MODAL =================
document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);

    if (params.get("completeProfile") === "1") {
        const modalEl = document.getElementById("profileFormModal");
        if (modalEl) {
            new bootstrap.Modal(modalEl).show();
        }
    }
});

// ================= FEATURED CAROUSEL RENDERING =================
function renderFeatured(watches) {
    const container = document.getElementById("featuredWatches");
    if (!container) return;

    container.innerHTML = "";

    watches.slice(0, 5).forEach((w, i) => {
        container.innerHTML += `
        <div class="carousel-item ${i === 0 ? "active" : ""}">
          <img src="${w.image}" class="d-block w-100" style="height:350px; object-fit:cover">
          <div class="carousel-caption bg-dark bg-opacity-50 rounded">
            <h5>${w.brand} ${w.model}</h5>
            <p>₹${w.discount_price || w.price}</p>
          </div>
        </div>`;
    });
}

function openWatch(id) {
    window.location.href = `/watch/${id}`;
}

// 
function addToCartFromDetail(id) {

    id = Number(id); // force number

    fetch("/api/watches")
        .then(res => res.json())
        .then(data => {

            const watch = data.watches.find(w => Number(w.id) === id);
            if (!watch) {
                alert("Watch not found");
                return;
            }

            const cart = JSON.parse(localStorage.getItem("cart")) || [];
            const existing = cart.find(i => Number(i.id) === id);

            if (existing) {
                existing.qty += 1;
            } else {
                cart.push({
                    id: watch.id,
                    brand: watch.brand,
                    model: watch.model,
                    price: watch.discount_price || watch.price,
                    qty: 1
                });
            }

            localStorage.setItem("cart", JSON.stringify(cart));
            alert("Added to cart");
        })
        .catch(err => {
            console.error("Error:", err);
        });
}



// ================= AUTO OPEN LOGIN MODAL =================
document.addEventListener("DOMContentLoaded", function () {

    const params = new URLSearchParams(window.location.search);

    if (params.get("login") === "required") {

        const modalEl = document.getElementById("authModal");

        if (modalEl) {
            new bootstrap.Modal(modalEl).show();
        }
    }

});