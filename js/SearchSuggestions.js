import { MovieData } from "./MovieData.js";

export class SearchSuggestions {
  constructor(appState, view) {
    this.appState = appState;
    this.view = view;

    this.searchInput = view.root.querySelector("#search-input");
    this.suggestions = view.root.querySelector("#search-suggestions");
    this.favButton = view.root.querySelector(".fav-button");

    this.bindEvents();
  }

  bindEvents() {
    // Add button click
    this.favButton.onclick = () => {
      const { value } = this.searchInput;
      if (value.trim()) {
        this.appState.addMovie(value).then((success) => {
          if (success) {
            this.searchInput.value = "";
            this.hideSuggestions();
          }
        });
      }
    };

    // Enter key press on search input
    this.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const { value } = this.searchInput;
        if (value.trim()) {
          this.appState.addMovie(value).then((success) => {
            if (success) {
              this.searchInput.value = "";
              this.hideSuggestions();
            }
          });
        }
      }
    });

    // Input autocomplete suggestions
    let timeoutId;
    this.searchInput.addEventListener("input", () => {
      clearTimeout(timeoutId);
      const query = this.searchInput.value.trim();

      if (query.length < 2) {
        this.hideSuggestions();
        return;
      }

      timeoutId = setTimeout(() => {
        this.fetchAndShowSuggestions(query);
      }, 300);
    });

    // Escape to hide suggestions
    this.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.hideSuggestions();
      }
    });

    // Click outside suggestions list to hide it
    document.addEventListener("click", (event) => {
      if (
        this.suggestions &&
        !this.suggestions.contains(event.target) &&
        event.target !== this.searchInput
      ) {
        this.hideSuggestions();
      }
    });
  }

  hideSuggestions() {
    if (this.suggestions) {
      this.suggestions.classList.add("hide");
      this.suggestions.innerHTML = "";
    }
  }

  async fetchAndShowSuggestions(query) {
    if (!this.suggestions) return;

    try {
      const movies = await MovieData.searchList(query);
      this.suggestions.innerHTML = "";

      if (movies.length === 0) {
        const noResults = document.createElement("div");
        noResults.className = "suggestion-no-results";
        noResults.textContent = "Nenhum filme encontrado.";
        this.suggestions.appendChild(noResults);
      } else {
        movies.forEach((movie) => {
          const item = document.createElement("div");
          item.className = "suggestion-item";

          const posterSrc =
            movie.Poster !== "N/A"
              ? movie.Poster
              : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=80&q=80";
          const displayTitle = movie.TitlePT || movie.Title;

          item.innerHTML = `
            <img class="suggestion-poster" src="${posterSrc}" alt="${displayTitle}">
            <div class="suggestion-info">
              <span class="suggestion-title">${displayTitle}</span>
              <span class="suggestion-year">${movie.Year}</span>
            </div>
          `;

          item.onclick = () => {
            this.appState.addMovie(movie.imdbID).then((success) => {
              if (success) {
                this.searchInput.value = "";
                this.hideSuggestions();
              }
            });
          };

          this.suggestions.appendChild(item);
        });
      }

      this.suggestions.classList.remove("hide");
    } catch (err) {
      console.error(err);
    }
  }
}
