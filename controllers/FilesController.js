import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(request, response) {
    const token = request.headers['x-token'];

    if (!token) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve user based on the token
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = '0', isPublic = false, data } = request.body;

    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return response.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return response.status(400).json({ error: 'Missing data' });
    }
    if (parentId !== '0') {
      const parent = await dbClient.db.collection('files').findOne({ _id: new ObjectId(parentId), userId: user._id });
      if (!parent) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileData = {
      userId: new ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? 0 : new ObjectId(parentId)
    };

    if (type === 'folder') {
      try {
        const newFile = await dbClient.db.collection('files').insertOne(fileData);
        return response.status(201).json({ id: newFile.insertedId, ...fileData });
      } catch (error) {
        console.error('Error creating folder: ', error);
        return response.status(500).json({ error: 'Internal Server Error' });
      }
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileUuid = uuidv4();
    const filePath = path.join(folderPath, fileUuid);

    try {
      await fs.mkdir(folderPath, { recursive: true });
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(filePath, buffer);
      fileData.localPath = filePath;
      const newFile = await dbClient.db.collection('files').insertOne(fileData);
      return response.status(201).json({ id: newFile.insertedId, ...fileData });
    } catch (error) {
      console.error('Error writing file: ', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
