/**
 * Icônes des instances : pixel art du chargeur (bloc d'herbe pour Vanilla, enclume
 * pour Forge/NeoForge, tissu pour Fabric, patchwork pour Quilt), ou image fournie
 * par la config de l'instance (champ `icon`).
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

// Bloc d'herbe : textures 16×16 du dessus et des côtés, posées en isométrie
const GRASS_PALETTE = {
    a: '#5f9e2f', b: '#6fb33a', c: '#7fc443', d: '#538c28',
    e: '#866043', f: '#6c4a32', g: '#a0774f', k: '#7d7a76'
}

const GRASS_TOP = [
    'bbdcababacbbcabb',
    'babdbdbbbbacbdaa',
    'cdadcbbbabbcbaad',
    'ccbbbbdbbabbcdac',
    'adbaadddaddacbab',
    'cacdacaacabbbbdd',
    'abaacdbdacacbdaa',
    'bbbcdcadacdabacd',
    'baaabbaabbbbbddb',
    'bbacbbcccacbabac',
    'bbcccabdbbacbdaa',
    'babdaddaacdaabcb',
    'adbbbccdbbbcdccd',
    'bdbabccacaabcabc',
    'aaaddbbbabddadba',
    'dccbdddbbcbbdbab'
]

const GRASS_SIDE = [
    'abbbbbbaaccbbaab',
    'abbbbbbabacacacb',
    'adacddacadbdbadb',
    'dedbegdadfdeaded',
    'fekdfgfbefekdffe',
    'geefefedfefegffg',
    'ffeefeeeeeeefeef',
    'eefeegffeeeegfkf',
    'ffeffffkfeffeeee',
    'fffeeegeegeeeegg',
    'eeffgekgeeeffeee',
    'eggeeefegeefefgg',
    'ggeeeeffgkeeeeke',
    'efgffgffffeeefee',
    'fegkfeeeeffeekee',
    'ffeeeeeeegegggee'
]

const ANVIL = [
    '................',
    '................',
    '................',
    'oooooooooooooooo',
    'ohhhhhhhhhhhhhho',
    '.ollllllllllllmo',
    '..oommmmmmmmmmso',
    '....oommmmmmmsoo',
    '......ommmmmso..',
    '......ommmmmso..',
    '.....ommmmmmmso.',
    '...oolllllllllso',
    '...ommmmmmmmmmso',
    '...ooooooooooooo',
    '................',
    '................'
]

const FABRIC = [
    '................',
    '................',
    '..oooooooooooo..',
    '..ollllllllllo..',
    '..oltctctctcso..',
    '..olccccccctso..',
    '..oltcccccccso..',
    '..olccccccctso..',
    '..oltcccccccso..',
    '..olccccccctso..',
    '..oltcccccccso..',
    '..olctctctctso..',
    '..olssssssssso..',
    '..oooooooooooo..',
    '................',
    '................'
]

const QUILT = [
    '................',
    '.oooooooooooooo.',
    '.oPPPPPqNNNNNvo.',
    '.oPppppqNnnnnvo.',
    '.oPppppqNnnnnvo.',
    '.oPppppqNnnnnvo.',
    '.oPppppqNnnnnvo.',
    '.oqqqqqqvvvvvvo.',
    '.oMMMMMwRRRRRxo.',
    '.oMmmmmwRrrrrxo.',
    '.oMmmmmwRrrrrxo.',
    '.oMmmmmwRrrrrxo.',
    '.oMmmmmwRrrrrxo.',
    '.owwwwwwxxxxxxo.',
    '.oooooooooooooo.',
    '................'
]

const LOADER_ART = {
    forge: {
        rows: ANVIL,
        palette: { o: '#121418', h: '#c3cad6', l: '#8a93a3', m: '#5c6372', s: '#3a3f4a' }
    },
    neoforge: {
        rows: ANVIL,
        palette: { o: '#3b1606', h: '#ffc58f', l: '#f39a4d', m: '#d9692a', s: '#9c4116' }
    },
    fabric: {
        rows: FABRIC,
        palette: { o: '#38342a', l: '#f1ead7', c: '#dbd0b4', s: '#b7ab8d', t: '#6e6552' }
    },
    legacyfabric: {
        rows: FABRIC,
        palette: { o: '#232a36', l: '#dbe4f2', c: '#b6c4da', s: '#8d9db8', t: '#4b5870' }
    },
    quilt: {
        rows: QUILT,
        palette: {
            o: '#1f1530',
            P: '#c49bff', p: '#9b51ff', q: '#6a28c7',
            N: '#86ceff', n: '#27a2fd', v: '#1772b8',
            M: '#f38ff3', m: '#dc29dd', w: '#9c189d',
            R: '#ffb688', r: '#fa7a3c', x: '#c2501b'
        }
    }
}

function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name)
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
    return element
}

// Une ligne de pixels de même couleur devient un seul rectangle
function drawPixels(rows, palette) {
    const group = svgElement('g')
    rows.forEach((row, y) => {
        let x = 0
        while (x < row.length) {
            const color = palette[row[x]]
            let end = x + 1
            while (end < row.length && row[end] === row[x]) end++
            if (color) group.appendChild(svgElement('rect', { x, y, width: end - x, height: 1, fill: color }))
            x = end
        }
    })
    return group
}

// Face 16×16 projetée en isométrie ; `shade` assombrit les côtés comme dans l'inventaire du jeu
function drawBlockFace(rows, transform, shade) {
    const face = svgElement('g', { transform })
    face.appendChild(svgElement('rect', { width: 16, height: 16, fill: GRASS_PALETTE.e }))
    face.appendChild(drawPixels(rows, GRASS_PALETTE))
    if (shade) face.appendChild(svgElement('rect', { width: 16, height: 16, fill: '#000', opacity: shade }))
    return face
}

function createGrassBlock() {
    const svg = svgElement('svg', { viewBox: '0 0 32 32', 'aria-hidden': 'true', class: 'instance-icon-art' })
    svg.appendChild(drawBlockFace(GRASS_TOP, 'matrix(0.8125 0.40625 -0.8125 0.40625 16 2)', 0))
    svg.appendChild(drawBlockFace(GRASS_SIDE, 'matrix(0.8125 0.40625 0 0.875 3 8.5)', 0.18))
    svg.appendChild(drawBlockFace(GRASS_SIDE, 'matrix(0.8125 -0.40625 0 0.875 16 15)', 0.36))
    return svg
}

function createLoaderGlyph(loaderType) {
    const art = LOADER_ART[String(loaderType || 'none').toLowerCase()]
    if (!art) return createGrassBlock()

    const svg = svgElement('svg', {
        viewBox: '0 0 16 16',
        'aria-hidden': 'true',
        class: 'instance-icon-art is-pixel',
        'shape-rendering': 'crispEdges'
    })
    svg.appendChild(drawPixels(art.rows, art.palette))
    return svg
}

function createInstanceIcon(instance = {}, className = 'instance-icon') {
    const loaderType = instance.loadder?.loadder_type
    const icon = document.createElement('span')
    icon.className = className
    icon.setAttribute('aria-hidden', 'true')

    // Une valeur avec « / » ou « . » est traitée comme une image (URL ou chemin)
    const source = typeof instance.icon === 'string' ? instance.icon.trim() : ''
    if (/[/.]/.test(source)) {
        const image = document.createElement('img')
        image.alt = ''
        image.addEventListener('error', () => {
            icon.classList.remove('has-image')
            image.replaceWith(createLoaderGlyph(loaderType))
        }, { once: true })
        image.src = source
        icon.classList.add('has-image')
        icon.appendChild(image)
    } else {
        icon.appendChild(createLoaderGlyph(loaderType))
    }

    return icon
}

export { createLoaderGlyph, createInstanceIcon }
