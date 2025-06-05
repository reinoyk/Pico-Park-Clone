import os
import threading
import asyncio
import http.server
import socketserver

import webview
import server  # pastikan server.py punya fungsi main()

def run_server():
    """Run the async WebSocket server in a thread"""
    try:
        asyncio.run(server.main())
    except Exception as e:
        print(f"WebSocket server error: {e}")

def run_web_server():
    """Run HTTP server for serving game files"""
    try:
        # Change to the directory where the script is located (current structure)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(script_dir)
        
        print(f"📁 Serving files from: {script_dir}")
        print(f"📄 Current working directory: {os.getcwd()}")
        
        # List some files to debug
        files = [f for f in os.listdir('.') if f.endswith('.html')]
        print(f"🗂️ HTML files found: {files}")
        
        # Check if src folder exists
        if os.path.exists('src'):
            src_files = [f for f in os.listdir('src') if f.endswith('.js')][:5]  # Show first 5 JS files
            print(f"📜 JS files in src/: {src_files}")
        
        Handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer(("", 3000), Handler) as httpd:
            print("🌐 Web server running on http://localhost:3000")
            print("🎮 Access game at: http://localhost:3000/index.html")
            httpd.serve_forever()
    except Exception as e:
        print(f"Web server error: {e}")
        import traceback
        traceback.print_exc()

def main():
    here = os.path.dirname(__file__)
    
    # 1) Start WebSocket server in background
    websocket_thread = threading.Thread(target=run_server, daemon=True)
    websocket_thread.start()
    
    # 2) Start HTTP server in background  
    web_thread = threading.Thread(target=run_web_server, daemon=True)
    web_thread.start()

    # Give the servers a moment to start
    import time
    time.sleep(2)

    # 3) Open webview to the HTTP server
    webview.create_window(
        'Pico Park Clone',
        'http://localhost:3000/index.html',
        width=1024,
        height=768,
        resizable=True
    )
    webview.start()

if __name__ == '__main__':
    main()