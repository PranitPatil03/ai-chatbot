import { createClient, type RedisClientType } from "redis";

type RedisClient = ReturnType<typeof createClient>;

type RedisClients = {
  publisher: RedisClient;
  subscriber: RedisClient;
};

let redisClients: RedisClients | null = null;

const resolveRedisUrl = () => {
  const redisUrl =
    process.env.UPSTASH_REDIS_URL ??
    process.env.REDIS_URL ??
    process.env.KV_URL;

  if (!redisUrl) {
    throw new Error(
      "Missing Redis connection string. Please set UPSTASH_REDIS_URL or REDIS_URL."
    );
  }

  if (redisUrl.startsWith("http")) {
    throw new Error(
      "The REST URL from Upstash cannot be used for streaming. Please provide the rediss:// connection string."
    );
  }

  return redisUrl;
};

const attachErrorLogging = (client: RedisClient, label: string) => {
  client.on("error", (error) => {
    console.error(`[redis:${label}]`, error);
  });
};

export const getRedisClients = (): RedisClients => {
  if (redisClients) {
    return redisClients;
  }

  const redisUrl = resolveRedisUrl();
  const publisher = createClient({ url: redisUrl });
  const subscriber = publisher.duplicate();

  attachErrorLogging(publisher, "publisher");
  attachErrorLogging(subscriber, "subscriber");

  void Promise.all([
    publisher.connect(),
    subscriber.connect(),
  ]).catch((error) => {
    console.error("[redis:connection]", error);
  });

  redisClients = { publisher, subscriber };
  return redisClients;
};

