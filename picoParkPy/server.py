import asyncio
import json
import websockets
import uuid
import time
import logging
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_PLAYERS = 6

# Global storage
ROOMS = {}  # roomId -> Room object
CLIENTS = {}  # websocket -> Client object

class Client:
    def __init__(self, websocket):
        self.websocket = websocket
        self.id = str(id(websocket))
        self.room_id = None
        self.role = None  # "host" or "client"
        self.username = "unnamed"
        self.player_data = {
            "x": 50, 
            "y": 50, 
            "direction": 1,
            "keys": {},
            "frame": "idle",
            "color": "red",
            "scale": 1,
            "ready": False,
            "shields": {},
            "dead": False
        }
        
class Room:
    def __init__(self, room_id, host_client):
        self.id = room_id
        self.host = host_client
        self.clients = {host_client.id: host_client}  # id -> Client
        self.game_state = {
            "players": {},
            "keys": [],
            "doors": [],
            "started": False,
            "level": 1
        }
        logger.info(f"🏠 Room {room_id} created with host {host_client.id}")
        
    def add_client(self, client):
        if len(self.clients) >= MAX_PLAYERS:
            return False
        self.clients[client.id] = client
        client.room_id = self.id
        logger.info(f"👥 Client {client.id} joined room {self.id} ({len(self.clients)}/{MAX_PLAYERS})")
        return True
        
    def remove_client(self, client_id):
        if client_id in self.clients:
            client = self.clients.pop(client_id)
            logger.info(f"👋 Client {client_id} left room {self.id}")
            # If host leaves, close the room
            if client.role == "host":
                logger.info(f"🏠 Host left, closing room {self.id}")
                return "close_room"
        return "continue"
        
    def get_player_data(self):
        return {
            client_id: {
                "id": client_id,
                "x": client.player_data["x"],
                "y": client.player_data["y"],
                "direction": client.player_data["direction"],
                "keys": client.player_data["keys"],
                "frame": client.player_data["frame"],
                "color": client.player_data["color"],
                "scale": client.player_data["scale"],
                "ready": client.player_data["ready"],
                "shields": client.player_data["shields"],
                "dead": client.player_data["dead"],
                "username": client.username,
                "role": client.role
            }
            for client_id, client in self.clients.items()
        }

async def register_client(websocket):
    client = Client(websocket)
    CLIENTS[websocket] = client
    try:
        address = websocket.remote_address
    except:
        address = "unknown"
    logger.info(f"🔗 Client {client.id} connected from {address}")
    return client

async def unregister_client(websocket):
    if websocket not in CLIENTS:
        return
        
    client = CLIENTS.pop(websocket)
    logger.info(f"🔌 Client {client.id} disconnected")
    
    if client.room_id and client.room_id in ROOMS:
        room = ROOMS[client.room_id]
        result = room.remove_client(client.id)
        
        if result == "close_room":
            # Notify all clients that room is closing
            disconnect_tasks = []
            for other_client in room.clients.values():
                if other_client.websocket != websocket:
                    disconnect_tasks.append(notify_room_closed(other_client))
            
            if disconnect_tasks:
                await asyncio.gather(*disconnect_tasks, return_exceptions=True)
            
            del ROOMS[client.room_id]
            logger.info(f"🗑️ Room {client.room_id} deleted")

async def notify_room_closed(client):
    try:
        await client.websocket.send(json.dumps({
            "error": "Host disconnected. Room closed."
        }))
        await client.websocket.close()
    except Exception as e:
        logger.error(f"Error notifying client {client.id}: {e}")

async def handle_join(client, data):
    role = data.get("role", "client")
    room_id = data.get("roomId")
    username = data.get("username", "unnamed")
    
    client.role = role
    client.username = username
    
    logger.info(f"📋 Join request: {role} wanting room {room_id} as {username}")
    
    if role == "host":
        # Create new room
        if not room_id:
            room_id = str(uuid.uuid4())[:8].upper()
        
        if room_id in ROOMS:
            await client.websocket.send(json.dumps({
                "error": "Room already exists"
            }))
            return
            
        room = Room(room_id, client)
        ROOMS[room_id] = room
        client.room_id = room_id
        
        response = {
            "type": "roomCreated",
            "roomId": room_id,
            "success": True
        }
        await client.websocket.send(json.dumps(response))
        logger.info(f"✅ Room {room_id} created successfully for host {client.id}")
        
    else:
        # Join existing room
        if not room_id or room_id not in ROOMS:
            await client.websocket.send(json.dumps({
                "error": f"Room '{room_id}' not found"
            }))
            return
            
        room = ROOMS[room_id]
        
        if not room.add_client(client):
            await client.websocket.send(json.dumps({
                "error": f"Room is full (max {MAX_PLAYERS} players)"
            }))
            return
            
        response = {
            "type": "joinedRoom",
            "roomId": room_id,
            "success": True,
            "playerCount": len(room.clients)
        }
        await client.websocket.send(json.dumps(response))
        logger.info(f"✅ Client {client.id} joined room {room_id} successfully")
        
        # Notify host about new player
        try:
            await room.host.websocket.send(json.dumps({
                "type": "playerJoined",
                "playerId": client.id,
                "username": username,
                "playerCount": len(room.clients)
            }))
        except Exception as e:
            logger.error(f"Error notifying host: {e}")

async def handle_player_update(client, data):
    if not client.room_id:
        return
        
    player_data = data.get("player", {})
    
    # Update client's player data
    if "position" in player_data:
        pos = player_data["position"]
        if "x" in pos:
            client.player_data["x"] = pos["x"]
        if "y" in pos:
            client.player_data["y"] = pos["y"]
    
    # Update other fields
    for field in ["direction", "keys", "frame", "color", "scale", "ready", "shields", "dead"]:
        if field in player_data:
            client.player_data[field] = player_data[field]

async def handle_key_input(client, data):
    if not client.room_id:
        return
    
    # Update client's keys
    keycode = data.get("keycode")
    pressed = data.get("pressed", False)
    
    if keycode:
        client.player_data["keys"][keycode] = pressed

async def handle_start_game(client, data):
    if not client.room_id or client.role != "host":
        await client.websocket.send(json.dumps({
            "error": "Only host can start the game"
        }))
        return
        
    room = ROOMS[client.room_id]
    room.game_state["started"] = True
    
    logger.info(f"🎮 Game started in room {client.room_id}")
    
    # Broadcast game start to all clients in room
    message = json.dumps({
        "type": "gameStarted",
        "startGame": True,
        "playerCount": len(room.clients)
    })
    
    broadcast_tasks = []
    for room_client in room.clients.values():
        broadcast_tasks.append(safe_send(room_client, message))
    
    await asyncio.gather(*broadcast_tasks, return_exceptions=True)

async def handle_broadcast(client, data):
    if not client.room_id or client.role != "host":
        return
        
    room = ROOMS[client.room_id]
    broadcast_data = data.get("data", "")
    
    message = json.dumps({
        "type": "hostBroadcast",
        "data": broadcast_data
    })
    
    # Send to all clients except host
    broadcast_tasks = []
    for room_client in room.clients.values():
        if room_client.role != "host":
            broadcast_tasks.append(safe_send(room_client, message))
    
    await asyncio.gather(*broadcast_tasks, return_exceptions=True)

async def safe_send(client, message):
    try:
        await client.websocket.send(message)
        return True
    except websockets.exceptions.ConnectionClosed:
        return False
    except Exception as e:
        logger.error(f"Send error to {client.id}: {e}")
        return False

async def connection_handler(websocket, path=None):
    """Main connection handler that works with different websockets versions"""
    client = await register_client(websocket)
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "join":
                    await handle_join(client, data)
                elif msg_type == "player":
                    await handle_player_update(client, data)
                elif msg_type == "key":
                    await handle_key_input(client, data)
                elif msg_type == "startGame":
                    await handle_start_game(client, data)
                elif msg_type == "broadcast":
                    await handle_broadcast(client, data)
                else:
                    logger.warning(f"❓ Unknown message type from {client.id}: {msg_type}")
                    
            except json.JSONDecodeError:
                logger.error(f"💥 Invalid JSON from client {client.id}")
            except Exception as e:
                logger.error(f"💥 Error handling message from {client.id}: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        logger.error(f"💥 Connection error with {client.id}: {e}")
    finally:
        await unregister_client(websocket)

async def broadcaster():
    while True:
        try:
            # Broadcast to each room separately
            rooms_to_remove = []
            
            for room_id, room in ROOMS.items():
                if len(room.clients) == 0:
                    rooms_to_remove.append(room_id)
                    continue
                
                # Create room-specific game state
                game_state = {
                    "type": "gameState",
                    "players": room.get_player_data(),
                    "roomId": room_id,
                    "playerCount": len(room.clients),
                    "started": room.game_state["started"]
                }
                
                message = json.dumps(game_state)
                
                # Send to all clients in this room
                send_tasks = []
                disconnected_clients = []
                
                for client in room.clients.values():
                    task = safe_send(client, message)
                    send_tasks.append((client, task))
                
                # Wait for all sends to complete
                results = await asyncio.gather(*[task for _, task in send_tasks], return_exceptions=True)
                
                # Check for failed sends
                for (client, _), success in zip(send_tasks, results):
                    if not success:
                        disconnected_clients.append(client.websocket)
                
                # Clean up disconnected clients
                for ws in disconnected_clients:
                    await unregister_client(ws)
            
            # Remove empty rooms
            for room_id in rooms_to_remove:
                del ROOMS[room_id]
                logger.info(f"🗑️ Removed empty room {room_id}")
                        
        except Exception as e:
            logger.error(f"💥 Broadcaster error: {e}")
            
        await asyncio.sleep(1/30)  # 30 FPS

async def main():
    logger.info("🚀 Starting multiplayer server...")
    logger.info(f"📊 Max players per room: {MAX_PLAYERS}")
    logger.info(f"🐍 Python version: {sys.version}")
    
    try:
        # Check websockets version and use appropriate handler
        import websockets
        logger.info(f"📦 Websockets version: {websockets.__version__}")
        
        # Start the WebSocket server
        start_server = websockets.serve(connection_handler, "0.0.0.0", 8765)
        
        logger.info("🌐 Server running on ws://0.0.0.0:8765")
        logger.info("📱 Local access: ws://localhost:8765")
        logger.info("🔗 Network access: ws://[your-ip]:8765")
        logger.info("=" * 50)
        
        # Run server and broadcaster concurrently
        await asyncio.gather(
            start_server,
            broadcaster()
        )
        
    except Exception as e:
        logger.error(f"💥 Failed to start server: {e}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 Server shutting down...")
    except Exception as e:
        logger.error(f"💥 Server crashed: {e}")
        sys.exit(1)