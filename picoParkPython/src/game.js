class Game {
    constructor(options) {
        options = {
            ...options,
        }

        this.mobile = []
        this.players = []
        this.constraints = []
        this.playersBinded = false
        this.buttons = []
        this.doors = []
        this.blocks = []
        this.lasers = []
        this.jumppads = []

        this.triggers = []
        this.entities = []

        this.matter = new MatterHandler(this)
        this.triggerHandler = new TriggerHandler(this)
        this.playerhandler = new PlayerHandler(this)
        this.blockHandler = new BlockHandler(this)
        this.laserHandler = new LaserHandler(this)
        this.jumppadHandler = new JumppadHandler(this)

        this.levelHandler = new LevelHandler(this)
        this.renderer = new Renderer(this)
        this.constraintHandler = new ConstraintHandler(this)

        this.entityHandler = new EntityHandler(this)
        this.particleHandler = new ParticleHandler(this)

        this.syncHandler = new SyncHandler(this)

        this.updateMobiles = function(self){
            self.updateDelta()
            
            self.playerhandler.updateControls()
            self.blockHandler.updateBlocks()
            self.laserHandler.updateLasers()
            self.jumppadHandler.updateJumppads()

            self.playerhandler.updatePlayers()
            self.constraintHandler.updateConstraints()
            self.triggerHandler.updateTriggers()
            
            self.updateEntities()
        }
        
        this.afterUpdateMobiles = function(self) {
            for (let i = 0; i < self.players.length; i++) {
                const player = self.players[i];
                if (player.unloading) {
                    self.players.splice(i, 1)
                } else {
                    player.updatePlayerParts()
                }
            }
        }

        this.currentColor = randInt(0,7)
        this.lastDelta = 0
        this.deltaTime = 0
    }
    
    updateDelta() {
        this.deltaTime = Math.min(((new Date()).getTime()-this.lastDelta)/(1000/60), 10)
        this.lastDelta = (new Date()).getTime()
    }

    async initRender() {
        this.renderer.init()
        await this.renderer.wait(700)
        await this.renderer.showTitle(`-- ${this.runTemp?"untitled level":"one"} --`, 500)
        await this.renderer.setFade(0, 1000)
    }
    
    initPhysics() {
        this.matter.init()
        Matter.Events.on(this.matter.engine, "beforeUpdate", ()=>{this.updateMobiles(this)})
        Matter.Events.on(this.matter.engine, "afterUpdate", ()=>{this.afterUpdateMobiles(this)})
    }

    fetchColor() {
        var colors = Object.keys(colorMods)
        this.currentColor += 1
        return colors[this.currentColor % colors.length]
    }
    
    updateEntities() {
        for (let i = 0; i < this.entities.length; i++) {
            const ent = this.entities[i];
            ent.update()
            if (ent.unload) this.entities.splice(i, 1)
        }
    }

    testInit() {
        this.initPhysics()
        
        // Setup sync controls for multiplayer
        this.setupSyncControls()
        
        if (this.runTemp) {
            this.levelHandler.loadLevel(levels.tempLevel, "tempLevel")
        } else {
            this.levelHandler.setLevel("one")
        }

        this.running = true
    }
    
    setupSyncControls() {
        // Keys/entities sync
        this.syncHandler.addControl("keys", ()=>{
            let entities = []
            for (let entity of this.entities) {
                entities.push({
                    pos: entity.pos,
                    vel: entity.vel,
                    id: entity.id,
                })
            }
            return entities
        }, (data)=>{
            let foundEntity = this.entities.find(e => e.id === data.id)
            if (foundEntity) {
                foundEntity.pos = data.pos
                foundEntity.vel = data.vel
            } else {
                // Create new entity (Key)
                let newKey = new Key(this, v(data.pos.x, data.pos.y), {})
                newKey.id = data.id
                this.entities.push(newKey)
            }
        })

        // Doors sync
        this.syncHandler.addControl("doors", ()=>{
            let doors = []
            for (let door of this.doors) {
                doors.push({
                    open: door.open,
                    pos: door.pos,
                    id: door.id,
                })
            }
            return doors
        }, (data)=>{
            let foundDoor = this.doors.find(d => d.id === data.id)
            if (foundDoor) {
                foundDoor.open = data.open
            }
        })

        // Blocks sync
        this.syncHandler.addControl("blocks", ()=>{
            let blocks = []
            for (let block of this.blocks) {
                blocks.push({
                    pos: block.rect.position,
                    gridPos: block.pos,
                    size: block.size,
                    id: block.id,
                    options: block.options,
                })
            }
            return blocks
        }, (data)=>{
            let foundBlock = this.blocks.find(b => b.id === data.id)
            if (foundBlock) {
                Matter.Body.setPosition(foundBlock.rect, data.pos)
            }
        })
    }

    bindPlayers(players) {
        let sortedPlayers = players.sort((a,b)=>{
            return Math.sign((a.color).hashCode()-(b.color).hashCode())
        })
        
        for (let i = 0; i < sortedPlayers.length; i++) {
            let bodyB = sortedPlayers[(i+1) % sortedPlayers.length]
            this.constraintHandler.addConstraint({
                bodyA: sortedPlayers[i],
                bodyB: bodyB,
            })
            this.constraintHandler.addConstraint({
                bodyB: sortedPlayers[i],
                bodyA: bodyB,
            })
        }
        this.playersBinded = true
    }
}