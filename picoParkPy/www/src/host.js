// ── CONFIGURE THIS ────────────────────────────────
const PUBLIC_HOST = "192.168.68.212";
const WS_URL      = `ws://${PUBLIC_HOST}:8000`;
const MAX_PLAYERS = 6;
// ──────────────────────────────────────────────────

import { parsePlayerData, setPlayerWithData } from "./utils.js"; 
import { addPlayerToMenu }   from "./menu.js";                  
import { startGame }         from "./game.js";                  

export default class Host {
  constructor(game) {
    this.game      = game;
    this.socket    = null;
    this.roomId    = null;
    this.roomCodeE = document.getElementById("roomCode");
    this.incomingE = document.getElementById("incoming");
    this.connected = false;
    this.remotePlayers = new Map(); // Track remote players
  }

  init(roomId) {
    this.roomId = roomId;
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      console.log("🎩 Host WS open:", WS_URL);
      // tell the server you're the host for roomId
      this.socket.send(JSON.stringify({
        type:     "join",
        role:     "host",
        roomId:   this.roomId,
        username: "Host Player"
      }));
    };

    this.socket.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      console.log("📨 Host received:", msg);

      // Room created successfully
      if (msg.type === "roomCreated") {
        this.connected = true;
        if (this.roomCodeE) {
          this.roomCodeE.textContent = this.roomId;
          // Remove fetching state
          this.roomCodeE.classList.remove("fetching");
        }
        console.log("✅ Room created:", this.roomId);
        return;
      }

      // Room full or other errors
      if (msg.error) {
        alert(msg.error);
        if (this.roomCodeE) {
          this.roomCodeE.textContent = "ERROR: " + msg.error;
        }
        this.socket.close();
        return;
      }

      // Game start command
      if (msg.startGame) {
        startGame();
        return;
      }

      // Apply the authoritative snapshot
      if (msg.players) {
        this._applyPlayers(msg.players);
      }
    };

    this.socket.onerror = e => {
      console.error("❌ Host WS error:", e);
      if (this.roomCodeE) {
        this.roomCodeE.textContent = "CONNECTION ERROR";
      }
    };
    
    this.socket.onclose = () => {
      console.warn("⚠️ Host WS closed");
      this.connected = false;
      if (this.roomCodeE) {
        this.roomCodeE.textContent = "DISCONNECTED";
      }
    };
  }

  // Call this every tick (e.g. in your existing setInterval)
  updateClients() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.connected) {
      // Send local player data to server
      if (this.game.localPlayer) {
        this.socket.send(JSON.stringify({
          type:   "player",
          player: parsePlayerData(this.game.localPlayer)
        }));
      }
    }
  }

  // Internal: merge server snapshot into your local game
  _applyPlayers(playersData) {
    Object.entries(playersData).forEach(([playerId, data]) => {
      // Skip if this is the local player (host)
      if (this.game.localPlayer && playerId === this.game.localPlayer.body.id.toString()) {
        return;
      }

      let remotePlayer = this.remotePlayers.get(playerId);

      // New remote player? spawn them
      if (!remotePlayer) {
        console.log("🆕 Adding remote player:", playerId, data.username);
        
        remotePlayer = this.game.playerhandler.addPlayer({
          bodyOptions: { id: playerId },
          color: this.game.fetchColor()
        });
        
        remotePlayer.onlinePlayer = true;
        remotePlayer.username = data.username || "Remote Player";
        this.remotePlayers.set(playerId, remotePlayer);
        
        // Add to UI
        if (typeof addPlayerToMenu === 'function') {
          addPlayerToMenu(data.username || playerId);
        }
      }

      // Update remote player state
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

    // Remove disconnected players
    this.remotePlayers.forEach((player, playerId) => {
      if (!playersData[playerId]) {
        console.log("🗑️ Removing disconnected player:", playerId);
        this.game.players = this.game.players.filter(p => p !== player);
        player.unload();
        this.remotePlayers.delete(playerId);
      }
    });
  }

  // Start the game
  start() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "startGame" }));
    }
    startGame();
  }

  // Broadcast to all players in room
  broadcast(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "broadcast",
        data: data
      }));
    }
  }

  // Clean up when closing
  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    this.remotePlayers.clear();
    this.connected = false;
  }
}