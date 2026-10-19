/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { ipcRenderer, shell } = require('electron');
const pkg = require('../package.json');
const os = require('os');
import { config, database, setBackground } from './utils.js';
const nodeFetch = require("node-fetch");


class Splash {
    constructor() {
        this.updateDecisionMade = false;
        this.maintenanceStarted = false;
        this.splash = document.querySelector(".splash");
        this.splashMessage = document.querySelector(".splash-message");
        this.splashAuthor = document.querySelector(".splash-author");
        this.message = document.querySelector(".message");
        this.progress = document.querySelector(".progress");
        document.addEventListener('DOMContentLoaded', async () => {
            let databaseLauncher = new database();
            let configClient = await databaseLauncher.readData('configClient');
            let theme = configClient?.launcher_config?.theme || "auto"
            let isDarkTheme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res)
            await setBackground(isDarkTheme);
            document.querySelector('.splash-version').textContent = `v${pkg.version}`;
            if (process.platform == 'win32') ipcRenderer.send('update-window-progress-load')
            this.startAnimation()
        });
    }

    async startAnimation() {
        let splashes = [
            { "message": "MUHEHEHEHEE", "author": "atmoz" },
            { "message": "Le serv c'est une masterclass", "author": "atmoz" },
            { "message": "je suis sdf", "author": "atmoz" }
        ];
        let splash = splashes[Math.floor(Math.random() * splashes.length)];
        this.splashMessage.textContent = splash.message;
        this.splashAuthor.children[0].textContent = "@" + splash.author;
        await sleep(100);
        document.querySelector("#splash").style.display = "block";
        await sleep(500);
        this.splash.classList.add("opacity");
        await sleep(500);
        this.splash.classList.add("translate");
        this.splashMessage.classList.add("opacity");
        this.splashAuthor.classList.add("opacity");
        this.message.classList.add("opacity");
        await sleep(1000);
        this.checkUpdate();
    }

    async checkUpdate() {
        this.setStatus(`Recherche de mise à jour...`);

        ipcRenderer.on('updateAvailable', () => {
            if (this.updateDecisionMade) return;
            this.updateDecisionMade = true;
            this.setStatus(`Mise à jour disponible !`);
            if (os.platform() == 'win32') {
                this.toggleProgress();
                ipcRenderer.send('start-update');
            }
            else return this.dowloadUpdate();
        })

        ipcRenderer.on('error', (event, err) => {
            this.continueWithoutUpdate(err?.message);
        })

        ipcRenderer.on('download-progress', (event, progress) => {
            ipcRenderer.send('update-window-progress', { progress: progress.transferred, size: progress.total })
            this.setProgress(progress.transferred, progress.total);
        })

        ipcRenderer.on('update-not-available', () => {
            if (this.updateDecisionMade) return;
            this.updateDecisionMade = true;
            console.error("Mise à jour non disponible");
            this.maintenanceCheck();
        })

        try {
            const result = await ipcRenderer.invoke('update-app');
            if (result?.ok === false) this.continueWithoutUpdate(result.message);
        } catch (error) {
            this.continueWithoutUpdate(error?.message || String(error));
        }
    }

    getLatestReleaseForOS(os, preferredFormat, asset) {
        return asset.filter(asset => {
            const name = asset.name.toLowerCase();
            const isOSMatch = name.includes(os);
            const isFormatMatch = name.endsWith(preferredFormat);
            return isOSMatch && isFormatMatch;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    }

    async dowloadUpdate() {
        try {
            const [owner, repo] = pkg.repository.url
                .replace("git+", "")
                .replace(".git", "")
                .replace("https://github.com/", "")
                .split("/");
            const response = await nodeFetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
            if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);

            const release = await response.json();
            let latest;

            if (os.platform() == 'darwin') latest = this.getLatestReleaseForOS('mac', '.dmg', release.assets || []);
            else if (os.platform() == 'linux') latest = this.getLatestReleaseForOS('linux', '.appimage', release.assets || []);

            if (!latest?.browser_download_url) throw new Error('Aucun installateur compatible dans la dernière release.');

            this.setStatus(`Mise à jour disponible !<br><div class="download-update">Télécharger</div>`);
            document.querySelector(".download-update").addEventListener("click", () => {
                shell.openExternal(latest.browser_download_url);
                return this.shutdown("Téléchargement en cours...");
            });
        } catch (error) {
            this.continueWithoutUpdate(error?.message || String(error));
        }
    }


    continueWithoutUpdate(error) {
        if (this.maintenanceStarted) return;
        this.updateDecisionMade = true;
        console.warn('[Updater] Démarrage sans mise à jour :', error || 'raison inconnue');
        this.setStatus(`Mise à jour indisponible.<br>Démarrage du launcher...`);
        setTimeout(() => this.maintenanceCheck(), 600);
    }


    async maintenanceCheck() {
        if (this.maintenanceStarted) return;
        this.maintenanceStarted = true;
        config.GetConfig().then(res => {
            if (res.maintenance) return this.shutdown(res.maintenance_message);
            this.startLauncher();
        }).catch(e => {
            console.error(e);
            return this.shutdown("Aucune connexion internet détectée,<br>veuillez réessayer ultérieurement.");
        })
    }

    startLauncher() {
        this.setStatus(`Démarrage du launcher`);
        ipcRenderer.send('main-window-open');
        ipcRenderer.send('update-window-close');
    }

    shutdown(text) {
        this.setStatus(`${text}<br>Arrêt dans 5s`);
        let i = 4;
        setInterval(() => {
            this.setStatus(`${text}<br>Arrêt dans ${i--}s`);
            if (i < 0) ipcRenderer.send('update-window-close');
        }, 1000);
    }

    setStatus(text) {
        this.message.innerHTML = text;
    }

    toggleProgress() {
        if (this.progress.classList.toggle("show")) this.setProgress(0, 1);
    }

    setProgress(value, max) {
        this.progress.value = value;
        this.progress.max = max;
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.keyCode == 73 || e.keyCode == 123) {
        ipcRenderer.send("update-window-dev-tools");
    }
})
new Splash();
