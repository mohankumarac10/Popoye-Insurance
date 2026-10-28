
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginMessage = document.getElementById("loginMessage");

    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Demo credentials only. Replace with server authentication later.
        if (
            email === "admin@popoyeinsurance.com" &&
            password === "Popoye@123"
        ) {
            localStorage.setItem("popoyeLoggedIn", "true");
            window.location.href = "dashboard.html";
        } else {
            loginMessage.textContent =
                "Invalid email or password. Please try again.";
        }
    });
});
