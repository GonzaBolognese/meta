import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import * as redis from 'redis';
import { promisify } from 'util';

const app = express();
const server = http.createServer(app);
const io = new Server(server)
const url = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = redis.createClient({
    url
});

(async () => {
  await redisClient.connect();
})();


const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);
const keysAsync = promisify(redisClient.keys).bind(redisClient);
const flushallAsync = promisify(redisClient.flushAll).bind(redisClient);

interface Coin {
    id:string;
    x:number;
    y:number;
    z:number;
    room: string;
}

interface RoomConfig {
    room:string;
    coinCount: number;
    area: {
        xmax: number;
        xmin: number;
        ymax: number;
        ymin: number;
        zmax: number;
        zmin: number;
    };
}

const generateRandomPosition = (area: RoomConfig['area'], room: RoomConfig['room']): Coin => {
    const x = Math.random() * (area.xmax - area.xmin) + area.xmin;
    const y = Math.random() * (area.ymax - area.ymin) + area.ymin;
    const z = Math.random() * (area.zmax - area.zmin) + area.zmin;
    return { id: `${x}-${y}-${z}`, x, y, z, room };
  };

  const generateCoinsForRandom = async (roomConfig: RoomConfig) => {
    const coins: Coin[] = [];
  
    for (let i = 0; i < roomConfig.coinCount; i++) {
      const coin = generateRandomPosition(roomConfig.area, roomConfig.room);
      coins.push(coin);
      await setAsync(`${coin.id}-${coin.room}`, JSON.stringify(coin), 'EX', 3600);
    }
    return coins;
  };
  

app.use(express.json());

app.get('/api/coins/:room', async (_req, res) => {
  const room = _req.params.room;
  const coinIds = await keysAsync(`*-${room}`);
  console.log(room);
  const coins = await Promise.all(coinIds.map((id: string) => getAsync(id)));
  res.json(coins.map((coin) => JSON.parse(coin)));
});


// Conexión y manejo de sockets
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('disconnect', async () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    await flushallAsync();
  });

  socket.on('coinCollected', async (coinId) => {
    const coin = await getAsync(coinId);
    if (coin) {
      await delAsync(coinId);
      io.emit('coinCollected', coinId);
    }
  });
});
  
  // Configuración de las salas y generación de monedas iniciales
  const roomConfigs: RoomConfig[] = [
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
  
  roomConfigs.forEach(async (roomConfig) => {
    const generatedCoins = await generateCoinsForRandom(roomConfig);
    console.log(`Generadas ${generatedCoins.length} monedas para la sala ${roomConfig.room}`);
  });
  

const PORT = 3000;

server.listen(PORT, () => {
    console.log(`Servidor escuchando el puerto ${PORT}`);
  
})