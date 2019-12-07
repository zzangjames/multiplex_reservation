var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var session = require('express-session');
var AWS = require('aws-sdk');
AWS.config.region= 'ap-northeast-2';
var ec2 = new AWS.EC2()

var connection = mysql.createConnection({
    post:3306,
    host:"cenema.cpnxmgyidpor.ap-northeast-2.rds.amazonaws.com",
    user : "admin",
    password:"11111111",
    database: 'cenema',
    multipleStatements: true
});

var login = {
    logined : false,
    username : ""
}


// var connection = mysql.createConnection({
//     multipleStatements: true,
//     host: 'localhost',
//     user: 'root',
//     post: 3000,
//     password: '',
//     database: 'cenema',
//     multipleStatements: true
// });

connection.connect(function (err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }
    console.log('Success DB connection');
});


//session
router.use(session({
    secret: 'sid',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60
    }
}));


router.use(function(req,res,next){
    if (req.session.user) {
    	login.logined = req.session.user.logined;
    	login.username = req.session.user.username;
    }
	next();	
});

/* GET home page. */
router.get('/', function (req, res, next) {
        const sql1 = "SELECT distinct movie_id, movie_name, movie_img FROM movie natural join box_office WHERE release_date <= current_timestamp() ORDER BY ratio limit 5;";
        const sql2 = "SELECT movie_id, movie_name, movie_img FROM movie WHERE release_date > current_timestamp() ORDER BY ratio limit 5;";

        const sql3 = "SELECT distinct * FROM movie natural join box_office natural join actor WHERE release_date <= current_timestamp() ORDER BY ratio limit 1;"

        // function

        connection.query(sql1+sql2+sql3, function(error,results,fields){

            let screening = [];
            let pre_release = [];
            let movie_selected = results[2][0];

            results[0].forEach((element)=>{
                screening.push(element);
            });
            results[1].forEach((element)=>{
                pre_release.push(element);
            })

        res.render('index.ejs', {
            logined: login.logined,
            username: login.username,
            movie : [ 
                screening,pre_release
            ],
            movie_selected : movie_selected
        });
    });
});

router.get('/ec2',function(rq,res){
    ec2.describeInstances({},function(err,data){
        res.json(data);
    })
});

router.get('/movie',function(req,res){
    const movie_id = req.query.movie_id;
    const sql = "SELECT * FROM movie natural join actor WHERE movie_id = ?;";
    connection.query(sql,[movie_id],(error,results,fileds)=>{
        results[0].type = "movie_selected";
        res.json(results[0]) ;
    });
});


router.get('/login',function(req,res,next){
	res.render('login',{
		logined : login.logined,
		username : login.username
	});
});

router.get('/register',function(req,res,next){
	res.render('register',{
		logined : login.logined,
		username : login.username
	});
});


router.get('/reserv/:state', function (req, res, next) {
    var state = req.url.split("/")[2];
    var statesplit = state.split('_');
    var results_region;
    var results_cinema;
    var results_movie;
    var results_date;
    var results_screen;
    var region = "서울";
    var cinema_name;
    var movie_name;
    var sql_region = 'SELECT region FROM cinema GROUP BY region  ;';
    connection.query(sql_region, function (error, resultsr, fields) {
        results_region = new Array;
        for (let i = 0; i < resultsr.length; i++) {
            results_region[i] = resultsr[i].region;
        }
        results_cinema = Array.from(Array(results_region.length), () => Array());
        var sql_cinema = 'SELECT region, cinema_name FROM cinema ;';
        connection.query(sql_cinema, function (error, resultsc, fields) {
            for (let i = 0; i < resultsc.length; i++) {
                for (let j = 0; j < results_region.length; j++) {
                    if (resultsc[i].region == results_region[j]) {
                        results_cinema[j][results_cinema[j].length] = resultsc[i].cinema_name;
                    }
                }
            }
            if (statesplit[0] == '0' && statesplit[1] == '0' && statesplit[2] == '0') {
                var sql_movie = 'SELECT movie_name, age_restriction, genre, movie_img  FROM movie GROUP BY movie_name ORDER BY reservation_rates DESC';
                connection.query(sql_movie, function (error, resultsm, fields) {
                    results_movie = Array.from(Array(resultsm.length), () => Array());
                    for (let i = 0; i < resultsm.length; i++) {
                        results_movie[i][0] = resultsm[i].movie_name;
                        results_movie[i][1] = resultsm[i].age_restriction;
                        results_movie[i][2] = resultsm[i].genre;
                        results_movie[i][3] = resultsm[i].movie_img;
                    }
                    var sql_date = 'SELECT date FROM box_office GROUP BY date';
                    connection.query(sql_date, function (error, resultsd, fields) {
                        results_date = Array.from(Array(resultsd.length), () => Array());
                        for (let i = 0; i < resultsd.length; i++) {
                            var str = String(resultsd[i].date).split("-")[0];
                            str = str.split(" ")
                            for (j = 0; j < 3; j++) {
                                results_date[i][j] = str[j];
                            }
                        }
                        res.render('reservation', {
                            logined: login.logined,
                            username: login.username,
                            reservation_information: [region, "", "", "", "", "", ""],
                            results_region,
                            results_cinema,
                            results_movie,
                            results_date,
                            results_screen: null,
                            state
                        })

                    })
                })
            }

            else if (statesplit[0] != '0') {// 100 101 110 111
                var sql_box_office = 'SELECT date FROM box_office NATURAL JOIN movie NATURAL JOIN cinema NATURAL JOIN screen WHERE cinema_id = ? GROUP BY date';
                connection.query(sql_box_office, [parseInt(statesplit[0])], function (error, result_box, fields) {
                    results_date = Array.from(Array(result_box.length), () => Array());
                    for (let i = 0; i < result_box.length; i++) {
                        var str = String(result_box[i].date).split("-")[0];
                        str = str.split(" ")
                        for (j = 0; j < 3; j++) {
                            results_date[i][j] = str[j];
                        }
                    }

                    var sql_movie = 'SELECT movie_name, age_restriction, genre,movie_img,cinema_name,region FROM movie NATURAL JOIN box_office natural join cinema natural join screen where cinema_id = ?  GROUP BY movie_name  ORDER BY ratio desc ;'
                    connection.query(sql_movie, [parseInt(statesplit[0])], function (error, resultsm_select_cinema, fields) {
                        region = resultsm_select_cinema[0].region;
                        cinema_name = resultsm_select_cinema[0].cinema_name;
                        results_movie = Array.from(Array(resultsm_select_cinema.length), () => Array());
                        for (let i = 0; i < resultsm_select_cinema.length; i++) {
                            results_movie[i][0] = resultsm_select_cinema[i].movie_name;
                            results_movie[i][1] = resultsm_select_cinema[i].age_restriction;
                            results_movie[i][2] = resultsm_select_cinema[i].genre;
                            results_movie[i][3] = resultsm_select_cinema[i].movie_img;
                        }
                        if (statesplit[1] == '0') {// 100 101
                            if (statesplit[2] == '0') {
                                res.render('reservation', {//100
                                    logined: login.logined,
                                    username: login.username,
                                    reservation_information: [region, cinema_name, "", "", "", "", ""],
                                    results_region,
                                    results_cinema,
                                    results_movie,
                                    results_date,
                                    results_screen: null,
                                    state
                                })
                            } else {//101
                                var sql_cinema = 'SELECT region, cinema_name,date FROM box_office NATURAL JOIN movie NATURAL JOIN screen NATURAL JOIN cinema;';
                                var sql_movie = 'SELECT date,movie_name, age_restriction, genre, movie_img,movie_id FROM movie NATURAL JOIN box_office NATURAL join cinema WHERE cinema_id = ? ORDER BY reservation_rates DESC';
                                connection.query(sql_cinema + sql_movie, [parseInt(statesplit[0]), parseInt(statesplit[0])], function (error, resultscm, fields) {
                                    results_cinema = Array.from(Array(results_region.length), () => Array());
                                    for (let i = 0; i < resultscm[0].length; i++) {
                                        var str = String(resultscm[0][i].date).split("-")[0];
                                        str = str.split(" ")
                                        if (statesplit[2] == str[2]) {
                                            for (let j = 0; j < results_region.length; j++) {
                                                if (resultscm[0][i].region == results_region[j]) {
                                                    let s = 0;
                                                    for (let k = 0; k < results_cinema[j].length; k++) {
                                                        if (results_cinema[j][k] == resultscm[0][i].cinema_name) {
                                                            s = 1;
                                                        }
                                                    }
                                                    if (s == 0) results_cinema[j][results_cinema[j].length] = resultscm[0][i].cinema_name;
                                                }
                                            }
                                        }
                                    }
                                    var l = 0;
                                    let list = new Array();
                                    console.log(resultscm[1])
                                    for (let i = 0; i < resultscm[1].length; i++) {
                                        var str = String(resultscm[1][i].date).split("-")[0];
                                        str = str.split(" ")
                                        if (statesplit[2] == str[2]) {
                                            let s = 0;
                                            for (let k = 0; k < list.length; k++) {
                                                if (list[k] == resultscm[1][i].movie_name) s = 1;
                                            }
                                            if (s == 0) {
                                                list[l] = resultscm[1][i].movie_name;
                                                l++;
                                            };
                                        }
                                    }
                                    results_movie = Array.from(Array(l), () => Array());
                                    if (l > 0) {
                                        for (let i = 0, k = 0; i < resultscm[1].length; i++) {
                                            var str = String(resultscm[1][i].date).split("-")[0];
                                            str = str.split(" ")
                                            if (statesplit[2] == str[2]) {
                                                if (statesplit[2] == str[2]) {
                                                    let s = 0;
                                                    for (let k = 0; k < list.length; k++) {
                                                        if (results_movie[k][0] == resultscm[1][i].movie_name) s = 1;
                                                    }
                                                    if (s == 0) {
                                                        results_movie[k][0] = resultscm[1][i].movie_name;
                                                        results_movie[k][1] = resultscm[1][i].age_restriction;
                                                        results_movie[k][2] = resultscm[1][i].genre;
                                                        results_movie[k][3] = resultscm[1][i].movie_img;
                                                        k++;
                                                    };
                                                }

                                            }
                                        }
                                    }

                                    res.render('reservation', {
                                        logined: login.logined,
                                        username: login.username,
                                        reservation_information: [region, cinema_name, "", statesplit[2], "", "", ""],
                                        results_region,
                                        results_cinema,
                                        results_movie,
                                        results_date,
                                        results_screen: null,
                                        state
                                    })
                                })
                            }
                        } else {//110 // 111
                            var sql_date = 'SELECT date FROM box_office NATURAL JOIN movie NATURAL JOIN cinema NATURAL JOIN screen WHERE cinema_id = ? AND movie_id = ? GROUP BY date';
                            connection.query(sql_date, [parseInt(statesplit[0]), parseInt(statesplit[1])], function (error, resultsd, fields) {
                                results_date = Array.from(Array(resultsd.length), () => Array());
                                for (let i = 0; i < resultsd.length; i++) {
                                    var str = String(resultsd[i].date).split("-")[0];
                                    str = str.split(" ")
                                    for (j = 0; j < 3; j++) {
                                        results_date[i][j] = str[j];
                                    }
                                }
                                var sql_movie = 'SELECT movie_name FROM movie where movie_id = ?';
                                connection.query(sql_movie, [parseInt(statesplit[1])], function (error, resultsm, fields) {
                                    movie_name = resultsm[0].movie_name
                                    if (statesplit[2] == '0') {//110
                                        var sql_cinema = 'SELECT region, cinema_name,date FROM box_office NATURAL JOIN movie NATURAL JOIN screen NATURAL JOIN cinema WHERE movie_id = ? GROUP BY cinema_name;'
                                        connection.query(sql_cinema, [statesplit[1]], function (error, resultsc, fields) {
                                            results_cinema = Array.from(Array(results_region.length), () => Array());
                                            for (let i = 0; i < resultsc.length; i++) {
                                                for (let j = 0; j < results_region.length; j++) {
                                                    if (resultsc[i].region == results_region[j]) {
                                                        results_cinema[j][results_cinema[j].length] = resultsc[i].cinema_name;
                                                    }
                                                }
                                            }
                                            res.render('reservation', {
                                                logined: login.logined,
                                                username: login.username,
                                                reservation_information: [region, cinema_name, movie_name, "", "", "", ""],
                                                results_region,
                                                results_cinema,
                                                results_movie,
                                                results_date,
                                                results_screen: null,
                                                state
                                            })
                                        })
                                    } else {//111
                                        var sql_cinema = 'SELECT region, cinema_name,date FROM box_office NATURAL JOIN movie NATURAL JOIN screen NATURAL JOIN cinema WHERE movie_id = ?;';
                                        var sql_movie = 'SELECT date,movie_name, age_restriction, genre, movie_img,movie_id FROM movie NATURAL JOIN box_office NATURAL JOIN screen NATURAL JOIN cinema WHERE cinema_id = ? ORDER BY reservation_rates DESC';
                                        connection.query(sql_cinema + sql_movie, [parseInt(statesplit[1]), parseInt(statesplit[0])], function (error, resultscm, fields) {
                                            results_cinema = Array.from(Array(results_region.length), () => Array());
                                            for (let i = 0; i < resultscm[0].length; i++) {
                                                var str = String(resultscm[0][i].date).split("-")[0];
                                                str = str.split(" ")
                                                if (statesplit[2] == str[2]) {
                                                    for (let j = 0; j < results_region.length; j++) {
                                                        if (resultscm[0][i].region == results_region[j]) {
                                                            let s = 0;
                                                            for (let k = 0; k < results_cinema[j].length; k++) {
                                                                if (results_cinema[j][k] == resultscm[0][i].cinema_name) {
                                                                    s = 1;
                                                                }
                                                            }
                                                            if (s == 0) results_cinema[j][results_cinema[j].length] = resultscm[0][i].cinema_name;
                                                        }
                                                    }
                                                }
                                            }
                                            var l = 0;
                                            let list = new Array();
                                            for (let i = 0; i < resultscm[1].length; i++) {
                                                var str = String(resultscm[1][i].date).split("-")[0];
                                                str = str.split(" ")
                                                if (statesplit[2] == str[2]) {
                                                    let s = 0;
                                                    for (let k = 0; k < list.length; k++) {
                                                        if (list[k] == resultscm[1][i].movie_name) s = 1;
                                                    }
                                                    if (s == 0) {
                                                        list[l] = resultscm[1][i].movie_name;
                                                        l++;
                                                    };
                                                }
                                            }
                                            results_movie = Array.from(Array(l), () => Array());
                                            if (l > 0) {
                                                for (let i = 0, k = 0; i < resultscm[1].length; i++) {
                                                    var str = String(resultscm[1][i].date).split("-")[0];
                                                    str = str.split(" ")
                                                    if (statesplit[2] == str[2]) {
                                                        if (statesplit[2] == str[2]) {
                                                            let s = 0;
                                                            for (let k = 0; k < list.length; k++) {
                                                                if (results_movie[k][0] == resultscm[1][i].movie_name) s = 1;
                                                            }
                                                            if (s == 0) {
                                                                results_movie[k][0] = resultscm[1][i].movie_name;
                                                                results_movie[k][1] = resultscm[1][i].age_restriction;
                                                                results_movie[k][2] = resultscm[1][i].genre;
                                                                results_movie[k][3] = resultscm[1][i].movie_img;
                                                                k++;
                                                            };
                                                        }

                                                    }
                                                }
                                            }
                                            var sql_screen = 'SELECT date,box_office_id, type,start_time, screen_no, seat_state FROM box_office NATURAL JOIN screen NATURAL JOIN cinema NATURAL JOIN movie WHERE cinema_id =? AND movie_id = ? ORDER BY start_time  ';
                                            connection.query(sql_screen, [parseInt(statesplit[0]), parseInt(statesplit[1])], function (error, resultss, fields) {
                                                var l = 0;
                                                let list = new Array();
                                                for (let i = 0; i < resultss.length; i++) {
                                                    var str = String(resultss[i].date).split("-")[0];
                                                    str = str.split(" ")
                                                    if (statesplit[2] == str[2]) {
                                                        let s = 0;
                                                        for (let k = 0; k < list.length; k++) {
                                                            if (list[k] == resultss[i].box_office_id) s = 1;
                                                        }
                                                        if (s == 0) {
                                                            list[l] = resultss[i].box_office_id;
                                                            l++;
                                                        };
                                                    }
                                                }
                                                results_screen = Array.from(Array(l), () => Array());
                                                for (let i = 0, k = 0; i < resultss.length; i++) {
                                                    var str = String(resultss[i].date).split("-")[0];
                                                    str = str.split(" ")
                                                    if (statesplit[2] == str[2]) {
                                                        seats = resultss[i].seat_state.split('[');
                                                        seats.splice(0, 2);
                                                        for (let j = 0; j < seats.length; j++) {
                                                            seat = new Array();
                                                            seats[j] = seats[j].split(']')[0];
                                                            for (let k = 0, l = 0; k < seats[j].length; k++) {
                                                                if (seats[j][k] != ',') {
                                                                    seat[l] = parseInt(seats[j][k]);
                                                                    l++;
                                                                }
                                                            }
                                                            seats[j] = seat
                                                        }
                                                        results_screen[k][0] = resultss[i].box_office_id;
                                                        results_screen[k][1] = resultss[i].start_time;
                                                        results_screen[k][2] = resultss[i].screen_no;
                                                        results_screen[k][3] = seats;
                                                        k++;
                                                    }
                                                }
                                                res.render('reservation', {
                                                    logined: login.logined,
                                                    username: login.username,
                                                    reservation_information: [region, cinema_name, movie_name, statesplit[2], "", "", ""],
                                                    results_region,
                                                    results_cinema,
                                                    results_movie,
                                                    results_date,
                                                    results_screen,
                                                    state
                                                })
                                            })
                                        })
                                    }
                                })
                            })
                        }
                    })
                })
            } else if (statesplit[1] != '0') {//010 011
                var sql_movie = 'SELECT movie_name, age_restriction, genre, movie_img,movie_id FROM movie GROUP BY movie_name ORDER BY reservation_rates DESC';
                connection.query(sql_movie, [parseInt(statesplit[1])], function (error, resultsm, fields) {

                    results_movie = Array.from(Array(resultsm.length), () => Array());
                    for (let i = 0; i < resultsm.length; i++) {
                        if (parseInt(statesplit[1]) == resultsm[i].movie_id) { var movie_name = resultsm[i].movie_name; }
                        results_movie[i][0] = resultsm[i].movie_name;
                        results_movie[i][1] = resultsm[i].age_restriction;
                        results_movie[i][2] = resultsm[i].genre;
                        results_movie[i][3] = resultsm[i].movie_img;
                    }
                    var sql_date = 'SELECT date FROM box_office NATURAL JOIN movie WHERE movie_id = ? GROUP BY date';
                    connection.query(sql_date, [statesplit[1]], function (error, resultsd, fields) {

                        results_date = Array.from(Array(resultsd.length), () => Array());
                        for (let i = 0; i < resultsd.length; i++) {
                            var str = String(resultsd[i].date).split("-")[0];
                            str = str.split(" ")
                            for (j = 0; j < 3; j++) {
                                results_date[i][j] = str[j];
                            }
                        }
                        if (statesplit[2] == '0') {//010
                            var sql_cinema = 'SELECT region, cinema_name,date FROM box_office NATURAL JOIN movie NATURAL JOIN screen NATURAL JOIN cinema WHERE movie_id = ? GROUP BY cinema_name;'
                            connection.query(sql_cinema, [statesplit[1]], function (error, resultsc, fields) {
                                results_cinema = Array.from(Array(results_region.length), () => Array());
                                for (let i = 0; i < resultsc.length; i++) {
                                    for (let j = 0; j < results_region.length; j++) {
                                        if (resultsc[i].region == results_region[j]) {
                                            results_cinema[j][results_cinema[j].length] = resultsc[i].cinema_name;
                                        }
                                    }
                                }
                                res.render('reservation', {
                                    logined: login.logined,
                                    username: login.username,
                                    reservation_information: [region, "", movie_name, "", "", "", ""],
                                    results_region,
                                    results_cinema,
                                    results_movie,
                                    results_date,
                                    results_screen: null,
                                    state
                                })

                            })
                        } else {//011
                            var sql_cinema = 'SELECT region, cinema_name,date FROM box_office NATURAL JOIN movie NATURAL JOIN screen NATURAL JOIN cinema WHERE movie_id = ?;';
                            var sql_movie = 'SELECT date,movie_name, age_restriction, genre, movie_img,movie_id FROM movie NATURAL JOIN box_office ORDER BY reservation_rates DESC';
                            connection.query(sql_cinema + sql_movie, [parseInt(statesplit[1])], function (error, resultscm, fields) {
                                results_cinema = Array.from(Array(results_region.length), () => Array());
                                for (let i = 0; i < resultscm[0].length; i++) {
                                    var str = String(resultscm[0][i].date).split("-")[0];
                                    str = str.split(" ")
                                    if (statesplit[2] == str[2]) {
                                        for (let j = 0; j < results_region.length; j++) {
                                            if (resultscm[0][i].region == results_region[j]) {
                                                let s = 0;
                                                for (let k = 0; k < results_cinema[j].length; k++) {
                                                    if (results_cinema[j][k] == resultscm[0][i].cinema_name) {
                                                        s = 1;
                                                    }
                                                }
                                                if (s == 0) results_cinema[j][results_cinema[j].length] = resultscm[0][i].cinema_name;
                                            }
                                        }
                                    }
                                }
                                var l = 0;
                                let list = new Array();
                                for (let i = 0; i < resultscm[1].length; i++) {
                                    var str = String(resultscm[1][i].date).split("-")[0];
                                    str = str.split(" ")
                                    if (statesplit[2] == str[2]) {
                                        let s = 0;
                                        for (let k = 0; k < list.length; k++) {
                                            if (list[k] == resultscm[1][i].movie_name) s = 1;
                                        }
                                        if (s == 0) {
                                            list[l] = resultscm[1][i].movie_name;
                                            l++;
                                        };
                                    }
                                }
                                results_movie = Array.from(Array(l), () => Array());
                                if (l > 0) {
                                    for (let i = 0, k = 0; i < resultscm[1].length; i++) {
                                        var str = String(resultscm[1][i].date).split("-")[0];
                                        str = str.split(" ")
                                        if (statesplit[2] == str[2]) {
                                            if (statesplit[2] == str[2]) {
                                                let s = 0;
                                                for (let k = 0; k < list.length; k++) {
                                                    if (results_movie[k][0] == resultscm[1][i].movie_name) s = 1;
                                                }
                                                if (s == 0) {
                                                    results_movie[k][0] = resultscm[1][i].movie_name;
                                                    results_movie[k][1] = resultscm[1][i].age_restriction;
                                                    results_movie[k][2] = resultscm[1][i].genre;
                                                    results_movie[k][3] = resultscm[1][i].movie_img;
                                                    k++;
                                                };
                                            }

                                        }
                                    }
                                }
                                res.render('reservation', {
                                    logined: login.logined,
                                    username: login.username,
                                    reservation_information: [region, "", movie_name, statesplit[2], "", "", ""],
                                    results_region,
                                    results_cinema,
                                    results_movie,
                                    results_date,
                                    results_screen: null,
                                    state
                                })
                            })
                        }
                    })

                })
            } else { //001
                var sql_date = 'SELECT date FROM box_office GROUP BY date';
                connection.query(sql_date, function (error, resultsd, fields) {
                    results_date = Array.from(Array(resultsd.length), () => Array());
                    for (let i = 0; i < resultsd.length; i++) {
                        var str = String(resultsd[i].date).split("-")[0];
                        str = str.split(" ")
                        for (j = 0; j < 3; j++) {
                            results_date[i][j] = str[j];
                        }
                    }
                    var sql_cinema = 'SELECT region, cinema_name,date FROM box_office NATURAL JOIN movie NATURAL JOIN screen NATURAL JOIN cinema ;';
                    var sql_movie = 'SELECT date,movie_name, age_restriction, genre, movie_img,movie_id FROM movie NATURAL JOIN box_office ORDER BY reservation_rates DESC';
                    connection.query(sql_cinema + sql_movie, function (error, resultscm, fields) {
                        results_cinema = Array.from(Array(results_region.length), () => Array());
                        for (let i = 0; i < resultscm[0].length; i++) {
                            var str = String(resultscm[0][i].date).split("-")[0];
                            str = str.split(" ")
                            if (statesplit[2] == str[2]) {
                                for (let j = 0; j < results_region.length; j++) {
                                    if (resultscm[0][i].region == results_region[j]) {
                                        let s = 0;
                                        for (let k = 0; k < results_cinema[j].length; k++) {
                                            if (results_cinema[j][k] == resultscm[0][i].cinema_name) {
                                                s = 1;
                                            }
                                        }
                                        if (s == 0) results_cinema[j][results_cinema[j].length] = resultscm[0][i].cinema_name;
                                    }
                                }
                            }
                        }

                        var l = 0;
                        let list = new Array();
                        for (let i = 0; i < resultscm[1].length; i++) {
                            var str = String(resultscm[1][i].date).split("-")[0];
                            str = str.split(" ")
                            if (statesplit[2] == str[2]) {
                                let s = 0;
                                for (let k = 0; k < list.length; k++) {
                                    if (list[k] == resultscm[1][i].movie_name) s = 1;
                                }
                                if (s == 0) {
                                    list[l] = resultscm[1][i].movie_name;
                                    l++;
                                };
                            }
                        }
                        results_movie = Array.from(Array(l), () => Array());
                        if (l > 0) {
                            for (let i = 0, k = 0; i < resultscm[1].length; i++) {
                                var str = String(resultscm[1][i].date).split("-")[0];
                                str = str.split(" ")
                                if (statesplit[2] == str[2]) {
                                    if (statesplit[2] == str[2]) {
                                        let s = 0;
                                        for (let k = 0; k < list.length; k++) {
                                            if (results_movie[k][0] == resultscm[1][i].movie_name) s = 1;
                                        }
                                        if (s == 0) {
                                            results_movie[k][0] = resultscm[1][i].movie_name;
                                            results_movie[k][1] = resultscm[1][i].age_restriction;
                                            results_movie[k][2] = resultscm[1][i].genre;
                                            results_movie[k][3] = resultscm[1][i].movie_img;
                                            k++;
                                        };
                                    }

                                }
                            }
                        }

                        res.render('reservation', {
                            logined: login.logined,
                            username: login.username,
                            reservation_information: [region, "", "", statesplit[2], "", "", ""],
                            results_region,
                            results_cinema,
                            results_movie,
                            results_date,
                            results_screen: null,
                            state
                        })
                    })

                })
            }
        });
    })
});

router.get('/reserv_seat/:box_office_id', function (req, res) {
    var box_office_id = req.url.split("/")[2];

    res.render('reservation_seat', {
        logined: login.logined,
        username: login.username,
        box_office_id
    });
});


router.get('/api/reserv',function(req,res,next){
    const sql = "SELECT reservation_id, movie_img, movie_name, cinema_name, screen_no, box_office.date,start_time,running_time, amount from reservation natural join box_office natural join movie natural join cinema natural join screen natural join payment WHERE member_id = (SELECT member_id FROM member WHERE username = ?) ;";
    connection.query(sql,[login.username],function(err,results,fields){
        res.json({
            type : "reservation_list",
            results
        });
    });
})


router.get('/payment',function(req,res,next){
    res.render('payment',{
        logined : login.logined,
        username : login.username
    });
});


router.get('/suggestion', function (req, res) {
    var sql = 'SELECT * FROM suggestion';
    connection.query(sql, function (error, results, fields) {
        if (req.session.user) {
            res.render('suggestion', {
                logined: req.session.user.logined,
                username: req.session.user.user_name,
                results
            });
        }
        else {
            res.render('suggestion', {
                logined: login.logined,
                username: login.username,
                results
            });
        }
    });
});

router.get('/suggestion_insert', function (req, res) {
    if (req.session.user) {
        res.render('suggestion_insert', {
            logined: req.session.user.logined,
            username: req.session.user.user_name
        });
    }
    else {
        res.redirect('login');
    }
});

router.get('/suggestion/:suggestion_id', function (req, res) {
    var suggestion_id = req.url.split("/")[2];
    var sql1 = 'SELECT * FROM suggestion WHERE suggestion_id = ?; ';
    var sql2 = 'SELECT * FROM comment WHERE suggestion_id = ?; ';

    connection.query('UPDATE suggestion SET view = view + 1 WHERE suggestion_id = ?', [suggestion_id]);
    connection.query(sql1 + sql2, [suggestion_id, suggestion_id], function(error, results, fields){
        results1 = results[0];
        results2 = results[1];
        if (req.session.user) {    
            res.render('suggestion_id', {
                logined: req.session.user.logined,
                username: req.session.user.user_name,
                results1,
                results2,
                suggestion_id
            });
        }
        else {
            res.render('suggestion_id', {
                logined: false,
                username: " ",
                results1,
                results2,
                suggestion_id
            });
        }
    })
});


router.post('/', function(req, res){
    var username = req.body.username;
    var password = req.body.password;

    var sql = 'SELECT * FROM member WHERE username = ?';
    connection.query(sql, [username], function (error, results, fields) {
        if (results.length == 0) {
            res.render('login', { alert: true });
        } else {
            var db_pwd = results[0].password;

            if (password == db_pwd) {
                //session
                req.session.user = {
                    logined: true,
                    username: results[0].username
                }

        
            }
                res.redirect('/');
        }
    });
});

router.post('/reserv/:state', function (req, res) {
    var info = req.body.info.split(',');
    if (info[6] != '') {
        res.redirect(`/reserv_seat/${info[6]}`);
    }
    var str2 = "_";
    var sql1 = 'SELECT cinema_id FROM cinema WHERE cinema_name = ?;'
    var sql2 = 'SELECT movie_id FROM movie WHERE movie_name = ?;'
    connection.query(sql1 + sql2, [info[1], info[2]], function (error, results, field) {
        if (info[1] == '') { str1 = '0'; } else if (info[1] != '0') { str1 = String(results[0][0].cinema_id); }
        if (info[2] == '') { str3 = '0'; } else if (info[2] != '0') { str3 = String(results[1][0].movie_id); }
        if (info[3] == '') { str4 = '0'; } else if (info[3] != '0') { str4 = info[3]; }
        res.redirect(`/reserv/${str1.concat(str2, str3).concat(str2, str4)}`);
    })


});

router.post('/reserv_seat', function (req, res) {
    var cinema = req.body.cinema;
})


router.post('/register', function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
	var pwdconf = req.body.pwdconf;
	var birth = req.body.birth;
	var sex = req.body.sex;
	var address = req.body.address;

    if (password !== pwdconf) {
        res.redirect('register');
    }
    else {
        var sql = 'SELECT * FROM member WHERE username = ?';
        connection.query(sql, [username], function (error, results, fields) {
            if (results.length == 0) {
                connection.query("INSERT INTO member(username, password, birth, sex, address) VALUES(?,?,?,?,?)", [username, password, birth, sex, address], function () {
                    res.redirect('login');
                });
            }
            else {
                res.render("register");
            }
        });
    }
});

router.post('/suggestion_insert', function (req, res) {
    var title = req.body.title;
    var content = req.body.content;
    var writer_name = req.session.user.username;

    
    console.log(req.body);

    var sql = 'INSERT INTO suggestion(title, content, writer_name) VALUES (?,?,?)';
    connection.query(sql, [title, content, writer_name], function (error, results, fields) {
        res.redirect('/suggestion');
    });
});

router.post('/suggestion/:suggestion_id', function(req, res){
    if(req.session.user){
        var suggestion_id = req.url.split("/")[2];
        var comment = req.body.comment;
        var writer_name = req.session.user.user_name;
        var sql = `INSERT INTO comment(suggestion_id, comment, writer_name) VALUES (?,?,?) ;`
        connection.query(sql, [suggestion_id, comment, writer_name], function(error, results, fields){
            res.redirect(`/suggestion/${suggestion_id}`);
        });
    }
    else {
        res.render('login.ejs');
    }
});

module.exports = router;