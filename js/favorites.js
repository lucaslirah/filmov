import { MovieData } from './MovieData.js'

export class Favorites{
  constructor(root){
    this.root = document.querySelector(root)

    this.load()
    this.clear()
  }

  load(){
    this.movieEntries = JSON.parse(localStorage.getItem('@OMDB-movies-favorites:'))|| []
    this.showOrHideNoFavorites()
  }

  save(){
    localStorage.setItem('@OMDB-movies-favorites:', JSON.stringify(this.movieEntries))
  }

  clear(){
    const clearButton = this.root.querySelector('.clear button')

    clearButton.onclick = () => {
      const isOk = confirm('Are you sure to remove all favorites?')
      
      if(isOk){
        localStorage.removeItem('@OMDB-movies-favorites:')
        this.movieEntries = []
        this.removeAllTr()
        this.load()
      }
    }
  }

  async addMovie(moviename){
    try{
      const movieExists = this.movieEntries.find(movieEntry => movieEntry.Title.toLowerCase() === moviename.toLowerCase())

      if(movieExists){
        throw new Error('Movie already added.')
      }

      const movie = await MovieData.search(moviename)
      
      if(movie.Title === undefined){
        throw new Error('Movie not found!')
      }

      // Check for duplicates again in case user clicked same movie through different title/id
      const duplicateByIdOrTitle = this.movieEntries.find(entry => entry.Title.toLowerCase() === movie.Title.toLowerCase())
      if(duplicateByIdOrTitle){
        throw new Error('Movie already added.')
      }

      this.movieEntries = [ movie, ...this.movieEntries ]

      this.save()
      this.update()
      this.showOrHideNoFavorites()
    }
    catch(Error){
      alert(Error.message)
    }
  }

  deleteMovie(movie){
    const filteredMovieEntries = this.movieEntries.filter(movieEntry => movieEntry.Title !== movie.Title)

    this.movieEntries = filteredMovieEntries

    this.save()
    this.update()
    this.showOrHideNoFavorites()
  }
}

export class FavoritesView extends Favorites{
  constructor(root){
    super(root)

    this.tbody = this.root.querySelector('table tbody')

    this.update()
    this.onadd()
    this.onEnter()
    this.onInput()
  }

  onadd(){
    const favButton = this.root.querySelector('.fav-button')
    favButton.onclick = () => {
      const searchInput = this.root.querySelector('#search-input')
      const { value } = searchInput
      if(value.trim()){
        this.addMovie(value)
        searchInput.value = ''
        this.hideSuggestions()
      }
    }
  }

  update(){
    this.removeAllTr()

    this.movieEntries.forEach(movie => {
      const row = this.createRow()

      row.querySelector('.movie-poster img').src = `${movie.Poster}`
      row.querySelector('.movie-title').textContent = `${movie.Title}`
      row.querySelector('.movie-year').textContent = `${movie.Year}`
      row.querySelector('.movie-runtime').textContent = `${movie.Runtime}`

      row.querySelector('.remove').onclick = () => {
        const isOk = confirm(`Remove ${movie.Title} from favorites?`)

        if(isOk){
          this.deleteMovie(movie)
        }
      }
  
      this.tbody.appendChild(row)
    })
  }

  createRow(){
    const tr = document.createElement('tr')

    tr.innerHTML = `
      <td class="movie-poster">
        <img src="https://github.com/lucaslirah.png" alt="Movie poster">
      </td>
      <td class="movie-title">
        Movie name
      </td>
      <td class="movie-year">
        Release year
      </td>
      <td class="movie-runtime">
        Movie runtime
      </td>
      <td>
        <button class="remove">
          <i class="ph ph-x-circle"></i>
        </button>
      </td>
    `

    return tr
  }
  
  removeAllTr(){
    if(this.tbody){
      this.tbody.querySelectorAll('tr').forEach(tr => tr.remove())
    }
  }

  showOrHideNoFavorites(){
    const noFavorites = this.root.querySelector('.no-favorites')
    
    if(!noFavorites) return

    if(this.movieEntries.length === 0){
      noFavorites.classList.remove('hide')
    }else{
      noFavorites.classList.add('hide')
    }
  }

  onEnter(){
    const searchInput = this.root.querySelector('#search-input')
    searchInput.addEventListener('keydown', (event) => {
      if(event.key === 'Enter'){
        const { value } = searchInput
        if(value.trim()){
          this.addMovie(value)
          searchInput.value = ''
          this.hideSuggestions()
        }
      }
    })
  }

  onInput() {
    const searchInput = this.root.querySelector('#search-input')
    let timeoutId

    searchInput.addEventListener('input', () => {
      clearTimeout(timeoutId)
      const query = searchInput.value.trim()

      if(query.length < 2) {
        this.hideSuggestions()
        return
      }

      timeoutId = setTimeout(() => {
        this.fetchAndShowSuggestions(query)
      }, 300)
    })

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.hideSuggestions()
      }
    })

    document.addEventListener('click', (event) => {
      const suggestions = this.root.querySelector('#search-suggestions')
      const searchInput = this.root.querySelector('#search-input')
      if(suggestions && !suggestions.contains(event.target) && event.target !== searchInput) {
        this.hideSuggestions()
      }
    })
  }

  hideSuggestions() {
    const suggestions = this.root.querySelector('#search-suggestions')
    if(suggestions) {
      suggestions.classList.add('hide')
      suggestions.innerHTML = ''
    }
  }

  async fetchAndShowSuggestions(query) {
    const suggestions = this.root.querySelector('#search-suggestions')
    if(!suggestions) return
    
    try {
      const movies = await MovieData.searchList(query)
      suggestions.innerHTML = ''

      if(movies.length === 0) {
        const noResults = document.createElement('div')
        noResults.className = 'suggestion-no-results'
        noResults.textContent = 'Nenhum filme encontrado.'
        suggestions.appendChild(noResults)
      } else {
        movies.forEach(movie => {
          const item = document.createElement('div')
          item.className = 'suggestion-item'
          
          const posterSrc = movie.Poster !== 'N/A' ? movie.Poster : 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=80&q=80'
          const displayTitle = movie.TitlePT || movie.Title
          
          item.innerHTML = `
            <img class="suggestion-poster" src="${posterSrc}" alt="${displayTitle}">
            <div class="suggestion-info">
              <span class="suggestion-title">${displayTitle}</span>
              <span class="suggestion-year">${movie.Year}</span>
            </div>
          `

          item.onclick = () => {
            this.addMovie(movie.imdbID)
            const searchInput = this.root.querySelector('#search-input')
            searchInput.value = ''
            this.hideSuggestions()
          }

          suggestions.appendChild(item)
        })
      }

      suggestions.classList.remove('hide')
    } catch(err) {
      console.error(err)
    }
  }
}
