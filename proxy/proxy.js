//Include external modules.
var http = require('http')
var httpProxy = require('http-proxy')
var HttpProxyRules = require('http-proxy-rules')
var fs = require( "fs" )
const express = require('express')

//Set default routing rules.
var baseRules = {
    '.*/': 'http://localhost:8383/',
    //ok: '.*/public': 'http://localhost:8383/', 
    //'.*/db': 'http://localhost:8686/',
}

//Read users routing rules.
var userRules = {}
try { userRules = JSON.parse( fs.readFileSync( '/app/data/files/routes.json' )) }
catch( e ) { console.error(e) }

//Set up proxy mapping rules instance.
var proxyRules = new HttpProxyRules({
    rules: {...userRules, ...baseRules},
    //default: 'http://localhost:8888' // default target
});

//Create reverse proxy instance
var proxy = httpProxy.createProxy()

//Remove certain headers from browser request.
proxy.on('proxyReq', function(proxyReq, req, res, options) {
    //console.log("proxyReq: ", req.url )
    if( req.url.split("?")[0]=="/_/" )
        proxyReq.setHeader('Accept-Encoding', '*')  //<-- ask for unzipped version.
})

//Intercept and modify main pocket-base html file.
proxy.on('proxyRes', function (proxyRes, req, res) {
    
    // Intercept and modify headers
    delete proxyRes.headers['x-frame-options'] // Remove X-Frame-Options header
    if (proxyRes.headers['content-security-policy']) {
        proxyRes.headers['content-security-policy'] = proxyRes.headers['content-security-policy'].replace(
            /frame-ancestors [^;]+;/,
            ''
        )
    }

    if (req.url.split("?")[0].includes("/_/")) { // req.url.split("?")[0]=="/_/"

        var body = []

        proxyRes.on('data', function (chunk) { 
            body.push(chunk) 
        })
        proxyRes.on('end', function () {

            body = Buffer.concat(body).toString()
            console.log("req: ", req.url )
            //console.log("reply: ", body )
            var html = fs.readFileSync( __dirname+'/dark.css' )
            body = body.replace( "</head>", "<style>"+html+"</style>\n</head>" )

            /*ok
            body = body.replace( "<meta\n", "<metaxx\n" )
            //https://user1-db.node-studio.dev/_/#/login?demoEmail=user1@droidscript.cloud&demoPassword=gjhiplfggodcchgnccphnalo
            var script = `<script>
                function autoLogin() {
                    document.querySelector('button[type="submit"]').click()
                } </script>`
            body = body.replace( '<body>', script+'<body onload="autoLogin()">' )
            */
            res.end( body )
        })
    }
})

//Error handling on proxy
proxy.on('error', function (err, req, res) {
    console.error('Proxy error:', err);
    if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end(err.toString());
});

//Create http server for proxy.
http.createServer( function(req, res) {
    try {
        //Check if request needs authorization (/admin is for apps to use for secure apis)
        var host = req.headers.host.split(":")[0];
        var path = req.url.split("?")[0]
        var checkAuth = (path.startsWith("/admin") || host.includes("-fs") || host.includes("-apps") ||
                        path.startsWith("/_fs") || path.startsWith("/_apps") || path.startsWith("/_db")) //|| path.startsWith("/_/") )
        
        //Check for authorization mode (using cookie or query param)
        if( checkAuth ) {
            let cookies = req.headers?.cookie || ""
            var urlHasKey = req.url.includes(process.env.ADMIN_KEY)
            //console.log(  "xxx req.path=" + req.path )
            //console.log(  "xxx process.env.ADMIN_KEY=" + process.env.ADMIN_KEY )
            //console.log(  "xxx urlHasKey=" + urlHasKey )
            if( !cookies.includes(process.env.ADMIN_KEY) && !urlHasKey ) { 
                res.end('Not authorized!'); return }
            if( urlHasKey ) res.setHeader( 'Set-Cookie', "key="+process.env.ADMIN_KEY+"; Path=/; SameSite=None; Secure")
        }

        var url = req.url+"" // holds the orginal url because "proxyRules.match(req)" seems to modify the req.url

        //Check proxy mapping rules.
        var target = null
        if(host.includes("-fs") || path.startsWith("/_fs")) {
            target = {host:"localhost", port:"8015"}  //<--filemanager
            req.url = req.url.replace("/_fs", "/")
        }
        else if(host.includes("-apps") || path.startsWith("/_apps")) {
            target = {host:"127.0.0.1", port:"8585"}  //<--apps admin
            req.url = req.url.replace("/_apps", "/")
        }
        else if(host.includes("-db") || path.startsWith("/_db")) {
            target = {host:"localhost", port:"8686"}  //<--database admin
            req.url = req.url.replace("/_db", "")
        }
        else if(path.startsWith("/_admin")) {
            target = {host:"localhost", port:"8088"}  //<--admin dashboard
            if(path == "/_admin") req.url = req.url.replace("/_admin", "/")
            else req.url = req.url.replace("/_admin", "")
        }
        else target = proxyRules.match(req); //<--user rules

        if(typeof target == "string" && target.includes("localhost:8383") ) req.url = url

        console.log(target, path)
        
        //Proxy in-comming request.
        if( target ) {
            const modifyHtml = (path=="/_db/_/" || path=="/_db/_/#/login") // const modifyHtml = (path=="/_/" || path=="/_/#/login")
            return proxy.web(req, res, {target:target, selfHandleResponse:modifyHtml} )
        }

        //Show proxy mismatch errors.
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('App not found!')
    }
    catch( e ) { console.error(e) }

}).listen(8080);

//Create static file server for public folder.
const public_app = express()
public_app.use(express.static("/app/data/files/public", {index: "index.html"}))
public_app.listen(8383)

console.log("PORTS    Server running")
console.log("----------------------")
console.log("8080     proxy")
console.log("8015     file server")
console.log("8686     pocketbase")
console.log("8585     pm2 webui")
console.log("8383     static website")
console.log("8088     admin")
console.log("----------------------")
console.log("")