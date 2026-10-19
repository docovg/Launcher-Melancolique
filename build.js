const fs = require("fs");

const builder = require('electron-builder')
const JavaScriptObfuscator = require('javascript-obfuscator');
const nodeFetch = require('node-fetch')
const png2icons = require('png2icons');
const Jimp = require('jimp');

const { productName, build: packageBuild } = require('./package.json');

const isLocalMacBuild = process.platform === 'darwin' && process.env.ALLOW_UNSIGNED_MAC_BUILD === 'true';

function getMacBuildOptions() {
    const isMac = process.platform === 'darwin';
    const allowUnsignedBuild = process.env.ALLOW_UNSIGNED_MAC_BUILD === 'true';
    const requiredVariables = [
        'CSC_LINK',
        'CSC_KEY_PASSWORD',
        'APPLE_ID',
        'APPLE_APP_SPECIFIC_PASSWORD',
        'APPLE_TEAM_ID'
    ];
    const configuredVariables = requiredVariables.filter(name => process.env[name]);

    if (isMac && configuredVariables.length > 0 && configuredVariables.length < requiredVariables.length) {
        const missingVariables = requiredVariables.filter(name => !process.env[name]);
        throw new Error(`Configuration macOS incomplète. Variables manquantes : ${missingVariables.join(', ')}`);
    }

    if (isMac && !allowUnsignedBuild && configuredVariables.length === 0) {
        throw new Error(
            'Le build macOS de production exige un certificat Developer ID et les identifiants de notarisation Apple. ' +
            `Configurez ${requiredVariables.join(', ')}, ou utilisez npm run build:unsigned uniquement pour un test local.`
        );
    }

    return {
        icon: "./app/assets/images/icon.icns",
        category: "public.app-category.games",
        hardenedRuntime: true,
        gatekeeperAssess: false,
        forceCodeSigning: isMac && !allowUnsignedBuild,
        notarize: configuredVariables.length === requiredVariables.length
            ? { teamId: process.env.APPLE_TEAM_ID }
            : false,
        target: allowUnsignedBuild
            ? [{ target: "dmg", arch: "universal" }]
            : [
                { target: "dmg", arch: "universal" },
                { target: "zip", arch: "universal" }
            ]
    };
}

class Index {
    async init() {
        this.obf = true
        this.Fileslist = []
        for (const val of process.argv) {
            if (val.startsWith('--icon')) {
                await this.iconSet(val.split('=')[1])
            }

            if (val.startsWith('--obf')) {
                this.obf = JSON.parse(val.split('=')[1])
                this.Fileslist = this.getFiles("src");
            }

            if (val.startsWith('--build')) {
                let buildType = val.split('=')[1]
                if (buildType == 'platform') await this.buildPlatform()
            }
        }
    }

    async Obfuscate() {
        if (fs.existsSync("./app")) fs.rmSync("./app", { recursive: true })

        for (let path of this.Fileslist) {
            let fileName = path.split('/').pop()
            let extFile = fileName.split(".").pop()
            let folder = path.replace(`/${fileName}`, '').replace('src', 'app')

            if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })

            if (extFile == 'js') {
                let code = fs.readFileSync(path, "utf8");
                code = code.replace(/src\//g, 'app/');
                if (this.obf) {
                    await new Promise((resolve) => {
                        console.log(`Obfuscate ${path}`);
                        let obf = JavaScriptObfuscator.obfuscate(code, { optionsPreset: 'medium-obfuscation', disableConsoleOutput: false });
                        resolve(fs.writeFileSync(`${folder}/${fileName}`, obf.getObfuscatedCode(), { encoding: "utf-8" }));
                    })
                } else {
                    console.log(`Copy ${path}`);
                    fs.writeFileSync(`${folder}/${fileName}`, code, { encoding: "utf-8" });
                }
            } else {
                fs.copyFileSync(path, `${folder}/${fileName}`);
            }
        }
    }

    async buildPlatform() {
        await this.Obfuscate();
        await builder.build({
            // GitHub Actions publie les artefacts dans un job dédié. Cela évite
            // que les builds Windows, Linux et macOS modifient la même release
            // en parallèle et permet aussi de relancer proprement une version.
            publish: "never",
            config: {
                generateUpdatesFilesForAllChannels: false,
                appId: packageBuild.appId,
                productName,
                copyright: 'Copyright © 2020-2024 Atmoz',
                // Le nom physique doit être identique au nom référencé dans
                // latest*.yml. GitHub remplace sinon les espaces par des points.
                artifactName: "Launcher-Melancolique-${os}-${arch}.${ext}",
                extraMetadata: { main: 'app/app.js', localBuild: isLocalMacBuild },
                files: ["app/**/*", "package.json", "LICENSE.md"],
                directories: { "output": "dist" },
                compression: isLocalMacBuild ? 'normal' : 'maximum',
                asar: true,
                publish: [{
                    provider: "github",
                    releaseType: 'release',
                }],
                win: {
                    icon: "./app/assets/images/icon.ico",
                    target: [{
                        target: "nsis",
                        arch: "x64"
                    }]
                },
                nsis: {
                    oneClick: true,
                    allowToChangeInstallationDirectory: false,
                    createDesktopShortcut: true,
                    runAfterFinish: true
                },
                mac: getMacBuildOptions(),
                linux: {
                    icon: "./app/assets/images/icon.png",
                    target: [{
                        target: "AppImage",
                        arch: "x64"
                    }]
                }
            }
        })
        console.log('le build est terminé')
    }

    getFiles(path, file = []) {
        if (fs.existsSync(path)) {
            let files = fs.readdirSync(path);
            for (let i in files) {
                let name = `${path}/${files[i]}`;
                if (fs.statSync(name).isDirectory()) this.getFiles(name, file);
                else file.push(name);
            }
        }
        return file;
    }

    async iconSet(url) {
        let Buffer = await nodeFetch(url)
        if (Buffer.status == 200) {
            Buffer = await Buffer.buffer()
            const image = await Jimp.read(Buffer);
            Buffer = await image.resize(256, 256).getBufferAsync(Jimp.MIME_PNG)
            fs.writeFileSync("src/assets/images/icon.icns", png2icons.createICNS(Buffer, png2icons.BILINEAR, 0));
            fs.writeFileSync("src/assets/images/icon.ico", png2icons.createICO(Buffer, png2icons.HERMITE, 0, false));
            fs.writeFileSync("src/assets/images/icon.png", Buffer);
            console.log('new icon set')
        } else {
            console.log('connection error')
        }
    }
}

new Index().init().catch(err => {
    console.error('Error during build!', err)
    process.exitCode = 1
});
