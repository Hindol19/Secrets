//jshint esversion:6
require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate")
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");

const app = express();

app.use(express.static("public"));

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));

//Session should be used at this postion only:
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true })

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    //For Google Authentication:
    googleId: String
});

// userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ["password"] })

userSchema.plugin(passportLocalMongoose);
//Add mongoose-findorcreate to the Schema as a plugin
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

//The below code will work for only local strategies:

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

//The below code will work for all strategies:

passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, {
            id: user.id,
            username: user.username,
            picture: user.picture
        });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        //Install npm mongoose-findorcreate for this function to work:
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", function (req, res) {
    res.render("home");
})
app.get("/login", function (req, res) {
    res.render("login");
})

//Getting to the google sign in page:
app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));

//Getting to the final Page after authentication by google:
app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect("/secrets");
    });

app.get("/register", function (req, res) {
    res.render("register");
})
app.get("/secrets", function (req, res) {
    //Check if user is already logged in
    if (req.isAuthenticated())
        res.render("secrets");
    else {
        res.redirect("/login");
    }
})
app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) {
            console.log(err);;
        }
        res.redirect('/');
    });
});

// Using Bcrypt:

// app.post("/register", function (req, res) {
//     bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
//         // Store hash in your password DB.
//         const newUser = new User({
//             email: req.body.username,
//             password: hash
//         });

//         newUser.save(function (err) {
//             if (err)
//                 console.log(err);
//             else
//                 res.render("secrets");
//         });
//     });
// });

// app.post("/login", function (req, res) {
//     const username = req.body.username;
//     const password = req.body.password;
//     User.findOne({ email: username }, function (err, foundUser) {
//         if (err)
//             console.log(err)
//         else if (foundUser) {
//             bcrypt.compare(password, foundUser.password, function (err, result) {
//                 if (result)
//                     res.render("secrets")
//             });
//         }
//         else
//             console.log("User Not Found");

//     });
// });


// Using Passport:

app.post("/register", function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        }
        passport.authenticate("local")(req, res, function () {
            res.redirect("/secrets");
        });
    })
})

app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function (err) {
        if (err)
            console.log(err);
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    })
})
app.listen(3000, function () {
    console.log("Server is running on port 3000");
})