# Cally Video – Troubleshooting

## Mobile and PC can't see each other's video

### 1. Same network
- Mobile and PC must be on the **same Wi‑Fi**.
- Mobile on cellular will not work for local dev.

### 2. Backend `.env`
Add to `Backend/.env`:
```
MEDIASOUP_ANNOUNCED_IP=10.13.118.161
```
Replace with your PC’s IP (run `ipconfig` on Windows, `ifconfig` on Mac/Linux).

### 3. Mobile URL
On mobile, open:
```
https://<YOUR_PC_IP>:5173
```
Example: `https://10.13.118.161:5173`

### 4. mkcert hosts
In `Frontend/vite.config.js`, add your PC’s IP to mkcert:
```js
mkcert({ hosts: ["localhost", "127.0.0.1", "10.13.118.161"] })
```

### 5. Firewall
Allow Node.js through Windows Firewall, or allow ports:
- **8000** (backend)
- **10000–59999** (WebRTC media)

### 6. Start order
1. Start backend: `cd Backend && npm start`
2. Start frontend: `cd Frontend && npm run dev`

### 7. Dev panel
In dev mode, the video area shows:
- **Socket: ✓** – connected
- **Media: ✓** – camera/mic ready
- **Remote: 0** – no remote streams yet

If Socket or Media is ✗, fix that first. If Remote stays 0, check steps 1–5.
