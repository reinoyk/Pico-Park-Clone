import os
import threading

import webview
import server  # pastikan server.py punya fungsi main()

def main():
    here = os.path.dirname(__file__)
    # 1) Arahkan ke static/index.html
    index = os.path.join(here, 'www', 'index.html')

    # 2) Spawn WebSocket server di background
    threading.Thread(target=server.main, daemon=True).start()

    # 3) Buka jendela webview ke file index.html
    webview.create_window(
        'Pico Park Clone',
        f'file://{index}',
        width=1024,
        height=768,
        resizable=True
    )
    webview.start()

if __name__ == '__main__':
    main()
