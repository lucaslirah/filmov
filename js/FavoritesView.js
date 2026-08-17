import { Favorites } from "./Favorites.js";
import { AuthManager } from "./AuthManager.js";
import { MovieDrawer } from "./MovieDrawer.js";
import { SearchSuggestions } from "./SearchSuggestions.js";

export class FavoritesView {
  constructor(rootSelector) {
    this.root = document.querySelector(rootSelector);
    this.tbody = this.root.querySelector("table tbody");

    // Initialize core state with update callback
    this.appState = new Favorites(() => this.update());

    // Initialize sub-controllers
    this.authManager = new AuthManager(this.appState, this);
    this.movieDrawer = new MovieDrawer(this.appState, this);
    this.searchSuggestions = new SearchSuggestions(this.appState, this);

    this.init();
  }

  async init() {
    this.bindTabEvents();

    // Load initial data
    await this.appState.load();
  }

  bindTabEvents() {
    const tabs = this.root.querySelectorAll(".tabs-nav .tab-btn");
    tabs.forEach((tab) => {
      tab.addEventListener("click", async () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        this.appState.activeTab = tab.getAttribute("data-tab");
        await this.appState.load();
      });
    });
  }

  update() {
    this.removeAllTr();
    this.authManager.updateProfileHeader();
    this.updateTabsStates();

    this.appState.movieEntries.forEach((movie) => {
      const row = this.createRow(movie);
      this.tbody.appendChild(row);
    });

    this.showOrHideNoFavorites();
  }

  updateTabsStates() {
    const myTab = this.root.querySelector('[data-tab="my"]');
    const trashTab = this.root.querySelector('[data-tab="trash"]');

    if (this.appState.currentUser) {
      myTab.removeAttribute("disabled");
      myTab.removeAttribute("title");
      trashTab.removeAttribute("disabled");
      trashTab.removeAttribute("title");
    } else {
      myTab.setAttribute("disabled", "true");
      myTab.setAttribute("title", "Faça login para ver seus favoritos");
      trashTab.setAttribute("disabled", "true");
      trashTab.setAttribute("title", "Faça login para ver a lixeira");
    }
  }

  createRow(movieOrNote) {
    const tr = document.createElement("tr");

    // Unify variables between grouped movie (tab 'all') and single note (tab 'my', 'trash')
    const isGrouped = this.appState.activeTab === "all";
    const imdbId = movieOrNote.imdb_id || movieOrNote.title;
    const title = movieOrNote.Title || movieOrNote.title;
    const year = movieOrNote.Year || movieOrNote.year;
    const runtime = movieOrNote.Runtime || movieOrNote.runtime;
    const poster = movieOrNote.Poster || movieOrNote.poster;
    const posterSrc =
      poster && poster !== "N/A"
        ? poster
        : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=150&q=200";
    const rating = isGrouped
      ? movieOrNote.avgRating
      : this.appState.getMovieAvgRating(imdbId);
    const noteId = movieOrNote.id; // exists if it is an individual note

    const imdbRating =
      movieOrNote.imdb_rating || movieOrNote.imdbRating || "N/A";
    const rottenRating =
      movieOrNote.rotten_rating || movieOrNote.rottenRating || "N/A";

    tr.innerHTML = `
      <td class="movie-poster">
        <div class="poster-wrapper">
          <img src="${posterSrc}" alt="${title}">
          <div class="avg-rating-badge">
            <i class="ph-fill ph-star"></i>
            <span>${rating}</span>
          </div>
        </div>
      </td>
      <td class="movie-title">
        <div class="movie-title-text">${title}</div>
        <div class="movie-external-ratings">
          ${
            imdbRating && imdbRating !== "N/A"
              ? `
            <span class="rating-badge imdb" title="IMDb Rating">IMDb: ${imdbRating}</span>
          `
              : ""
          }
          ${
            rottenRating && rottenRating !== "N/A"
              ? `
            <span class="rating-badge rotten" title="Rotten Tomatoes Rating">RT: ${rottenRating}</span>
          `
              : ""
          }
        </div>
      </td>
      <td class="movie-year">${year}</td>
      <td class="movie-runtime">${runtime}</td>
      <td class="movie-actions">
        <!-- Render buttons based on active tab -->
      </td>
    `;

    // Open comments drawer on title click or poster click
    tr.querySelector(".movie-title").onclick = () => {
      this.movieDrawer.openDrawer(movieOrNote);
    };
    tr.querySelector(".poster-wrapper").onclick = () => {
      this.movieDrawer.openDrawer(movieOrNote);
    };

    // Configure actions column
    const actionsTd = tr.querySelector(".movie-actions");

    if (this.appState.activeTab === "all") {
      if (this.appState.currentUser) {
        // Check if user already favorited it
        const userNotes = movieOrNote.notes || [];
        const alreadyFavorited = userNotes.some(
          (n) => n.user_id === this.appState.currentUser.id,
        );

        if (alreadyFavorited) {
          const btn = document.createElement("button");
          btn.className = "remove";
          btn.title = "Remover dos meus favoritos";
          btn.innerHTML = '<i class="ph ph-x-circle"></i>';
          btn.onclick = () => {
            const myNote = userNotes.find(
              (n) => n.user_id === this.appState.currentUser.id,
            );
            if (myNote && confirm(`Remover ${title} de seus favoritos?`)) {
              this.appState.softDeleteMovie(myNote.id);
            }
          };
          actionsTd.appendChild(btn);
        } else {
          // Show quick favorite star button
          const btn = document.createElement("button");
          btn.style.cssText =
            "border:none; background:none; color:#ffc800; font-size:2.5rem; cursor:pointer; transition: transform 0.2s;";
          btn.title = "Adicionar aos meus favoritos";
          btn.innerHTML = '<i class="ph ph-star"></i>';
          btn.onmouseover = () => (btn.style.transform = "scale(1.2)");
          btn.onmouseout = () => (btn.style.transform = "scale(1)");
          btn.onclick = () => {
            this.appState.addMovie(imdbId);
          };
          actionsTd.appendChild(btn);
        }

        // Render global delete for admin user
        if (this.appState.currentUser.email === "lucas.lira@gmail.com") {
          const adminBtn = document.createElement("button");
          adminBtn.className = "remove";
          adminBtn.title = "Remover da lista global (Admin)";
          adminBtn.innerHTML = '<i class="ph ph-trash"></i>';
          adminBtn.style.marginLeft = "1rem";
          adminBtn.onclick = () => {
            if (
              confirm(
                `Tem certeza de que deseja remover o filme "${title}" da lista global? Isso excluirá o filme para todos os usuários.`,
              )
            ) {
              this.appState.deleteMovieGlobally(imdbId);
            }
          };
          actionsTd.appendChild(adminBtn);
        }
      } else {
        // Disabled star showing login prompt
        const span = document.createElement("span");
        span.style.cssText =
          "color: var(--fc-secondary); font-size: 1.4rem; font-style: italic;";
        span.textContent = "—";
        actionsTd.appendChild(span);
      }
    } else if (this.appState.activeTab === "my") {
      const btn = document.createElement("button");
      btn.className = "remove";
      btn.title = "Remover";
      btn.innerHTML = '<i class="ph ph-x-circle"></i>';
      btn.onclick = () => {
        if (confirm(`Mover ${title} para o histórico / lixeira?`)) {
          this.appState.softDeleteMovie(noteId);
        }
      };
      actionsTd.appendChild(btn);
    } else if (this.appState.activeTab === "trash") {
      // Restore Button
      const restoreBtn = document.createElement("button");
      restoreBtn.style.cssText =
        "border:none; background:none; color:var(--bg-color-secondary); font-size:2.4rem; cursor:pointer; margin-right:1rem;";
      restoreBtn.title = "Restaurar filme";
      restoreBtn.innerHTML = '<i class="ph ph-arrow-counter-clockwise"></i>';
      restoreBtn.onclick = () => {
        this.appState.restoreMovie(noteId);
      };

      // Delete Permanent Button
      const deletePermBtn = document.createElement("button");
      deletePermBtn.className = "remove";
      deletePermBtn.title = "Excluir permanentemente";
      deletePermBtn.innerHTML = '<i class="ph ph-trash"></i>';
      deletePermBtn.onclick = () => {
        if (
          confirm(
            `Excluir permanentemente ${title}? Essa ação não pode ser desfeita.`,
          )
        ) {
          this.appState.hardDeleteMovie(noteId);
        }
      };

      actionsTd.appendChild(restoreBtn);
      actionsTd.appendChild(deletePermBtn);
    }

    return tr;
  }

  removeAllTr() {
    if (this.tbody) {
      this.tbody.querySelectorAll("tr").forEach((tr) => tr.remove());
    }
  }

  showOrHideNoFavorites() {
    const noFavorites = this.root.querySelector(".no-favorites");
    if (!noFavorites) return;

    const emptyMessage = document.getElementById("empty-message");

    if (this.appState.movieEntries.length === 0) {
      noFavorites.classList.remove("hide");

      // Set localized empty messages
      if (this.appState.activeTab === "all") {
        emptyMessage.textContent = "Nenhum filme favoritado no sistema.";
      } else if (this.appState.activeTab === "my") {
        emptyMessage.textContent = "Você não possui nenhum favorito ativo.";
      } else if (this.appState.activeTab === "trash") {
        emptyMessage.textContent = "Seu histórico de lixeira está vazio.";
      }
    } else {
      noFavorites.classList.add("hide");
    }
  }
}
