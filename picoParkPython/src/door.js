class Door {
    constructor(pos, options) {
        this.game = undefined;
        options = {
            open: false,
            ...options,
        };
        this.options = options;
        this.pos = pos;

        this.id = Math.floor(Math.random() * 100000);

        this.nextLevel = options.nextLevel;
        this.open = options.open;
        this.playerCount = options.playerCount;

        // Fungsi onIn akan dijalankan saat player dalam trigger area door
        this.onIn = (e) => {
            let rect = this.trigger.rect.bounds,
                playerBody = e.bounds

            // Cek apakah player sudah benar-benar ada di area pintu
            let inArea = (
                rect.min.x < playerBody.min.x && rect.max.x > playerBody.max.x &&
                rect.min.y < playerBody.min.y && (rect.max.y + 5) > playerBody.max.y
            );

            // Deteksi input ArrowDown (atau tombol “masuk” lain)
            let isPressing = e.player.keys[e.player.controls[3]];

            // Jika player BELUM PERNAH masuk door, dan sekarang benar2 masuk area dan tekan DOWN
            if (!e.player.enteredDoor && inArea && isPressing) {
                e.player.enteredDoor = true; // PERMANEN
                e.player.readyUp(this.trigger.rect.position);
            }
            
            // Hitung jumlah player yang sudah PERNAH masuk door
            let playerExitCount = 0;
            this.game.players.forEach(p => {
                if (p.enteredDoor) playerExitCount += 1;
            });

            console.log("playerExitCount:", playerExitCount, "playerCount:", this.playerCount);

            // Jika semua player sudah masuk pintu, next level!
            if (playerExitCount >= this.playerCount && !window.clientConnection) {
                e.player.game.renderer.levelTransistion(this.nextLevel)
                if (window.hostConnection) {
                    hostConnection.broadcast(JSON.stringify({
                        setLevel: this.nextLevel,
                    }))
                }
            }
        }
    }
}
