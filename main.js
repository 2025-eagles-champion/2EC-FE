const { app, BrowserWindow } = require('electron');
const path = require('path');

// 힙 메모리 확장 (app.whenReady() 전에 해야 함)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // 있으면 쓰고 없으면 삭제
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
