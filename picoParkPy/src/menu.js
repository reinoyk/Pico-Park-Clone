function startGame() {
    document.getElementById("c").style.display = ""
    document.getElementById("menu").style.display = "none"
    document.getElementById("restartLevel").style.display = ""
    
    if (!mainGame.matter.running) {
        startMainGame()
        
        // Only broadcast if we're the host
        if (window.hostConnection && hostConnection.connected) {
            setInterval(() => {
                hostConnection.broadcast(JSON.stringify({
                    startGame: true,
                }))
            }, 3000);
        }
    }
}

function hideGame() {
    document.getElementById("menu").style.display = ""
    document.getElementById("c").style.display = "none"
}

function setRoomCode(c) {
    const roomCodeElement = document.getElementById("roomCode")
    if (roomCodeElement) {
        roomCodeElement.textContent = c
    }
}

function addPlayerToMenu(name) {
    const memberListElement = document.getElementById("memberlist")
    if (memberListElement) {
        // Check if player already exists in the list
        const existingPlayers = memberListElement.querySelectorAll('div')
        for (let player of existingPlayers) {
            if (player.textContent.trim().replace('<br>', '') === name) {
                console.log(`Player ${name} already in member list, skipping...`)
                return // Don't add duplicate
            }
        }
        
        // Add new player
        const playerDiv = document.createElement("div")
        playerDiv.innerHTML = `${name}<br>`
        memberListElement.appendChild(playerDiv)
        console.log(`Added ${name} to member list`)
    }
}