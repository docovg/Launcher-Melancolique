/**
 * Icônes des instances : glyphes SVG (trait, grille 24×24).
 * Ordre de résolution : champ `icon` de l'instance (clé ou image), thème deviné
 * depuis le nom, puis chargeur.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

const INSTANCE_ICONS = {
    castle: {
        label: 'Colonie',
        path: 'M3 21h18M4 21V7h1.5v1.5h2V7H9v14M15 21V7h1.5v1.5h2V7H20v14M9 12h6M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21M6.5 7V3l3 1.25-3 1.25'
    },
    cog: {
        label: 'Technique',
        path: 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.75 1.75M16.25 16.25 18 18M6 18l1.75-1.75M16.25 7.75 18 6'
    },
    sword: {
        label: 'Combat',
        path: 'M20 4h-4.5l-9 9M20 4v4.5l-9 9M5 11.5l7.5 7.5M8.5 15.5 4 20'
    },
    pickaxe: {
        label: 'Survie',
        path: 'M5.5 5.5Q17.5 6.5 18.5 18.5Q13.5 10.5 5.5 5.5zM12.7 11.3 4 20'
    },
    tree: {
        label: 'Nature',
        path: 'M12 3 6.5 10.5h3L5 16.5h14l-4.5-6h3zM12 16.5V21'
    },
    compass: {
        label: 'Aventure',
        path: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z'
    },
    star: {
        label: 'Magie',
        path: 'M11 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7zM18.5 16v4M16.5 18h4'
    },
    flask: {
        label: 'Alchimie',
        path: 'M9.5 3h5M10.5 3v6.2L5.3 18.1A2 2 0 0 0 7 21h10a2 2 0 0 0 1.7-2.9L13.5 9.2V3M7.5 15h9'
    },
    block: {
        label: 'Vanilla',
        path: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9M4 10.5l8 4.5 8-4.5'
    },
    anvil: {
        label: 'Forge',
        path: 'M3 6h13c0 2 2 3.5 5 3.5V11c-3 0-5 1-6 3H9c-1-2-3-3-6-3zM9.5 14v4M14.5 14v4M6.5 21v-3h11v3z'
    },
    spool: {
        label: 'Fabric',
        path: 'M6 4h12M6 20h12M8 4v16M16 4v16M8 8l8 2M8 12l8 2M8 16l8 2'
    },
    quilt: {
        label: 'Quilt',
        path: 'M5 5h14v14H5zM12 5v14M5 12h14M7.5 7.5l2 2M14.5 14.5l2 2'
    }
}

// Icônes proposées à la création d'une instance locale
const PICKER_ICONS = ['castle', 'cog', 'sword', 'pickaxe', 'tree', 'compass', 'star', 'flask', 'block']

const THEME_KEYWORDS = [
    ['castle', /colon|village|town|ville|kingdom|royaume|empire|conquer|conquete|civili/],
    ['sword', /pvp|faction|\bwar|guerre|combat|battle|bataille|arena|arene/],
    ['star', /magi|sorcel|wizard|arcan|enchant|\bmana\b/],
    ['cog', /create|tech|indus|mekanism|thermal|engineer|ingenieur|machine|automat/],
    ['flask', /potion|alchem|alchim|chimi|\blab\b/],
    ['compass', /explor|aventure|adventure|voyage|\brpg\b|quest|quete/],
    ['tree', /sky|\biles?\b|nature|forest|foret|biome|jardin|garden|farm|ferme/],
    ['pickaxe', /surviv|survie|mining|minage|hardcore|\bcaves?\b|grotte/]
]

const LOADER_ICONS = {
    forge: 'anvil',
    neoforge: 'anvil',
    fabric: 'spool',
    legacyfabric: 'spool',
    quilt: 'quilt'
}

// Teintes de fond, choisies pour rester dans l'ambiance braise/bronze du launcher
const HUES = [12, 36, 145, 205, 268, 172, 335]

function normalize(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
}

function autoIconName(instance = {}) {
    const name = normalize(`${instance.displayName || ''} ${instance.name || ''}`)
    const theme = THEME_KEYWORDS.find(([, pattern]) => pattern.test(name))
    if (theme) return theme[0]
    return LOADER_ICONS[normalize(instance.loadder?.loadder_type)] || 'block'
}

function resolveInstanceIcon(instance = {}) {
    const icon = typeof instance.icon === 'string' ? instance.icon.trim() : ''
    if (INSTANCE_ICONS[icon]) return { name: icon }
    // Une valeur avec « / » ou « . » est traitée comme une image (URL ou chemin)
    if (/[/.]/.test(icon)) return { name: autoIconName(instance), src: icon }
    return { name: autoIconName(instance) }
}

function getInstanceHue(instance = {}) {
    let hash = 0
    for (const char of String(instance.displayName || instance.name || '')) {
        hash = (hash * 31 + char.codePointAt(0)) >>> 0
    }
    return HUES[hash % HUES.length]
}

function createIconGlyph(name) {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', (INSTANCE_ICONS[name] || INSTANCE_ICONS.block).path)
    svg.appendChild(path)
    return svg
}

function createInstanceIcon(instance, className = 'instance-icon') {
    const { name, src } = resolveInstanceIcon(instance)
    const icon = document.createElement('span')
    icon.className = className
    icon.setAttribute('aria-hidden', 'true')
    icon.style.setProperty('--instance-hue', getInstanceHue(instance))

    if (src) {
        const image = document.createElement('img')
        image.alt = ''
        image.addEventListener('error', () => {
            icon.classList.remove('has-image')
            image.replaceWith(createIconGlyph(name))
        }, { once: true })
        image.src = src
        icon.classList.add('has-image')
        icon.appendChild(image)
    } else {
        icon.appendChild(createIconGlyph(name))
    }

    return icon
}

export { INSTANCE_ICONS, PICKER_ICONS, resolveInstanceIcon, createIconGlyph, createInstanceIcon }
