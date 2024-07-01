import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');
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
      return response.status(201).json({ id: newFile.insertedId, ...fileData });
    } catch (error) {
      console.error('Error writing file: ', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getShow(request, response) {
    const getUser = await FilesController.getUser(request);
    if (!getUser) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const usrId = request.params.id;
    const files = await dbClient.db.collection('files').findOne({
      id: new ObjectId(usrId),
      userId: getUser._id,
    });

    if (!files) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(files);
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);

    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = request.query.parentId || '0';
    const page = parseInt(request.query.page, 10) || 0;
    const pageSize = 20;
    const skip = page * pageSize;
    /* let query;
      if (parentId !== '0') {
      query = { userId: user._id, parentId: new ObjectId(parentId) };
    } else {
      query = { userId: user._id };
    } */
    const query = {
      userId: user._id,
      parentId: parentId === '0' ? 0 : new ObjectId(parentId),
    };

    const filesCollection = dbClient.db.collection('files');

    filesCollection.aggregate([
      { $match: query },
      { $sort: { _id: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }, { $addFields: { page } }],
          data: [{ $skip: skip }, { $limit: pageSize }],
        },
      },
    ]).toArray((err, result) => {
      if (result) {
        const final = result[0].data.map((file) => {
          const tmpFile = {
            ...file,
            id: file._id,
          };
          delete tmpFile._id;
          delete tmpFile.localPath;
          return tmpFile;
        });
        return response.status(200).json(final);
      }
      console.log('Error occurred:', err);
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }

  static async putPublish(request, response) {
    const fileId = request.params.id;
    const token = request.headers['X-Token'];

    // retrieve user based on token
    const user = await redisClient.get(`auth_${token}`);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    // retrieve file document with fileId and user owner and update it
    const files = dbClient.db.collection('files');

    const file = await files.findOneAndUpdate(
      { _id: new ObjectId(fileId), userId: new ObjectId(user) },
      { $set: { isPublic: true } },
      { returnOriginal: false },
    );
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(file.value);
  }

  static async putUnpublish(request, response) {
    const fileId = request.params.id;
    const token = request.headers['x-token'];

    // retrieve user based on token
    const user = await redisClient.get(`auth_${token}`);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    // retrieve file document with fileId and user owner and update it
    const files = dbClient.db.collection('files');

    const file = await files.findOneAndUpdate(
      { _id: new ObjectId(fileId), userId: new ObjectId(user) },
      { $set: { isPublic: false } },
      { returnOriginal: false },
    );
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(file.value);
  }
}
module.exports = FilesController;
