var keys = {}, preKeys = {}
document.addEventListener("keydown",(e)=>{
    if(e.code=="F1") mainGame.renderer.debug = !mainGame.renderer.debug
    keys[e.key.toLowerCase()] = true
})
document.addEventListener("keyup",(e)=>{
    keys[e.key.toLowerCase()] = false
})

function updateControls() {
    // For multiplayer, we don't need to send individual key events
    // The game manager will send the complete key state regularly
    preKeys = {...keys}
}