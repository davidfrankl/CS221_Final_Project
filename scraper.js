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
      teamLinks.push(url.resolve('http://www.baseball-reference.com/leagues/NL/2013.shtml', $(this).attr('href')))
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

//list of player objects
var players = []

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
      , columns = ['yearNumber','age','team','league','gamesPlayed','plateAppearances','atBats','runs','hits','doubles'
        ,'triples','homeRuns','runsBattedIn','stolenBases','caughtStealing','walks','strikeouts','battingAverage'
        ,'onBasePercentage','ops','opsPlus','totalBases','groundIntoDoublePlay','hitByPitch','sacrificeHits'
        ,'sacrificeFlies','intentionalWalks']
      , playerSalaries = []

    var player = {
        url: playerUrl
      , years: {}
    }

    $('table#batting_standard').find('tr.full').each(function () {
      var curYear = []
      var stats = {}

      var yearNumber = $(this).find('td').first().text()


      $(this).find('td').each(function (i) {
        if(i>=columns.length) return false

        stats[columns[i]] = $(this).text()
      })

      player.years[yearNumber] = stats
    })

    $('table#salaries').find('td').each(function () {
      var year = $(this).attr('data-year')
      var amount = $(this).attr('data-amount')

      if (year&&player.years[year]&&amount&&!isNaN(amount)) {
        player.years[year].salary = amount
      }
    })

    players.push(player)

    console.log("player: "+JSON.stringify(player))
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
  fs.writeFile("data.txt", JSON.stringify(players), function (err) {
    if (err) console.log(err)
  })
})