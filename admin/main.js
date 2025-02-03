
//*******************************
// DroidScript Cloud Admin.
//*******************************

class Main extends App {
    onStart()
    {
        this.currLogs = ""
        this.drawerShown = false

        //Creates main layout.
        this.main = ui.addLayout( "main", "Linear", "FillXY,VCenter")
        
        this.headerLay = ui.addLayout(this.main, "Linear", "Horizontal,VCenter", 1, "3rem")
        this.headerLay.backColor = "#3e4347"
        this.headerLay.bringForward(100)
        this.headerLay.childSpacing = "between"

        var leftLay = ui.addLayout(this.headerLay, "Linear", "Left,VCenter,Horizontal")

        this.logo = ui.addImage(leftLay, "_admin/assets/dscloud.png", "", "2rem")
        this.logo.setMargins(1,0,1,0,"rem")

        this.appName = ui.addText(leftLay, "DS Cloud Admin", "h6,Bold")

        var rightLay = ui.addLayout(this.headerLay, "Linear", "Right,VCenter,Horizontal")

        this.logsIcon = ui.addButton(rightLay, "sort", "Icon")
        this.logsIcon.toolTip = "Proxy logs"
        this.logsIcon.setOnTouch( this.openProxyLogs )

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
        this.web1.url = window.location.origin + "/_fs?key=je12!34J5678"

        //Get the second tab and add a webview control.
        this.tab2 = this.tabs.getLayout(1)
        this.web2 = ui.addWebView(this.tab2, "", "", 1, 1)
        this.web2.url = window.location.origin + "/_apps?key=je12!34J5678"

        //Get the third tab and add a webview control
        this.tab3 = this.tabs.getLayout(2)
        this.web3 = ui.addWebView(this.tab3, "", "", 1, 1)
        this.web3.url = window.location.origin + "/_db/_/?key=je12!34J5678#login?demoEmail=undefined&demoPassword=je12!34J5678"

        this.drawerLay = ui.addLayout(null, "Linear", "", 1, 1)
        this.drawer = ui.addDrawer(this.drawerLay, "Right", 0.4)

        this.procTabs = ui.addTabs(this.drawerLay, "STDOUT,STDERR", "Dense", 1, 1)
        this.procTabs.setOnChange( this.onProcTab )
        this.proxyStdOutLay = this.procTabs.getLayout(0)
        this.proxyStdErrLay = this.procTabs.getLayout(1)
        var styles = {
            color: '#d4d4d4',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
            padding: '1rem',
            fontSize: '12',
            lineHeight: '1.5',
            fontWeight: '300',
            letterSpacing: '-0.5px',
            overflowY: 'auto'
        }
        Object.assign(this.proxyStdOutLay._div.style, styles)
        Object.assign(this.proxyStdErrLay._div.style, styles)

        this.refreshLogs = ui.addButton(this.drawerLay, "refresh", "Icon,Small")
        this.refreshLogs.setOnTouch( this.reloadLogs )
        Object.assign(this.refreshLogs._div.style, {
            position: 'absolute',
            right: '0.5rem',
            top: '8px',
            zIndex: '200'
        })
    }

    openProxyLogs() {
        this.drawer.show()
        if( !this.drawerShown ) this.onProcTab("stdout")
        this.drawerShown = true
    }

    onProcTab(tab, index) {
        console.log( tab )
        if(this.currLogs !== tab) {
            var url = "https://dscloud.up.railway.app/_apps/api/apps/proxy/logs/stdout?key=je12!34J5678"
            fetch(url).then(async res => {
                if( !res.ok ) return
                var logs = await res.json()
                var dataLogs = logs.logs.lines.split("<br/>").map(m => '> '+m).join('<br/>')
                if(this.currLogs == "stdout")
                    this.proxyStdOutLay._div.innerHTML = dataLogs
                else
                    this.proxyStdErrLay._div.innerHTML = dataLogs
            })
        }
        this.currLogs = tab
    }

    reloadLogs() {
        onProcTab( this.currLogs )
    }
}
