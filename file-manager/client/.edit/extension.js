

//DroidScript extension util class.
function Extension() {

    var self = this;
    var timer = 0;
    this.isConnected = true; //Are we connected to remote IDE.
    this.serverIP = "";      //Server ip.
    this.appName = "";       //Current loaded app name.
    this.devPath = "";       //Target extra path during development.
    this.displayWidth = 0;   //Connected device display width.
    this.displayHeight = 0;  //Connected device display height.
    this.inIde = (window._isDS && window.top===window.self)  //Are we in device IDE.
    this.inCloud = (location.href.includes("https")||location.port<8080)  //Are we connected to cloud server (or dev server).
    this.cloudKey = ""

    //Hook into cross frame messaging
    this.onMessage = function(event) {

    	var params = event.data.split("|");
    	var cmd = params[0];
    	console.log( "ext msg:" + event.data );

    	if( cmd=="init" ) {
    	    console.log( "ext init" );
    	    self.serverIP = params[1];
    	    self.appName = params[2];
    	    self.displayWidth = params[3];
    	    self.displayHeight = params[4];
    	    self.devPath = params[5];
            self.cloudKey = params[6];
    	    try { if(typeof ext_OnReady=='function') ext_OnReady() }
    	    catch(e) { console.log( "Script Error: in ext_OnReady - " + e ) }
    	    clearInterval( timer );
    	}
    	else if( cmd=="onSelect" ) {
    	    self.appName = params[2];
    	    if( typeof ext_OnSelect=='function' ) ext_OnSelect(params[1]);
    	}
    	else if( cmd=="onDeselect" ) {
    	    if( typeof ext_OnDeselect=='function') ext_OnDeselect(params[1]);
    	}
    	else if( cmd=="onConnect" ) {
            self.isConnected = true;
            if( typeof ext_OnConnect=='function' ) ext_OnConnect();
        }
        else if( cmd=="onDisconnect" ) {
            self.isConnected = false;
            if( typeof ext_OnDisconnect=='function' ) ext_OnDisconnect();
        }
        else if( cmd=="onProject" ) {
            self.appName = params[1]
            if( typeof ext_OnProject=='function') ext_OnProject(params[1]);
        }
    	else if( cmd=="onOpen" ) {
            if( typeof ext_OnOpen=='function') ext_OnOpen(params[1],params[2]);
        }
        else if( cmd=="onSave" ) {
            if( typeof ext_OnSave=='function') ext_OnSave();
        }
        else if( cmd=="onError" ) {
            if( typeof ext_OnError=='function') ext_OnError(params[1],params[2]);
        }
        else if( cmd=="onPost" ) {
            params.shift()
            if( typeof ext_OnPost=='function') ext_OnPost(params.join("|"));
        }
        else if( cmd=="onBack") {
            if( typeof ext_OnBack=='function') ext_OnBack();
        }
    }
    window.addEventListener( "message", self.onMessage );

    //Handle situation if we are not in an i-frame (in device IDE/WebView).
    if( this.inIde ) {
        var exec = function( js ) { prompt( "#", "App.Execute("+js ); }
        window.parent = {
            postMessage: (msg)=>{ exec( 'if( typeof ext_OnMessage=="function") ext_OnMessage("'+msg+'")' ) }
        }
    }
    //Handle situation where server is running in cloud.
    else if( this.inCloud ) {
        this.serverIP = location.hostname
    }

    //Initialise the extension.
    this.Init = function() {
        //Ask parent ide for initialisation data.
    	if( parent && !this.inCloud ) 
            timer = setInterval( ()=>{ if( parent ) parent.postMessage( "init:", "*" )}, 1000 );
    }

    //Send message to IDE console.
    this.Log = function( msg ) {
    	if( parent ) parent.postMessage( "log:"+msg, "*" )
    }

	//Execute code on the device.
	//'app' mode runs as a stand-alone app.
	//'ide' mode runs inside ide.
	//'usr' mode runs inside current user app.
	this.Execute = function( mode, code ) {
	    if( this.inIde ) {
	        exec( 'OnIDE( "execute","'+mode+'","'+btoa(code)+'")' );
	    }
	    else {
    		xmlHttp = new XMLHttpRequest();
    		xmlHttp.open( "get", "/ide?cmd=execute&mode="+mode+"&code="+encodeURIComponent(btoa(code)), true );
    		xmlHttp.send();
	    }
	}

	//Execute shell commands with output shown in debug tab.
	//(Same as typing into WiFi IDE debug tab)
	this.SysExec = function( code ) {
	     if( this.inIde ) {
	        exec( 'OnIDE( "exec","'+encodeURIComponent("$"+code)+'")' );
	    }
	    else {
    		xmlHttp = new XMLHttpRequest();
    		xmlHttp.open( "get", "/ide?cmd=exec&code="+encodeURIComponent("$"+code), true );
    		xmlHttp.send();
	    }
	}

	//Read a text file from the projects folder.
    //ext.ReadFile( "/"+ext.appName+"/layout1.json", (json)=>{ alert(json) } )
    this.ReadFile = function( file, callback ) {
        xmlHttp = new XMLHttpRequest();
        xmlHttp.onload = function() { return callback(xmlHttp.responseText); }
        xmlHttp.open( "get", "/"+ext.devPath.replace("/","")+file, true );
        xmlHttp.send();
    }

    //Write a text file to the projects folder.
    //ext.WriteFile( JSON.stringify(json,null,2), ext.appName, "layout1.json", (resp)=>{ alert(resp) } )
    this.WriteFile = function( text, folder, file, callback ) {
        var formData = new FormData();
        let blob = new Blob([text], {type: 'text/plain; charset=UTF-8'})
        formData.append( ext.devPath+folder, blob, file );

        xmlHttp = new XMLHttpRequest();
        if(callback) xmlHttp.onload = function() {
            const responseText = xmlHttp.responseText || '{"status": "Error ext.WriteFile"}';
            return callback(JSON.parse(responseText).status);
        }
        else xmlHttp.onload = function() { console.log(xmlHttp.responseText); }
        xmlHttp.open( "post", "/upload", true )
        xmlHttp.send(formData)
    }

    //Install an npm module to the current project folder.
    this.InstallModule = function(moduleName) {
        return fetch(`/ide?cmd=exec&code=!addmodule ${moduleName}`)
            .then(res => res.json())
            .then(res => res.status)
            .catch(err => err.toString())
    }

    //Delete a file from the current project folder.
    this.DeleteFile = function(file) {
        return fetch(`/ide?cmd=delete&file=/${ext.devPath+ext.appName}/${file}`)
            .then(res => res.json())
            .then(res => res.status)
            .catch(err => err.toString())
    }

    //Rename a file in the current project folder
    this.RenameFile = function(name, newName) {
        return fetch(`/ide?cmd=rename&file=/${ext.devPath+ext.appName}/${name}&newname=/${ext.devPath+ext.appName}/${newName}`)
            .then(res => res.json())
            .then(res => res.status)
            .catch(err => err.toString());
    }

    //Check a file exists in the current project folder.
    this.FileExists = function( file ) {
        return fetch(`/${ext.devPath+ext.appName}/${file}`)
            .then(res => res.ok)
            .catch(err => false)
    }

	//Get the ip address of the DroidScript server.
	this.GetServerIp = function() {
	    return self.serverIP;
	}

    //Post a message to another extension.
    this.Post = function( extName, msg ) {
        if( parent ) parent.postMessage( "post:"+extName+"|"+msg, "*" )
    }

	//Reload a given file.
	//Use '*' to reload all current editor files.
    this.Reload = function( fileName ) {
    	if( parent ) parent.postMessage( "reload:"+fileName, "*" )
    }

    //Open a given project file at given line or search pattern.
    this.Open = function( fileName, lineOrPattern ) {
        if( parent ) parent.postMessage( "open:"+fileName+"|"+lineOrPattern, "*" )
    }

    //Refresh the app list.
    this.Refresh = function() {
    	if( parent ) parent.postMessage( "refresh:", "*" )
    }

    //Highlight an extension tab in red.
    this.Attention = function( name ) {
        if( parent ) parent.postMessage( "attention:"+name, "*" )
    }

    //Run the current project.
    this.Play = function() {
        if( parent ) parent.postMessage( "play:", "*"  )
    }

    //Stop the current project.
    this.Stop = function() {
        if( parent ) parent.postMessage( "stop:", "*"  )
    }

    //Save the current project.
    this.Save = function() {
        if( parent ) parent.postMessage( "save:", "*"  )
    }

    //Open the docs for a particular method.
    this.OpenDocs = function( method ) {
        if( parent ) parent.postMessage( "docs:"+method, "*"  )
    }
}

//Create single global instance.
var ext = new Extension();

//Fire onReady if we are not in the IDE.
if( ext.inCloud ) setTimeout( ()=>{ ext_OnReady() }, 1000 )

