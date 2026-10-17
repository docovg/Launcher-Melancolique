/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, logger, changePanel, appdata, getServerStatus, renderServerStatus, pkg, popup } from '../utils.js'
import { createInstanceIcon } from '../utils/instanceIcons.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

const DEFAULT_INSTANCE_ART = 'assets/images/instances/default.jpg'

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
            deleteCopy: document.querySelector('.instance-delete-copy'),
            railTooltip: document.querySelector('.instance-rail-tooltip'),
            art: document.querySelector('.instance-hero-art')
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

        document.querySelector('.instance-open-btn').addEventListener('click', () => this.openInstanceFolder())
        document.querySelector('.instance-delete-btn').addEventListener('click', () => this.openDeleteInstance())
        document.querySelector('.instance-delete-confirm').addEventListener('click', async () => this.deleteLocalInstance())
        document.querySelector('.play-instance').addEventListener('click', () => this.startGame())

        ui.createPopup.addEventListener('click', event => {
            if (event.target === ui.createPopup) this.closeCreateInstance()
        })
        ui.deletePopup.addEventListener('click', event => {
            if (event.target === ui.deletePopup) this.closeDeleteInstance()
        })
        ui.art.addEventListener('error', () => {
            if (ui.art.getAttribute('src') !== DEFAULT_INSTANCE_ART) ui.art.src = DEFAULT_INSTANCE_ART
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
        this.hideInstanceTooltip()
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
            const displayName = instance.displayName || instance.name
            const minecraftVersion = instance.loadder?.minecraft_version || 'Version inconnue'
            const loaderName = this.formatLoader(instance.loadder?.loadder_type)
            const accessibleLabel = `${displayName} — Minecraft ${minecraftVersion}, ${loaderName}`
            button.setAttribute('aria-label', accessibleLabel)
            button.setAttribute('aria-current', instance.name === this.selectedInstance?.name ? 'true' : 'false')
            button.addEventListener('mouseenter', () => this.showInstanceTooltip(button, displayName, `${minecraftVersion} · ${loaderName}`))
            button.addEventListener('mouseleave', () => this.hideInstanceTooltip())
            button.addEventListener('focus', () => this.showInstanceTooltip(button, displayName, `${minecraftVersion} · ${loaderName}`))
            button.addEventListener('blur', () => this.hideInstanceTooltip())

            const icon = createInstanceIcon(instance, 'instance-icon instance-list-icon')

            const copy = document.createElement('span')
            copy.className = 'instance-list-copy'

            const name = document.createElement('strong')
            name.className = 'instance-list-name'
            name.textContent = displayName

            const meta = document.createElement('span')
            meta.className = 'instance-list-meta'
            meta.textContent = `${minecraftVersion} · ${loaderName}`

            copy.append(name, meta)
            button.append(icon, copy)
            entry.appendChild(button)
            list.appendChild(entry)
        }

        const count = this.instances.length
        const countLabel = `${count} instance${count > 1 ? 's' : ''}`
        this.instanceUI.count.textContent = count
        this.instanceUI.count.title = countLabel
        this.instanceUI.count.setAttribute('aria-label', countLabel)
    }

    showInstanceTooltip(button, name, meta) {
        const tooltip = this.instanceUI.railTooltip
        const manager = tooltip?.closest('.instance-manager')
        if (!tooltip || !manager) return

        const buttonRect = button.getBoundingClientRect()
        const managerRect = manager.getBoundingClientRect()
        tooltip.querySelector('.instance-rail-tooltip-name').textContent = name
        tooltip.querySelector('.instance-rail-tooltip-meta').textContent = meta
        tooltip.style.top = `${buttonRect.top - managerRect.top + buttonRect.height / 2}px`
        tooltip.classList.add('is-visible')
    }

    hideInstanceTooltip() {
        const tooltip = this.instanceUI?.railTooltip
        if (!tooltip) return
        tooltip.classList.remove('is-visible')
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
            this.renderedInstanceName = null
            this.instanceDirectory = null
            this.setInstanceArt(null)
            this.setInstanceName('')
            this.updateLocalStatus(null)
            return
        }

        const displayName = instance.displayName || instance.name
        const isLocal = instance.source === 'local'
        this.instanceDirectory = null

        if (this.renderedInstanceName !== instance.name) {
            this.renderedInstanceName = instance.name
            this.playInstanceTransition()
        }
        this.setInstanceArt(instance.background)

        detail.querySelector('.instance-detail-name').textContent = displayName
        detail.querySelector('.instance-detail-name').title = displayName
        detail.querySelector('.instance-detail-description').textContent = instance.description || (isLocal
            ? 'Configuration privée enregistrée sur cet ordinateur.'
            : 'Instance officielle synchronisée avec le serveur du launcher.')
        detail.querySelector('.instance-minecraft-version').textContent = instance.loadder?.minecraft_version || 'Inconnue'
        detail.querySelector('.instance-loader-type').textContent = this.formatLoaderLabel(instance.loadder)
        const syncMode = detail.querySelector('.instance-sync-mode')
        syncMode.textContent = isLocal
            ? 'Locale uniquement'
            : instance.verify ? 'Vérifiée au lancement' : 'Standard'
        syncMode.title = isLocal
            ? 'Enregistrée sur cet ordinateur'
            : instance.verify ? 'Fichiers contrôlés avant chaque partie' : 'Fichiers téléchargés depuis le serveur'

        const badge = detail.querySelector('.instance-source-badge')
        badge.textContent = isLocal ? 'Instance locale' : 'Instance officielle'
        badge.classList.toggle('is-local', isLocal)
        detail.querySelector('.instance-hero-icon-slot').replaceChildren(
            createInstanceIcon(instance, 'instance-icon instance-hero-icon')
        )

        this.setInstanceName(displayName)
        const statusUpdate = this.updateInstanceStatus(instance)

        const root = await appdata()
        if (this.selectedInstance !== instance) return

        const dataDirectory = process.platform === 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`
        const directory = path.join(root, dataDirectory, 'instances', instance.instanceDirectory || instance.name)
        const directoryElement = detail.querySelector('.instance-directory-value')
        this.instanceDirectory = directory
        directoryElement.textContent = this.formatDirectory(directory)
        directoryElement.title = directory

        await statusUpdate
    }

    setInstanceArt(source) {
        const art = this.instanceUI.art
        const next = source || DEFAULT_INSTANCE_ART
        if (art.getAttribute('src') !== next) art.src = next
    }

    playInstanceTransition() {
        const detail = this.instanceUI.detail
        detail.classList.remove('is-entering')
        void detail.offsetWidth
        detail.classList.add('is-entering')
    }

    async updateInstanceStatus(instance) {
        const requestId = (this.statusRequestId || 0) + 1
        this.statusRequestId = requestId

        if (!instance?.status) {
            this.updateLocalStatus(instance)
            return
        }

        document.querySelector('.server-status-name').textContent = instance.status.nameServer
        document.querySelector('.player-count-label').textContent = 'joueurs'

        const status = await getServerStatus(instance.status)
        // Une autre instance a été sélectionnée entre-temps : cette réponse est périmée.
        if (requestId === this.statusRequestId) renderServerStatus(status)
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

    async openInstanceFolder() {
        const directory = this.instanceDirectory
        if (!directory) return

        try {
            fs.mkdirSync(directory, { recursive: true })
            const error = await shell.openPath(directory)
            if (error) throw new Error(error)
        } catch (error) {
            console.error('[Instances] Unable to open instance folder:', error)
            new popup().openPopup({
                title: 'Dossier inaccessible',
                content: `Impossible d’ouvrir le dossier de l’instance : ${error.message}`,
                color: 'var(--danger-color)',
                options: true
            })
        }
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

    formatLoaderLabel(loader) {
        const name = this.formatLoader(loader?.loadder_type)
        if (String(loader?.loadder_type || 'none').toLowerCase() === 'none') return name

        const build = String(loader.loadder_version || 'latest').trim()
        if (build.toLowerCase() === 'latest') return `${name} · dernière`
        if (build.toLowerCase() === 'recommended') return `${name} · recommandée`

        // « 1.20.1-47.4.0 » → « 47.4.0 » : la version Minecraft est déjà affichée à côté
        const prefix = `${loader.minecraft_version}-`
        return `${name} ${build.startsWith(prefix) ? build.slice(prefix.length) : build}`
    }

    formatDirectory(directory) {
        const parts = directory.split(/[\\/]+/).filter(Boolean)
        return parts.length > 3 ? `…${path.sep}${parts.slice(-3).join(path.sep)}` : directory
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
            url: options.url
                ? `${options.url}${options.url.includes('?') ? '&' : '?'}v=${Date.now()}`
                : options.url,
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
                build: this.normalizeLoaderBuild(options.loadder),
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

        try {
            this.quarantineInstanceFiles(opt.path, opt.instance, options.disabledFiles)
        } catch (error) {
            let popupError = new popup()
            popupError.openPopup({
                title: 'Fichier incompatible',
                content: `Impossible de désactiver un mod incompatible : ${error.message}`,
                color: 'var(--danger-color)',
                options: true
            })
            return
        }

        let packMenuServerSynced = false
        launch.on('data', event => {
            if (packMenuServerSynced || !String(event).startsWith('Launching with arguments')) return
            packMenuServerSynced = true
            this.syncPackMenuServerAddress(opt.path, opt.instance, options.status)
        })

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
                content: this.formatLaunchError(err?.error),
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

    quarantineInstanceFiles(launcherRoot, instanceName, disabledFiles = []) {
        if (!Array.isArray(disabledFiles) || !disabledFiles.length) return

        const instanceRoot = path.resolve(launcherRoot, 'instances', instanceName)
        const quarantineRoot = path.join(instanceRoot, '.launcher-disabled')

        for (const relativeFile of disabledFiles) {
            if (typeof relativeFile !== 'string' || !relativeFile.trim()) continue

            const source = path.resolve(instanceRoot, relativeFile)
            const relativeSource = path.relative(instanceRoot, source)
            if (!relativeSource || relativeSource.startsWith('..') || path.isAbsolute(relativeSource)) {
                console.warn(`[Instances] Chemin de désactivation refusé : ${relativeFile}`)
                continue
            }

            if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue

            fs.mkdirSync(quarantineRoot, { recursive: true })
            const disabledName = `${path.basename(source)}.disabled`
            let destination = path.join(quarantineRoot, disabledName)
            if (fs.existsSync(destination)) {
                destination = path.join(quarantineRoot, `${Date.now()}-${disabledName}`)
            }

            fs.renameSync(source, destination)
            console.info(`[Instances] Fichier incompatible désactivé : ${relativeSource}`)
        }
    }

    syncPackMenuServerAddress(launcherRoot, instanceName, status = null) {
        const host = String(status?.ip || '').trim()
        const port = Number(status?.port)
        if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return

        const instanceRoot = path.resolve(launcherRoot, 'instances', instanceName)
        const buttonFile = path.resolve(
            instanceRoot,
            'packmenu',
            'resources',
            'assets',
            'packmenu',
            'buttons',
            'multiplayer.json'
        )
        const relativeButtonFile = path.relative(instanceRoot, buttonFile)
        if (!relativeButtonFile || relativeButtonFile.startsWith('..') || path.isAbsolute(relativeButtonFile)) return
        if (!fs.existsSync(buttonFile) || !fs.statSync(buttonFile).isFile()) return

        try {
            const button = JSON.parse(fs.readFileSync(buttonFile, 'utf8'))
            if (button.action !== 'CONNECT_TO_SERVER') return

            const address = `${host}:${port}`
            if (button.data === address) return

            button.data = address
            fs.writeFileSync(buttonFile, `${JSON.stringify(button, null, '\t')}\n`, 'utf8')
            console.info(`[Instances] Adresse PackMenu synchronisée : ${address}`)
        } catch (error) {
            console.warn(`[Instances] Impossible de synchroniser l'adresse PackMenu : ${error.message}`)
        }
    }

    normalizeLoaderBuild(loader = {}) {
        const type = String(loader.loadder_type || '').toLowerCase()
        const minecraftVersion = String(loader.minecraft_version || '').trim()
        const build = String(loader.loadder_version || 'latest').trim()

        if (
            type === 'forge' &&
            minecraftVersion &&
            !['latest', 'recommended'].includes(build.toLowerCase()) &&
            /^\d+(?:\.\d+)+$/.test(build)
        ) {
            return `${minecraftVersion}-${build}`
        }

        return build
    }

    formatLaunchError(error) {
        const message = typeof error === 'string'
            ? error
            : error?.message || 'Le lancement de Minecraft a échoué.'

        if (message.includes('Available builds:')) {
            return `${message.split(', Available builds:')[0]}. Vérifie la version du chargeur configurée pour cette instance.`
        }

        return message
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
