import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import Queue from 'bull';
import mime from 'mime-types';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

class FilesController {
  static async getUser(request) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return null;
    }
    const users = dbClient.db.collection('users');
    const idObject = new ObjectId(userId);
    const user = await users.findOne({ _id: idObject });

    if (user) {
      return user;
    }
    return null;
  }

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

    const {
      name, type, parentId = '0', isPublic = false, data,
    } = request.body;

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
      parentId: parentId === '0' ? 0 : new ObjectId(parentId),
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

      if (type === 'image') {
        fileQueue.add({ userId: userId.toString(), fileId: newFile.insertedId.toString() });
      }
      return response.status(201).json({ id: newFile.insertedId, ...fileData });
    } catch (error) {
      console.error('Error writing file: ', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getShow(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: user._id,
    });

    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(file);
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);

    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = '0', page = 0 } = request.query;
    const limit = 20;
    const skip = page * limit;
    const query = {
      userId: user._id,
      parentId: parentId === '0' ? 0 : new ObjectId(parentId),
    };

    const pipeline = [
      { $match: query },
      { $sort: { _id: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    try {
      const files = await dbClient.db.collection('files').aggregate(pipeline).toArray();
      const final = files.map((file) => {
        const tmpFile = { ...file, id: file._id };
        delete tmpFile._id;
        delete tmpFile.localPath;
        return tmpFile;
      });
      return response.status(200).json(final);
    } catch (err) {
      console.error('Error occurred:', err);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putPublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    const files = dbClient.db.collection('files');

    try {
      const result = await files.findOneAndUpdate(
        { _id: new ObjectId(fileId), userId: user._id },
        { $set: { isPublic: true } },
        { returnOriginal: false },
      );
      if (!result.value) {
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(result.value);
    } catch (error) {
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putUnpublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    const files = dbClient.db.collection('files');

    try {
      const result = await files.findOneAndUpdate(
        { _id: new ObjectId(fileId), userId: user._id },
        { $set: { isPublic: false } },
        { returnOriginal: false },
      );
      if (!result.value) {
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(result.value);
    } catch (error) {
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const { size } = request.query;
    const valideSizes = ['500', '250', '200'];

    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(id) });

    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }
    const user = await FilesController.getUser(request);
    if (!file.isPublic && (!user || user._id.toString() !== file.userId.toString())) {
      return response.status(404).json({ error: 'Not found' });
    }
    if (file.type === 'folder') {
      return response.status(400).json({ error: "A folder doesn't have content" });
    }

    try {
      let filePath = file.localPath;

      if (size && valideSizes.includes(size)) {
        filePath = `${filePath}_${size}`;
      }
      if (!await fs.access(filePath).then(() => true).catch(() => false)) {
        return response.status(404).json({ error: 'Not found' });
      }
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';
      const fileContent = await fs.readFile(filePath);
      return response.status(200).header('Content-Type', mimeType).send(fileContent);
    } catch (error) {
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
