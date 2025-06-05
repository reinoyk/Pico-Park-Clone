// Host.js - WebSocket multiplayer host
const WS_URL_HOST = "ws://localhost:8765";
const MAX_PLAYERS_HOST = 6;

class Host {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.roomId = null;
    this.roomCodeE = document.getElementById("roomCode");
    this.incomingE = document.getElementById("incoming");
    this.connected = false;
    this.remotePlayers = new Map();
    this.localPlayer = null;
  }

  init(roomId = null) {
    this.roomId = roomId || this._generateRoomId();
    
    console.log("🎩 Host connecting to:", WS_URL_HOST);
    this.socket = new WebSocket(WS_URL_HOST);

    this.socket.onopen = () => {
      console.log("✅ Host WS open:", WS_URL_HOST);
      
      this.socket.send(JSON.stringify({
        type: "join",
        role: "host", 
        roomId: this.roomId,
        username: "Host Player"
      }));
    };

    this.socket.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        console.log("📨 Host received:", msg.type);
        this._handleMessage(msg);
      } catch (e) {
        console.error("❌ Failed to parse host message:", e);
      }
    };

    this.socket.onerror = e => {
      console.error("❌ Host WS error:", e);
      this.connected = false;
      this._updateRoomCodeDisplay("CONNECTION ERROR");
    };
    
    this.socket.onclose = () => {
      console.warn("⚠️ Host WS closed");
      this.connected = false;
      this._updateRoomCodeDisplay("DISCONNECTED");
    };

    this._setupLocalPlayer();
  }

  _handleMessage(msg) {
    if (msg.type === "roomCreated") {
      this.connected = true;
      this.roomId = msg.roomId;
      this._updateRoomCodeDisplay(this.roomId);
      console.log("✅ Room created:", this.roomId);
      return;
    }

    if (msg.type === "playerJoined") {
      console.log("👥 Player joined:", msg.username, "Total players:", msg.playerCount);
      if (typeof addPlayerToMenu === 'function') {
        addPlayerToMenu(msg.username);
      }
      
      const gameCodeElement = document.getElementById("gameCode");
      if (gameCodeElement) {
        gameCodeElement.innerHTML = `Code: <b>${this.roomId}</b> (${msg.playerCount} players)`;
      }
      return;
    }

    if (msg.error) {
      alert(msg.error);
      this._updateRoomCodeDisplay("ERROR: " + msg.error);
      this.socket.close();
      return;
    }

    if (msg.type === "gameState" && msg.players) {
      this._applyGameState(msg.players);
      return;
    }

    if (msg.type === "gameStarted") {
      if (typeof startGame === 'function') {
        startGame();
      }
      return;
    }
  }

  _setupLocalPlayer() {
    if (this.game && this.game.players && this.game.players.length > 0) {
      this.localPlayer = this.game.players[0];
    }
  }

  _generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  _updateRoomCodeDisplay(text) {
    if (this.roomCodeE) {
      this.roomCodeE.textContent = text;
      this.roomCodeE.classList.remove("fetching");
    }
  }

  updateClients() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.connected) {
      return;
    }

    if (!this.localPlayer && this.game && this.game.players && this.game.players.length > 0) {
      this.localPlayer = this.game.players[0];
    }

    if (this.localPlayer) {
      this.socket.send(JSON.stringify({
        type: "player",
        player: parsePlayerData(this.localPlayer)
      }));
    }
  }

  _applyGameState(playersData) {
    if (!this.game || !this.game.players) return;

    Object.entries(playersData).forEach(([playerId, data]) => {
      if (this.localPlayer && playerId === this.localPlayer.body.id.toString()) {
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

  start() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "startGame" }));
    }
    
    if (typeof startGame === 'function') {
      startGame();
    }
  }

  broadcast(dataString) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "broadcast",
        data: dataString
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