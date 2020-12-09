'use strict';

//dependencies:
const express = require('express');
const app = express();
const superagent = require('superagent');
const pg = require('pg');
const methodOverride = require('method-override');
require('dotenv').config();
require('ejs');
const PORT = process.env.PORT || 3000;
const client = new pg.Client(process.env.DATABASE_URL);

client.on('error', err => console.err(err));

app.use(methodOverride('_method'));
app.use(express.static('./public'));
app.use(express.urlencoded({extended: true}));
app.set('view engine', 'ejs');

/////////////////////////////////////////

//routes&callbacks:
app.get('/', renderBooks);
app.get('/searches/new', showForm);
app.post('/searches', createSearch);
app.get('/books/:id', viewDetail);
app.post('/books', addBook);
app.put('/update/:id', updateBook);
app.get('/showForm/:id', showUpdate);
app.delete('/delete/:id', deleteBook);

////////////////////////////////////////

//selects everything from the book database and displays it to the index page
function renderBooks(req, res){
  let SQL =  `SELECT * FROM books;`;

  client.query(SQL)
  .then(query => {
    console.log(query.rows);
    res.render('./pages/index', {results: query.rows});
  })
  .catch(err => console.error(err));
}

//renders the book search form
function showForm(req, res) {
  res.render('pages/searches/new.ejs');
}

//searches the API for the users search, then runs results through a constructor and displays to the page
function createSearch(req, res){
  let url = 'https://www.googleapis.com/books/v1/volumes?q='

  if(req.body.search[1] === 'title') {url += `+intitle:${req.body.search[0]}`;}
  if(req.body.search[1] === 'author') {url += `+inauthor:${req.body.search[0]}`;}

  superagent.get(url)
  .then(data => {
    return data.body.items.map(book => {
      return new Book(book.volumeInfo);
    });
  })
  .then(results => {
    res.render('pages/searches/show.ejs', { searchResults: JSON.stringify(results) });
  })
  .catch(err => {
    console.error(err);
    res.render('pages/error', err);
  });
}

//selects the individual book from the database and displays the details
function viewDetail(req,res){
  let id = req.params.id;
  let SQL = `SELECT * FROM books WHERE id = '${id}';`
  let display = false;

  return client.query(SQL)
  .then(data => {
    res.render('./pages/detailView', {book: data.rows[0], display: display});
  });
}

//adds book to database and then displays the detail page
function addBook(req,res){
  let { author, title, isbn, image_url, description } = req.body;
  let SQL = 'INSERT INTO books(author, title, isbn, image_url, description) VALUES ($1, $2, $3, $4, $5);';
  let values = [author, title, isbn, image_url, description];
  
  client.query(SQL, values)
  .then(book => {
    let SQL2 = `SELECT * FROM books WHERE title = '${title}';`
    client.query(SQL2)
    .then(data => {
      console.log(data.rows);
      res.render('./pages/detailView', {book: data.rows[0], display: false});
    });
    
  })
  .catch(err => console.error(err));
}

//updates book in database with new information from form
function updateBook(req,res){
  let bookId = req.params.id;
  let {title, author, description, isbn} = req.body;
  let SQL = `UPDATE books SET title=$1, author=$2, description=$3, isbn=$4 WHERE id='${bookId}';`
  let values = [title, author, description, isbn];

  client.query(SQL, values)
  .then(res.redirect(`/books/${bookId}`))
  .catch(err => {console.error(err)});
}

function showUpdate(req,res){
  let id = req.params.id;
  let SQL = `SELECT * FROM books WHERE id = '${id}';`
  let display = true;

  return client.query(SQL)
  .then(data => {
    res.render('./pages/detailView', {book: data.rows[0], display: display});
  });
}

//deletes book from database and redirects to home page
function deleteBook(req,res){
  let bookId = req.params.id;
  console.log(bookId);
  let SQL = `DELETE FROM books WHERE id='${bookId}';`;

  client.query(SQL)
  .then(res.redirect('/'))
  .catch(err => {console.error(err)});
}

//renders a standard 404
function renderError(req,res){
  res.render('pages/error');
}

//constructor:
function Book(info){
  this.title = info.title ? info.title : 'No title availible';
  this.author = info.authors ? info.authors[0] : 'No author availible'
  this.description = info.description ? info.description : 'No description provided';
  this.img = info.imageLinks ? info.imageLinks.thumbnail : 'https://www.freeiconspng.com/uploads/book-icon--icon-search-engine-6.png';
  this.isbn = info.industryIdentifiers ? info.industryIdentifiers[0].identifier : 'No ISBN provided';
}

client.connect()
.then(() => {
  app.listen(PORT, () => {
    console.log(`server up on port ${PORT}`);
  });
})