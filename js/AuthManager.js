export class AuthManager {
  constructor(appState, view) {
    this.appState = appState;
    this.view = view;

    this.loginBtn = view.root.querySelector(".google-login-btn");
    this.loginModal = document.getElementById("login-modal");
    this.customLoginForm = document.getElementById("custom-login-form");

    this.bindEvents();
  }

  bindEvents() {
    // Open Login modal
    this.view.root.addEventListener("click", (e) => {
      const btn = e.target.closest(".google-login-btn");
      if (btn) {
        this.renderSavedAccount();
        this.loginModal.classList.remove("hide");
      }
    });

    // Close Login modal
    this.loginModal.querySelector(".close-modal").onclick = () => {
      this.loginModal.classList.add("hide");
    };
    this.loginModal.onclick = (e) => {
      if (e.target === this.loginModal) {
        this.loginModal.classList.add("hide");
      }
    };

    // Custom Login Form submit
    this.customLoginForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("custom-name").value.trim();
      const email = document.getElementById("custom-email").value.trim();
      if (name && email) {
        await this.loginUser(name, email, null);
      }
    };
  }

  renderSavedAccount() {
    const savedUser = JSON.parse(localStorage.getItem("@Filmov:savedUser"));
    const container = document.getElementById("saved-account-container");
    if (!container) return;

    if (savedUser) {
      const avatarUrl =
        savedUser.avatar ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(savedUser.name)}`;
      container.innerHTML = `
        <div class="saved-account-label">Acesso rápido</div>
        <div class="saved-account-wrapper">
          <div class="saved-account-item">
            <img src="${avatarUrl}" alt="${savedUser.name}">
            <div class="account-info">
              <span class="account-name">${savedUser.name}</span>
              <span class="account-email">${savedUser.email}</span>
            </div>
          </div>
          <button class="saved-account-forget-btn" title="Esquecer dados"><i class="ph ph-trash"></i></button>
        </div>
      `;
      container.classList.remove("hide");

      // Click to quick login
      container.querySelector(".saved-account-item").onclick = async () => {
        await this.loginUser(savedUser.name, savedUser.email, savedUser.avatar);
      };

      // Click to forget saved account
      container.querySelector(".saved-account-forget-btn").onclick = (e) => {
        e.stopPropagation();
        localStorage.removeItem("@Filmov:savedUser");
        this.renderSavedAccount();
      };
    } else {
      container.innerHTML = "";
      container.classList.add("hide");
    }
  }

  async loginUser(name, email, avatar) {
    try {
      const res = await fetch(`${this.appState.API_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, avatar }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erro ao realizar login.");
      }

      this.appState.currentUser = data;
      localStorage.setItem("@Filmov:user", JSON.stringify(data));
      localStorage.setItem(
        "@Filmov:savedUser",
        JSON.stringify({
          name: data.name,
          email: data.email,
          avatar: data.avatar,
        }),
      );

      // Clear inputs
      document.getElementById("custom-name").value = "";
      document.getElementById("custom-email").value = "";

      // Hide modal
      this.loginModal.classList.add("hide");

      // Refresh
      await this.appState.load();
    } catch (err) {
      alert(err.message);
    }
  }

  logoutUser() {
    this.appState.currentUser = null;
    localStorage.removeItem("@Filmov:user");

    // Switch to all favorites tab on logout if we are on user tabs
    if (this.appState.activeTab !== "all") {
      this.appState.activeTab = "all";
      const tabs = this.view.root.querySelectorAll(".tab-btn");
      tabs.forEach((t) => t.classList.remove("active"));
      this.view.root.querySelector('[data-tab="all"]').classList.add("active");
    }

    // Refresh UI
    this.appState.load();
  }

  updateProfileHeader() {
    const container = document.getElementById("user-profile-header");
    if (!container) return;
    container.innerHTML = "";

    if (this.appState.currentUser) {
      const avatarUrl =
        this.appState.currentUser.avatar ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(this.appState.currentUser.name)}`;

      container.innerHTML = `
        <div class="user-profile-badge">
          <img src="${avatarUrl}" alt="${this.appState.currentUser.name}">
          <span class="user-name">${this.appState.currentUser.name}</span>
          <button class="logout-btn" title="Sair"><i class="ph ph-sign-out"></i></button>
        </div>
      `;

      // Bind logout button click
      container.querySelector(".logout-btn").onclick = () => {
        this.logoutUser();
      };
    } else {
      container.innerHTML = `
        <button class="google-login-btn">
          <i class="ph ph-sign-in"></i> Entrar
        </button>
      `;
    }
  }
}
