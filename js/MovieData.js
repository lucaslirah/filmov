// const app = document.querySelector('#app')
// const p = document.createElement('p')
// p.textContent = `poha`
// app.appendChild(p)

export class MovieData{
  static search(title){
    const apiKey = '22fddf5e'

    const endpoint = `http://www.omdbapi.com/?t=${title}&apikey=${apiKey}`

    return fetch(endpoint)
    .then(data => data.json())
      .then(({Title,Year,Runtime,Poster}) => ({Title,Year,Runtime,Poster}))
  }
}