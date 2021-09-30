let redis = require('redis');
const asyncRedis = require("async-redis");

var client;
var asyncRedisClient;

//const get = promisify(client.get).bind(client);
//const set = promisify(client.set).bind(client);

module.exports = {
    initConnection: async function () {
        client = await redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST, {db: 0});
        client.on('connect', async () => {
            console.log('Redis client connected');
            asyncRedisClient = asyncRedis.decorate(client);
            asyncRedisClient.flushall();
        });
        client.on("error", (error) => {
            console.error(error);
        });
    },
    set: async function(key, value) {
        await asyncRedisClient.set(key, value);
    },
    get: async function(key) {
        let val = await asyncRedisClient.get(key);
        return val;
    },
    hgetall: async function(key) {
        let obj = await asyncRedisClient.hgetall(key);
        return obj;
    },
    getClient: function() {
        return asyncRedisClient;
    }
};