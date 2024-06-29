import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AppController {
  /**
   * Retrieves the status of Redis and the database.
   *
   * GET /status
   *
   * @param {object} request - The request object.
   * @param {object} response - The response object.
   * @returns {object} JSON response with the status of Redis and the database.
   */
  static async getStatus(request, response) {
    const redisStatus = await redisClient.isAlive();
    const dbStatus = await dbClient.isAlive();

    response.status(200).json({ redis: redisStatus, db: dbStatus });
  }

  /**
   * Retrieves the number of users and files in the database.
   *
   * GET /stats
   *
   * @param {object} request - The request object.
   * @param {object} response - The response object.
   * @returns {object} JSON response with the number of users and files in the database.
   */
  static async getStats(request, response) {
    const users = await dbClient.nbUsers(); // miss spell of nbUsers()
    const files = await dbClient.nbFiles();

    response.status(200).json({ users, files });
  }
}
