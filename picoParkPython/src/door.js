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
                playerBody = e.bounds;
            if (this.open) {
                // Cek player benar-benar di area door (full overlap)
                if (
                    rect.min.x < playerBody.min.x && rect.max.x > playerBody.max.x &&
                    rect.min.y < playerBody.min.y && (rect.max.y + 5) > playerBody.max.y
                ) {
                    // Syarat: player harus menekan tombol "down" (atau ganti sesuai kontrolmu)
                    let isPressing = e.player.keys[e.player.controls[3]]; // biasanya "down" atau "s"
                    e.player.atExit = !!isPressing; // TRUE jika menekan tombol, FALSE jika tidak

                } else {
                    // Jika tidak di area door, atExit = false
                    e.player.atExit = false;
                }

                // Cek apakah semua player sudah atExit
                let playerExitCount = 0;
                this.game.players.forEach(p => {
                    if (p.atExit) playerExitCount += 1;
                });
                if (playerExitCount >= this.playerCount && !window.clientConnection) {
                    // Semua player sudah masuk door, trigger next level!
                    e.player.game.renderer.levelTransistion(this.nextLevel);
                    if (window.hostConnection) {
                        hostConnection.broadcast(JSON.stringify({
                            setLevel: this.nextLevel,
                        }));
                    }
                }
            }
        };
    }
}
