const pm2 = require('pm2');
const { bytesToSize, timeSince } = require('./ux.helper')

function listApps(){
    return new Promise((resolve, reject) => {
        pm2.connect((err) => {
            if (err) {
                reject(err)
            }
            pm2.list((err, apps) => {
                pm2.disconnect()
                if (err) {
                    reject(err)
                }
                apps = apps.map((app) => {

                    //dh: 
                    var script = app.pm2_env.pm_exec_path
                    var status = script.endsWith("install.js") ? "install" : app.pm2_env.status

                    return {
                        name: app.name,
                        script: script,
                        status: status,
                        cpu: app.monit.cpu,
                        memory: bytesToSize(app.monit.memory),
                        uptime: timeSince(app.pm2_env.pm_uptime),
                        pm_id: app.pm_id
                    }
                })
                resolve(apps)
            })
        })
    })
}

function describeApp(appName){
    return new Promise((resolve, reject) => {
        pm2.connect((err) => {
            if (err) {
                reject(err)
            }
            pm2.describe(appName, (err, apps) => {
                pm2.disconnect()
                if (err) {
                    reject(err)
                }
                if(Array.isArray(apps) && apps.length > 0){

                    //dh: 
                    var script = apps[0].pm2_env.pm_exec_path
                    var status = script.endsWith("install.js") ? "install" : apps[0].pm2_env.status

                    const app = {
                        name: apps[0].name,
                        script: script, //dh:
                        status: status, 
                        cpu: apps[0].monit.cpu,
                        memory: bytesToSize(apps[0].monit.memory),
                        uptime: timeSince(apps[0].pm2_env.pm_uptime),
                        pm_id: apps[0].pm_id, 
                        pm_out_log_path: apps[0].pm2_env.pm_out_log_path,
                        pm_err_log_path: apps[0].pm2_env.pm_err_log_path,
                        pm2_env_cwd: apps[0].pm2_env.pm_cwd
                    }
                    resolve(app)
                }
                else{
                    resolve(null)
                }
            })
        })
    })
}

function reloadApp(process){
    return new Promise((resolve, reject) => {
        pm2.connect((err) => {
            if (err) {
                reject(err)
            }
            pm2.reload(process, (err, proc) => {
                pm2.disconnect()
                if (err) {
                    reject(err)
                }
                resolve(proc)
            })
        })
    })
}

function stopApp(process){
    return new Promise((resolve, reject) => {
        pm2.connect((err) => {
            if (err) {
                reject(err)
            }
            pm2.stop(process, (err, proc) => {
                pm2.disconnect()
                if (err) {
                    reject(err)
                }
                resolve(proc)
            })
        })
    })
}

function restartApp(process){
    return new Promise((resolve, reject) => {
        pm2.connect((err) => {
            if (err) {
                reject(err)
            }
            pm2.restart(process, (err, proc) => {
                pm2.disconnect()
                if (err) {
                    reject(err)
                }
                resolve(proc)
            })
        })
    })
}

//dh: start app with different script, but same process name.
function startApp(script, process, env, noRestart) {

    console.log( "pm2: script = " + script )
    return new Promise((resolve, reject) => {
        pm2.connect((err) => {
            if (err) {
                reject(err)
            }
            console.log( "pm2: stopping proc..." )
            pm2.delete(process, (err, proc) => {
              
                console.log( "pm2: running proc..." )
                var options = { name:process, env:env, autorestart:(noRestart!=true) }
                pm2.start( script, options, (err, proc) => {
                    console.log( "pm2: started proc " + process )
                    pm2.disconnect()
                    if (err) {
                        reject(err)
                    }
                    resolve(proc)
                })
            })
        })
    })
}

module.exports = {
    listApps,
    describeApp,
    reloadApp,
    stopApp,
    restartApp,
    startApp
}

