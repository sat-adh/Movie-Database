const express = require("express");
const app = express();
const pug = require("pug");
const session = require("express-session");
const fs = require("fs");

let users = require("./data/users.json");
let movies = require("./data/movies.json");

// movies.forEach(movie => {    //added reviews property to all movies
//     movie.Reviews = [];      //commented out after first time implementation 
// });                           
// updateMovie();


//referenced from https://www.w3schools.com/nodejs/nodejs_filesystem.asp  
function updateUser(){    //writes to users.json file whenever user updates their profile
    fs.writeFile('./data/users.json', JSON.stringify(users), (err) => {
        if (err) {
            console.log("Could not update user data.");
        }
        console.log("Modified user.");
      });
}

function updateMovie(){     //same idea as updateUser
    fs.writeFile('./data/movies.json', JSON.stringify(movies), (err) => {
        if (err) {
            console.log("Could not update movie data.");
        }
        // console.log("Modified movie.");
    });
}

app.use(express.urlencoded({extended: true}));
app.set('view engine', 'pug');
app.use(session({
    secret:"secret",
    resave: true,
    saveUninitialized: false
}));
app.use('/', (req,res,next) => {
    next();
});

// ROUTES

app.get('/MDAPI/', (req, res) => {
    res.send(pug.renderFile('./views/login.pug'));
});

app.get('/MDAPI/signup', (req, res) => {
    res.send(pug.renderFile('./views/signup.pug'));
});

app.get('/MDAPI/logout', (req, res) => {
    console.log(req.session.username + ": logged out.");
    req.session.destroy();
    res.redirect('/MDAPI');
});


app.get('/MDAPI/myProfile', (req, res) => {
    let foundUser = searchForUser(req.session.username);    //gets current user
    if(foundUser == null) {
        res.status(404);
        res.send("Could not load your profile.");
    }
    else {
        res.status(200);
        res.send(pug.renderFile('./views/myProfile.pug', {foundUser}));  
    }
});


app.post("/MDAPI/login", (req, res) => {
    let user = login(req.body);

    if(user == null){
        res.status(401);
        res.send("Incorrect login credentials. Please try again.");
    }
    else{
        req.session.username = user.username;   
        req.session.accountType = user.accountType;
        console.log(req.session.username + ": log in successful.");
        res.status(200);
        res.redirect('/MDAPI/myProfile');
    }
});


app.post("/MDAPI/signup", (req, res) => {  
    let newUser = createUser(req.body);
    if (newUser == null){
        res.status(409);
        res.send("Username already exists. Please go back and try a new one.");
    }else{
        req.session.username = req.body.username;
        res.status(200);
        res.redirect('/MDAPI/myProfile');
    }
});


app.get('/MDAPI/changeType', (req, res) => {
    changeAccountType(req.session.username);    
    let foundUser = searchForUser(req.session.username);     
    req.session.accountType = foundUser.accountType;   //for reflecting the acc type change throughout the program 
    res.redirect('/MDAPI/myProfile');
});


app.get('/MDAPI/search', (req, res) => {    //for search through search page
    let mvs = getInitialMovies();       //retrieves 10 randomly selected movies to display to user on the landing search page
    mvs.message = "Selected For You";
    res.send(pug.renderFile('./views/search.pug', {mvs}));
});


app.get('/MDAPI/movies', (req, res) => {    //for query parameter search
    if(Object.keys(req.query).length < 1){
        res.status(400);
        res.send("Please add something to query parameters to see results.");
    }
    else{
        let mvs = advancedMovieSearch(req.query);   // /MDAPI/movies?<queryType>=<input> , queryType = genre or title or actor
        mvs.message = "Search Results";
        res.send(pug.renderFile('./views/search.pug', {mvs}));
        res.status(200);
            
    }
});

app.post('/MDAPI/movies', (req, res) => {      //The newly created movie is added to movies file and printed to terminal for now.
    let movie = req.body;                      //I did not get the chance to make it render a page for the new movie.
    console.log(movie);     
    movies.push(movie);                                   
    updateMovie();
    res.redirect('/MDAPI/myProfile');
    res.status(200);
})

app.get('/MDAPI/movies/:movie', (req, res) => {        //grabs the movie that is clicked on
    let movie = searchMovie(req.params.movie)[0]; 
    if(movie == null){
        res.status(404);
        res.send("Movie you requested was not found.");
    }
    else{
        movie.accountType = req.session.accountType;    //for 'add review' functionality (if contrib it shows the button, if reg it doesn't)
        movie.similarMovies = similarMovies(movie.Title);
        res.send(pug.renderFile('./views/movie.pug', {movie}));
        res.status(200);
         
    }
});


app.get('/MDAPI/addToWatchedList/:title', (req, res) => {   //pushes the current movie title to user's watchlist
    
    req.body.Title = req.params.title;
    req.body.username = req.session.username;

    users[req.session.username]["watchedList"].push(req.params.title);
    updateUser();
    res.status(200);
    res.redirect('back');   

});

app.get('/MDAPI/removeFromWatchedList/:title', (req, res) => {  //a temp array so not to tamper with original watchlist array
    req.body.Title = req.params.title;
    req.body.username = req.session.username;
    let tempArray = [];

    for (let i = 0; i < users[req.session.username]["watchedList"].length; i++) {
        tempArray.push(users[req.session.username]["watchedList"][i]);
    }
    
    users[req.session.username]["watchedList"] = tempArray.filter(value => {    //filter function came in handy, splice/delete made life difficult
        return value != req.params.title;
    });
    
    updateUser();
    res.status(200);
    res.redirect('back');

});

app.get('/MDAPI/removeFromFollowingUsers/:user', (req, res) => {
    let tempArray = [];
    
    for (let i = 0; i < users[req.session.username]["followingUsers"].length; i++){
        tempArray.push(users[req.session.username]["followingUsers"][i]);
    }

    users[req.session.username]["followingUsers"] = tempArray.filter(value => {
        return value != req.params.user;
    });

    updateUser();
    res.status(200);
    res.redirect('back');

});

app.get('/MDAPI/removeFromFollowingPeople/:person', (req, res) => {
    let tempArray = [];

    for (let i = 0; i < users[req.session.username]["followingPeople"].length; i++){
        tempArray.push(users[req.session.username]["followingPeople"][i]);
    }

    users[req.session.username]["followingPeople"] = tempArray.filter(value => {
        return value != req.params.person;
    });

    updateUser();
    res.status(200);
    res.redirect('back');

})

app.get('/MDAPI/recommended', (req, res) => {
    let foundUser = searchForUser(req.session.username);
    if (foundUser.watchedList.slice().reverse()[0] == null) {   //if user has no movies in their watchedlist, just gets first 15 movies 
        let mvsFull = [];
        for (m in movies) {
            mvsFull.push(movies[m]);
        }
        let mvsShort = [];
        for (let i = 0; i < 15; i++){
            mvsShort.push(mvsFull[i]);
        }
        res.send(pug.renderFile('./views/recMovies.pug', {mvsShort}));   
    }
    else {
        let lastWLMovieTitle = foundUser.watchedList.slice().reverse()[0];  //gets the last movie title in their watchedlist
        let lastWLMovie = searchMovie(lastWLMovieTitle)[0]; //gets the last movie obj
        let mvsFull = [];
        for (m in movies){
            if (movies[m].Genre.includes(lastWLMovie.Genre[0])){    //gets all movies that include first genre of the movie obj above
                mvsFull.push(movies[m]);
            }
        }
        let mvsShort = [];              //gets only the first 15 so not to overpopulate recommendation page 
        for (let i = 0; i < 15; i++){
            mvsShort[i] = mvsFull[i];
        }
        res.send(pug.renderFile('./views/recMovies.pug', {mvsShort}));   
    }
});

app.get('/MDAPI/addReview/:title', (req, res) => {
    let movie = req.params;
    res.status(200);
    res.send(pug.renderFile('./views/addReview.pug', {movie}));
});

app.post('/MDAPI/addReview/:title', (req, res) => {
    let mvTitle = req.params.title;
    let movie = searchMovie(mvTitle)[0];
    if (req.body.reviewer != req.session.username) {
        res.status(400);
        res.send("Did not enter correct username. Review cannot be made.");
    }
    else {
        movie.Reviews.push(req.body.reviewer + ": " + "\""+req.body.reviewscore + "/10 --- " + req.body.reviewtext + "\"");
        updateMovie();
        res.send(pug.renderFile('./views/movie.pug', {movie}));
    }
});

app.get('/MDAPI/addMovie', (req, res) => {
    res.send(pug.renderFile('./views/addMovie.pug'));
});


app.get('/MDAPI/searchUser', (req, res) => {
    res.send(pug.renderFile('./views/searchUser.pug'));
});


app.get('/MDAPI/followUser/:user', (req, res) => {  //searches for current user and adds the parameter user to followinguser array
    let foundUser = searchForUser(req.session.username);
    foundUser["followingUsers"].push(req.params.user);
    updateUser();
    res.status(200);
    res.redirect('back');
});


app.get('/MDAPI/followPerson/:person', (req, res) => {  //same idea as followUser 
    let foundUser = searchForUser(req.session.username);
    foundUser["followingPeople"].push(req.params.person);
    updateUser();
    res.status(200);
    res.redirect('back');
});


app.get('/MDAPI/searchPerson', (req, res) => {
    res.send(pug.renderFile('./views/searchPerson.pug'));
});


app.post('/MDAPI/searchPerson', (req, res) => {     //for searching from Search Person page, allows all 3 roles for a person to show up at once
    console.log(`Person searched for: ${req.body.searchperson}`);
    let mvsAc = [];
    let mvsDi = [];
    let mvsWr = [];
    let searchP = (req.body.searchperson).toLowerCase().replace(/\s/g, "");
    let actorName;
    let directorName;
    let writerName;
    for (m in movies){
        for (act in movies[m].Actors){
            let actor = movies[m].Actors[act].toLowerCase().replace(/\s/g, "");
            if (actor.includes(searchP)){
                actorName = actor;
                mvsAc.push(movies[m]);
            }
        }
        for (dir in movies[m].Director){
            let director = movies[m].Director[dir].toLowerCase().replace(/\s/g, "");
            if (director.includes(searchP)){
                directorName = director;
                mvsDi.push(movies[m]);
            }
        }
        for (wr in movies[m].Writer){
            let writer = movies[m].Writer[wr].toLowerCase().replace(/\s/g, "");
            if (writer.includes(searchP)){
                writerName = writer;
                mvsWr.push(movies[m]);
            }
        }
    }
    res.send(pug.renderFile('./views/person.pug', {mvsAc, actorName, mvsDi, directorName, mvsWr, writerName})); 
});

app.get('/MDAPI/searchPerson/:person', (req, res) => {  //for clicking on people from movie pages
    console.log(`Person searched for: ${req.params.person}`);
    let mvsAc = [];
    let mvsDi = [];
    let mvsWr = [];
    let searchP = (req.params.person).toLowerCase().replace(/\s/g, "");
    let actorName;
    let directorName;
    let writerName;
    for (m in movies){
        for (act in movies[m].Actors){
            let actor = movies[m].Actors[act].toLowerCase().replace(/\s/g, "");
            if (actor.includes(searchP)){
                actorName = actor;
                mvsAc.push(movies[m]);
            }
        }
        for (dir in movies[m].Director){
            let director = movies[m].Director[dir].toLowerCase().replace(/\s/g, "");
            if (director.includes(searchP)){
                directorName = director;
                mvsDi.push(movies[m]);
            }
        }
        for (wr in movies[m].Writer){
            let writer = movies[m].Writer[wr].toLowerCase().replace(/\s/g, "");
            if (writer.includes(searchP)){
                writerName = writer;
                mvsWr.push(movies[m]);
            }
        }
    }
    res.send(pug.renderFile('./views/person.pug', {mvsAc, actorName, mvsDi, directorName, mvsWr, writerName}));
})

app.post("/MDAPI/search", (req, res) => {   //lists out matching movies from search movies input field
    let mvs = searchMovie(req.body.search);
    
    if (mvs == null){
        res.status(404);
        res.send("Something went wrong. Please go back.");
       
    }else{
        mvs.message = "Search results: ";
        res.status(200);
        res.send(pug.renderFile('./views/search.pug', {mvs}));
    }
});

app.post("/MDAPI/searchUser", (req, res) => {   //autocompletes user search from Search User page and displays the most relevant user's profile
    let user = searchForUserWithIncludes(req.body.searchuser);
    if (user == null){
        res.status(404);
        res.send("Could not find matching users.");
    }
    else{
        res.send(pug.renderFile('./views/userPage.pug', {user}));
        res.status(200);
    }

});

app.get('/MDAPI/searchUser/:user', (req, res) => {      //for clicking on users from user profile pages
    let user = searchForUser(req.params.user);
    res.send(pug.renderFile('./views/userPage.pug', {user}));
    res.status(200);
})


// HELPER FUNCTIONS


function login(user){   //validates username and password
    if (users.hasOwnProperty(user.username) && users[user.username].password == user.password) {
        return users[user.username];
    }
    else {
        return null;
    }
}

function createUser(user){  //checks for authentic user and makes them a regular account, updates users file
    if (user.username != null || user.password != null){
        if (!users.hasOwnProperty(user.username)){
            user.accountType = "regular";
            user.followingUsers = [];
            user.followingPeople = [];
            user.watchedList = [];
            user.recommended = [];

            users[user.username] = user;    //server identifies current user by their username
            console.log("User '" + user.username + "' created.");
            updateUser();
            return users[user.username];

        }
        return null;
    }
    return null;
}

function changeAccountType(user){  //changes reg -> contr || contr -> reg and updates user file

    users[user].accountType == "regular" ? users[user].accountType = "contributing" : users[user].accountType = "regular";
    updateUser();
    return users[user];
}

function searchForUser(username){   //searches for user that matches parameter
    if (username == null){
        return null;
    }
    else {
        username = username.toLowerCase().replace(/\s/g, "");
        for(u in users){
            let usr = users[u].username.toLowerCase().replace(/\s/g, "");
            if(usr == username){
                return users[u];
            }
        }
    }
}

function searchForUserWithIncludes(username){   //searches for user that includes parameter
    if (username == null){
        return null;
    }
    else {
        username = username.toLowerCase().replace(/\s/g, "");
        for(u in users){
            let usr = users[u].username.toLowerCase().replace(/\s/g, "");
            if(usr.includes(username)){
                return users[u];
            }
        }
    }
}

function similarMovies(title){  //measures similarity between movies through the first genre
    let genre = searchMovie(title)[0].Genre[0]; //there is a wider variety with searching by genre 
    let genreResults = searchMovieByGenre(genre); //I didn't choose other criteria like actors/directors bc some might only act/direct one movie
    let res = [];
    
    for (let i = 0; i < 4; i++){
        if (genreResults[i].Title != title) {
            res.push(genreResults[i]);
        }
    }
    return res;
}


function searchMovie(titleParam){   //checks for movie titles that include input text after performing regex ops 
    if(titleParam == null){
        return null;
    }
    else {
        let res = [];
        titleParam = titleParam.toLowerCase().replace(/\s/g, "");
        for(m in movies){
            let mv = movies[m].Title.toLowerCase().replace(/\s/g, "");
            if(mv.includes(titleParam)){
                res.push(movies[m]);
            }
        }
        return res;
    }
}

function searchMovieByActor(actorName){  //checks for movies that contain the specified actor
    if (actorName == null){
        return null;
    }
    else {
        let arr = [];
        actorName = actorName.toLowerCase().replace(/\s/g, "");
        for (m in movies){
            for (ac in movies[m].Actors){
                let actor = movies[m].Actors[ac].toLowerCase().replace(/\s/g, "");
                if (actor.includes(actorName)){
                    arr.push(movies[m]);
                    break;
                }
            }
        }
        return arr;
    }
}

function searchMovieByGenre(genre){  //checks for movies that contain the specified genre 
    if(genre == null){
        return null;
    }
    else {
        let arr = [];
        genre = genre.toLowerCase().replace(/\s/g, "");
        for(m in movies){
            for(gnr in movies[m].Genre){
                let g = movies[m].Genre[gnr].toLowerCase().replace(/\s/g, "");
                if(g.includes(genre)){
                    arr.push(movies[m]);
                    break;
                }
            }
        }
        return arr;
    }
}


function advancedMovieSearch(queryParams){  //all three forms of query searches
    let res = [];
    
    if(Object.keys(queryParams).includes("title")) {
        res = searchMovie(queryParams.title);
    }
    if(Object.keys(queryParams).includes("genre")) {
        res = searchMovieByGenre(queryParams.genre);
    }
    if(Object.keys(queryParams).includes("actor")) {
        res = searchMovieByActor(queryParams.actor);
    }
   
    return res;
}


let initialMovies = {};     //stores the movies selected for user when they go to search page

function populateSearchPage() {     //grabs 10 random movies to populate the search page
    let randIndex = -1;
    let count = 0;
    while (count < 10){
        randIndex = Math.floor(Math.random() * movies.length)+1;
        initialMovies[movies[randIndex].Title] = movies[randIndex];
        count++;
    }
    return initialMovies;
}

function getInitialMovies() {   
    return initialMovies;
}

populateSearchPage();       //page is populated with 10 random movies each session



app.listen(3000);
console.log("Server listening at http://localhost:3000/MDAPI");

