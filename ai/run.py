import uvicorn
import os
import sys

# Ensure current directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting Urban Heat AI Service on http://{host}:{port}")
    print(f"Interactive API documentation available at http://localhost:{port}/docs")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
