import asyncio
import websockets
import json
import uuid
from typing import Dict, Set, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Player:
    def __init__(self, websocket, player_id: str, username: str):
        self.websocket = websocket
        self.id = player_id
        self.username = username
        self.room_id: Optional[str] = None
        self.position = {"x": 0, "y": 0}
        self.color = "red"
        self.ready = False
        self.scale = 1
        self.direction = 1
        self.frame = "idle"
        self.keys = {}
        self.dead = False
        self.shields = {1: False, 2: False, 3: False, 4: False}

class Room:
    def __init__(self, room_id: str, host_id: str):
        self.id = room_id
        self.host_id = host_id
        self.players: Dict[str, Player] = {}
        self.game_started = False
        self.current_level = "one"
        self.sync_data = {}
        
    def add_player(self, player: Player):
        self.players[player.id] = player
        player.room_id = self.id
        
    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]
            
    def get_player_data(self):
        return [
            {
                "id": p.id,
                "username": p.username,
                "position": p.position,
                "direction": p.direction,
                "keys": p.keys,
                "frame": p.frame,
                "color": p.color,
                "scale": p.scale,
                "ready": p.ready,
                "shields": p.shields,
                "dead": p.dead
            }
            for p in self.players.values()
        ]

class GameServer:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.players: Dict[str, Player] = {}
        self.colors = ["red", "blue", "yellow", "green", "orange", "pink", "purple", "gray"]
        # Ordered list of levels as defined on the frontend. This order is
        # used to determine what the next level should be when all players
        # have finished the current one.
        self.level_order = [
            "one", "two", "three", "four", "five", "six", "seven",
            "eight", "nine", "ten", "eleven", "tweleve", "thirteen",
            "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
            "nineteen", "twenty",
        ]

        # Some levels are special and should jump to a custom next level.
        # These mappings mirror the `nextLevel` values from the level
        # definitions in the frontend code.
        self.special_next = {
            "clancysTempLevel": "tempLevel",
            "tempName": "tempLevel",
        }
        
    def generate_room_id(self) -> str:
        words = ["FIRE", "WIND", "MOON", "STAR", "BOLT", "WAVE", "ROCK", "MIST"]
        import random
        return random.choice(words)
    
    def get_next_color(self, room: Room) -> str:
        used_colors = {p.color for p in room.players.values()}
        for color in self.colors:
            if color not in used_colors:
                return color
        return "red"  # fallback

    def get_next_level(self, current_level: str) -> str:
        """Return the level that should follow ``current_level``.

        If the level is part of ``level_order`` we simply advance to the next
        one (wrapping around at the end). For special levels defined in
        ``special_next`` we return the mapped level. If the level isn't known,
        it is returned unchanged.
        """

        if current_level in self.special_next:
            return self.special_next[current_level]

        if current_level in self.level_order:
            idx = self.level_order.index(current_level)
            return self.level_order[(idx + 1) % len(self.level_order)]

        # Unknown level name; default to the same level to avoid errors
        return current_level
    
    async def handle_create_room(self, websocket, player: Player, data: dict):
        room_id = self.generate_room_id()
        room = Room(room_id, player.id)
        player.color = self.get_next_color(room)
        room.add_player(player)
        self.rooms[room_id] = room
        
        await websocket.send(json.dumps({
            "type": "room_created",
            "room_id": room_id,
            "player_id": player.id,
            "color": player.color
        }))
        
    async def handle_join_room(self, websocket, player: Player, data: dict):
        room_id = data.get("room_id")
        room = self.rooms.get(room_id)
        
        if not room:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "Room not found"
            }))
            return
            
        if room.game_started:
            await websocket.send(json.dumps({
                "type": "error", 
                "message": "Game already started"
            }))
            return
            
        player.color = self.get_next_color(room)
        room.add_player(player)
        
        await websocket.send(json.dumps({
            "type": "room_joined",
            "room_id": room_id,
            "player_id": player.id,
            "color": player.color
        }))
        
        # Notify other players
        await self.broadcast_to_room(room_id, {
            "type": "player_joined",
            "player": {
                "id": player.id,
                "username": player.username,
                "color": player.color
            }
        }, exclude=player.id)
        
    async def handle_start_game(self, websocket, player: Player, data: dict):
        room = self.rooms.get(player.room_id)
        if not room or room.host_id != player.id:
            return
            
        room.game_started = True
        await self.broadcast_to_room(room.id, {
            "type": "game_started"
        })
        
    async def handle_player_update(self, websocket, player: Player, data: dict):
        # Update player state
        if "position" in data:
            player.position = data["position"]
        if "keys" in data:
            player.keys = data["keys"]
        if "direction" in data:
            player.direction = data["direction"]
        if "frame" in data:
            player.frame = data["frame"]
        if "ready" in data:
            player.ready = data["ready"]
        if "scale" in data:
            player.scale = data["scale"]
        if "shields" in data:
            player.shields = data["shields"]
        if "dead" in data:
            player.dead = data["dead"]
            
        room = self.rooms.get(player.room_id)
        if room and room.game_started:
            if all(p.ready for p in room.players.values()):
                # Semua player sudah ready, broadcast level_changed!
                room.current_level = self.get_next_level(room.current_level)  # bikin/mapping fungsi next level
                await self.broadcast_to_room(room.id, {
                    "type": "level_changed",
                    "level": room.current_level
                })
                # Reset ready flag untuk next round
                for p in room.players.values():
                    p.ready = False
            
    async def handle_sync_data(self, websocket, player: Player, data: dict):
        room = self.rooms.get(player.room_id)
        if not room or room.host_id != player.id:
            return
            
        room.sync_data = data.get("sync_data", {})
        
    async def handle_level_change(self, websocket, player: Player, data: dict):
        room = self.rooms.get(player.room_id)
        if not room or room.host_id != player.id:
            return
            
        room.current_level = data.get("level")
        await self.broadcast_to_room(room.id, {
            "type": "level_changed",
            "level": room.current_level
        })
        
    async def broadcast_to_room(self, room_id: str, message: dict, exclude: str = None):
        room = self.rooms.get(room_id)
        if not room:
            return
            
        disconnected = []
        for player_id, player in room.players.items():
            if exclude and player_id == exclude:
                continue
            try:
                await player.websocket.send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                disconnected.append(player_id)
                
        # Clean up disconnected players
        for player_id in disconnected:
            room.remove_player(player_id)
            if player_id in self.players:
                del self.players[player_id]
    
    async def game_loop(self):
        """Send regular updates to all rooms"""
        while True:
            for room in self.rooms.values():
                if room.game_started and room.players:
                    await self.broadcast_to_room(room.id, {
                        "type": "game_update",
                        "players": room.get_player_data(),
                        "sync_data": room.sync_data
                    })
            await asyncio.sleep(1/60)  # 60 FPS
    
    async def handle_message(self, websocket, message: str):
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            # Get or create player
            player_id = data.get("player_id")
            if not player_id:
                player_id = str(uuid.uuid4())
                
            if player_id not in self.players:
                username = data.get("username", f"Player{len(self.players)+1}")
                self.players[player_id] = Player(websocket, player_id, username)
            
            player = self.players[player_id]
            
            if message_type == "create_room":
                await self.handle_create_room(websocket, player, data)
            elif message_type == "join_room":
                await self.handle_join_room(websocket, player, data)
            elif message_type == "start_game":
                await self.handle_start_game(websocket, player, data)
            elif message_type == "player_update":
                await self.handle_player_update(websocket, player, data)
            elif message_type == "sync_data":
                await self.handle_sync_data(websocket, player, data)
            elif message_type == "level_change":
                await self.handle_level_change(websocket, player, data)
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON: {message}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    async def handle_disconnect(self, websocket):
        # Find and remove disconnected player
        player_to_remove = None
        for player in self.players.values():
            if player.websocket == websocket:
                player_to_remove = player
                break
                
        if player_to_remove:
            room_id = player_to_remove.room_id
            if room_id and room_id in self.rooms:
                room = self.rooms[room_id]
                room.remove_player(player_to_remove.id)
                
                # Notify other players
                await self.broadcast_to_room(room_id, {
                    "type": "player_left",
                    "player_id": player_to_remove.id
                })
                
                # Remove empty rooms
                if not room.players:
                    del self.rooms[room_id]
                    
            del self.players[player_to_remove.id]

# Global server instance
server = GameServer()

async def handle_client(websocket):
    try:
        async for message in websocket:
            await server.handle_message(websocket, message)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        await server.handle_disconnect(websocket)

async def main():
    try:
        # Start game loop
        asyncio.create_task(server.game_loop())
        
        # Start WebSocket server
        start_server = websockets.serve(handle_client, "0.0.0.0", 8765)
        logger.info("Game server started on ws://localhost:8765")
        
        await start_server
        
        # Keep server running
        await asyncio.Future()  # Run forever
        
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped")
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        input("Press Enter to exit...")
