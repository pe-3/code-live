// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })
const webscoket = require('@fastify/websocket');
const os = require('os');
const fs = require('fs');
const getIPAddress = function () {
    const ifaces = os.networkInterfaces();
    let ip = '';
    for (let dev in ifaces) {
        ifaces[dev].forEach(
            // eslint-disable-next-line no-loop-func
            (details) => {
                if (ip === '' && details.family === 'IPv4' && !details.internal) {
                    ip = details.address;
                    return;
                }
            });
    }
    return ip || "127.0.0.1";
};
const ip = getIPAddress();

fastify.register(webscoket);


let code = '';
try {
    code = fs.readFileSync(__dirname + '/file/code.js');
    code = new Buffer(code);
    code = code.toString();
    console.log('--- code start --- \n' + code + '\n --- code end --- ');
} catch (e) {
    console.log(e);
}

const parseChange = (previous, change) => {
    if (typeof previous !== 'string') {
        throw new Error('previous should be a string');
    }
    // 1.解析change对象
    const { changes } = change;
    // 2.根据解析的内容分割重组字符串
    const codePartArr = [];
    const { changeRange: { fromA: sFromA } } = changes[0];
    codePartArr.push(previous.slice(0, sFromA));

    for (let i = 0; i < changes.length - 1; i++) {
        const { changeRange: { toA: cToA }, insertStr } = changes[i];
        const { changeRange: { fromA: nFromA } } = changes[i + 1];
        codePartArr.push(insertStr);
        codePartArr.push(previous.slice(cToA, nFromA));
    }

    const { changeRange: { toA: lToA }, insertStr } = changes[changes.length - 1];
    codePartArr.push(insertStr);
    codePartArr.push(previous.slice(lToA));
    console.log(codePartArr)
    return codePartArr.join('');
}

const connections = [];

fastify.register(async function (fastify) {
    fastify.get('/', { websocket: true }, (connection /* SocketStream */, req /* FastifyRequest */) => {
        if (!connections.includes(connection)) {
            connection.socket.send(JSON.stringify({ code }));
        }
        connections.push(connection);
        connection.socket.on('message', message => {
            const buffer = Buffer(message);
            const changeStr = buffer.toString();
            if (changeStr === 'run') {
                return connections.forEach((cnec) => {
                    if (cnec !== connection) {
                        cnec.socket.send(changeStr);
                    }
                })
            }

            if(changeStr === 'save'){
                console.log(code);
                fs.writeFile(__dirname + '/file/code.js', code, (err)=>{
                    err ? console.log(err) : console.log('--- saved success ---');
                })
                return;
            }

            const change = JSON.parse(changeStr);
            code = parseChange(code, change);
          
            console.log('--- code start --- \n' + code + '\n --- code end --- ');
            connections.forEach((cnec) => {
                if (cnec !== connection) {
                    cnec.socket.send(changeStr);
                }
            })
        })
    })
})

// Run the server!
const start = async () => {
    try {
        await fastify.listen(8080, ip);
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start();

fs.writeFile('./src/ip.json', JSON.stringify({ ip }), (err, data) => {
    console.log(err, data);
})