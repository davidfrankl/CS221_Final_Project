var async = require('async')
  , cheerio = require('cheerio')
  , ff = require('ff')
  , request = require('request')
  , url = require('url')
  , fs = require('fs')

var urls = []
  , existing = {}
  , count = 0

var teamLinks = []
var scrapeTeams = function (next) {
  request('http://www.baseball-reference.com/leagues/AL/2013.shtml', function (err, res, body) {
    if (err) return next()
    
    var $ = cheerio.load(body, {
        lowerCaseTags: true
      , lowerCaseAttributeNames: true
    })

    $('table#teams_standard_batting').find('a').each(function () {
      teamLinks.push(url.resolve('http://www.baseball-reference.com/leagues/AL/2013.shtml', $(this).attr('href')))
    })
    
    next()
  })
}

playerLinks = []
var scrapeTeam = function (teamUrl, next) {
  request(teamUrl, function (err, res, body) {
    if (err) return next()
    
    var $ = cheerio.load(body, {
        lowerCaseTags: true
      , lowerCaseAttributeNames: true
    })

    $('table#team_batting').find('a').each(function () {
      playerLinks.push(url.resolve(teamUrl, $(this).attr('href')))
    })
    
    next()
  })
}

var stats = []
var salaries = []

var scrapePlayer = function (playerUrl, next) {
  request(playerUrl, function (err, res, body) {
    console.log("scraping player: "+playerUrl)
    
    if (err) return next()

    var $ = cheerio.load(body, {
        lowerCaseTags: true
      , lowerCaseAttributeNames: true
    })

    //check if its a pitcher
    if($('[itemprop="role"]').text()=="Pitcher") return next()

    var playerStats = [] //list of AGE, AT BATS, RUNS, HITS, HOME RUNS, RBI, SB, BA
      , statMap = {} //map from year to playerStats
      , columns = {
          1: true
        , 6: true
        , 7: true
        , 8: true
        , 11: true
        , 12: true
        , 13: true
        , 17: true
      }
      , playerSalaries = []

    $('table#batting_standard').find('tr.full').each(function () {
      var curYear = []
      var year = $(this).find('td').first().text()
      $(this).find('td').each(function (i) {
        if (i in columns) {
          curYear.push($(this).text())
        }
      })

      playerStats.push(curYear)
      statMap[year] = curYear
    })

    $('table#salaries').find('td').each(function () {
      var year = $(this).attr('data-year')
      var amount = $(this).attr('data-amount')

      if (year&&statMap[year]&&amount&&!isNaN(amount)) {
        stats.push(statMap[year])
        salaries.push(Number(amount))
      }
    })

    next()
  })
}

var f = ff(function () {
  scrapeTeams(f.slot())
}, function () {
  async.eachLimit(teamLinks, 3, scrapeTeam, f.slot())
}, function () {
  async.eachLimit(playerLinks, 3, scrapePlayer, f.slot())
}, function () {
  console.log(JSON.stringify(stats))
  console.log('\n\n\n'+JSON.stringify(salaries))
  fs.writeFile("stats.txt", JSON.stringify(stats), function (err) {
    if (err) console.log(err)
  })
  fs.writeFile("salaries.txt", JSON.stringify(salaries), function (err) {
    if (err) console.log(err)
  })
})