class GameManager {
    constructor(game, localPlayer) {
        this.game = game
        this.localPlayer = localPlayer
        this.isHost = false
        this.members = new Map()
        
        this.setupEventHandlers()
    }
    
    setupEventHandlers() {
        gameClient.on('onRoomCreated', (data) => {
            this.isHost = true
            this.localPlayer.color = data.color
            setRoomCode(data.room_id)
            console.log('Room created:', data.room_id)
        })
        
        gameClient.on('onRoomJoined', (data) => {
            this.isHost = false
            this.localPlayer.color = data.color
            console.log('Joined room:', data.room_id)
        })
        
        gameClient.on('onPlayerJoined', (data) => {
            addPlayerToMenu(data.player.username)
            this.members.set(data.player.id, data.player)
        })
        
        gameClient.on('onPlayerLeft', (data) => {
            this.removePlayerFromGame(data.player_id)
            this.members.delete(data.player_id)
        })
        
        gameClient.on('onGameStarted', () => {
            startGame()
        })
        
        gameClient.on('onGameUpdate', (data) => {
            this.updateRemotePlayers(data.players)
            if (data.sync_data) {
                this.game.syncHandler.processSyncData(data.sync_data)
            }
        })
        
        gameClient.on('onLevelChanged', (data) => {
            this.game.renderer.levelTransistion(data.level)
        })
        
        gameClient.on('onError', (data) => {
            console.error('Server error:', data.message)
            alert('Error: ' + data.message)
        })
    }
    
    updateRemotePlayers(serverPlayers) {
        for (let serverPlayer of serverPlayers) {
            if (serverPlayer.id === gameClient.playerId) {
                continue // Skip local player
            }
            
            let gamePlayer = this.findPlayerById(serverPlayer.id)
            if (!gamePlayer) {
                gamePlayer = this.game.playerhandler.addPlayer({
                    bodyOptions: { id: serverPlayer.id },
                    color: serverPlayer.color
                })
                gamePlayer.onlinePlayer = true
            }
            
            this.updatePlayerFromServer(gamePlayer, serverPlayer)
        }
    }
    
    updatePlayerFromServer(gamePlayer, serverData) {
        // Update position
        // Smooth position interpolation
        let lerpFactor = 0.8
        let currentPos = gamePlayer.body.position
        let newPos = {
            x: currentPos.x * (1-lerpFactor) + serverData.position.x * lerpFactor,
            y: currentPos.y * (1-lerpFactor) + serverData.position.y * lerpFactor
        }
        Matter.Body.setPosition(gamePlayer.body, newPos)
        
        // Update other properties
        gamePlayer.direction = serverData.direction
        gamePlayer.color = serverData.color
        gamePlayer.frame = serverData.frame
        gamePlayer.ready = serverData.ready
        gamePlayer.hasShield = serverData.shields
        gamePlayer.dead = serverData.dead
        gamePlayer.setScale(serverData.scale)
        
        // Update keys for movement animation
        gamePlayer.keys = serverData.keys
    }
    
    findPlayerById(id) {
        return this.game.players.find(p => p.body.id === id)
    }
    
    removePlayerFromGame(playerId) {
        const playerIndex = this.game.players.findIndex(p => p.body.id === playerId)
        if (playerIndex !== -1) {
            const player = this.game.players[playerIndex]
            player.unload()
            this.game.players.splice(playerIndex, 1)
        }
    }
    
    updateServer() {
        if (!gameClient.connected) return
        
        // Send local player data
        const playerData = {
            position: this.localPlayer.body.position,
            direction: this.localPlayer.direction,
            keys: this.localPlayer.keys,
            frame: this.localPlayer.frame,
            ready: this.localPlayer.ready,
            scale: this.localPlayer.scale,
            shields: this.localPlayer.hasShield,
            dead: this.localPlayer.dead
        }
        
        gameClient.updatePlayer(playerData)
        
        // Send sync data if host
        if (this.isHost) {
            const syncData = this.game.syncHandler.getSyncData()
            gameClient.sendSyncData(syncData)
        }
    }
    
    addLocalPlayer() {
        const newPlayer = this.game.playerhandler.addPlayer({
            controls: ['a','d','w','s'],
            keys: keys,
            color: this.game.fetchColor(),
        })
        addPlayerToMenu('Player2')
        return newPlayer
    }
}