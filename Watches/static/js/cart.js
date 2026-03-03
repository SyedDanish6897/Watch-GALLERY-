document.addEventListener("DOMContentLoaded", function () {

    /* ================= LOAD CART ================= */
    loadCart();

    /* ================= AUTO OPEN PROFILE MODAL ================= */
    const params = new URLSearchParams(window.location.search);
    if (params.get("completeProfile") === "1") {
        const modalEl = document.getElementById("profileFormModal");

        if (modalEl && typeof bootstrap !== "undefined") {
            const modal = new bootstrap.Modal(modalEl, {
                backdrop: "static",
                keyboard: false
            });
            modal.show();
        }
    }
});

/* ================= LOAD CART ================= */
function loadCart() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const body = document.getElementById("cartBody");
    const totalEl = document.getElementById("grandTotal");

    body.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="text-center">Cart is empty</td></tr>`;
        totalEl.innerText = "0";
        return;
    }

    cart.forEach((item, i) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        body.innerHTML += `
            <tr>
                <td>${item.brand} ${item.model}</td>
                <td>₹${item.price}</td>
                <td>${item.qty}</td>
                <td>₹${itemTotal}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="removeItem(${i})">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    });

    totalEl.innerText = total;
}

/* ================= REMOVE ITEM ================= */
function removeItem(i) {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    cart.splice(i, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    loadCart();
}

/* ================= CHECKOUT ================= */
function checkout() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];

    if (cart.length === 0) {
        alert("Cart is empty");
        return;
    }

    fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart })
    })
    .then(res => res.json())
    .then(data => {

        if (data.error === "Complete profile first") {
            window.location.href = "/cart?completeProfile=1";
            return;
        }

       if (data.error === "Login required") {
            // Redirect to home with login trigger
            window.location.href = "/?login=required&next=cart";

            return;
        }

        if (data.status === "success") {
            startRazorpayPayment(data.invoice);
            return;
        }

        alert("Order failed");
    });
}

/* ================= RAZORPAY PAYMENT ================= */
function startRazorpayPayment(invoice) {

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    let amount = 0;
    let summary = [];

    cart.forEach(item => {
        amount += item.price * item.qty;
        summary.push(`${item.brand} ${item.model} x${item.qty}`);
    });

    fetch("/api/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount * 100 })
    })
    .then(res => res.json())
    .then(order => {

        const options = {
            key: "rzp_test_RvB0GTienxup7o",
            amount: order.amount,
            currency: "INR",
            name: "Watch Gallery",
            description: "Watch Purchase",
            order_id: order.id,

            handler: function (response) {
                fetch("/api/payment-success", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        razorpay_payment_id: response.razorpay_payment_id,
                        amount: amount,
                        summary: summary.join(", ")
                    })
                })
                .then(() => {
                    alert("Payment successful! Invoice sent to email.");
                    localStorage.removeItem("cart");
                    window.location.href = "/";
                });
            }
        };

        new Razorpay(options).open();
    });
}

/* ================= PROFILE SUBMIT ================= */
document.getElementById("profileForm")?.addEventListener("submit", function (e) {
    e.preventDefault();

    fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            full_name: fullName.value,
            dob: dob.value,
            address: address.value,
            contact_no: contactNo.value
        })
    })
    .then(res => res.json())
    .then(() => {
        bootstrap.Modal.getInstance(
            document.getElementById("profileFormModal")
        ).hide();

        checkout(); // retry after profile save
    });
});
