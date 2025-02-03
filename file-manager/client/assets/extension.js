
//DroidScript extension util class.
function Extension() {

    var self = this;
    this.timer = 0;
    this.serverIP = "";      //DS ip.
    this.appName = "";       //Current loaded app name.
    this.displayWidth = 0;   //Connected device display width.
    this.displayHeight = 0;  //Connected device display height.

    //Hook into cross frame messaging
    window.addEventListener("message", function(event) {
    	var params = event.data.split("|");
    	var cmd = params[0];
    	console.log( "ext msg:" + event.data );

    	if( cmd=="init" ) {
    	    self.serverIP = params[1];
    	    self.appName = params[2];
    	    self.displayWidth = params[3];
    	    self.displayHeight = params[4];
    	    if(typeof ext_OnReady=='function') ext_OnReady();
    	    clearTimeout( self.timer );
    	}
    	else if( cmd=="onSelect" ) {
    	    self.appName = params[2];
    	    if( typeof ext_OnSelect=='function' ) ext_OnSelect(params[1]);
    	}
    	else if( cmd=="onDeselect" )
    	    if( typeof ext_OnDeselect=='function') ext_OnDeselect(params[1]);
    });
    
    //Execute code on the device.
	//'app' mode runs as a stand-alone app.
	//'ide' mode runs inside ide.
	//'usr' mode runs inside current user app.
	this.Execute = function( mode, code ) {
		xmlHttp = new XMLHttpRequest();
		xmlHttp.open( "get", "/ide?cmd=execute&mode="+mode+"&code="+encodeURIComponent(btoa(code)), true );
		xmlHttp.send();
	}
	
	//Refresh the app list.
    this.Refresh = function() {
    	if( parent ) parent.postMessage( "refresh:", "*" )
    }

    //Initialise the extension.
    this.Init = function() {
        //Ask parent ide for initialisation data.
    	this.timer = setTimeout( ()=>{ if( parent ) parent.postMessage( "init:", "*" )}, 1000 );
    }

	//Get the ip address of the DroidScript server.
	this.GetServerIp = function() {
	    return self.serverIP;
	}
}

//Create single global instance.
var ext = new Extension();

