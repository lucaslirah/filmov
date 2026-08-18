export class AuthManager {
  constructor(appState, view) {
    this.appState = appState;
    this.view = view;

    this.loginBtn = view.root.querySelector(".google-login-btn");
    this.loginModal = document.getElementById("login-modal");
    this.customLoginForm = document.getElementById("custom-login-form");

    // Avatar Selection Elements
    this.avatarModal = document.getElementById("avatar-modal");
    this.selectedAvatarUrl = null;

    this.bindEvents();
    this.initAvatarModal();
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
          <div class="avatar-wrapper">
            <img src="${avatarUrl}" alt="${this.appState.currentUser.name}">
            <div class="avatar-edit-overlay" title="Alterar avatar">
              <i class="ph ph-pencil-simple"></i>
            </div>
          </div>
          <span class="user-name">${this.appState.currentUser.name}</span>
          <button class="logout-btn" title="Sair"><i class="ph ph-sign-out"></i></button>
        </div>
      `;

      // Bind logout button click
      container.querySelector(".logout-btn").onclick = () => {
        this.logoutUser();
      };

      // Bind avatar click to edit
      container.querySelector(".avatar-wrapper").onclick = () => {
        this.openAvatarModal();
      };
    } else {
      container.innerHTML = `
        <button class="google-login-btn">
          <i class="ph ph-sign-in"></i> Entrar
        </button>
      `;
    }
  }

  initAvatarModal() {
    // Close modal trigger
    this.avatarModal.querySelector(".close-modal").onclick = () => {
      this.avatarModal.classList.add("hide");
    };
    this.avatarModal.onclick = (e) => {
      if (e.target === this.avatarModal) {
        this.avatarModal.classList.add("hide");
      }
    };

    // Custom Robot Input
    const seedInput = document.getElementById("custom-robot-seed");
    const previewBtn = document.getElementById("preview-robot-btn");
    previewBtn.onclick = () => {
      const seed = seedInput.value.trim();
      if (seed) {
        const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
        this.selectAvatar(url);
        
        // De-highlight predefined avatars
        const items = this.avatarModal.querySelectorAll(".predefined-avatar-item");
        items.forEach((item) => item.classList.remove("active"));
        
        // Clear upload preview
        this.clearUploadPreview();
      }
    };

    // File Upload Elements
    const uploadArea = document.getElementById("avatar-upload-area");
    const fileInput = document.getElementById("avatar-file-input");
    const removeUploadBtn = document.getElementById("remove-upload-btn");

    uploadArea.onclick = () => fileInput.click();

    uploadArea.ondragover = (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    };

    uploadArea.ondragleave = () => {
      uploadArea.classList.remove("dragover");
    };

    uploadArea.ondrop = (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleFileUpload(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFileUpload(e.target.files[0]);
      }
    };

    removeUploadBtn.onclick = () => {
      this.clearUploadPreview();
      
      // Select the current user avatar as default again or disable save
      this.selectAvatar(this.appState.currentUser.avatar);
    };

    // Save Action
    const saveBtn = document.getElementById("save-avatar-btn");
    saveBtn.onclick = async () => {
      if (!this.appState.currentUser) return;
      await this.saveAvatar(this.selectedAvatarUrl);
    };
  }

  openAvatarModal() {
    if (!this.appState.currentUser) return;

    this.selectedAvatarUrl = this.appState.currentUser.avatar;

    // Reset inputs
    document.getElementById("custom-robot-seed").value = "";
    this.clearUploadPreview();
    
    // Disable save button by default (no changes yet)
    document.getElementById("save-avatar-btn").setAttribute("disabled", "true");

    // Render predefined robots list
    this.renderPredefinedRobots();

    // Show current avatar in preview
    const headerImg = document.getElementById("avatar-modal-header-img");
    const headerPlaceholder = document.getElementById("avatar-modal-header-placeholder");
    const defaultAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(this.appState.currentUser.name)}`;
    const initialAvatar = this.selectedAvatarUrl || defaultAvatarUrl;

    headerImg.src = initialAvatar;
    headerImg.classList.remove("hide");
    headerPlaceholder.classList.add("hide");

    // Show modal
    this.avatarModal.classList.remove("hide");
  }

  renderPredefinedRobots() {
    const container = document.getElementById("predefined-avatars-list");
    container.innerHTML = "";

    const robotSeeds = ["Felix", "Aneka", "Jack", "Sasha", "Milo", "Coco", "Toby", "Lola"];
    
    robotSeeds.forEach((seed) => {
      const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
      const isActive = this.selectedAvatarUrl === url;

      const item = document.createElement("div");
      item.className = `predefined-avatar-item ${isActive ? "active" : ""}`;
      item.innerHTML = `<img src="${url}" alt="Robô ${seed}">`;
      
      item.onclick = () => {
        // Highlight active
        const items = container.querySelectorAll(".predefined-avatar-item");
        items.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");

        // Clear other fields
        document.getElementById("custom-robot-seed").value = "";
        this.clearUploadPreview();

        this.selectAvatar(url);
      };

      container.appendChild(item);
    });
  }

  selectAvatar(url) {
    this.selectedAvatarUrl = url;

    // Update modal header preview image
    const headerImg = document.getElementById("avatar-modal-header-img");
    const headerPlaceholder = document.getElementById("avatar-modal-header-placeholder");
    const defaultAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(this.appState.currentUser.name)}`;
    const avatarToDisplay = url || defaultAvatarUrl;

    headerImg.src = avatarToDisplay;
    headerImg.classList.remove("hide");
    headerPlaceholder.classList.add("hide");
    
    // Enable save button only if changed
    const currentAvatar = this.appState.currentUser.avatar || defaultAvatarUrl;
    if (this.selectedAvatarUrl !== currentAvatar) {
      document.getElementById("save-avatar-btn").removeAttribute("disabled");
    } else {
      document.getElementById("save-avatar-btn").setAttribute("disabled", "true");
    }
  }

  handleFileUpload(file) {
    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione uma imagem válida.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      
      // Resize image down to max 200x200 pixels to avoid db bloat
      this.resizeImage(dataUrl, (resizedDataUrl) => {
        // Show preview
        const previewWrapper = document.getElementById("preview-upload-wrapper");
        const previewImg = document.getElementById("avatar-upload-preview");
        const uploadArea = document.getElementById("avatar-upload-area");

        previewImg.src = resizedDataUrl;
        previewWrapper.classList.remove("hide");
        uploadArea.classList.add("hide");

        // De-highlight predefined avatars
        const items = this.avatarModal.querySelectorAll(".predefined-avatar-item");
        items.forEach((item) => item.classList.remove("active"));
        document.getElementById("custom-robot-seed").value = "";

        this.selectAvatar(resizedDataUrl);
      });
    };
    reader.readAsDataURL(file);
  }

  resizeImage(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const MAX_WIDTH = 200;
      const MAX_HEIGHT = 200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      callback(resizedDataUrl);
    };
    img.src = dataUrl;
  }

  clearUploadPreview() {
    const previewWrapper = document.getElementById("preview-upload-wrapper");
    const previewImg = document.getElementById("avatar-upload-preview");
    const uploadArea = document.getElementById("avatar-upload-area");
    const fileInput = document.getElementById("avatar-file-input");

    previewImg.src = "";
    previewWrapper.classList.add("hide");
    uploadArea.classList.remove("hide");
    fileInput.value = "";
  }

  async saveAvatar(avatarUrl) {
    const saveBtn = document.getElementById("save-avatar-btn");
    saveBtn.innerText = "Salvando...";
    saveBtn.setAttribute("disabled", "true");

    try {
      const userId = this.appState.currentUser.id;
      const res = await fetch(`${this.appState.API_URL}/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: this.appState.currentUser.name,
          email: this.appState.currentUser.email,
          avatar: avatarUrl
        }),
      });

      const updatedUser = await res.json();
      if (!res.ok) {
        throw new Error(updatedUser.message || "Erro ao atualizar avatar.");
      }

      // Update state & storage
      this.appState.currentUser = updatedUser;
      localStorage.setItem("@Filmov:user", JSON.stringify(updatedUser));

      // Sincronizar savedUser no localStorage
      const savedUser = JSON.parse(localStorage.getItem("@Filmov:savedUser"));
      if (savedUser && savedUser.email === updatedUser.email) {
        savedUser.avatar = updatedUser.avatar;
        localStorage.setItem("@Filmov:savedUser", JSON.stringify(savedUser));
      }

      // Update Header profile picture
      this.updateProfileHeader();

      // Hide modal
      this.avatarModal.classList.add("hide");

      // Reload favorites & data (this updates user avatars across comments list)
      await this.appState.load();
    } catch (err) {
      alert(err.message);
    } finally {
      saveBtn.innerText = "Salvar Alterações";
    }
  }
}
