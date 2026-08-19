import { MovieData } from "./MovieData.js";

export class MovieDrawer {
  constructor(appState, view) {
    this.appState = appState;
    this.view = view;

    this.movieDrawer = document.getElementById("movie-drawer");
    this.activeDrawerMovie = null;
    this.activeDrawerMovieNoteId = null;
    this.selectedRating = 0;
    this.detailsCache = new Map();

    this.bindEvents();
  }

  bindEvents() {
    // Close Drawer
    this.movieDrawer.querySelector(".close-drawer").onclick = () => {
      this.movieDrawer.classList.add("hide");
    };
    this.movieDrawer.onclick = (e) => {
      if (e.target === this.movieDrawer) {
        this.movieDrawer.classList.add("hide");
      }
    };

    // Toggle Synopsis & Cast Accordion
    const toggleBtn = document.getElementById("drawer-details-toggle");
    const detailsContent = document.getElementById("drawer-details-content");

    if (toggleBtn && detailsContent) {
      toggleBtn.onclick = () => {
        const isHidden = detailsContent.classList.contains("hide");
        if (isHidden) {
          detailsContent.classList.remove("hide");
          toggleBtn.classList.add("expanded");
          toggleBtn.setAttribute("aria-expanded", "true");
          this.loadMovieDetails();
        } else {
          detailsContent.classList.add("hide");
          toggleBtn.classList.remove("expanded");
          toggleBtn.setAttribute("aria-expanded", "false");
        }
      };
    }

    // Interactive Stars in Drawer Review Form
    const starBtns = this.movieDrawer.querySelectorAll(".star-btn");
    starBtns.forEach((star) => {
      star.onclick = () => {
        const rating = parseInt(star.getAttribute("data-star"));
        if (this.selectedRating === rating && rating === 1) {
          this.selectedRating = 0;
        } else {
          this.selectedRating = rating;
        }
        this.renderDrawerStarsInput(this.selectedRating);
      };

      star.onmouseenter = () => {
        const rating = parseInt(star.getAttribute("data-star"));
        this.renderDrawerStarsInput(rating, true);
      };

      star.onmouseleave = () => {
        this.renderDrawerStarsInput(
          this.selectedRating !== undefined ? this.selectedRating : 0,
        );
      };
    });

    // Save Review
    const saveReviewBtn = document.getElementById("save-review-btn");
    saveReviewBtn.onclick = async () => {
      if (!this.appState.currentUser) return;

      const commentText = document
        .getElementById("review-comment")
        .value.trim();
      const rating =
        this.selectedRating !== undefined ? this.selectedRating : 0;

      try {
        if (this.activeDrawerMovieNoteId) {
          // Update existing note
          const res = await fetch(
            `${this.appState.API_URL}/movie_notes/${this.activeDrawerMovieNoteId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rating,
                description: commentText,
              }),
            },
          );
          if (!res.ok) throw new Error("Erro ao atualizar sua crítica.");
        } else {
          // Create new note
          const res = await fetch(
            `${this.appState.API_URL}/movie_notes/${this.appState.currentUser.id}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: this.activeDrawerMovie.Title || this.activeDrawerMovie.title,
                description: commentText,
                rating,
                imdb_id: this.activeDrawerMovie.imdb_id || this.activeDrawerMovie.imdbID,
                year: this.activeDrawerMovie.Year || this.activeDrawerMovie.year,
                runtime: this.activeDrawerMovie.Runtime || this.activeDrawerMovie.runtime,
                poster: this.activeDrawerMovie.Poster || this.activeDrawerMovie.poster,
                tags: [],
              }),
            },
          );
          if (!res.ok) throw new Error("Erro ao enviar sua crítica.");
        }

        // Refresh database state
        await this.appState.load();

        // Re-render drawer for same movie to display changes
        const imdbId = this.activeDrawerMovie.imdb_id || this.activeDrawerMovie.imdbID;
        const updatedNotes = this.appState.allActiveNotes.filter(
          (n) => n.imdb_id === imdbId,
        );
        this.activeDrawerMovie.notes = updatedNotes;
        this.activeDrawerMovie.avgRating = this.appState.getMovieAvgRating(imdbId);
        this.openDrawer(this.activeDrawerMovie);
      } catch (err) {
        alert(err.message);
      }
    };
  }

  renderDrawerStarsInput(rating, isHover = false) {
    const starBtns = this.movieDrawer.querySelectorAll(".star-btn");
    starBtns.forEach((star) => {
      const starVal = parseInt(star.getAttribute("data-star"));
      const icon = star.querySelector("i");

      star.classList.remove("active", "hover");

      if (starVal <= rating) {
        if (isHover) {
          star.classList.add("hover");
        } else {
          star.classList.add("active");
        }
        icon.className = "ph-fill ph-star";
      } else {
        star.classList.remove("active", "hover");
        icon.className = "ph ph-star";
      }
    });
  }

  async loadMovieDetails() {
    if (!this.activeDrawerMovie) return;
    const imdbId = this.activeDrawerMovie.imdb_id || this.activeDrawerMovie.imdbID || this.activeDrawerMovie.title;
    
    const plotElem = document.getElementById("drawer-plot");
    const actorsElem = document.getElementById("drawer-actors");
    const loadingElem = document.getElementById("drawer-details-loading");
    const bodyElem = document.getElementById("drawer-details-body");

    if (this.detailsCache.has(imdbId)) {
      const details = this.detailsCache.get(imdbId);
      plotElem.textContent = details.Plot;
      actorsElem.textContent = details.Actors;
      loadingElem.classList.add("hide");
      bodyElem.classList.remove("hide");
      return;
    }

    loadingElem.classList.remove("hide");
    bodyElem.classList.add("hide");

    const details = await MovieData.getDetails(imdbId);
    if (details) {
      this.detailsCache.set(imdbId, details);
      // Ensure drawer is still showing the same movie
      const currentImdbId = this.activeDrawerMovie ? (this.activeDrawerMovie.imdb_id || this.activeDrawerMovie.imdbID || this.activeDrawerMovie.title) : null;
      if (currentImdbId === imdbId) {
        plotElem.textContent = details.Plot;
        actorsElem.textContent = details.Actors;
        loadingElem.classList.add("hide");
        bodyElem.classList.remove("hide");
      }
    }
  }

  openDrawer(movie) {
    this.activeDrawerMovie = movie;
    this.activeDrawerMovieNoteId = null;
    this.selectedRating = 0;

    // Reset details accordion state
    const toggleBtn = document.getElementById("drawer-details-toggle");
    const detailsContent = document.getElementById("drawer-details-content");
    const loadingElem = document.getElementById("drawer-details-loading");
    const bodyElem = document.getElementById("drawer-details-body");
    const plotElem = document.getElementById("drawer-plot");
    const actorsElem = document.getElementById("drawer-actors");

    if (toggleBtn && detailsContent) {
      detailsContent.classList.add("hide");
      toggleBtn.classList.remove("expanded");
      toggleBtn.setAttribute("aria-expanded", "false");
    }

    if (plotElem) plotElem.textContent = "";
    if (actorsElem) actorsElem.textContent = "";
    if (loadingElem) loadingElem.classList.add("hide");
    if (bodyElem) bodyElem.classList.add("hide");

    const imdbId = movie.imdb_id || movie.imdbID || movie.title;
    const title = movie.Title || movie.title;
    const year = movie.Year || movie.year;
    const runtime = movie.Runtime || movie.runtime;
    const poster = movie.Poster || movie.poster;

    // Prefetch details in background
    if (imdbId && !this.detailsCache.has(imdbId)) {
      MovieData.getDetails(imdbId).then((details) => {
        if (details) this.detailsCache.set(imdbId, details);
      });
    }

    // Set poster, title, etc.
    const posterSrc =
      poster && poster !== "N/A"
        ? poster
        : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=150&q=200";
    document.getElementById("drawer-poster").src = posterSrc;
    document.getElementById("drawer-title").textContent = title;
    document.getElementById("drawer-year").textContent = year;
    document.getElementById("drawer-runtime").textContent = runtime;
    document.getElementById("drawer-avg-rating").textContent =
      movie.avgRating || this.appState.getMovieAvgRating(imdbId);

    // Render external ratings
    const drawerRatings = document.getElementById("drawer-external-ratings");
    if (drawerRatings) {
      const imdbRating = movie.imdb_rating || movie.imdbRating || "N/A";
      const rottenRating = movie.rotten_rating || movie.rottenRating || "N/A";

      drawerRatings.innerHTML = `
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
      `;
    }

    // Render list of owners avatars
    const ownersContainer = document.getElementById("drawer-owners");
    ownersContainer.innerHTML = "";

    const notesList =
      movie.notes ||
      this.appState.allActiveNotes.filter((n) => n.imdb_id === imdbId);

    notesList.forEach((note) => {
      const avatarUrl =
        note.user_avatar ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(note.user_name)}`;
      const img = document.createElement("img");
      img.className = "owner-avatar-img";
      img.src = avatarUrl;
      img.title = note.user_name;
      img.alt = note.user_name;
      ownersContainer.appendChild(img);
    });

    if (notesList.length === 0) {
      ownersContainer.innerHTML = `<span style="font-size: 1.2rem; color: var(--fc-secondary); font-style: italic;">Ninguém ainda</span>`;
    }

    // Render review list comments
    const reviewsListContainer = document.getElementById("drawer-reviews-list");
    reviewsListContainer.innerHTML = "";

    const notesWithComments = notesList.filter(
      (note) => note.description.trim() || note.rating > 0,
    );

    if (notesWithComments.length === 0) {
      reviewsListContainer.innerHTML = `<div class="no-reviews">Nenhum comentário escrito para este filme ainda.</div>`;
    } else {
      notesWithComments.forEach((note) => {
        const item = document.createElement("div");
        item.className = "review-item";

        const avatarUrl =
          note.user_avatar ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(note.user_name)}`;

        let starsHTML = "";
        for (let i = 1; i <= 5; i++) {
          starsHTML +=
            i <= note.rating
              ? '<i class="ph-fill ph-star"></i>'
              : '<i class="ph ph-star"></i>';
        }

        const dateStr = note.updated_at
          ? note.updated_at.split(" ")[0]
          : "Recentemente";
        const commentText = note.description.trim()
          ? note.description
          : `<span style="font-style: italic; color: var(--fc-secondary); font-size: 1.3rem;">Apenas avaliou com estrelas.</span>`;

        item.innerHTML = `
          <div class="review-user-header">
            <div class="review-user-info">
              <img class="review-user-avatar" src="${avatarUrl}" alt="${note.user_name}">
              <span class="review-user-name">${note.user_name}</span>
            </div>
            <div class="review-stars">
              ${starsHTML}
            </div>
          </div>
          <p class="review-comment-text">${commentText}</p>
          <span class="review-date">${dateStr}</span>
        `;
        reviewsListContainer.appendChild(item);
      });
    }

    // Render personal review form
    const reviewForm = document.getElementById("drawer-review-form");
    const warning = reviewForm.querySelector(".login-warning");
    const content = reviewForm.querySelector(".form-content");

    if (!this.appState.currentUser) {
      warning.classList.remove("hide");
      content.classList.add("hide");
    } else {
      warning.classList.add("hide");
      content.classList.remove("hide");

      // Check if logged in user already left a note for this movie
      const myNote = notesList.find((n) => n.user_id === this.appState.currentUser.id);

      if (myNote) {
        this.activeDrawerMovieNoteId = myNote.id;
        this.selectedRating = myNote.rating !== undefined ? myNote.rating : 0;
        document.getElementById("review-comment").value =
          myNote.description || "";
        this.movieDrawer.querySelector("#save-review-btn").textContent =
          "Atualizar Crítica";
      } else {
        this.activeDrawerMovieNoteId = null;
        this.selectedRating = 0;
        document.getElementById("review-comment").value = "";
        this.movieDrawer.querySelector("#save-review-btn").textContent =
          "Adicionar aos Favoritos e Avaliar";
      }

      this.renderDrawerStarsInput(this.selectedRating);
    }

    // Show Drawer
    this.movieDrawer.classList.remove("hide");
  }
}
