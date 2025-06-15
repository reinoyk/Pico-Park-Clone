class WebSocketClient {
    constructor(serverUrl = 'ws://localhost:8765') {
        this.serverUrl = serverUrl;
        this.ws = null;
        this.playerId = null;
        this.roomId = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.callbacks = {
            onConnection: () => {},
            onDisconnection: () => {},
            onRoomCreated: () => {},
            onRoomJoined: () => {},
            onPlayerJoined: () => {},
            onPlayerLeft: () => {},
            onGameStarted: () => {},
            onGameUpdate: () => {},
            onLevelChanged: () => {},
            onError: () => {}
        };
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.serverUrl);
                
                this.ws.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    console.log('Connected to game server');
                    this.callbacks.onConnection();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(JSON.parse(event.data));
                };
                
                this.ws.onclose = () => {
                    this.connected = false;
                    console.log('Disconnected from game server');
                    this.callbacks.onDisconnection();
                    this.attemptReconnect();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.callbacks.onError(error);
                    reject(error);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => {
                this.connect().catch(() => {
                    // Continue reconnection attempts
                });
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'room_created':
                this.roomId = data.room_id;
                this.playerId = data.player_id;
                this.callbacks.onRoomCreated(data);
                break;
                
            case 'room_joined':
                this.roomId = data.room_id;
                this.playerId = data.player_id;
                this.callbacks.onRoomJoined(data);
                break;
                
            case 'player_joined':
                this.callbacks.onPlayerJoined(data);
                break;
                
            case 'player_left':
                this.callbacks.onPlayerLeft(data);
                break;
                
            case 'game_started':
                this.callbacks.onGameStarted(data);
                break;
                
            case 'game_update':
                this.callbacks.onGameUpdate(data);
                break;
                
            case 'level_changed':
                this.callbacks.onLevelChanged(data);
                break;
                
            case 'error':
                this.callbacks.onError(data);
                break;
                
            default:
                console.warn('Unknown message type:', data.type);
        }
    }
    
    send(data) {
        if (this.connected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                ...data,
                player_id: this.playerId
            }));
        } else {
            console.warn('Cannot send message: not connected');
        }
    }
    
    createRoom(username) {
        this.send({
            type: 'create_room',
            username: username
        });
    }
    
    joinRoom(roomId, username) {
        this.send({
            type: 'join_room',
            room_id: roomId,
            username: username
        });
    }
    
    startGame() {
        this.send({
            type: 'start_game'
        });
    }
    
    updatePlayer(playerData) {
        this.send({
            type: 'player_update',
            ...playerData
        });
    }
    
    sendSyncData(syncData) {
        this.send({
            type: 'sync_data',
            sync_data: syncData
        });
    }
    
    changeLevel(level) {
        this.send({
            type: 'level_change',
            level: level
        });
    }
    
    on(event, callback) {
        if (this.callbacks[event] !== undefined) {
            this.callbacks[event] = callback;
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Global client instance
window.gameClient = null;