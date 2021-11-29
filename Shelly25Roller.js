/**
A codec to control a roller with a Shelly25Swithc

Place this file alongside your
config.json file, and add the following config:
       {
             
            "name": "Shelly25Roller",
            "accessory": "mqttthing",
            "url": "url",
            "username": "user",
            "password": "passwd",
            "type": "garageDoorOpener",
            "codec": "Shelly25Roller.js",
            "Shelly25Roller": {
            	"setState": {
            		"Target": {
            			"topic": "shellies/shellyswitch25-84CCA89FXXXX/roller/0/command",
            			"open": "open",
            			"close": "close",
            			"stop": "stop"
            			}
            	},
            	"getState": {
            		"Target": {
            		   "topic": "shellies/shellyswitch25-84CCA89FXXXX/roller/0/command",
            			"open": "open",
            			"close": "close"
            			},
            		"Current": {
            			"topic": "shellies/shellyswitch25-84CCA89FXXXX/roller/0",
            			"INACTIVE": "stop"
            			},
            		"Obstruction": {
            			"topic": "shellies/shellyswitch25-84CCA89FXXXX/roller/0/stop_reason",
            			"INACTIVE": "normal"
            			},
            		"Lock": {
            			"topic": "shellies/shellyswitch25-84CCA89FXXXX/roller/0/pos",
            			"ACTIVE": 0,
            			"INACTIVE": 100
            			}
            	}
            },
            "logMqtt": true
    }



**/

function init( params ) {
    let { log, config, publish, notify } = params;
  
    let target_state=null, current_state=null,
    	obstruction_state=null, lock_state=null, door_position=null;
    	

	 config.topics = {
		"getTargetDoorState": config.Shelly25Roller.getState.Target.topic,
		"getCurrentDoorState": config.Shelly25Roller.getState.Current.topic,
		"getObstructionDetected": config.Shelly25Roller.getState.Obstruction.topic,
		"getLockCurrentState": config.Shelly25Roller.getState.Lock.topic,
		"setTargetDoorState": config.Shelly25Roller.setState.Target.topic
    };


    log(`Starting Shelly25Roller Codec for ${config.name}
		getTargetDoorState: ${config.Shelly25Roller.getState.Target.topic},
		getCurrentDoorState: ${config.Shelly25Roller.getState.Current.topic},
		getObstructionDetected: ${config.Shelly25Roller.getState.Obstruction.topic},
		getLockCurrentState: ${config.Shelly25Roller.getState.Lock.topic},
		setTargetDoorState: ${config.Shelly25Roller.setState.Target.topic}
    `);    


    function decodeShelly25Roller( message, info, output ) { 
    	if (config.logMqtt) {
    		log(`decoding : [${info.property}] with message [${message}]`);
    	}
   
        if (info.property == "targetDoorState") {
            //getTargetState returns targetState
            if (message == config.Shelly25Roller.getState.Target.open ) {
            	target_state = "O";
				notify(config.currentState,0);  // ['O','C'] 	
            }
            else if (message == config.Shelly25Roller.getState.Target.stop ) {
            	target_state = "stop";
            	notify(config.currentState,4) // if it works
            } 
            else if (message == config.Shelly25Roller.getState.Target.close){
            // should be 'close'
           		target_state = "C";
       			notify(config.currentState,1);
            }
            output(target_state);
        }

        // ['O','C','o','c','S']  Current state is probe from : /roller/0 and /roller/0/command
        if (info.property == "currentDoorState") {
        	if (config.logMqtt) {log(`Checking if message = ${config.Shelly25Roller.getState.Current.INACTIVE}`);}
        	if (message == config.Shelly25Roller.getState.Current.INACTIVE ) {
        	// not moving check if its obstructed or just stopped by user
        		if (obstruction_state === true  ||
        			target_state == "O" ||
        			target_state == "C") {
	            	if (config.logMqtt) {log("The door is stopped, we need to know if its secured or not");}
            	    if (lock_state == "S") {
            			if (config.logMqtt) {log("The door is stopped and secured, current state is closed");}
						current_state = "C";
						if (target_state == null) {target_state="S";}
            	    }
            	    else if (lock_state == "U") {
            			if (config.logMqtt) {log("The door is stopped and fully open");}
	   	        		current_state = "O"; // Stopped
	   	        		if (target_state == null) {target_state="O";}
            	    }
            	    else {
            			if (config.logMqtt) {log("The door is stopped and not fully open, current state is Stopped");}
	   	        		current_state = "S"; // Stopped
	   	        		if (target_state == null) {target_state="O";}
            	    }

        		} 
				// not obstructed then its target_state
				current_state = target_state; // [O,C] Opened/Closed
			}
		// not stopped, then moving	
        else if (target_state == null) {target_state="O";} // must be initialized to smthg
        else if (target_state == "O") {current_state = "o";} // opening
        else if (target_state == "C") {current_state = "c";} // closing
    
		output(current_state);
		}

		// [true,false] from /stop_reason
       if (info.property == "obstructionDetected") {
            if (message != config.Shelly25Roller.getState.Obstruction.INACTIVE) {
            	obstruction_state = true;
            	if (config.logMqtt) {log("Obstruction detected, notifying !!!");}
            	notify(config.obstructionDetected,true); // see if it works    	
            }
            else {
            	obstruction_state = false;
            	if (config.logMqtt) {log("Obstruction no detected, nothing to do");}  	
            	}
			output(obstruction_state);
		}

		// [[ 'U', 'S', 'J', '?'] from /pos
       if (info.property == "lockCurrentState") {
            if (message == config.Shelly25Roller.getState.Lock.ACTIVE) {
            	lock_state = "S";
            	if (config.logMqtt) {log("Lock detected, notifying !!!");}
            	notify(config.lockCurrentState,1); // see if it works    	
            }
            else if (message == config.Shelly25Roller.getState.Lock.INACTIVE) {
            	lock_state = "U";
            	if (config.logMqtt) {log("Lock detected, notifying !!!");}
            	notify(config.lockCurrentState,0); // see if it works    	
            }
            else {
            	lock_state = "?";
            	if (config.logMqtt) {log("Door not locked");}
				notify(config.lockCurrentState,4); // see if it works    	
            }
            door_position = message; // to a later use
			output(lock_state);
		}

	}

	function encodeShelly25Roller(message, info, output) {
    	if (config.logMqtt) {
    		log(`encoding : [${info.property}] with message [${message}]`);
    		}

        if (info.property == "targetDoorState") {
            //check if we need to send smthg
            if ( message == target_state ) {return undefined;} 
            // ok we can publish
            if (message == "O" ) {
            	message = config.Shelly25Roller.setState.Target.open;
               	target_state = "O";
				notify(config.currentDoorState,0);  // open 	
            }
            else if (message == "S") {
            	message = config.Shelly25Roller.setState.Target.stop;
            	target_state = "S";
				notify(config.currentDoorState,4); // stop
            } 
            else {
            	// should be 'close'
            	message = config.Shelly25Roller.setState.Target.close;
            	target_state = "C";
       			notify(config.currentDoorState,1); //close
            }
            publish(config.Shelly25Roller.setState.Target, message);
            output(message);
        }
//		return undefined;
	}

  return {
        encode: encodeShelly25Roller,
        decode: decodeShelly25Roller
      };
}


// export initialisation function
module.exports = {
    init
};
