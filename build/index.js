"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const redis = __importStar(require("redis"));
const util_1 = require("util");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server);
const url = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = redis.createClient({
    url
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient.connect();
}))();
const getAsync = (0, util_1.promisify)(redisClient.get).bind(redisClient);
const setAsync = (0, util_1.promisify)(redisClient.set).bind(redisClient);
const delAsync = (0, util_1.promisify)(redisClient.del).bind(redisClient);
const keysAsync = (0, util_1.promisify)(redisClient.keys).bind(redisClient);
const generateRandomPosition = (area, room) => {
    const x = Math.random() * (area.xmax - area.xmin) + area.xmin;
    const y = Math.random() * (area.ymax - area.ymin) + area.ymin;
    const z = Math.random() * (area.zmax - area.zmin) + area.zmin;
    return { id: `${x}-${y}-${z}`, x, y, z, room };
};
const generateCoinsForRandom = (roomConfig) => __awaiter(void 0, void 0, void 0, function* () {
    const coins = [];
    for (let i = 0; i < roomConfig.coinCount; i++) {
        const coin = generateRandomPosition(roomConfig.area, roomConfig.room);
        coins.push(coin);
        yield setAsync(`${coin.id}-${coin.room}`, JSON.stringify(coin), 'EX', 3600);
    }
    return coins;
});
app.use(express_1.default.json());
app.get('/api/coins/:room', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const room = _req.params.room;
    const coinIds = yield keysAsync(`*-${room}`);
    console.log(room);
    const coins = yield Promise.all(coinIds.map((id) => getAsync(id)));
    res.json(coins.map((coin) => JSON.parse(coin)));
}));
// Conexión y manejo de sockets
io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
    });
    socket.on('coinCollected', (coinId) => __awaiter(void 0, void 0, void 0, function* () {
        const coin = yield getAsync(coinId);
        if (coin) {
            yield delAsync(coinId);
            io.emit('coinCollected', coinId);
        }
    }));
});
// Configuración de las salas y generación de monedas iniciales
const roomConfigs = [
    {
        room: 'room1',
        coinCount: 10,
        area: {
            xmax: 100,
            xmin: 0,
            ymax: 100,
            ymin: 0,
            zmax: 100,
            zmin: 0
        }
    },
    // Agregar más configuraciones de sala aquí...
];
roomConfigs.forEach((roomConfig) => __awaiter(void 0, void 0, void 0, function* () {
    const generatedCoins = yield generateCoinsForRandom(roomConfig);
    console.log(`Generadas ${generatedCoins.length} monedas para la sala ${roomConfig.room}`);
}));
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando el puerto ${PORT}`);
});
