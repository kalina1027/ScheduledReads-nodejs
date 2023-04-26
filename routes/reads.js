var express = require('express');
var router = express.Router();

const fs = require('fs');

//Session
session = require('express-session');
router.use(session({
    secret: 'random string',
    resave: true,
    saveUninitialized: true,
}));

sqlite3 = require('sqlite3');
db = new sqlite3.Database('reads.sqlitedb');
db.serialize();
db.run(`CREATE TABLE IF NOT EXISTS reads(
    id INTEGER PRIMARY KEY,
    user TEXT,
    cover TEXT,
    title TEXT,
    author TEXT,
    date_started TEXT,
    date_finished TEXT,
    current_page INTEGER,
    pages INTEGER)`
);
db.parallelize();

fileUpload = require('express-fileupload');
router.use(fileUpload());

bcrypt = require('bcryptjs');
users = require('./passwd.json');

//Login
router.get('/login', function(req, res) {
    res.render('login', {info: 'PLEASE LOGIN'});
});

router.post('/login', function(req, res){
    bcrypt.compare(req.body.password, users[req.body.username] || "", function(err, is_match) {
        if(err) throw err;
            if(is_match === true) {
                req.session.username = req.body.username;
                req.session.count = 0;
                res.redirect("/");
            } else {
                res.render('login', {warn: 'Wrong credentials! Please try again!'});
            }
        });
});

//Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect("/");
});


router.all('*', function(req, res, next) {
    if(!req.session.username) {
        res.redirect("/login");
        return;
    }
    next();
});

//Show books
router.get('/', function(req, res, next) {
    db.all('SELECT * FROM reads WHERE user = ? ORDER BY date_started DESC;', 
        req.session.username, 
        function(err, rows) {
            if(err) throw err;
            res.render('index', { info: req.session.username, rows: rows });
        }
    );
});

//Add Book
router.post('/upload',(req, res) => {
    url = '/images/no_image_icon.png';

    if(req.body.cover_url && req.body.cover_url != ''){
        url = req.body.cover_url;
    }
    if(req.files && req.files.cover && req.files.cover != null && req.files.cover != '') {
        let filename = req.files.cover.name.split('.');
        req.files.cover.mv('./public/images/' + req.files.cover.name, (err) => {
            if (err) throw err;
            
        });
        url = '/images/' + filename[0] + '.' + filename[1];
        /*fs.rename('../public/images/' + req.files.cover.name, '../public/images/' + filename[0] + '_' + Date.now() + '.' + filename[1], function(err) {
            if ( err ) {}
            url = '/images/' + filename[0] + '_' + Date.now() + '.' + filename[1];
        });*/
    }
    let currentPage=req.body.current_page;
    if(req.body.current_page > req.body.total_pages)
        currentPage=req.body.total_pages;
    if(req.body.date_finished && req.body.date_finished != '')
        currentPage=req.body.total_pages;


    db.run(`
        INSERT INTO reads( user, cover, title, author, date_started, date_finished, current_page, pages) 
        VALUES ( ?, ?, ?, ?, ?, ?, ?, ?) `,
        [
            req.session.username,
            url,
            req.body.title, 
            req.body.author || '',
            req.body.date_started || '',
            req.body.date_finished || '',
            currentPage || '0',
            req.body.total_pages || '0',
        ],
        (err) => {
            if(err) throw err;
            res.redirect('/');
        }
    );
});

//Delete
router.post('/delete', (req, res) => {

	db.all('SELECT * FROM reads WHERE id = ? AND user = ? ;', req.body.id, req.session.username, function(err, rows) {
        if(err) throw err;
		if(rows.length > 0) {
			db.run('DELETE FROM reads WHERE id = ?', req.body.id, (err) => {
				if(err) throw err;
                res.redirect('/');
			});	
		} else {
			db.all('SELECT * FROM reads', (err, rows) => {
				if(err) throw err;
				res.render('index', { info: 'Access denied', rows: rows, userid: req.session.username });	
			});		
		}
    });
});

//Update
router.post('/update', (req, res) => {
    let url = '/images/no_image_icon.png';

    if(req.body.cover_url && req.body.cover_url != ''){
        url = req.body.cover_url;
    }
    else if(req.body.cover_previous && req.body.cover_previous != '' && req.body.cover_url == '') {
        url = req.body.cover_previous;
    }
    if(req.files && req.files.cover_update && req.files.cover_update != null && req.files.cover_update != '') {
        let filename = req.files.cover_update.name.split('.');
        req.files.cover_update.mv('./public/images/' + req.files.cover_update.name, (err) => {
            if (err) throw err;
        });
        url = '/images/' + filename[0] + '.' + filename[1];
        /*fs.rename('../public/images/' + req.files.cover_update.name, '../public/images/' + filename[0] + '_' + Date.now() + '.' + filename[1], function(err) {
            if ( err ) {}
            url = '/images/' + filename[0] + '_' + Date.now() + '.' + filename[1];
        });*/
    }
    else if(req.body.cover_previous && req.body.cover_previous != '' && req.body.cover_url == '') {
        url = req.body.cover_previous;
    }

    let currentPage=req.body.current_page;
    if(req.body.current_page > req.body.total_pages)
        currentPage=req.body.total_pages;
    if(req.body.date_finished && req.body.date_finished != '')
        currentPage=req.body.total_pages;

    db.run(`UPDATE reads SET
        user = ?, 
        cover = ?,
        title = ?, 
        author = ?, 
        date_started = ?, 
        date_finished = ?, 
        current_page = ?, 
        pages = ?
        WHERE id = ?;`,
        req.session.username,
        url,
        req.body.title, 
        req.body.author || '',
        req.body.date_started || '',
        req.body.date_finished || '',
        currentPage || 0,
        req.body.total_pages || 0,
        req.body.id,
        
        (err) => {
            if(err) throw err;
            res.redirect('/');
    });
});

router.all('*', function(req, res) {
    res.send("No such page or action! Go to: <a href='/'>main page</a>");
});

module.exports = router;
