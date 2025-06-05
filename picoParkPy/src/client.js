// Client.js - WebSocket multiplayer client
const WS_URL = "ws://localhost:8765";
const MAX_PLAYERS = 6;

class Client {
    constructor(game, player) {
        this.game = game;
        this.mainPlayer = player;
        this.socket = null;
        this.username = localStorage.getItem("username") || "unnamed";
        this.connected = false;
        this.remotePlayers = new Map();
    }

    init(roomId) {
        console.log("🔗 Client connecting to:", WS_URL);
        
        this.socket = new WebSocket(WS_URL);
        
        this.socket.onopen = () => {
            console.log("✅ Client connected to", WS_URL);
            this.connected = true;
            
            this.socket.send(JSON.stringify({
                type: "join",
                role: "client", 
                username: this.username,
                roomId: roomId
            }));
        };
        
        this.socket.onmessage = evt => {
            try {
                const msg = JSON.parse(evt.data);
                this.processData(msg);
            } catch (e) {
                console.error("❌ Failed to parse message:", e);
            }
        };
        
        this.socket.onclose = () => {
            console.log("⚠️ Client disconnected from server");
            this.connected = false;
        };
        
        this.socket.onerror = e => {
            console.error("❌ Client WebSocket error:", e);
            this.connected = false;
        };
    }

    processData(msg) {
        console.log("📨 Client received:", msg.type, msg);

        if (msg.error) {
            alert(msg.error);
            if (this.socket) {
                this.socket.close();
            }
            return;
        }

        if (msg.type === "joinedRoom") {
            console.log("✅ Joined room:", msg.roomId);
            const joinDiv = document.getElementById("join");
            if (joinDiv) {
                joinDiv.innerHTML = `
                    <h2>Connected!</h2>
                    <p>Room: ${msg.roomId}</p>
                    <p>Players: ${msg.playerCount}</p>
                    <p>Waiting for host to start the game...</p>
                `;
            }
            return;
        }

        if (msg.type === "gameState" && msg.players) {
            this._updateFromGameState(msg.players);
            return;
        }

        if (msg.type === "hostBroadcast" && msg.data) {
            const data = JSON.parse(msg.data);
            
            if (data.startGame) {
                startGame();
            }
            if (data.setLevel) {
                this.game.renderer.levelTransistion(data.setLevel);
            }
            if (data.restartLevel) {
                this.game.levelHandler.setLevel(
                    this.game.levelHandler.currentLevel.name
                );
            }
            return;
        }

        if (msg.type === "gameStarted") {
            startGame();
            return;
        }
    }

    _updateFromGameState(playersData) {
        if (!this.game || !this.game.players) return;

        const playerEntries = Object.entries(playersData).slice(0, MAX_PLAYERS);
        
        playerEntries.forEach(([playerId, data]) => {
            if (this.mainPlayer && playerId === this.mainPlayer.body.id.toString()) {
                return;
            }

            let remotePlayer = this.remotePlayers.get(playerId);

            if (!remotePlayer) {
                console.log("🆕 Adding remote player:", playerId, data.username);
                
                remotePlayer = this.game.playerhandler.addPlayer({
                    bodyOptions: { id: playerId },
                    color: data.color || this.game.fetchColor()
                });
                
                remotePlayer.onlinePlayer = true;
                remotePlayer.username = data.username || "Remote Player";
                this.remotePlayers.set(playerId, remotePlayer);
                
                if (typeof addPlayerToMenu === 'function') {
                    addPlayerToMenu(data.username || playerId);
                }
            }

            if (remotePlayer && data.x !== undefined && data.y !== undefined) {
                setPlayerWithData(remotePlayer, {
                    position: { x: data.x, y: data.y },
                    direction: data.direction || 1,
                    keys: data.keys || {},
                    frame: data.frame || "idle",
                    color: data.color || remotePlayer.color,
                    scale: data.scale || 1,
                    ready: data.ready || false,
                    shields: data.shields || {},
                    dead: data.dead || false
                });
            }
        });

        this.remotePlayers.forEach((player, playerId) => {
            if (!playersData[playerId]) {
                console.log("🗑️ Removing disconnected player:", playerId);
                const index = this.game.players.indexOf(player);
                if (index > -1) {
                    this.game.players.splice(index, 1);
                }
                if (player.unload) {
                    player.unload();
                }
                this.remotePlayers.delete(playerId);
            }
        });
    }

    updateKey(keycode, value) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "key",
                keycode: keycode,
                pressed: value
            }));
        }
    }

    updateHost() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN && this.mainPlayer) {
            this.socket.send(JSON.stringify({
                type: "player",
                player: parsePlayerData(this.mainPlayer)
            }));
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
        this.remotePlayers.clear();
        this.connected = false;
    }
}