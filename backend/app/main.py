from fastapi import FastAPI

app = FastAPI(title="Utah Forage Map API")


@app.get("/health")
def health():
    return {"status": "ok", "project": "utah-forage-map"}
