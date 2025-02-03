
const IS_RAILWAY = true

function getRoute(path = "") {
    if( IS_RAILWAY ) return "/_apps"+path
    return path
}

async function pm2AppAction(appName, action, options ) {
    await fetch(getRoute()+`/api/apps/${appName}/${action}`, {method: 'POST'})
    //dh: location.reload();
    setTimeout( ()=>{ location.reload() }, 3000 )
}

async function managerAction( cmd ) {

    await fetch(getRoute()+`/api/${cmd}`, {method: 'GET'})

    //setTimeout( ()=>{ 
    //    location.reload()
    //}, 1000 )
}
