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
    if (mainGame.players) {
        for (let player of mainGame.players) {
            if (!player.onlinePlayer) {  // Only for local players
                player.keys = keys  // INI YANG PENTING!
            }
        }
    }
    
    if (window.clientConnection) {
        let playerControls = mainGame.players[0].controls
        var fu = (n) => {
            if (keys[playerControls[n]] && !preKeys[playerControls[n]]) {
                clientConnection.updateKey(playerControls[n], true)
            }
            if (!keys[playerControls[n]] && preKeys[playerControls[n]]) {
                clientConnection.updateKey(playerControls[n], false)
            }
        }
        
        fu(0)
        fu(1) 
        fu(2)
        fu(3)
    }
    
    preKeys = {...keys}
}