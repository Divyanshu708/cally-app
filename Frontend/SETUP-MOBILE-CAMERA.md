# Mobile Camera Setup (HTTPS)

For the camera to work on mobile, the app must run over HTTPS. Follow these steps:

## 1. Install mkcert (one-time)

**Windows (PowerShell as Admin):**
```powershell
winget install mkcert
# or: choco install mkcert
```

**Mac:**
```bash
brew install mkcert
```

## 2. Install the local CA (one-time)

```bash
mkcert -install
```

## 3. Install dependencies & run

```bash
cd Frontend
npm install
npm run dev
```

## 4. On your mobile device

1. Open **https://10.13.118.161:5173** (use `https`, not `http`)
2. If you see a certificate warning: the first time, you may need to install the mkcert root CA on your phone:
   - **Android:** Copy `rootCA.pem` from your PC (see path below) to your phone, then Settings → Security → Install from storage
   - **iOS:** AirDrop or email the `rootCA.pem` to yourself, open it, install the profile in Settings

**mkcert root CA location:**
- Windows: `%LOCALAPPDATA%\mkcert\rootCA.pem`
- Mac: `$(mkcert -CAROOT)/rootCA.pem`

## 5. Allow camera when prompted

When you join a room, the browser will ask for camera/mic permission. Tap **Allow**.

---

**Troubleshooting:** If you still get SSL errors, try using **Chrome** on your mobile (it often has better mkcert support).
