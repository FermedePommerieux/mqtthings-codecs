/**
A codec to control a roller with a Shelly25Switch
it uses the followings inputs : roller/0/command, roller/0, roller/0/stop_reason and /roller/0/pos
and the following output : roller/0/command

it needs calibration to detect the fully close/open state of the roller. This is required to
detect the 'O', 'C' or 'S' states when the roller is stopped.

On start, the roller could report a wrong state in the Home app

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
 			"ACTIVE": 0, // requires calibration
 			"INACTIVE": 100 // requires calibration
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
			notify(config.currentState,0); // ['O','C'] 	
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

 // ['O','C','o','c','S'] Current state is probe from : /roller/0 and /roller/0/command
 	if (info.property == "currentDoorState") {
		if (config.logMqtt) {log(`Checking if message = ${config.Shelly25Roller.getState.Current.INACTIVE}`);}
		if (message == config.Shelly25Roller.getState.Current.INACTIVE ) {
		// not moving check if its obstructed or just stopped by user
			if (config.logMqtt) {log("The door is stopped, we need to know if its secured or not");}
			if (lock_state == "S") {
				if (config.logMqtt) {log("The door is stopped and secured, current state is closed");}
				current_state = "C";
			}
			else if (lock_state == "U") {
				if (config.logMqtt) {log("The door is stopped and fully open");}
				current_state = "O"; // Stopped
			}
			else { 
				if (config.logMqtt) {log("The door is stopped and not fully open, current state is Stopped");}
				current_state = "S"; // Stopped but could be Obstructed
			}
		}
		// not stopped, then moving	
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
			// here we could report a jammed LockState
			notify(config.lockCurrentState,2); // for 'J'
			lock_state = "J"; 	
		}
		else {
			obstruction_state = false;
			if (config.logMqtt) {log("Obstruction not detected, nothing to do");} 	
		}
		output(obstruction_state);
	}

// [[ 'U', 'S', 'J', '?'] from /pos
	if (info.property == "lockCurrentState") {
		if (message == config.Shelly25Roller.getState.Lock.ACTIVE) {
			lock_state = "S";
			if (config.logMqtt) {log("Door fully close, Lock detected");}
			// fix current and target states
			if (target_state == null) {
				target_state="C"; notify(config.TargetState,1);
			}
			if (current_state == null) {
				current_state="C"; notify(config.CurrentDoorState,1);
			}
			notify(config.lockCurrentState,1); // see if it works 	
		}
		else if (message == config.Shelly25Roller.getState.Lock.INACTIVE) {
			lock_state = "U";
			if (config.logMqtt) {log("Door fully Open");}
			// fix current and target states
				if (target_state == null) {
					target_state="O"; notify(config.TargetState,0);
				}
				if (current_state == null) {
					current_state="O"; notify(config.CurrentDoorState,0);
				}
		notify(config.lockCurrentState,0); // see if it works 	
		}
		else {
			if (config.logMqtt) {log("Door not locked see what it is doing");}
			// at this time we don't know if the door is jammed let check 
			if (obstruction_state == true) {
				if (config.logMqtt) {log("Door is Jammed, you should check why");}
				notify(config.lockCurrentState,2); // for 'J'
				lock_state = "J"; 					
				}
			else {
				// the door is not jammed, neither lock or full open report a '?' state
				if (config.logMqtt) {log("Door is doing something");}
				lock_state = "?";
				notify(config.lockCurrentState,3); // reports a '?' state 
			}
		}
		door_position = message; // to a later use, does nothing today
		output(lock_state);
	}	

}

function encodeShelly25Roller(message, info, output) {
	if (config.logMqtt) {log(`encoding : [${info.property}] with message [${message}]`);}
	if (info.property == "targetDoorState") {
		//check if we need to send smthg
		if ( message == target_state ) {return undefined;} 
		// ok we can publish
		if (message == "O" ) {
			message = config.Shelly25Roller.setState.Target.open;
			target_state = "O";
			notify(config.currentDoorState,0); // open 	
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
	return undefined;
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
