
"use strict";

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

// Demo credentials only — replace with secure server-side authentication.
const DEMO_USERNAME = "admin";
const DEMO_PASSWORD = "Popoye@123";

document.getElementById("currentYear").textContent =
  new Date().getFullYear();

togglePassword.addEventListener("click", function () {
  const isPassword = passwordInput.type === "password";

  passwordInput.type = isPassword ? "text" : "password";
  togglePassword.textContent = isPassword ? "Hide" : "Show";
});

loginForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = passwordInput.value;

  if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
    try {
      sessionStorage.setItem("popoyeLoggedIn", "true");
      window.location.href = "index.html";
    } catch (error) {
      loginMessage.textContent =
        "Login session could not be created. Please check your browser settings.";
      loginMessage.className = "message error";
    }

    return;
  }

  loginMessage.textContent =
    "Invalid username or password. Please try again.";
  loginMessage.className = "message error";
});
