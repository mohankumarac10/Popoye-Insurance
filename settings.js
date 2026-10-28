
"use strict";

document.addEventListener("DOMContentLoaded", function () {
  // ==========================================
  // POPOYE INSURANCE - SETTINGS MODULE
  // Browser localStorage demo
  // ==========================================

  const SETTINGS_KEY = "popoyeInsuranceSettings";
  const THEME_KEY = "popoyeTheme";
  const LOGIN_KEY = "popoyeLoggedIn";

  const DEFAULT_SETTINGS = {
    businessName: "Popoye Insurance",
    businessEmail: "",
    businessPhone: "",
    businessAddress: "",
    reminderDays: "30",
    reminderChannel: "WhatsApp",
    enableReminders: true,
    themePreference: "light"
  };

  const form = document.getElementById("settingsForm");
  const businessName = document.getElementById("businessName");
  const businessEmail = document.getElementById("businessEmail");
  const businessPhone = document.getElementById("businessPhone");
  const businessAddress = document.getElementById("businessAddress");
  const reminderDays = document.getElementById("reminderDays");
  const reminderChannel = document.getElementById("reminderChannel");
  const enableReminders = document.getElementById("enableReminders");
  const themeLight = document.getElementById("themeLight");
  const themeDark = document.getElementById("themeDark");
  const settingsMessage = document.getElementById("settingsMessage");
  const resetSettingsBtn = document.getElementById("resetSettingsBtn");
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const logoutBtn = document.getElementById("logoutBtn");

  // Require login, matching the other application pages.
  if (localStorage.getItem(LOGIN_KEY) !== "true") {
    window.location.replace("login.html");
    return;
  }

  function readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");

      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        return { ...DEFAULT_SETTINGS };
      }

      return { ...DEFAULT_SETTINGS, ...saved };
    } catch (error) {
      console.error("Unable to read settings:", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function showMessage(message, type) {
    settingsMessage.textContent = message;
    settingsMessage.className = "settings-message " + type;
  }

  function applyTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    document.body.classList.toggle(
      "dark-theme",
      selectedTheme === "dark"
    );

    themeLight.checked = selectedTheme === "light";
    themeDark.checked = selectedTheme === "dark";

    // Keep the theme key compatible with the rest of the website.
    try {
      localStorage.setItem(THEME_KEY, selectedTheme);
    } catch (error) {
      console.error("Unable to save theme:", error);
    }
  }

  function fillForm(settings) {
    businessName.value = settings.businessName || "";
    businessEmail.value = settings.businessEmail || "";
    businessPhone.value = settings.businessPhone || "";
    businessAddress.value = settings.businessAddress || "";

    reminderDays.value = String(settings.reminderDays || "30");
    reminderChannel.value = settings.reminderChannel || "WhatsApp";
    enableReminders.checked = settings.enableReminders !== false;

    applyTheme(settings.themePreference);
  }

  function getFormSettings() {
    return {
      businessName: businessName.value.trim(),
      businessEmail: businessEmail.value.trim(),
      businessPhone: businessPhone.value.trim(),
      businessAddress: businessAddress.value.trim(),
      reminderDays: reminderDays.value,
      reminderChannel: reminderChannel.value,
      enableReminders: enableReminders.checked,
      themePreference: themeDark.checked ? "dark" : "light"
    };
  }

  function saveSettings(event) {
    if (event) {
      event.preventDefault();
    }

    if (!form.reportValidity()) {
      return;
    }

    const settings = getFormSettings();

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      applyTheme(settings.themePreference);

      showMessage("Settings saved successfully.", "success");
    } catch (error) {
      console.error("Unable to save settings:", error);
      showMessage(
        "Unable to save settings. Check your browser storage.",
        "error"
      );
    }
  }

  // Save form settings.
  form.addEventListener("submit", saveSettings);

  // Apply appearance immediately when selected.
  themeLight.addEventListener("change", function () {
    if (themeLight.checked) {
      applyTheme("light");
      showMessage("Light mode selected. Click Save Settings to save.", "success");
    }
  });

  themeDark.addEventListener("change", function () {
    if (themeDark.checked) {
      applyTheme("dark");
      showMessage("Dark mode selected. Click Save Settings to save.", "success");
    }
  });

  // Restore default settings.
  resetSettingsBtn.addEventListener("click", function () {
    const confirmed = window.confirm(
      "Reset all settings to their default values?"
    );

    if (!confirmed) {
      return;
    }

    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(DEFAULT_SETTINGS)
      );

      fillForm(DEFAULT_SETTINGS);
      showMessage("Default settings restored.", "success");
    } catch (error) {
      console.error("Unable to reset settings:", error);
      showMessage("Unable to reset settings.", "error");
    }
  });

  // Mobile sidebar toggle.
  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", function () {
      sidebar.classList.toggle("active");
    });
  }

  // Logout.
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      const confirmed = window.confirm("Are you sure you want to log out?");

      if (confirmed) {
        localStorage.removeItem(LOGIN_KEY);
        window.location.href = "login.html";
      }
    });
  }

  // Load saved settings and restore the saved appearance.
  const savedSettings = readSettings();

  // Support the older theme key if settings have no saved preference.
  if (!localStorage.getItem(SETTINGS_KEY)) {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      savedSettings.themePreference = savedTheme;
    }
  }

  fillForm(savedSettings);
});
