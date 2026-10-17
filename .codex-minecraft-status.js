const net = require('net')
const host = process.argv[2]
const port = Number(process.argv[3])
const encode = value => {
  const bytes = []
  do {
    let byte = value & 127
    value >>>= 7
    if (value) byte |= 128
    bytes.push(byte)
  } while (value)
  return Buffer.from(bytes)
}
const decode = (buffer, offset) => {
  let value = 0, shift = 0, cursor = offset, byte
  do {
    if (cursor >= buffer.length) return null
    byte = buffer[cursor++]
    value |= (byte & 127) << shift
    shift += 7
  } while (byte & 128)
  return [value, cursor]
}
const name = Buffer.from(host)
const portBuffer = Buffer.alloc(2)
portBuffer.writeUInt16BE(port)
const handshake = Buffer.concat([encode(0), encode(763), encode(name.length), name, portBuffer, encode(1)])
const socket = net.createConnection({host, port}, () => socket.write(Buffer.concat([encode(handshake.length), handshake, Buffer.from([1, 0])])))
let response = Buffer.alloc(0)
socket.on('data', chunk => {
  response = Buffer.concat([response, chunk])
  const packet = decode(response, 0)
  if (!packet || response.length - packet[1] < packet[0]) return
  const id = decode(response, packet[1])
  const length = id && decode(response, id[1])
  if (!length) return
  console.log(JSON.stringify(JSON.parse(response.subarray(length[1], length[1] + length[0]).toString())))
  socket.end()
})
socket.on('error', error => { console.log(JSON.stringify({error: error.code})); process.exitCode = 1 })
socket.setTimeout(8000, () => { console.log(JSON.stringify({error: 'TIMEOUT'})); socket.destroy(); process.exitCode = 2 })
