/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { app, ipcMain, nativeTheme } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater')

// RPC
const RPC = require('discord-rpc');
const rpc = new RPC.Client({ transport: "ipc" });

rpc.on("ready", () => {
  rpc.setActivity({
    details: "Joue à minecraft",
    state: "Le meilleur launcher minecraft",
    startTimestamp: new Date(),
    largeImageKey: 'https://i.pinimg.com/originals/f4/52/66/f452667440b61bee8c8ee412c5b61906.gif',
    largeImageText: 'Le meilleur launcher minecraft',
    smallImageKey: 'https://static-00.iconduck.com/assets.00/minecraft-icon-2048x2048-3ifq7gy7.png',
    smallImageText: 'Survie privé'
  });
  console.log("La RichPresence est allumée");
});

rpc.login({ clientId: "557912813360644096" });

const path = require('path');
const fs = require('fs');

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

const dev = process.env.NODE_ENV === 'dev';

// ——————————————————————————————
// Identité d’app + userData stable
// ——————————————————————————————
app.setName('Launcher Melancolique'); // doit matcher package.json productName
app.setAppUserModelId('fr.docovg.launcher.melancolique');

if (dev) {
  // En dev: on garde ton comportement existant (dossier ./data)
  const appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
  const appdata = path.resolve('./data').replace(/\\/g, '/');
  if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
  if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
  app.setPath('userData', appPath);
  app.setPath('appData', appdata);
} else {
  // En prod: on force un chemin userData stable basé sur productName
  const appData = app.getPath('appData');
  const fixedUserData = path.join(appData, 'Launcher Melancolique');
  if (!fs.existsSync(fixedUserData)) fs.mkdirSync(fixedUserData, { recursive: true });
  app.setPath('userData', fixedUserData);
}

// Logs de contrôle
console.log('[Boot] isPackaged =', app.isPackaged);
console.log('[Boot] NODE_ENV   =', process.env.NODE_ENV || 'prod');
console.log('[Boot] appData    =', app.getPath('appData'));
console.log('[Boot] userData   =', app.getPath('userData'));

// ——————————————————————————————
// Migration auto (si anciens dossiers existent)
// ——————————————————————————————
function migrateOldUserDataIfNeeded() {
  try {
    const newDir = app.getPath('userData');
    const flag = path.join(newDir, 'migrated.flag');
    if (fs.existsSync(flag)) return;

    // Candidats d’anciens emplacements (adapte si besoin)
    const candidates = dev
      ? [] // en dev tu écris déjà dans ./data
      : [
          path.join(app.getPath('appData'), 'Launcher-Melancolique'),
          path.join(app.getPath('appData'), 'Selvania Launcher'),
          path.join(app.getPath('appData'), 'Electron')
        ];

    let migratedSomething = false;
    for (const oldDir of candidates) {
      if (!fs.existsSync(oldDir)) continue;
      for (const file of ['accounts.json', 'settings.json']) {
        const src = path.join(oldDir, file);
        const dst = path.join(newDir, file);
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
          try {
            fs.copyFileSync(src, dst);
            console.log('[Migrate] Copied', file, 'from', oldDir);
            migratedSomething = true;
          } catch (e) {
            console.warn('[Migrate] copy error for', file, 'from', oldDir, e);
          }
        }
      }
    }
    if (migratedSomething) fs.writeFileSync(flag, 'ok');
  } catch (e) {
    console.warn('[Migrate] skipped:', e);
  }
}

// ——————————————————————————————
// Cycle de vie & fenêtres
// ——————————————————————————————
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    migrateOldUserDataIfNeeded();
    if (dev) return MainWindow.createWindow();
    UpdateWindow.createWindow();
  });

  ipcMain.on('main-window-open', () => MainWindow.createWindow());
  ipcMain.on('main-window-dev-tools', () => MainWindow.getWindow().webContents.openDevTools({ mode: 'detach' }));
  ipcMain.on('main-window-dev-tools-close', () => MainWindow.getWindow().webContents.closeDevTools());
  ipcMain.on('main-window-close', () => MainWindow.destroyWindow());
  ipcMain.on('main-window-reload', () => MainWindow.getWindow().reload());
  ipcMain.on('main-window-progress', (event, options) => MainWindow.getWindow().setProgressBar(options.progress / options.size));
  ipcMain.on('main-window-progress-reset', () => MainWindow.getWindow().setProgressBar(-1));
  ipcMain.on('main-window-progress-load', () => MainWindow.getWindow().setProgressBar(2));
  ipcMain.on('main-window-minimize', () => MainWindow.getWindow().minimize());

  ipcMain.on('update-window-close', () => UpdateWindow.destroyWindow());
  ipcMain.on('update-window-dev-tools', () => UpdateWindow.getWindow().webContents.openDevTools({ mode: 'detach' }));
  ipcMain.on('update-window-progress', (event, options) => UpdateWindow.getWindow().setProgressBar(options.progress / options.size));
  ipcMain.on('update-window-progress-reset', () => UpdateWindow.getWindow().setProgressBar(-1));
  ipcMain.on('update-window-progress-load', () => UpdateWindow.getWindow().setProgressBar(2));

  ipcMain.handle('path-user-data', () => app.getPath('userData'));
  ipcMain.handle('appData', () => app.getPath('appData'));

  ipcMain.on('main-window-maximize', () => {
    if (MainWindow.getWindow().isMaximized()) MainWindow.getWindow().unmaximize();
    else MainWindow.getWindow().maximize();
  });

  ipcMain.on('main-window-hide', () => MainWindow.getWindow().hide());
  ipcMain.on('main-window-show', () => MainWindow.getWindow().show());

  ipcMain.handle('Microsoft-window', async (_, client_id) => {
    return await new Microsoft(client_id).getAuth();
  });

  ipcMain.handle('is-dark-theme', (_, theme) => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return nativeTheme.shouldUseDarkColors;
  });

  app.on('window-all-closed', () => app.quit());
}

// ——————————————————————————————
// AutoUpdater (inchangé)
// ——————————————————————————————
autoUpdater.autoDownload = false;

ipcMain.handle('update-app', async () => {
  return await new Promise(async (resolve, reject) => {
    autoUpdater.checkForUpdates().then(res => resolve(res)).catch(error => {
      reject({ error: true, message: error });
    });
  });
});

autoUpdater.on('update-available', () => {
  const updateWindow = UpdateWindow.getWindow();
  if (updateWindow) updateWindow.webContents.send('updateAvailable');
});

ipcMain.on('start-update', () => {
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', () => {
  const updateWindow = UpdateWindow.getWindow();
  if (updateWindow) updateWindow.webContents.send('update-not-available');
});

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall();
});

autoUpdater.on('download-progress', (progress) => {
  const updateWindow = UpdateWindow.getWindow();
  if (updateWindow) updateWindow.webContents.send('download-progress', progress);
});

autoUpdater.on('error', (err) => {
  const updateWindow = UpdateWindow.getWindow();
  if (updateWindow) updateWindow.webContents.send('error', err);
});
