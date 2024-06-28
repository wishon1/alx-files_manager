import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  /**
     * Initializes a Redis client and sets up event listeners
     * for connection and error handling.
     */
  constructor() {
    this.client = createClient();
    this.isConnected = true;

    // Handle Redis client errors
    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
      this.isConnected = false;
    });

    // Handle successful connection to Redis
    this.client.on('connect', () => {
      this.isConnected = true;
    });
  }

  /**
     * Checks if the Redis client is currently connected.
     * @returns {boolean} true if connected, false otherwise.
     */
  isAlive() {
    return this.isConnected;
  }

  /**
     * Retrieves the value associated with the given key from Redis.
     * @param {string} key - The key to retrieve the value for.
     * @returns {Promise<any>} A promise that resolves with the retrieved
     * value, or rejects with an error.
     */
  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, value) => {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
    });
  }

  /**
     * Sets a key-value pair in Redis with an expiration time.
     * @param {string} key - The key to set.
     * @param {any} value - The value to set for the key.
     * @param {number} duration - The expiration time in seconds.
     * @returns {Promise<void>} A promise that resolves when the
     * operation is successful, or rejects with an error.
     */
  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, 'EX', duration, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
     * Deletes a key and its associated value from Redis.
     * @param {string} key - The key to delete.
     * @returns {Promise<void>} A promise that resolves when the operation is
     * successful, or rejects with an error.
     */
  async del(key) {
    await promisify(this.client.del).bind(this.client)(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
