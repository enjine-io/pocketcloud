const login_main = `
//*******************************
// PocketCloud Admin
//*******************************

class Main extends App {
    onStart()
    {
        let txtMsg = "@@ERROR_TEXT@@"
        let showAdminKeyHint = @@ADMIN_KEY_HINT@@
        let hintText = 'Your admin key is weak. Update your ADMIN_KEY environment variable and follow these criteria \\n\\n' +
                    '- must be at least 8 characters\\n' +
                    '- must include a lowercase and uppercase letter\\n' +
                    '- must include a number\\n' +
                    '- must include a special character'
        this.main = ui.addLayout("main", "Linear", "FillXY,VCenter")

        var headerLay = ui.addLayout(this.main, "Linear", "Horizontal,VCenter")
        headerLay.setMargins(0,0,0,3,"rem")

        this.logo = ui.addImage(headerLay, "_admin/assets/pocketcloud.png", "", "6rem")
        
        var rightLay = ui.addLayout(headerLay, "Linear", "Left")
        rightLay.setMargins(2,0,0,0,"rem")

        this.appName = ui.addText(rightLay, "PocketCloud", "H3,Bold")
        
        this.adminTxt = ui.addText(rightLay, "Admin", "h5,textSecondary")
        
        this.crd = ui.addLayout(this.main, "Card", "Top,Left", "24rem")
        
        this.txt1 = ui.addText(this.crd, txtMsg, "Bold,h6")
        this.txt1.setMargins(2, 2, 2, 2, "rem")

        if( showAdminKeyHint ) {
            var lay = ui.addLayout(this.crd, "Linear", "Horizontal", 1)
            lay.backColor = "rgba(255,255,255,0.05)"
            lay.setPadding(2, 1, 2, 1, "rem")
            lay.setMargins(0, 0, 0, 2, "rem")

            this.hintIcon = ui.addText(lay, "lightbulb", "icon")
            this.hintIcon.textColor = "yellow"

            this.adminKeyHint = ui.addText(lay, hintText, "Subtitle2,Multiline,textSecondary")
            this.adminKeyHint.setMargins(1, 0, 0, 0, "rem")
        }

        this.adminKey = ui.addTextField(this.crd, "@@ADMIN_KEY@@", "Outlined", "calc(100% - 4rem)")
        this.adminKey.setMargins(2, 0, 2, 2, "rem")
        this.adminKey.label = "Admin key"
        this.adminKey.setEndAdornment("vpn_key", "icon")
        this.adminKey.setOnEnter( this.submitKey )

        this.proceedBtn = ui.addButton(this.crd, "Proceed", "Large,Outlined", "calc(100% - 4rem)")
        this.proceedBtn.setMargins(2, 0, 2, 2, "rem")
        this.proceedBtn.setOnTouch( this.submitKey )
    }

    async submitKey()
    {
        const key = this.adminKey.text
        if( !key ) return ui.showPopup("Admin key is empty")
        // let url = window.location.origin + window.location.pathname + "?key=" + key
        // window.location.replace( url )
        let url = window.location.origin + window.location.pathname + "/login"
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ key })
        })
        if( res.ok ) {
            var data = await res.json()
            if( data.ok ) {
                url = window.location.origin + window.location.pathname + "/home"
                window.location.reload()
            }
            else {
                this.txt1.text = "Invalid admin key"
                this.adminKey.text = ""
            }
        }
        else {
            ui.showPopup("An error occurred while trying to log in. Please try again later.")
        }
    }
}
`
const home_main = `
//*******************************
// PocketCloud Admin
//*******************************

class Main extends App {
    onStart()
    {
        this.currLogs = ""
        this.drawerShown = false
        this.reload = false

        //Creates main layout.
        this.main = ui.addLayout( "main", "Linear", "FillXY,VCenter")
        
        this.headerLay = ui.addLayout(this.main, "Linear", "Horizontal,VCenter", 1, "3rem")
        this.headerLay.backColor = "#3e4347"
        this.headerLay.bringForward(100)
        this.headerLay.childSpacing = "between"

        var leftLay = ui.addLayout(this.headerLay, "Linear", "Left,VCenter,Horizontal")

        this.logo = ui.addImage(leftLay, "_admin/assets/pocketcloud.png", "", "2rem")
        this.logo.setMargins(1,0,0,0,"rem")

        this.cloudName = ui.addText(leftLay, "PocketCloud", "h6,Bold")
        this.cloudName.setMargins(1,0,0.5,0,"rem")

        this.appName = ui.addText(leftLay, "Admin", "h6,Bold,textSecondary")

        var rightLay = ui.addLayout(this.headerLay, "Linear", "Right,VCenter,Horizontal")

        this.staticWebIcon = ui.addButton(rightLay, "public", "Icon,Link,NewTab")
        this.staticWebIcon.toolTip = "Open static website"
        this.staticWebIcon.url = window.location.origin

        this.logsIcon = ui.addButton(rightLay, "sort", "Icon")
        this.logsIcon.toolTip = "Proxy logs"
        this.logsIcon.setMargins(0.5,0,0.5,0,"rem")
        this.logsIcon.setOnTouch( this.openProxyLogs )

        this.logoutIcon = ui.addButton(rightLay, "power_settings_new", "Icon")
        this.logoutIcon.toolTip = "Logout"
        this.logoutIcon.setMargins(0,0,0.5,0,"rem")
        this.logoutIcon.setOnTouch( this.logoutUser )

        // Adds a tab component to the main layout.
        var tabs = ["folder:Files", "grid_view:Apps", "storage:Database"]
        this.tabs = ui.addTabs(this.main, tabs, "Icon,Dense", 1, "calc(100% - 3rem)")
        this.tabs.alignTitle = "horizontal"
        this.tabs.tabHeight = 48
        this.tabs.setIndicatorStyle(0.4, 3, "#ffffff", 3)
        this.tabs.setOnChange( this.onChange )

        //Get the first tab and add a webview control
        this.tab1 = this.tabs.getLayout(0)
        this.web1 = ui.addWebView(this.tab1, "", "", 1, 1)
        this.web1.url = window.location.origin + "/_fs?key=@@ADMIN_KEY@@"

        //Get the second tab and add a webview control.
        this.tab2 = this.tabs.getLayout(1)
        this.web2 = ui.addWebView(this.tab2, "", "", 1, 1)
        this.web2.url = window.location.origin + "/_apps?key=@@ADMIN_KEY@@"

        //Get the third tab and add a webview control
        this.tab3 = this.tabs.getLayout(2)
        this.web3 = ui.addWebView(this.tab3, "", "", 1, 1)
        this.web3.url = window.location.origin + "/_db/_/?key=@@ADMIN_KEY@@#login?demoEmail=@@ADMIN_EMAIL@@&demoPassword=@@ADMIN_KEY@@"

        this.drawerLay = ui.addLayout(null, "Linear", "", 1, 1)
        this.drawer = ui.addDrawer(this.drawerLay, "Right", 0.4)

        this.procTabs = ui.addTabs(this.drawerLay, "STDOUT,STDERR", "Dense", 1, 1)
        this.procTabs.alignTitle = "horizontal"
        this.procTabs.tabHeight = 48
        this.procTabs.setIndicatorStyle(0.4, 3, "#ffffff", 3)
        this.procTabs.setOnChange( this.onProcTab )
        this.proxyStdOutLay = this.procTabs.getLayout(0)
        this.proxyStdOutLay.addClass("admin-logs-container")
        this.proxyStdErrLay = this.procTabs.getLayout(1)
        this.proxyStdErrLay.addClass("admin-logs-container")
        
        this.refreshLogs = ui.addButton(this.drawerLay, "refresh", "Icon,Small")
        this.refreshLogs.setOnTouch( this.reloadLogs )
        this.refreshLogs.addClass("admin-refresh-icon-btn")
    }

    openProxyLogs() {
        this.drawer.show()
        if( !this.drawerShown ) this.onProcTab("STDOUT")
        this.drawerShown = true
    }

    onProcTab(tab, index) {
        tab = tab.toLowerCase()
        if(this.currLogs !== tab || this.reload) {
            var url = window.location.origin+"/_apps/api/apps/proxy/logs/"+tab+"?key=@@ADMIN_KEY@@"
            fetch(url).then(async res => {
                if( !res.ok ) return
                var logs = await res.json()
                var dataLogs = "Nothing to show"
                if( logs.logs.lines ) {
                    dataLogs = logs.logs.lines.split("<br/>").map(m => '> '+m).join('<br/>')
                }
                if(this.currLogs == "stdout")
                    this.proxyStdOutLay._div.innerHTML = dataLogs
                else
                    this.proxyStdErrLay._div.innerHTML = dataLogs
            })
        }
        this.currLogs = tab
        this.reload = false
    }

    reloadLogs() {
        this.reload = true
        this.onProcTab( this.currLogs )
    }

    async logoutUser() {
        var url = window.location.origin + window.location.pathname + "/logout"
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include'
        })
        if( res.ok ) {
            var data = await res.json()
            if( data.ok ) {
                url = window.location.origin + window.location.pathname + "/home"
                window.location.reload()
            }
        }
        else {
            ui.showPopup("An error occurred while trying to log in. Please try again later.")
        }
    }
}
`

const express = require('express')
const cookieParser = require('cookie-parser')
const fs = require("fs")

function validatePassword(password) {
    const minLength = password.length >= 8
    const hasLetter = /[a-zA-Z]/.test(password)
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  
    return (
        minLength &&
        hasLetter &&
        hasUppercase &&
        hasLowercase &&
        hasNumber &&
        hasSpecialChar
    )
}

const app = express()

let adminPath = "/app/admin"
let indexPath = adminPath+"/index.html"
let mainPath = adminPath+"/main.js"
const sessions = {}
const generateSessionID = () => Math.random().toString(36).substring(2, 16)
const sessionExpires = 5 * 24 * 60 * 60 * 1000

app.use(express.json())
app.use(cookieParser())

// for local testing purposes
let DEBUG = false
if( DEBUG ) {
    process.env.ADMIN_KEY = "j2K45@678" //j2K45@678
    adminPath = process.cwd()
    indexPath = adminPath+"/index.html"
    mainPath = adminPath+"/main.js"
}

app.use((req, res, next) => {
    const sessionID = req.cookies['sessionID']
    let mainScript = ""
    let isPasswordValid = validatePassword( process.env.ADMIN_KEY )
    if( !isPasswordValid ) {
        mainScript = login_main
        mainScript = mainScript.replace("@@ERROR_TEXT@@", "Update admin key and try again")
        mainScript = mainScript.replace("@@ADMIN_KEY_HINT@@", "true")
        mainScript = mainScript.replace("@@ADMIN_KEY@@", "")
    }
    else if( !sessionID ) {
        mainScript = login_main
        mainScript = mainScript.replace("@@ERROR_TEXT@@", "Enter admin key")
        mainScript = mainScript.replace("@@ADMIN_KEY_HINT@@", "false")
        mainScript = mainScript.replace("@@ADMIN_KEY@@", "")
    }
    else {
        mainScript = home_main
        mainScript = mainScript.replaceAll("@@ADMIN_KEY@@", process.env.ADMIN_KEY)
        mainScript = mainScript.replaceAll("@@ADMIN_EMAIL@@", process.env.PB_ADMIN_EMAIL)
    }
    fs.writeFileSync(mainPath, mainScript)
    next()
})
app.get((_, res) => {
    res.sendFile( indexPath )
})
app.post("/login", (req, res) => {
    const { key } = req.body
    if(key != process.env.ADMIN_KEY) {
        return res.json({ok: false, message: 'Invalid credentials'})
    }
    const sessionID = generateSessionID()
    sessions[sessionID] = {sessionID, createdAt: Date.now()}
    res.cookie('sessionID', sessionID, {httpOnly: true, secure: true, maxAge: sessionExpires}) // Set secure: true in production
    res.json({ok: true, message: 'Login successful'})
})
app.post("/logout", (req, res) => {
    const sessionID = req.cookies['sessionID']
    if (sessionID) delete sessions[sessionID]
    res.clearCookie('sessionID')
    res.json({ok: true, message: 'Logged out successfully'})
})
app.use(express.static(adminPath))
app.listen(8088, () => { console.log("Admin is listening on port 8088") })