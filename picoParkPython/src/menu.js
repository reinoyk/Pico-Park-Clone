function startGame() {
    document.getElementById("c").style.display = ""
    document.getElementById("menu").style.display = "none"
    document.getElementById("restartLevel").style.display = ""
    
    if (!mainGame.matter.running) {
        startMainGame()
    }
}

function hideGame() {
    document.getElementById("menu").style.display = ""
    document.getElementById("c").style.display = "none"
}

function setRoomCode(roomCode) {
    document.getElementById("roomCode").textContent = roomCode
}

function addPlayerToMenu(name) {
    const memberList = document.getElementById("memberlist")
    const playerElement = document.createElement("div")
    playerElement.innerHTML = `${name}<br>`
    memberList.appendChild(playerElement)
}