const config = require('../config')
const RateLimit = require('koa2-ratelimit').RateLimit;
const router = require('@koa/router')();
const { listApps, describeApp, reloadApp, restartApp, stopApp, startApp } = require('../providers/pm2/api')
const { validateAdminUser } = require('../services/admin.service')
const  { readLogsReverse } = require('../utils/read-logs.util')
const { getCurrentGitBranch, getCurrentGitCommit } = require('../utils/git.util')
const { getEnvFileContent } = require('../utils/env.util')
const { isAuthenticated, checkAuthentication }= require('../middlewares/auth')
const AnsiConverter = require('ansi-to-html');
const ansiConvert = new AnsiConverter();
const fetch = require('node-fetch');

const IS_RAILWAY = true;

function getRoute(path = "")
{
    if( IS_RAILWAY ) return "/_apps" + path
    return path
}

const loginRateLimiter = RateLimit.middleware({
    interval: 2*60*1000, // 2 minutes
    max: 100,
    prefixKey: '/login' // to allow the bdd to Differentiate the endpoint 
  });

router.get('/', async (ctx) => {
    return ctx.redirect(getRoute()+'/apps') //dh: /login
})

router.get('/login', loginRateLimiter, checkAuthentication, async (ctx) => {
    return await ctx.render('auth/login', {layout : false, login: { username: '', password:'', error: null }})
})

router.post('/login', loginRateLimiter, checkAuthentication, async (ctx) => {
    const { username, password } = ctx.request.body;
    try {
        await validateAdminUser(username, password)
        ctx.session.username = username;
        ctx.session.isAuthenticated = true;
        return ctx.redirect(getRoute()+'/apps')
    }
    catch(err){
        return await ctx.render('auth/login', {layout : false, login: { username, password, error: err.message }})
    }
})

router.get('/apps', isAuthenticated, async (ctx) => {
    const apps =  await listApps()
    const username = ctx.session.username;
    return await ctx.render('apps/dashboard', {
        apps: apps.filter(m => m.name != "proxy"),
        username,
    });
});

router.get('/logout', (ctx)=>{
    ctx.session = null;
    return ctx.redirect(getRoute()+'/login')
})

//dh:
router.get('/api/reboot', async (ctx)=>{
    var url = "http://" + process.env.HOST_IP + ":9090/restart?container=" + process.env.HOSTNAME
    console.log( "reboot url: " + url )
    const response = await fetch( url )
    if( !response.ok ) return ctx.body = { error: error } 
    const text = await response.text()
    return ctx.body = { reply: text }
})

router.get('/apps/:appName', isAuthenticated, async (ctx) => {
    const { appName } = ctx.params
    let app =  await describeApp(appName)
    if(app){
        app.git_branch = await getCurrentGitBranch(app.pm2_env_cwd)
        app.git_commit = await getCurrentGitCommit(app.pm2_env_cwd)
        app.env_file = await getEnvFileContent(app.pm2_env_cwd)
        const stdout = await readLogsReverse({filePath: app.pm_out_log_path})
        const stderr = await readLogsReverse({filePath: app.pm_err_log_path})
        stdout.lines = stdout.lines.map(log => {
            return  ansiConvert.toHtml(log)
        }).join('<br/>')
        stderr.lines = stderr.lines.map(log => {
            return  ansiConvert.toHtml(log)
        }).join('<br/>')
        const username = ctx.session.username;
        return await ctx.render('apps/app', {
            app,
            username,
            logs: {
                stdout,
                stderr
            }
        });
    }
    return ctx.redirect(getRoute()+'/apps')
});

router.get('/api/apps/:appName/logs/:logType', isAuthenticated, async (ctx) => {
    const { appName, logType } = ctx.params
    const { nextKey } = ctx.query
    if(logType !== 'stdout' && logType !== 'stderr'){
        return ctx.body = {
            'error': 'Log Type must be stdout or stderr'
        }
    }
    const app =  await describeApp(appName)
    const filePath = logType === 'stdout' ? app.pm_out_log_path: app.pm_err_log_path
    let logs = await readLogsReverse({filePath, nextKey})
    logs.lines = logs.lines.map(log => {
        return  ansiConvert.toHtml(log)
    }).join('<br/>')
    return ctx.body = {
        logs
    };
});

//dh: 
router.post('/api/apps/:appName/install', isAuthenticated, async (ctx) => {
    try{
        let { appName } = ctx.params
        
        //dhl orig let apps =  await reloadApp(appName)
        console.log( "pm2: installing app dependencies..." )
        // let apps =  await startApp( "/shared/pm2/install.js", appName, {EXTRA:"/app/data/files/apps/"+appName+"/index.js"}, true )

        let apps =  await startApp( "/app/pm2/install.js", appName, {EXTRA:"/app/data/files/apps/"+appName+"/index.js"}, true )

        if(Array.isArray(apps) && apps.length > 0){
            return ctx.body = {
                success: true
            }
        }
        return ctx.body = {
            success: false
        }
    }
    catch(err){
        return ctx.body = {
            'error':  err
        }
    }
});

router.post('/api/apps/:appName/reload', isAuthenticated, async (ctx) => {
    try{
        let { appName } = ctx.params
        let apps =  await reloadApp(appName)
        if(Array.isArray(apps) && apps.length > 0){
            return ctx.body = {
                success: true
            }
        }
        return ctx.body = {
            success: false
        }
    }
    catch(err){
        return ctx.body = {
            'error':  err
        }
    }
});

router.post('/api/apps/:appName/restart', isAuthenticated,  async (ctx) => {
    try {
        let { appName } = ctx.params

        //dh: let apps =  await restartApp(appName)
        let scriptSource = "/app/data/files/apps/"+appName+"/index.js"
        if(appName == "proxy") scriptSource = "/app/proxy/proxy.js"
        
        let apps =  await startApp(scriptSource, appName)
        if(Array.isArray(apps) && apps.length > 0) {
            return ctx.body = {
                success: true
            }
        }
        return ctx.body = {
            success: false
        }
    }
    catch(err){
        console.log(err)
        return ctx.body = {
            'error':  err
        }
    }
});

router.post('/api/apps/:appName/stop', isAuthenticated, async (ctx) => {
    try{
        let { appName } = ctx.params
        let apps =  await stopApp(appName)
        if(Array.isArray(apps) && apps.length > 0){
            return ctx.body = {
                success: true
            }
        }
        return ctx.body = {
            success: false
        }
    }
    catch(err){
        return ctx.body = {
            'error':  err
        }
    }
});

module.exports = router;
