

const checkAuthentication = async (ctx, next) => {

    ctx.session.isAuthenticated = true //dh:
    
    if(ctx.session.isAuthenticated){
        return ctx.redirect('/_apps/apps')
    }
    await next()
}

const isAuthenticated = async (ctx, next) => {

    ctx.session.isAuthenticated = true //dh:

    if(!ctx.session.isAuthenticated){
        return ctx.redirect('/_apps/login')
    }
    await next()
}

module.exports = {
    isAuthenticated,
    checkAuthentication,
};