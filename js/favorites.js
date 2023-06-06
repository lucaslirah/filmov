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
        localStorage.removeItem('@OMDB-movies-favorites:', JSON.stringify(this.movieEntries))

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

    console.log(filteredMovieEntries)
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
  }

  onadd(){
    const favButton = this.root.querySelector('.fav-button')
    favButton.onclick = () => {
      const { value } = this.root.querySelector('#search-input')
      this.addMovie(value)
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
    this.tbody.querySelectorAll('tr').forEach(tr => tr.remove())
  }

  showOrHideNoFavorites(){
    const noFavorites = this.root.querySelector('.no-favorites')
    
    if(this.movieEntries == 0){
      noFavorites.classList.remove('hide')
    }else{
      noFavorites.classList.add('hide')
    }
  }
}