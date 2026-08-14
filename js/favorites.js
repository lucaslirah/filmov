import { MovieData } from './MovieData.js'

export class Favorites {
  constructor(root) {
    this.root = document.querySelector(root)
    this.API_URL = 'http://localhost:3333'
    
    // Auth State
    this.currentUser = JSON.parse(localStorage.getItem('@Filmov:user')) || null
    
    // Data lists
    this.movieEntries = []       // Movies to render in the active tab
    this.allActiveNotes = []     // Cache of all active notes globally for stats
    this.activeTab = 'all'       // 'all', 'my', 'trash'
  }

  async load() {
    await this.fetchNotes()
  }

  async fetchNotes() {
    try {
      // 1. Fetch all active notes globally to compute average ratings and details
      const resAll = await fetch(`${this.API_URL}/movie_notes?all=true`)
      if (resAll.ok) {
        this.allActiveNotes = await resAll.json()
      }

      // 2. Fetch data based on active tab
      if (this.activeTab === 'all') {
        this.movieEntries = this.groupNotesByMovie(this.allActiveNotes)
      } else if (this.currentUser) {
        if (this.activeTab === 'my') {
          const resMy = await fetch(`${this.API_URL}/movie_notes?user_id=${this.currentUser.id}&is_deleted=0`)
          if (resMy.ok) {
            this.movieEntries = await resMy.json()
          }
        } else if (this.activeTab === 'trash') {
          const resTrash = await fetch(`${this.API_URL}/movie_notes?user_id=${this.currentUser.id}&is_deleted=1`)
          if (resTrash.ok) {
            this.movieEntries = await resTrash.json()
          }
        }
      } else {
        this.movieEntries = []
      }
    } catch (err) {
      console.error("Erro ao carregar dados da API:", err)
    }
  }

  groupNotesByMovie(notes) {
    const grouped = {}
    notes.forEach(note => {
      const imdbId = note.imdb_id || note.title
      if (!grouped[imdbId]) {
        grouped[imdbId] = {
          imdb_id: imdbId,
          Title: note.title,
          Year: note.year,
          Runtime: note.runtime,
          Poster: note.poster,
          notes: []
        }
      }
      grouped[imdbId].notes.push(note)
    });
    
    return Object.values(grouped).map(movie => {
      const totalRating = movie.notes.reduce((sum, n) => sum + (n.rating || 0), 0)
      movie.avgRating = movie.notes.length > 0 ? (totalRating / movie.notes.length).toFixed(1) : '0.0'
      return movie
    })
  }

  getMovieAvgRating(imdbId) {
    const notes = this.allActiveNotes.filter(n => n.imdb_id === imdbId)
    const total = notes.reduce((sum, n) => sum + (n.rating || 0), 0)
    return notes.length > 0 ? (total / notes.length).toFixed(1) : '0.0'
  }

  async addMovie(moviename) {
    try {
      if (!this.currentUser) {
        throw new Error('Por favor, faça login com o Google para poder favoritar filmes!')
      }

      // Check if user already favorited it in their active list
      const queryTitle = moviename.trim()
      let movieData = null

      // Search OMDb
      const searchResult = await MovieData.search(queryTitle)
      if (searchResult.Title === undefined) {
        throw new Error('Filme não encontrado no OMDb!')
      }
      movieData = searchResult

      const imdbId = movieData.imdbID || queryTitle // fallback or ID if search passed ID

      // Call API to create/restore note
      const res = await fetch(`${this.API_URL}/movie_notes/${this.currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: movieData.Title,
          description: '',
          rating: 5,
          imdb_id: imdbId,
          year: movieData.Year,
          runtime: movieData.Runtime,
          poster: movieData.Poster,
          tags: []
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao adicionar filme aos favoritos.')
      }

      await this.load()
      return true
    } catch (err) {
      alert(err.message)
      return false
    }
  }

  async softDeleteMovie(noteId) {
    try {
      const res = await fetch(`${this.API_URL}/movie_notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: 1 })
      })
      if (!res.ok) throw new Error('Erro ao enviar filme para o histórico/lixeira.')
      await this.load()
    } catch (err) {
      alert(err.message)
    }
  }

  async restoreMovie(noteId) {
    try {
      const res = await fetch(`${this.API_URL}/movie_notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: 0 })
      })
      if (!res.ok) throw new Error('Erro ao restaurar filme.')
      await this.load()
    } catch (err) {
      alert(err.message)
    }
  }

  async hardDeleteMovie(noteId) {
    try {
      const res = await fetch(`${this.API_URL}/movie_notes/${noteId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Erro ao excluir filme permanentemente.')
      await this.load()
    } catch (err) {
      alert(err.message)
    }
  }

  async deleteMovieGlobally(imdbId, title) {
    try {
      if (!this.currentUser || this.currentUser.email !== 'lucas.lira@gmail.com') {
        throw new Error('Permissão negada. Apenas o administrador pode realizar esta ação.')
      }

      if (confirm(`Tem certeza de que deseja remover o filme "${title}" da lista global? Isso excluirá o filme para todos os usuários.`)) {
        const res = await fetch(`${this.API_URL}/movie_notes/imdb/${imdbId}?user_email=${this.currentUser.email}`, {
          method: 'DELETE'
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || 'Erro ao remover filme globalmente.')
        }
        await this.load()
        this.update()
      }
    } catch (err) {
      alert(err.message)
    }
  }
}

export class FavoritesView extends Favorites {
  constructor(root) {
    super(root)

    this.tbody = this.root.querySelector('table tbody')
    this.loginBtn = this.root.querySelector('.google-login-btn')
    this.loginModal = document.getElementById('login-modal')
    this.movieDrawer = document.getElementById('movie-drawer')
    this.customLoginForm = document.getElementById('custom-login-form')

    // Initial render & setups
    this.init()
  }

  async init() {
    this.bindAuthEvents()
    this.bindTabEvents()
    this.bindDrawerEvents()
    this.onadd()
    this.onEnter()
    this.onInput()
    
    await this.load()
    this.update()
  }

  bindAuthEvents() {
    // Open Login modal
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('.google-login-btn')
      if (btn) {
        this.renderSavedAccount()
        this.loginModal.classList.remove('hide')
      }
    })

    // Close Login modal
    this.loginModal.querySelector('.close-modal').onclick = () => {
      this.loginModal.classList.add('hide')
    }
    this.loginModal.onclick = (e) => {
      if (e.target === this.loginModal) {
        this.loginModal.classList.add('hide')
      }
    }

    // Custom Login Form submit
    this.customLoginForm.onsubmit = async (e) => {
      e.preventDefault()
      const name = document.getElementById('custom-name').value.trim()
      const email = document.getElementById('custom-email').value.trim()
      if (name && email) {
        await this.loginUser(name, email, null)
      }
    }
  }

  renderSavedAccount() {
    const savedUser = JSON.parse(localStorage.getItem('@Filmov:savedUser'))
    const container = document.getElementById('saved-account-container')
    if (!container) return

    if (savedUser) {
      const avatarUrl = savedUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(savedUser.name)}`
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
      `
      container.classList.remove('hide')

      // Click to quick login
      container.querySelector('.saved-account-item').onclick = async () => {
        await this.loginUser(savedUser.name, savedUser.email, savedUser.avatar)
      }

      // Click to forget saved account
      container.querySelector('.saved-account-forget-btn').onclick = (e) => {
        e.stopPropagation()
        localStorage.removeItem('@Filmov:savedUser')
        this.renderSavedAccount()
      }
    } else {
      container.innerHTML = ''
      container.classList.add('hide')
    }
  }

  async loginUser(name, email, avatar) {
    try {
      const res = await fetch(`${this.API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, avatar })
      })
      
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao realizar login.')
      }

      this.currentUser = data
      localStorage.setItem('@Filmov:user', JSON.stringify(data))
      localStorage.setItem('@Filmov:savedUser', JSON.stringify({
        name: data.name,
        email: data.email,
        avatar: data.avatar
      }))
      
      // Clear inputs
      document.getElementById('custom-name').value = ''
      document.getElementById('custom-email').value = ''

      // Hide modal
      this.loginModal.classList.add('hide')

      // Refresh
      await this.load()
      this.update()
    } catch (err) {
      alert(err.message)
    }
  }

  logoutUser() {
    this.currentUser = null
    localStorage.removeItem('@Filmov:user')
    
    // Switch to all favorites tab on logout if we are on user tabs
    if (this.activeTab !== 'all') {
      this.activeTab = 'all'
      const tabs = this.root.querySelectorAll('.tab-btn')
      tabs.forEach(t => t.classList.remove('active'))
      this.root.querySelector('[data-tab="all"]').classList.add('active')
    }

    // Refresh UI
    this.load().then(() => this.update())
  }

  bindTabEvents() {
    const tabs = this.root.querySelectorAll('.tabs-nav .tab-btn')
    tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        tabs.forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        
        this.activeTab = tab.getAttribute('data-tab')
        await this.load()
        this.update()
      })
    })
  }

  bindDrawerEvents() {
    // Close Drawer
    this.movieDrawer.querySelector('.close-drawer').onclick = () => {
      this.movieDrawer.classList.add('hide')
    }
    this.movieDrawer.onclick = (e) => {
      if (e.target === this.movieDrawer) {
        this.movieDrawer.classList.add('hide')
      }
    }

    // Interactive Stars in Drawer Review Form
    const starBtns = this.movieDrawer.querySelectorAll('.star-btn')
    starBtns.forEach(star => {
      star.onclick = () => {
        const rating = parseInt(star.getAttribute('data-star'))
        this.selectedRating = rating
        this.renderDrawerStarsInput(rating)
      }
      
      star.onmouseenter = () => {
        const rating = parseInt(star.getAttribute('data-star'))
        this.renderDrawerStarsInput(rating, true)
      }

      star.onmouseleave = () => {
        this.renderDrawerStarsInput(this.selectedRating || 5)
      }
    })

    // Save Review
    const saveReviewBtn = document.getElementById('save-review-btn')
    saveReviewBtn.onclick = async () => {
      if (!this.currentUser) return
      
      const commentText = document.getElementById('review-comment').value.trim()
      const rating = this.selectedRating || 5
      
      try {
        if (this.activeDrawerMovieNoteId) {
          // Update existing note
          const res = await fetch(`${this.API_URL}/movie_notes/${this.activeDrawerMovieNoteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rating,
              description: commentText
            })
          })
          if (!res.ok) throw new Error('Erro ao atualizar sua crítica.')
        } else {
          // Create new note
          const res = await fetch(`${this.API_URL}/movie_notes/${this.currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: this.activeDrawerMovie.Title,
              description: commentText,
              rating,
              imdb_id: this.activeDrawerMovie.imdb_id,
              year: this.activeDrawerMovie.Year,
              runtime: this.activeDrawerMovie.Runtime,
              poster: this.activeDrawerMovie.Poster,
              tags: []
            })
          })
          if (!res.ok) throw new Error('Erro ao enviar sua crítica.')
        }

        // Refresh and reopen drawer to show comments updated
        await this.load()
        this.update()
        
        // Re-render drawer for same movie
        const updatedNotes = this.allActiveNotes.filter(n => n.imdb_id === this.activeDrawerMovie.imdb_id)
        this.activeDrawerMovie.notes = updatedNotes
        this.activeDrawerMovie.avgRating = this.getMovieAvgRating(this.activeDrawerMovie.imdb_id)
        this.openDrawer(this.activeDrawerMovie)
      } catch (err) {
        alert(err.message)
      }
    }
  }

  renderDrawerStarsInput(rating, isHover = false) {
    const starBtns = this.movieDrawer.querySelectorAll('.star-btn')
    starBtns.forEach(star => {
      const starVal = parseInt(star.getAttribute('data-star'))
      const icon = star.querySelector('i')
      
      if (starVal <= rating) {
        star.classList.add(isHover ? 'hover' : 'active')
        icon.className = 'ph ph-star-fill'
      } else {
        star.classList.remove('active', 'hover')
        icon.className = 'ph ph-star'
      }
    })
  }

  openDrawer(movie) {
    this.activeDrawerMovie = movie
    this.activeDrawerMovieNoteId = null
    this.selectedRating = 5
    
    // Set poster, title, etc.
    const posterSrc = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=150&q=200'
    document.getElementById('drawer-poster').src = posterSrc
    document.getElementById('drawer-title').textContent = movie.Title
    document.getElementById('drawer-year').textContent = movie.Year
    document.getElementById('drawer-runtime').textContent = movie.Runtime
    document.getElementById('drawer-avg-rating').textContent = movie.avgRating || this.getMovieAvgRating(movie.imdb_id)
    
    // Render list of owners avatars
    const ownersContainer = document.getElementById('drawer-owners')
    ownersContainer.innerHTML = ''
    
    const notesList = movie.notes || this.allActiveNotes.filter(n => n.imdb_id === movie.imdb_id)
    
    notesList.forEach(note => {
      const avatarUrl = note.user_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(note.user_name)}`
      const img = document.createElement('img')
      img.className = 'owner-avatar-img'
      img.src = avatarUrl
      img.title = note.user_name
      img.alt = note.user_name
      ownersContainer.appendChild(img)
    })

    if (notesList.length === 0) {
      ownersContainer.innerHTML = `<span style="font-size: 1.2rem; color: var(--fc-secondary); font-style: italic;">Ninguém ainda</span>`
    }

    // Render review list comments
    const reviewsListContainer = document.getElementById('drawer-reviews-list')
    reviewsListContainer.innerHTML = ''
    
    const notesWithComments = notesList.filter(note => note.description.trim())
    
    if (notesWithComments.length === 0) {
      reviewsListContainer.innerHTML = `<div class="no-reviews">Nenhum comentário escrito para este filme ainda.</div>`
    } else {
      notesWithComments.forEach(note => {
        const item = document.createElement('div')
        item.className = 'review-item'
        
        const avatarUrl = note.user_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(note.user_name)}`
        
        let starsHTML = ''
        for (let i = 1; i <= 5; i++) {
          starsHTML += i <= note.rating ? '<i class="ph ph-star-fill"></i>' : '<i class="ph ph-star"></i>'
        }

        const dateStr = note.updated_at ? note.updated_at.split(' ')[0] : 'Recentemente'

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
          <p class="review-comment-text">${note.description}</p>
          <span class="review-date">${dateStr}</span>
        `
        reviewsListContainer.appendChild(item)
      })
    }

    // Render personal review form
    const reviewForm = document.getElementById('drawer-review-form')
    const warning = reviewForm.querySelector('.login-warning')
    const content = reviewForm.querySelector('.form-content')
    
    if (!this.currentUser) {
      warning.classList.remove('hide')
      content.classList.add('hide')
    } else {
      warning.classList.add('hide')
      content.classList.remove('hide')
      
      // Check if logged in user already left a note for this movie
      const myNote = notesList.find(n => n.user_id === this.currentUser.id)
      
      if (myNote) {
        this.activeDrawerMovieNoteId = myNote.id
        this.selectedRating = myNote.rating || 5
        document.getElementById('review-comment').value = myNote.description || ''
        this.movieDrawer.querySelector('#save-review-btn').textContent = 'Atualizar Crítica'
      } else {
        this.activeDrawerMovieNoteId = null
        this.selectedRating = 5
        document.getElementById('review-comment').value = ''
        this.movieDrawer.querySelector('#save-review-btn').textContent = 'Adicionar aos Favoritos e Avaliar'
      }
      
      this.renderDrawerStarsInput(this.selectedRating)
    }

    // Show Drawer
    this.movieDrawer.classList.remove('hide')
  }

  update() {
    this.removeAllTr()
    this.updateProfileHeader()
    this.updateTabsStates()

    this.movieEntries.forEach(movie => {
      const row = this.createRow(movie)
      this.tbody.appendChild(row)
    })

    this.showOrHideNoFavorites()
  }

  updateProfileHeader() {
    const container = document.getElementById('user-profile-header')
    container.innerHTML = ''
    
    if (this.currentUser) {
      const avatarUrl = this.currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(this.currentUser.name)}`
      
      container.innerHTML = `
        <div class="user-profile-badge">
          <img src="${avatarUrl}" alt="${this.currentUser.name}">
          <span class="user-name">${this.currentUser.name}</span>
          <button class="logout-btn" title="Sair"><i class="ph ph-sign-out"></i></button>
        </div>
      `
      
      // Bind logout button click
      container.querySelector('.logout-btn').onclick = () => {
        this.logoutUser()
      }
    } else {
      container.innerHTML = `
        <button class="google-login-btn">
          <i class="ph ph-sign-in"></i> Entrar
        </button>
      `
    }
  }

  updateTabsStates() {
    const myTab = this.root.querySelector('[data-tab="my"]')
    const trashTab = this.root.querySelector('[data-tab="trash"]')
    
    if (this.currentUser) {
      myTab.removeAttribute('disabled')
      myTab.removeAttribute('title')
      trashTab.removeAttribute('disabled')
      trashTab.removeAttribute('title')
    } else {
      myTab.setAttribute('disabled', 'true')
      myTab.setAttribute('title', 'Faça login para ver seus favoritos')
      trashTab.setAttribute('disabled', 'true')
      trashTab.setAttribute('title', 'Faça login para ver a lixeira')
    }
  }

  createRow(movieOrNote) {
    const tr = document.createElement('tr')
    
    // Unify variables between grouped movie (tab 'all') and single note (tab 'my', 'trash')
    const isGrouped = this.activeTab === 'all'
    const imdbId = movieOrNote.imdb_id || movieOrNote.title
    const title = movieOrNote.Title || movieOrNote.title
    const year = movieOrNote.Year || movieOrNote.year
    const runtime = movieOrNote.Runtime || movieOrNote.runtime
    const poster = movieOrNote.Poster || movieOrNote.poster
    const posterSrc = poster && poster !== 'N/A' ? poster : 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=150&q=200'
    const rating = isGrouped ? movieOrNote.avgRating : this.getMovieAvgRating(imdbId)
    const noteId = movieOrNote.id // exists if it is an individual note

    tr.innerHTML = `
      <td class="movie-poster">
        <div class="poster-wrapper">
          <img src="${posterSrc}" alt="${title}">
          <div class="avg-rating-badge">
            <i class="ph ph-star-fill"></i>
            <span>${rating}</span>
          </div>
        </div>
      </td>
      <td class="movie-title">${title}</td>
      <td class="movie-year">${year}</td>
      <td class="movie-runtime">${runtime}</td>
      <td class="movie-actions">
        <!-- Render buttons based on active tab -->
      </td>
    `

    // Open comments drawer on title click or poster click
    tr.querySelector('.movie-title').onclick = () => {
      this.openDrawer(movieOrNote)
    }
    tr.querySelector('.poster-wrapper').onclick = () => {
      this.openDrawer(movieOrNote)
    }

    // Configure actions column
    const actionsTd = tr.querySelector('.movie-actions')
    
    if (this.activeTab === 'all') {
      if (this.currentUser) {
        // Check if user already favorited it
        const userNotes = movieOrNote.notes || []
        const alreadyFavorited = userNotes.some(n => n.user_id === this.currentUser.id)
        
        if (alreadyFavorited) {
          const btn = document.createElement('button')
          btn.className = 'remove'
          btn.title = 'Remover dos meus favoritos'
          btn.innerHTML = '<i class="ph ph-x-circle"></i>'
          btn.onclick = () => {
            const myNote = userNotes.find(n => n.user_id === this.currentUser.id)
            if (myNote && confirm(`Remover ${title} de seus favoritos?`)) {
              this.softDeleteMovie(myNote.id)
            }
          }
          actionsTd.appendChild(btn)
        } else {
          // Show quick favorite star button
          const btn = document.createElement('button')
          btn.style.cssText = 'border:none; background:none; color:#ffc800; font-size:2.5rem; cursor:pointer; transition: transform 0.2s;'
          btn.title = 'Adicionar aos meus favoritos'
          btn.innerHTML = '<i class="ph ph-star"></i>'
          btn.onmouseover = () => btn.style.transform = 'scale(1.2)'
          btn.onmouseout = () => btn.style.transform = 'scale(1)'
          btn.onclick = () => {
            this.addMovie(imdbId)
          }
          actionsTd.appendChild(btn)
        }

        // Render global delete for admin user
        if (this.currentUser.email === 'lucas.lira@gmail.com') {
          const adminBtn = document.createElement('button')
          adminBtn.className = 'remove'
          adminBtn.title = 'Remover da lista global (Admin)'
          adminBtn.innerHTML = '<i class="ph ph-trash"></i>'
          adminBtn.style.marginLeft = '1rem'
          adminBtn.onclick = () => {
            this.deleteMovieGlobally(imdbId, title)
          }
          actionsTd.appendChild(adminBtn)
        }
      } else {
        // Disabled star showing login prompt
        const span = document.createElement('span')
        span.style.cssText = 'color: var(--fc-secondary); font-size: 1.4rem; font-style: italic;'
        span.textContent = '—'
        actionsTd.appendChild(span)
      }
    } else if (this.activeTab === 'my') {
      const btn = document.createElement('button')
      btn.className = 'remove'
      btn.title = 'Remover'
      btn.innerHTML = '<i class="ph ph-x-circle"></i>'
      btn.onclick = () => {
        if (confirm(`Mover ${title} para o histórico / lixeira?`)) {
          this.softDeleteMovie(noteId)
        }
      }
      actionsTd.appendChild(btn)
    } else if (this.activeTab === 'trash') {
      // Restore Button
      const restoreBtn = document.createElement('button')
      restoreBtn.style.cssText = 'border:none; background:none; color:var(--bg-color-secondary); font-size:2.4rem; cursor:pointer; margin-right:1rem;'
      restoreBtn.title = 'Restaurar filme'
      restoreBtn.innerHTML = '<i class="ph ph-arrow-counter-clockwise"></i>'
      restoreBtn.onclick = () => {
        this.restoreMovie(noteId)
      }
      
      // Delete Permanent Button
      const deletePermBtn = document.createElement('button')
      deletePermBtn.className = 'remove'
      deletePermBtn.title = 'Excluir permanentemente'
      deletePermBtn.innerHTML = '<i class="ph ph-trash"></i>'
      deletePermBtn.onclick = () => {
        if (confirm(`Excluir permanentemente ${title}? Essa ação não pode ser desfeita.`)) {
          this.hardDeleteMovie(noteId)
        }
      }

      actionsTd.appendChild(restoreBtn)
      actionsTd.appendChild(deletePermBtn)
    }

    return tr
  }

  removeAllTr() {
    if (this.tbody) {
      this.tbody.querySelectorAll('tr').forEach(tr => tr.remove())
    }
  }

  showOrHideNoFavorites() {
    const noFavorites = this.root.querySelector('.no-favorites')
    if (!noFavorites) return

    const emptyMessage = document.getElementById('empty-message')

    if (this.movieEntries.length === 0) {
      noFavorites.classList.remove('hide')
      
      // Set localized empty messages
      if (this.activeTab === 'all') {
        emptyMessage.textContent = 'Nenhum filme favoritado no sistema.'
      } else if (this.activeTab === 'my') {
        emptyMessage.textContent = 'Você não possui nenhum favorito ativo.'
      } else if (this.activeTab === 'trash') {
        emptyMessage.textContent = 'Seu histórico de lixeira está vazio.'
      }
    } else {
      noFavorites.classList.add('hide')
    }
  }

  onadd() {
    const favButton = this.root.querySelector('.fav-button')
    favButton.onclick = () => {
      const searchInput = this.root.querySelector('#search-input')
      const { value } = searchInput
      if (value.trim()) {
        this.addMovie(value).then(success => {
          if (success) {
            searchInput.value = ''
            this.hideSuggestions()
          }
        })
      }
    }
  }

  onEnter() {
    const searchInput = this.root.querySelector('#search-input')
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const { value } = searchInput
        if (value.trim()) {
          this.addMovie(value).then(success => {
            if (success) {
              searchInput.value = ''
              this.hideSuggestions()
            }
          })
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

      if (query.length < 2) {
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
      if (suggestions && !suggestions.contains(event.target) && event.target !== searchInput) {
        this.hideSuggestions()
      }
    })
  }

  hideSuggestions() {
    const suggestions = this.root.querySelector('#search-suggestions')
    if (suggestions) {
      suggestions.classList.add('hide')
      suggestions.innerHTML = ''
    }
  }

  async fetchAndShowSuggestions(query) {
    const suggestions = this.root.querySelector('#search-suggestions')
    if (!suggestions) return
    
    try {
      const movies = await MovieData.searchList(query)
      suggestions.innerHTML = ''

      if (movies.length === 0) {
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
            this.addMovie(movie.imdbID).then(success => {
              if (success) {
                const searchInput = this.root.querySelector('#search-input')
                searchInput.value = ''
                this.hideSuggestions()
              }
            })
          }

          suggestions.appendChild(item)
        })
      }

      suggestions.classList.remove('hide')
    } catch (err) {
      console.error(err)
    }
  }
}
