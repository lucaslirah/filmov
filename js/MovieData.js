// const app = document.querySelector('#app')
// const p = document.createElement('p')
// p.textContent = `content`
// app.appendChild(p)

const API_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:3333"
  : "https://filmov-api.onrender.com";

export class MovieData{
  static async search(titleOrId){
    const param = /^tt\d+$/.test(titleOrId) ? 'i' : 't'
    const endpoint = `${API_URL}/omdb?${param}=${encodeURIComponent(titleOrId)}`

    try {
      let res = await fetch(endpoint)
      let movie = await res.json()
      
      if ((movie.Response === "False" || !movie.Title) && param === 't') {
        // If searching by title failed, try translating via Wikipedia
        const translated = await this.translateTitleViaWiki(titleOrId);
        if (translated && translated.toLowerCase() !== titleOrId.toLowerCase()) {
          const cleanTranslated = translated.replace(/\s*\([^)]*\)\s*$/, '');
          const retryEndpoint = `${API_URL}/omdb?t=${encodeURIComponent(cleanTranslated)}`
          res = await fetch(retryEndpoint)
          movie = await res.json()
        }
      }

      if(movie.Response === "False" || !movie.Title){
        return { Title: undefined }
      }

      // Translate title to Portuguese
      const ptTitle = await this.getPortugueseTitle(movie.imdbID || titleOrId, movie.Title)
      
      return {
        Title: ptTitle,
        Year: movie.Year,
        Runtime: movie.Runtime,
        Poster: movie.Poster,
        imdbRating: movie.imdbRating,
        rottenRating: (movie.Ratings || []).find(r => r.Source === "Rotten Tomatoes")?.Value || "N/A",
        imdbID: movie.imdbID,
        Plot: movie.Plot && movie.Plot !== "N/A" ? movie.Plot : null,
        Actors: movie.Actors && movie.Actors !== "N/A" ? movie.Actors : null
      }
    } catch(e) {
      console.error(e)
      return { Title: undefined }
    }
  }

  static async translateText(text) {
    if (!text || text === "N/A" || text === "Sinopse não disponível.") return text;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt-BR&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map(item => item[0]).filter(Boolean).join('');
          if (translated.trim()) {
            return translated;
          }
        }
      }
    } catch (e) {
      console.error("Erro na tradução primária da sinopse:", e);
    }

    // Fallback translation
    try {
      const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pt-BR`;
      const res = await fetch(fallbackUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.responseData && data.responseData.translatedText) {
          return data.responseData.translatedText;
        }
      }
    } catch (e) {
      console.error("Erro no fallback de tradução da sinopse:", e);
    }

    return text;
  }

  static async getDetails(titleOrId) {
    if (!titleOrId) return null;
    const param = /^tt\d+$/.test(titleOrId) ? 'i' : 't';
    const endpoint = `${API_URL}/omdb?${param}=${encodeURIComponent(titleOrId)}&plot=full`;
    
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.Response === "True") {
        let plot = data.Plot && data.Plot !== "N/A" ? data.Plot : "Sinopse não disponível.";
        if (plot && plot !== "Sinopse não disponível.") {
          plot = await this.translateText(plot);
        }

        return {
          Plot: plot,
          Actors: data.Actors && data.Actors !== "N/A" ? data.Actors : "Elenco não informado.",
          Director: data.Director && data.Director !== "N/A" ? data.Director : null,
          Genre: data.Genre && data.Genre !== "N/A" ? data.Genre : null
        };
      }
    } catch (e) {
      console.error("Erro ao buscar detalhes do filme no OMDb:", e);
    }
    return {
      Plot: "Sinopse não disponível.",
      Actors: "Elenco não informado."
    };
  }

  static async searchList(query){
    let searchResults = [];

    // Helper to query OMDb pages in parallel
    const runSearch = async (q) => {
      const fetchPage = async (page) => {
        const endpoint = `${API_URL}/omdb?s=${encodeURIComponent(q)}&page=${page}`
        try {
          const res = await fetch(endpoint)
          const data = await res.json()
          if(data.Response === "True"){
            return data.Search || []
          }
        } catch(e) {
          console.error(e)
        }
        return []
      }

      // Fetch pages 1 and 2 in parallel to double suggestions size
      const [p1, p2] = await Promise.all([fetchPage(1), fetchPage(2)])
      
      // Deduplicate results by imdbID
      const combined = [...p1, ...p2];
      const seen = new Set();
      return combined.filter(movie => {
        if (seen.has(movie.imdbID)) return false;
        seen.add(movie.imdbID);
        return true;
      });
    }

    // 1. Try search with full query
    searchResults = await runSearch(query);

    // 2. If no results, try partial matching by first word fallback
    const words = query.trim().split(/\s+/);
    if(searchResults.length === 0 && words.length > 1) {
      const firstWord = words.find(w => w.length >= 3) || words[0];
      if(firstWord && firstWord.length >= 2) {
        const rawResults = await runSearch(firstWord);
        // Filter locally: title must contain all words from original query
        searchResults = rawResults.filter(movie => {
          const title = movie.Title.toLowerCase();
          return words.every(w => title.includes(w.toLowerCase()));
        });
      }
    }

    // 3. If still no results, try translating via Wikipedia langlinks
    if(searchResults.length === 0) {
      const translated = await this.translateTitleViaWiki(query);
      if(translated && translated.toLowerCase() !== query.toLowerCase()) {
        const cleanTranslated = translated.replace(/\s*\([^)]*\)\s*$/, '');
        searchResults = await runSearch(cleanTranslated);
      }
    }

    // 4. Translate all results to Portuguese in parallel
    const promises = searchResults.map(async movie => {
      movie.TitlePT = await this.getPortugueseTitle(movie.imdbID, movie.Title);
    });
    await Promise.all(promises);

    return searchResults;
  }

  static async translateTitleViaWiki(query) {
    const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    try {
      const searchRes = await fetch(searchUrl)
      const searchData = await searchRes.json()
      if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
        return null;
      }
      
      const topWikiTitle = searchData.query.search[0].title;

      // Query langlinks for English title
      const langUrl = `https://pt.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=en&titles=${encodeURIComponent(topWikiTitle)}&format=json&origin=*`;
      const langRes = await fetch(langUrl)
      const langData = await langRes.json()
      
      const pages = langData.query.pages;
      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];
      
      if (page && page.langlinks && page.langlinks.length > 0) {
        return page.langlinks[0]["*"];
      }
      return topWikiTitle;
    } catch(e) {
      console.error("Wikipedia search/translation failed:", e)
    }
    return null;
  }

  static async getPortugueseTitle(imdbId, defaultTitle) {
    if (!imdbId) return defaultTitle;
    
    const query = `
      SELECT ?label ?alias WHERE {
        ?item wdt:P345 "${imdbId}" .
        OPTIONAL {
          ?item rdfs:label ?label .
          FILTER(LANG(?label) = "pt-br" || LANG(?label) = "pt")
        }
        OPTIONAL {
          ?item skos:altLabel ?alias .
          FILTER(LANG(?alias) = "pt-br" || LANG(?alias) = "pt")
        }
      }
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    
    try {
      const res = await fetch(url)
      const data = await res.json()
      const bindings = data.results.bindings;
      if (bindings.length > 0) {
        const ptBrAlias = bindings.find(b => b.alias && b.alias["xml:lang"] === "pt-br" && b.alias.value.toLowerCase() !== defaultTitle.toLowerCase());
        if (ptBrAlias) return ptBrAlias.alias.value;

        const ptBrLabel = bindings.find(b => b.label && b.label["xml:lang"] === "pt-br" && b.label.value.toLowerCase() !== defaultTitle.toLowerCase());
        if (ptBrLabel) return ptBrLabel.label.value;

        const ptAlias = bindings.find(b => b.alias && b.alias["xml:lang"] === "pt" && b.alias.value.toLowerCase() !== defaultTitle.toLowerCase());
        if (ptAlias) return ptAlias.alias.value;

        const ptLabel = bindings.find(b => b.label && b.label["xml:lang"] === "pt" && b.label.value.toLowerCase() !== defaultTitle.toLowerCase());
        if (ptLabel) return ptLabel.label.value;

        const anyPtBr = bindings.find(b => b.label && b.label["xml:lang"] === "pt-br") || bindings.find(b => b.alias && b.alias["xml:lang"] === "pt-br");
        if (anyPtBr) return anyPtBr.label ? anyPtBr.label.value : anyPtBr.alias.value;

        const anyPt = bindings.find(b => b.label && b.label["xml:lang"] === "pt") || bindings.find(b => b.alias && b.alias["xml:lang"] === "pt");
        if (anyPt) return anyPt.label ? anyPt.label.value : anyPt.alias.value;
      }
    } catch (e) {
      console.error("Error fetching Portuguese title from Wikidata:", e)
    }
    return defaultTitle;
  }
}
