// static/src/client.js

// 1) CONFIGURE THIS:
const PUBLIC_HOST = "10.125.171.255";
const WS_URL       = `ws://${PUBLIC_HOST}:8000`;
const MAX_PLAYERS  = 6;

class Client {
    constructor(game, player) {
        this.game       = game;
        this.mainPlayer = player;
        this.socket     = null;
        this.username   = localStorage.getItem("username") || "unnamed";
    }

    init(roomId) {
        // 2) open WebSocket
        this.socket = new WebSocket(WS_URL);
        this.socket.onopen = () => {
            console.log("✅ Connected to", WS_URL);
            // tell server who we are & which room
            this.socket.send(JSON.stringify({
                type:      "join",
                username:  this.username,
                roomId:    roomId
            }));
        };
        this.socket.onmessage = evt => {
            const msg = JSON.parse(evt.data);

            // 3) Handle server‐side room‐full error
            if (msg.error) {
                alert(msg.error);
                this.socket.close();
                return;
            }

            this.processData(msg);
        };
        this.socket.onclose = () => {
            console.log("⚠️ Disconnected from server");
        };
        this.socket.onerror = e => {
            console.error("WebSocket error:", e);
        };
    }

    processData(d) {
        // clamp remote‐player list to first MAX_PLAYERS
        if (d.playerData) {
            const limited = d.playerData.slice(0, MAX_PLAYERS);
            this.updateHostPlayers(limited);
        }

        // rest of your existing branches:
        if (d.syncData && this.game.running) {
            this.game.syncHandler.processSyncData(d.syncData);
        }
        if (d.setColor) {
            this.mainPlayer.color = d.setColor;
        }
        if (d.startGame) {
            startGame();
        }
        if (d.setLevel) {
            this.game.renderer.levelTransistion(d.setLevel);
        }
        if (d.restartLevel) {
            this.game.levelHandler.setLevel(
              this.game.levelHandler.currentLevel.name
            );
        }
        // etc...
    }

    updateKey(keycode, value) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type:    "key",
                keycode: { code: keycode, value: value }
            }));
        }
    }

    updateHost() {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type:   "player",
                player: parsePlayerData(this.mainPlayer)
            }));
        }
    }

    updateHostPlayers(players) {
        // your existing code, but now only the first 6 players ever land here
        const findPlayerById = id =>
          this.game.players.find(p => p.body.id === id);

        players.forEach(raw => {
            let p = findPlayerById(raw.id);
            if (!p) {
                p = this.game.playerhandler.addPlayer({
                  bodyOptions: { id: raw.id }
                });
                p.onlinePlayer = true;
            }
            this.setPlayer(p, raw);
        });
    }

    setPlayer(body, data) {
        setPlayerWithData(body, data);
    }
    
}

// 4) Wherever you create your Client instance, just keep calling
//    client.updateHost() on your sync‐tick as before.
