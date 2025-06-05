var keys = {}, preKeys = {}

document.addEventListener("keydown", (e) => {
    if(e.code == "F1") mainGame.renderer.debug = !mainGame.renderer.debug
    keys[e.key.toLowerCase()] = true
})

document.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false
})

function updateControls() {
    // Sync global keys to all players
    if (mainGame && mainGame.players) {
        for (let player of mainGame.players) {
            if (!player.onlinePlayer) {  // Only for local players
                player.keys = {...keys}  // Copy keys object
            }
        }
    }
    
    // Handle client connection key updates
    if (window.clientConnection && clientConnection.connected) {
        let playerControls = mainGame.players[0].controls
        
        // Send key press/release events to server
        var sendKeyUpdate = (controlIndex) => {
            let key = playerControls[controlIndex]
            if (keys[key] && !preKeys[key]) {
                clientConnection.updateKey(key, true)
            }
            if (!keys[key] && preKeys[key]) {
                clientConnection.updateKey(key, false)
            }
        }
        
        // Send updates for all control keys
        sendKeyUpdate(0)  // left
        sendKeyUpdate(1)  // right 
        sendKeyUpdate(2)  // up
        sendKeyUpdate(3)  // down
    }
    
    preKeys = {...keys}
}