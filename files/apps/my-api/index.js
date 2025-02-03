var express = require('express')
var app = express()
var version = 1.0

app.get('/version', function (req, res) {
   res.send( version.toString() )
})

app.get('/info', function (req, res) {
   res.send( { name:"My API", version:version } )
})

var server = app.listen(3000, function () {
   console.log( "Express App running at http://localhost:3000/" )
})
