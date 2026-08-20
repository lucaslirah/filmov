import { MovieData } from "./MovieData.js";

export class Favorites {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.API_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
      ? "http://localhost:3333"
      : "https://filmov-api.onrender.com";

    // Auth State
    this.currentUser = JSON.parse(localStorage.getItem("@Filmov:user")) || null;

    // Data lists
    this.movieEntries = []; // Movies to render in the active tab
    this.allActiveNotes = []; // Cache of all active notes globally for stats
    this.activeTab = "all"; // 'all', 'my', 'trash'
  }

  async load() {
    await this.fetchNotes();
    if (this.onUpdate) {
      this.onUpdate();
    }
  }

  async fetchNotes() {
    try {
      // 1. Fetch all active notes globally to compute average ratings and details
      const resAll = await fetch(`${this.API_URL}/movie_notes?all=true`);
      if (resAll.ok) {
        this.allActiveNotes = await resAll.json();
      }

      // 2. Fetch data based on active tab
      if (this.activeTab === "all") {
        this.movieEntries = this.groupNotesByMovie(this.allActiveNotes);
      } else if (this.currentUser) {
        if (this.activeTab === "my") {
          const resMy = await fetch(
            `${this.API_URL}/movie_notes?user_id=${this.currentUser.id}&is_deleted=0`,
          );
          if (resMy.ok) {
            const data = await resMy.json();
            this.movieEntries = data.sort((a, b) => b.id - a.id);
          }
        } else if (this.activeTab === "trash") {
          const resTrash = await fetch(
            `${this.API_URL}/movie_notes?user_id=${this.currentUser.id}&is_deleted=1`,
          );
          if (resTrash.ok) {
            const data = await resTrash.json();
            this.movieEntries = data.sort((a, b) => b.id - a.id);
          }
        }
      } else {
        this.movieEntries = [];
      }
    } catch (err) {
      console.error("Erro ao carregar dados da API:", err);
    }
  }

  groupNotesByMovie(notes) {
    const grouped = {};
    notes.forEach((note) => {
      const imdbId = note.imdb_id || note.title;
      if (!grouped[imdbId]) {
        grouped[imdbId] = {
          imdb_id: imdbId,
          Title: note.title,
          Year: note.year,
          Runtime: note.runtime,
          Poster: note.poster,
          imdb_rating: note.imdb_rating,
          rotten_rating: note.rotten_rating,
          notes: [],
        };
      }
      grouped[imdbId].notes.push(note);
    });

    return Object.values(grouped)
      .map((movie) => {
        const ratedNotes = movie.notes.filter((n) => n.rating > 0);
        const totalRating = ratedNotes.reduce((sum, n) => sum + n.rating, 0);
        movie.avgRating =
          ratedNotes.length > 0
            ? (totalRating / ratedNotes.length).toFixed(1)
            : "0.0";
        // Calculate maxId of notes in this movie to represent the most recent add
        movie.maxId = Math.max(...movie.notes.map((n) => n.id || 0));
        return movie;
      })
      .sort((a, b) => b.maxId - a.maxId);
  }

  getMovieAvgRating(imdbId) {
    const notes = this.allActiveNotes.filter(
      (n) => n.imdb_id === imdbId && n.rating > 0,
    );
    const total = notes.reduce((sum, n) => sum + n.rating, 0);
    return notes.length > 0 ? (total / notes.length).toFixed(1) : "0.0";
  }

  async addMovie(moviename) {
    try {
      if (!this.currentUser) {
        throw new Error(
          "Por favor, faça login com o Google para poder favoritar filmes!",
        );
      }

      // Check if user already favorited it in their active list
      const queryTitle = moviename.trim();
      let movieData = null;

      // Search OMDb
      const searchResult = await MovieData.search(queryTitle);
      if (searchResult.Title === undefined) {
        throw new Error("Filme não encontrado no OMDb!");
      }
      movieData = searchResult;

      const imdbId = movieData.imdbID || queryTitle; // fallback or ID if search passed ID

      // Call API to create/restore note
      const res = await fetch(
        `${this.API_URL}/movie_notes/${this.currentUser.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: movieData.Title,
            description: "",
            rating: 0,
            imdb_id: imdbId,
            year: movieData.Year,
            runtime: movieData.Runtime,
            poster: movieData.Poster,
            imdb_rating: movieData.imdbRating,
            rotten_rating: movieData.rottenRating,
            tags: [],
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "Erro ao adicionar filme aos favoritos.",
        );
      }

      await this.load();
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  }

  async softDeleteMovie(noteId) {
    try {
      const res = await fetch(`${this.API_URL}/movie_notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_deleted: 1 }),
      });
      if (!res.ok)
        throw new Error("Erro ao enviar filme para o histórico/lixeira.");
      await this.load();
    } catch (err) {
      alert(err.message);
    }
  }

  async restoreMovie(noteId) {
    try {
      const res = await fetch(`${this.API_URL}/movie_notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_deleted: 0 }),
      });
      if (!res.ok) throw new Error("Erro ao restaurar filme.");
      await this.load();
    } catch (err) {
      alert(err.message);
    }
  }

  async hardDeleteMovie(noteId) {
    try {
      const res = await fetch(`${this.API_URL}/movie_notes/${noteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao excluir filme permanentemente.");
      await this.load();
    } catch (err) {
      alert(err.message);
    }
  }

  async deleteMovieGlobally(imdbId) {
    try {
      if (
        !this.currentUser ||
        this.currentUser.email !== "lucas.lira@gmail.com"
      ) {
        throw new Error(
          "Permissão negada. Apenas o administrador pode realizar esta ação.",
        );
      }

      const res = await fetch(
        `${this.API_URL}/movie_notes/imdb/${imdbId}?user_email=${this.currentUser.email}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erro ao remover filme globalmente.");
      }
      await this.load();
    } catch (err) {
      alert(err.message);
    }
  }
}
