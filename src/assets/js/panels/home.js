/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')
const path = require('path')

class Home {
    static id = "home";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.news()
        this.socialLick()
        this.instancesSelect()
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'))
        document.querySelector('.player-options').addEventListener('click', e => changePanel('settings'))
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        let news = await config.getNews().then(res => res).catch(err => false);
        if (news) {
            if (!news.length) {
                newsElement.appendChild(this.newsBlock({
                    title: 'Aucune news pour le moment',
                    content: 'Vous pourrez suivre ici toutes les news relatives au serveur.'
                }));
            } else {
                for (let News of news) {
                    let date = this.getdate(News.publish_date)
                    newsElement.appendChild(this.newsBlock({
                        title: News.title,
                        content: News.content.replace(/\n/g, '</br>'),
                        author: News.author,
                        date: `${date.day} ${date.month} ${date.year}`
                    }));
                }
            }
        } else {
            newsElement.appendChild(this.newsBlock({
                title: 'Erreur',
                content: 'Impossible de contacter le serveur des news.'
            }));
        }
    }

    newsBlock({ title, content, author, date }) {
        let blockNews = document.createElement('div');
        blockNews.classList.add('news-block');
        blockNews.innerHTML = `
            <div class="news-meta">
                <span class="news-date">${date || 'DevLog'}</span>
                ${author ? `<span class="news-author">par <span>${author}</span></span>` : ''}
            </div>
            <div class="news-title">${title}</div>
            <div class="news-content">
                <p>${content}</p>
            </div>`
        return blockNews;
    }

    setInstanceName(name) {
        document.querySelector('.play-instance-name').textContent = name || '';
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block')

        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.target.dataset.url)
            })
        });
    }

    async instancesSelect() {
        this.instanceUI = {
            list: document.querySelector('.instance-library-list'),
            count: document.querySelector('.instance-library-count'),
            detail: document.querySelector('.instance-detail'),
            createPopup: document.querySelector('.instance-create-popup'),
            createForm: document.querySelector('.instance-create-dialog'),
            nameInput: document.querySelector('.instance-name-input'),
            versionInput: document.querySelector('.instance-version-input'),
            loaderInput: document.querySelector('.instance-loader-input'),
            loaderVersionInput: document.querySelector('.instance-loader-version-input'),
            formError: document.querySelector('.instance-form-error'),
            deletePopup: document.querySelector('.instance-delete-popup'),
            deleteCopy: document.querySelector('.instance-delete-copy')
        }

        this.bindInstanceManagerEvents()
        await this.refreshInstances()
    }

    bindInstanceManagerEvents() {
        const ui = this.instanceUI

        document.querySelector('.instance-create-btn').addEventListener('click', () => this.openCreateInstance())
        document.querySelector('.instance-dialog-close').addEventListener('click', () => this.closeCreateInstance())
        document.querySelector('.instance-dialog-cancel').addEventListener('click', () => this.closeCreateInstance())
        document.querySelector('.instance-delete-cancel').addEventListener('click', () => this.closeDeleteInstance())

        ui.loaderInput.addEventListener('change', () => {
            const enabled = ui.loaderInput.value !== 'none'
            ui.loaderVersionInput.disabled = !enabled
            if (enabled && !ui.loaderVersionInput.value) ui.loaderVersionInput.value = 'latest'
        })

        ui.createForm.addEventListener('submit', async event => {
            event.preventDefault()
            await this.createLocalInstance()
        })

        ui.list.addEventListener('click', async event => {
            const button = event.target.closest('.instance-list-item')
            if (button) await this.selectInstance(button.dataset.instance)
        })

        document.querySelector('.instance-delete-btn').addEventListener('click', () => this.openDeleteInstance())
        document.querySelector('.instance-delete-confirm').addEventListener('click', async () => this.deleteLocalInstance())
        document.querySelector('.play-instance').addEventListener('click', () => this.startGame())

        ui.createPopup.addEventListener('click', event => {
            if (event.target === ui.createPopup) this.closeCreateInstance()
        })
        ui.deletePopup.addEventListener('click', event => {
            if (event.target === ui.deletePopup) this.closeDeleteInstance()
        })

        document.addEventListener('keydown', event => {
            const openDialog = ui.createPopup.classList.contains('is-open')
                ? ui.createForm
                : ui.deletePopup.classList.contains('is-open')
                    ? ui.deletePopup.querySelector('.instance-delete-dialog')
                    : null

            if (event.key === 'Tab' && openDialog) this.trapDialogFocus(event, openDialog)
            if (event.key === 'Escape' && ui.createPopup.classList.contains('is-open')) this.closeCreateInstance()
            if (event.key === 'Escape' && ui.deletePopup.classList.contains('is-open')) this.closeDeleteInstance()
        })
    }

    async refreshInstances(preferredInstance = null) {
        const configClient = await this.db.readData('configClient')
        const auth = configClient?.account_selected
            ? await this.db.readData('accounts', configClient.account_selected)
            : null
        const [remoteInstances, localInstances] = await Promise.all([
            config.getInstanceList(),
            this.db.readAllData('localInstances')
        ])

        const accessibleRemoteInstances = remoteInstances.filter(instance => {
            if (!instance.whitelistActive) return true
            return Array.isArray(instance.whitelist) && instance.whitelist.includes(auth?.name)
        })

        this.instances = [
            ...accessibleRemoteInstances,
            ...localInstances.map(instance => ({
                ...instance,
                source: 'local',
                displayName: instance.displayName || instance.name
            }))
        ]

        const selectedName = preferredInstance || configClient?.instance_selct
        const selected = this.instances.find(instance => instance.name === selectedName) || this.instances[0] || null

        if (configClient && configClient.instance_selct !== (selected?.name || null)) {
            configClient.instance_selct = selected?.name || null
            await this.db.updateData('configClient', configClient)
        }

        this.selectedInstance = selected
        this.renderInstanceList()
        await this.renderSelectedInstance()
    }

    renderInstanceList() {
        const list = this.instanceUI.list
        list.replaceChildren()

        if (!this.instances.length) {
            const empty = document.createElement('p')
            empty.className = 'instance-list-empty'
            empty.textContent = 'Aucune instance disponible. Utilise le bouton + pour en créer une.'
            list.appendChild(empty)
        }

        for (const instance of this.instances) {
            const entry = document.createElement('div')
            entry.className = 'instance-list-entry'
            entry.setAttribute('role', 'listitem')

            const button = document.createElement('button')
            button.type = 'button'
            button.className = `instance-list-item${instance.source === 'local' ? ' is-local' : ''}${instance.name === this.selectedInstance?.name ? ' is-active' : ''}`
            button.dataset.instance = instance.name
            button.title = instance.displayName || instance.name
            button.setAttribute('aria-current', instance.name === this.selectedInstance?.name ? 'true' : 'false')

            const icon = document.createElement('span')
            icon.className = 'instance-list-icon'
            icon.setAttribute('aria-hidden', 'true')
            icon.textContent = this.getInstanceInitials(instance.displayName || instance.name)

            const copy = document.createElement('span')
            copy.className = 'instance-list-copy'

            const name = document.createElement('strong')
            name.className = 'instance-list-name'
            name.textContent = instance.displayName || instance.name

            const meta = document.createElement('span')
            meta.className = 'instance-list-meta'
            meta.textContent = `${instance.loadder?.minecraft_version || 'Version inconnue'} · ${this.formatLoader(instance.loadder?.loadder_type)}`

            copy.append(name, meta)
            button.append(icon, copy)
            entry.appendChild(button)
            list.appendChild(entry)
        }

        const count = this.instances.length
        this.instanceUI.count.textContent = `${count} instance${count > 1 ? 's' : ''}`
    }

    async selectInstance(instanceName) {
        const instance = this.instances.find(item => item.name === instanceName)
        if (!instance) return

        this.selectedInstance = instance
        const configClient = await this.db.readData('configClient')
        configClient.instance_selct = instance.name
        await this.db.updateData('configClient', configClient)

        this.renderInstanceList()
        await this.renderSelectedInstance()
    }

    async renderSelectedInstance() {
        const instance = this.selectedInstance
        const detail = this.instanceUI.detail
        const playButton = document.querySelector('.play-instance')
        const playAction = document.querySelector('.play-btn')

        detail.classList.toggle('has-instance', Boolean(instance))
        detail.classList.toggle('is-local', instance?.source === 'local')
        playButton.classList.toggle('is-disabled', !instance)
        playButton.setAttribute('aria-disabled', instance ? 'false' : 'true')
        playAction.disabled = !instance

        if (!instance) {
            this.setInstanceName('')
            this.updateLocalStatus(null)
            return
        }

        const displayName = instance.displayName || instance.name
        const loaderType = this.formatLoader(instance.loadder?.loadder_type)
        const isLocal = instance.source === 'local'

        detail.querySelector('.instance-detail-name').textContent = displayName
        detail.querySelector('.instance-detail-name').title = displayName
        detail.querySelector('.instance-detail-description').textContent = isLocal
            ? 'Configuration privée enregistrée sur cet ordinateur.'
            : 'Instance officielle synchronisée avec le serveur du launcher.'
        detail.querySelector('.instance-minecraft-version').textContent = instance.loadder?.minecraft_version || 'Inconnue'
        detail.querySelector('.instance-loader-type').textContent = loaderType
        detail.querySelector('.instance-loader-version').textContent = instance.loadder?.loadder_type === 'none'
            ? 'Non applicable'
            : instance.loadder?.loadder_version || 'latest'
        detail.querySelector('.instance-sync-mode').textContent = isLocal
            ? 'Locale uniquement'
            : instance.verify ? 'Vérifiée au lancement' : 'Standard'

        const badge = detail.querySelector('.instance-source-badge')
        badge.textContent = isLocal ? 'Locale' : 'Officielle'
        badge.classList.toggle('is-local', isLocal)

        const root = await appdata()
        const dataDirectory = process.platform === 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`
        detail.querySelector('.instance-directory-value').textContent = path.join(
            root,
            dataDirectory,
            'instances',
            instance.instanceDirectory || instance.name
        )

        this.setInstanceName(displayName)
        await this.updateInstanceStatus(instance)
    }

    async updateInstanceStatus(instance) {
        const requestId = (this.statusRequestId || 0) + 1
        this.statusRequestId = requestId

        if (!instance?.status) {
            this.updateLocalStatus(instance)
            return
        }

        document.querySelector('.player-count-label').textContent = 'joueurs'
        await setStatus(instance.status)

        if (requestId !== this.statusRequestId && this.selectedInstance) {
            await this.updateInstanceStatus(this.selectedInstance)
        }
    }

    updateLocalStatus(instance) {
        const statusText = document.querySelector('.server-status-text')
        document.querySelector('.server-status-name').textContent = instance?.displayName || instance?.name || 'Minecraft'
        document.querySelector('.player-count').textContent = '—'
        document.querySelector('.player-count-label').textContent = 'local'
        document.querySelector('.status-player-count').classList.remove('red')
        statusText.classList.remove('red')
        statusText.textContent = instance ? 'Instance locale' : 'Aucune instance'
    }

    openCreateInstance() {
        const ui = this.instanceUI
        ui.createForm.reset()
        ui.versionInput.value = '1.20.1'
        ui.loaderInput.value = 'none'
        ui.loaderVersionInput.value = 'latest'
        ui.loaderVersionInput.disabled = true
        ui.formError.textContent = ''
        ui.createPopup.classList.add('is-open')
        ui.createPopup.setAttribute('aria-hidden', 'false')
        setTimeout(() => ui.nameInput.focus(), 0)
    }

    closeCreateInstance() {
        this.instanceUI.createPopup.classList.remove('is-open')
        this.instanceUI.createPopup.setAttribute('aria-hidden', 'true')
        document.querySelector('.instance-create-btn').focus()
    }

    async createLocalInstance() {
        const ui = this.instanceUI
        const submitButton = document.querySelector('.instance-dialog-submit')
        const displayName = ui.nameInput.value.trim()
        const minecraftVersion = ui.versionInput.value.trim()
        const loaderType = ui.loaderInput.value
        const loaderVersion = ui.loaderVersionInput.value.trim() || 'latest'

        if (displayName.length < 2) {
            ui.formError.textContent = 'Le nom doit contenir au moins 2 caractères.'
            ui.nameInput.focus()
            return
        }
        if (!/^[0-9A-Za-z._-]+$/.test(minecraftVersion)) {
            ui.formError.textContent = 'La version Minecraft contient des caractères non valides.'
            ui.versionInput.focus()
            return
        }
        if (this.instances.some(instance => (instance.displayName || instance.name).toLowerCase() === displayName.toLowerCase())) {
            ui.formError.textContent = 'Une instance porte déjà ce nom.'
            ui.nameInput.focus()
            return
        }

        const timestamp = Date.now()
        const safeName = displayName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase() || 'instance'

        submitButton.disabled = true
        submitButton.textContent = 'Création…'
        ui.formError.textContent = ''

        try {
            const instance = await this.db.createData('localInstances', {
                name: `local-${timestamp}`,
                displayName,
                source: 'local',
                instanceDirectory: `${safeName}-${timestamp.toString(36)}`,
                url: null,
                loadder: {
                    minecraft_version: minecraftVersion,
                    loadder_type: loaderType,
                    loadder_version: loaderType === 'none' ? null : loaderVersion
                },
                verify: false,
                ignored: [],
                whitelist: [],
                whitelistActive: false,
                status: null,
                createdAt: new Date().toISOString()
            })

            this.closeCreateInstance()
            await this.refreshInstances(instance.name)
        } catch (error) {
            console.error('[Instances] Unable to create local instance:', error)
            ui.formError.textContent = 'Création impossible. Vérifiez que le launcher peut écrire sur le disque.'
        } finally {
            submitButton.disabled = false
            submitButton.textContent = 'Créer l’instance'
        }
    }

    openDeleteInstance() {
        const instance = this.selectedInstance
        if (!instance || instance.source !== 'local') return

        this.pendingDeleteInstance = instance
        this.instanceUI.deleteCopy.textContent = `« ${instance.displayName || instance.name} » sera retirée de la liste.`
        this.instanceUI.deletePopup.classList.add('is-open')
        this.instanceUI.deletePopup.setAttribute('aria-hidden', 'false')
        setTimeout(() => document.querySelector('.instance-delete-cancel').focus(), 0)
    }

    closeDeleteInstance() {
        this.pendingDeleteInstance = null
        this.instanceUI.deletePopup.classList.remove('is-open')
        this.instanceUI.deletePopup.setAttribute('aria-hidden', 'true')
        document.querySelector('.instance-delete-btn').focus()
    }

    async deleteLocalInstance() {
        const instance = this.pendingDeleteInstance
        if (!instance || instance.source !== 'local' || !instance.ID) return

        await this.db.deleteData('localInstances', instance.ID)
        this.instanceUI.deletePopup.classList.remove('is-open')
        this.instanceUI.deletePopup.setAttribute('aria-hidden', 'true')
        this.pendingDeleteInstance = null
        await this.refreshInstances()
    }

    getInstanceInitials(name) {
        return String(name)
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0])
            .join('')
            .toUpperCase() || 'MC'
    }

    formatLoader(loader) {
        const labels = {
            none: 'Vanilla',
            forge: 'Forge',
            neoforge: 'NeoForge',
            fabric: 'Fabric',
            legacyfabric: 'Legacy Fabric',
            quilt: 'Quilt'
        }
        return labels[String(loader || 'none').toLowerCase()] || String(loader || 'Vanilla')
    }

    trapDialogFocus(event, dialog) {
        const focusable = [...dialog.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )]
        if (!focusable.length) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }

    async startGame() {
        let launch = new Launch()
        let configClient = await this.db.readData('configClient')
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        let options = this.instances?.find(i => i.name == configClient.instance_selct)

        if (!options) {
            let popupError = new popup()
            popupError.openPopup({
                title: 'Aucune instance',
                content: 'Sélectionnez ou créez une instance avant de lancer le jeu.',
                color: 'var(--danger-color)',
                options: true
            })
            return
        }

        let playInstanceBTN = document.querySelector('.play-instance')
        let infoStartingBOX = document.querySelector('.info-starting-game')
        let infoStarting = document.querySelector(".info-starting-game-text")
        let progressBar = document.querySelector('.progress-bar')

        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.instanceDirectory || options.name,
            version: options.loadder.minecraft_version,
            detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,

            loader: {
                type: options.loadder.loadder_type == 'none' ? null : options.loadder.loadder_type,
                build: options.loadder.loadder_version || 'latest',
                enable: options.loadder.loadder_type == 'none' ? false : true
            },

            verify: Boolean(options.verify),

            ignored: [...(options.ignored || [])],

            javaPath: configClient.java_config.java_path,

            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },

            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }

        launch.Launch(opt);

        playInstanceBTN.style.display = "none"
        infoStartingBOX.style.display = "block"
        progressBar.style.display = "";
        ipcRenderer.send('main-window-progress-load')

        launch.on('extract', extract => {
            ipcRenderer.send('main-window-progress-load')
            console.log(extract);
        });

        launch.on('progress', (progress, size) => {
            infoStarting.innerHTML = `Téléchargement ${((progress / size) * 100).toFixed(0)}%`
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('check', (progress, size) => {
            infoStarting.innerHTML = `Vérification ${((progress / size) * 100).toFixed(0)}%`
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('estimated', (time) => {
            let hours = Math.floor(time / 3600);
            let minutes = Math.floor((time - hours * 3600) / 60);
            let seconds = Math.floor(time - hours * 3600 - minutes * 60);
            console.log(`${hours}h ${minutes}m ${seconds}s`);
        })

        launch.on('speed', (speed) => {
            console.log(`${(speed / 1067008).toFixed(2)} Mb/s`)
        })

        launch.on('patch', patch => {
            console.log(patch);
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `Patch en cours...`
        });

        launch.on('data', (e) => {
            progressBar.style.display = "none"
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-hide")
            };
            new logger('Minecraft', '#36b030');
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `Demarrage en cours...`
            console.log(e);
        })

        launch.on('close', code => {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Vérification`
            new logger(pkg.name, '#7289da');
            console.log('Close');
        });

        launch.on('error', err => {
            let popupError = new popup()

            popupError.openPopup({
                title: 'Erreur',
                content: err.error,
                color: 'red',
                options: true
            })

            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Vérification`
            new logger(pkg.name, '#7289da');
            console.log(err);
        });
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
        return { year: year, month: allMonth[month - 1], day: day }
    }
}
export default Home;
