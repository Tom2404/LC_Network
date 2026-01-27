#!/usr/bin/env python3
"""
Startup script for LC Network Application
Starts both backend and frontend servers in parallel
"""
import subprocess
import sys
import os
import time
from pathlib import Path

def main():
    print("=" * 50)
    print("Starting LC Network Application")
    print("=" * 50)
    print()
    
    # Get project root directory
    project_root = Path(__file__).parent.absolute()
    backend_dir = project_root / "backend"
    frontend_dir = project_root / "frontend"
    
    # Start backend server
    print("[1/2] Starting Backend Server...")
    backend_process = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=backend_dir,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
    )
    
    time.sleep(2)
    
    # Start frontend server
    print("[2/2] Starting Frontend Server...")
    frontend_process = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8080"],
        cwd=frontend_dir,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
    )
    
    time.sleep(3)
    
    print()
    print("=" * 50)
    print("Application Started Successfully!")
    print("=" * 50)
    print("Backend:  http://127.0.0.1:5000")
    print("Frontend: http://localhost:8080")
    print()
    print("Check the terminal windows for server logs.")
    print("Press Ctrl+C to stop all servers...")
    print()
    
    # Monitor processes
    try:
        while True:
            # Check if processes are still running
            backend_status = backend_process.poll()
            frontend_status = frontend_process.poll()
            
            if backend_status is not None:
                print(f"\n[ERROR] Backend server stopped unexpectedly! (Exit code: {backend_status})")
                print("Please check backend terminal for errors.")
                break
            if frontend_status is not None:
                print(f"\n[ERROR] Frontend server stopped unexpectedly! (Exit code: {frontend_status})")
                break
            
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\nStopping servers...")
        backend_process.terminate()
        frontend_process.terminate()
        
        # Wait for processes to finish
        backend_process.wait(timeout=5)
        frontend_process.wait(timeout=5)
        
        print("Servers stopped successfully.")
        sys.exit(0)

if __name__ == "__main__":
    main()
