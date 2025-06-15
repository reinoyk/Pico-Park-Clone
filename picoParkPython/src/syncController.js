class SyncHandler {
    constructor(game, options) {
        this.game = game
        this.options = {
            ...options,
        }
        this.syncs = {}
    }
    
    addControl(label, getData, returnData) {
        this.syncs[label] = {
            label: label,
            getData: getData,
            returnData: returnData,
        }
    }
    
    getSyncData() {
        let retdata = {}
        for (let syncKey of Object.keys(this.syncs)) {
            const sync = this.syncs[syncKey]
            retdata[sync.label] = sync.getData()
        }
        return retdata
    }
    
    processSyncData(syncData) {
        if (!syncData) return
        
        for (let label of Object.keys(syncData)) {
            const dataArray = syncData[label]
            if (!Array.isArray(dataArray)) continue
            
            const sync = this.syncs[label]
            if (!sync) {
                console.warn(`No sync handler for: ${label}`)
                continue
            }
            
            for (let individualData of dataArray) {
                sync.returnData(individualData)
            }
        }
    }
}