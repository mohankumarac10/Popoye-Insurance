
"use strict";

const SETTINGS_KEY = "popoyeInsuranceSettings";
const THEME_KEY = "popoyeTheme";

const DEFAULT_SETTINGS = {
  businessName: "Popoye Insurance",
  businessPhone: "",
  businessEmail: "",
  reminderDays: "30",
  reminderChannel: "WhatsApp",
  enableReminders: true,
  themePreference: "light"
};

const settingsForm = document.getElementById("settingsForm");
const message = document.getElementById("message");

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");

    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return { ...DEFAULT_SETTINGS };
    }

    return { ...DEFAULT_SETTINGS, ...saved };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function showMessage(text, type = "success") {
  message.textContent = text;
  message.className = `message ${type}`;

  window.clearTimeout(showMessage.timeoutId);
  showMessage.timeoutId = window.setTimeout(() => {
    message.textContent = "";
    message.className = "message";
  }, 3500);
}

function applyTheme(theme) {
  const selectedTheme = theme === "dark" ? "dark" : "light";

  document.body.classList.toggle(
    "dark-theme",
    selectedTheme === "dark"
  );

  localStorage.setItem(THEME_KEY, selectedTheme);
}

function loadSettings() {
  const settings = readSettings();

  document.getElementById("businessName").value =
    settings.businessName || DEFAULT_SETTINGS.businessName;

  document.getElementById("businessPhone").value =
    settings.businessPhone || "";

  document.getElementById("businessEmail").value =
    settings.businessEmail || "";

  document.getElementById("reminderDays").value =
    ["7", "15", "30", "45", "60"].includes(String(settings.reminderDays))
      ? String(settings.reminderDays)
      : "30";

  document.getElementById("reminderChannel").value =
    ["WhatsApp", "SMS", "Email"].includes(settings.reminderChannel)
      ? settings.reminderChannel
      : "WhatsApp";

  document.getElementById("enableReminders").checked =
    settings.enableReminders !== false;

  const storedTheme = localStorage.getItem(THEME_KEY);
  const preferredTheme =
    storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : settings.themePreference;

  document.getElementById("themePreference").value =
    preferredTheme === "dark" ? "dark" : "light";

  applyTheme(preferredTheme);
}

function saveSettings(event) {
  event.preventDefault();

  const businessName =
    document.getElementById("businessName").value.trim();

  const businessPhone =
    document.getElementById("businessPhone").value.trim();

  const businessEmail =
    document.getElementById("businessEmail").value.trim();

  if (!businessName) {
    showMessage("Please enter your business name.", "error");
    return;
  }

  const settings = {
    businessName,
    businessPhone,
    businessEmail,
    reminderDays: document.getElementById("reminderDays").value,
    reminderChannel: document.getElementById("reminderChannel").value,
    enableReminders: document.getElementById("enableReminders").checked,
    themePreference: document.getElementById("themePreference").value
  };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    applyTheme(settings.themePreference);
    showMessage("Settings saved successfully!");
  } catch (error) {
    showMessage(
      "Could not save settings. Check your browser storage.",
      "error"
    );
  }
}

function restoreDefaults() {
  const confirmed = window.confirm(
    "Restore the default settings? Your customer, policy, and payment records will not be deleted."
  );

  if (!confirmed) return;

  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS })
    );

    loadSettings();
    showMessage("Default settings restored.");
  } catch (error) {
    showMessage("Could not restore settings.", "error");
  }
}

function getRecordCount(key) {
  try {
    const records = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(records) ? records.length : 0;
  } catch (error) {
    return 0;
  }
}

function updateDataOverview() {
  document.getElementById("customerCount").textContent =
    getRecordCount("popoyeCustomers");

  document.getElementById("policyCount").textContent =
    getRecordCount("popoyePolicies");

  document.getElementById("paymentCount").textContent =
    getRecordCount("popoyePayments");
}

document.getElementById("themePreference").addEventListener(
  "change",
  function () {
    applyTheme(this.value);
  }
);

settingsForm.addEventListener("submit", saveSettings);

document.getElementById("resetBtn").addEventListener(
  "click",
  restoreDefaults
);

document.getElementById("menuBtn").addEventListener("click", function () {
  document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("logoutBtn").addEventListener("click", function () {
  sessionStorage.removeItem("popoyeLoggedIn");
  window.location.href = "login.html";
});

// Protect this page using the existing demo login session.
if (sessionStorage.getItem("popoyeLoggedIn") !== "true") {
  window.location.replace("login.html");
} else {
  loadSettings();
  updateDataOverview();
}
