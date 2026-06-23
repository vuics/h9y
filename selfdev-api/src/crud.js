import { log, warn, error, Verbose } from './services.js'

const verbose = Verbose('sd:crud'); verbose('')

export async function createDocument({ Model, data, userId }) {
  try {
    if (!userId) throw new Error('Missing userId');
    const doc = new Model({ ...data, userId });
    await doc.save();
    return doc;
  } catch (err) {
    throw new Error(`Create failed: ${err.message}`);
  }
}

export async function getDocumentById({ Model, _id, userId }) {
  try {
    if (!userId) throw new Error('Missing userId');
    const doc = await Model.findOne({ _id, userId });
    if (!doc) throw new Error('Document not found');
    return doc;
  } catch (err) {
    throw new Error(`Get failed: ${err.message}`);
  }
}

export async function updateDocumentById({ Model, _id, data, userId }) {
  try {
    if (!userId) throw new Error('Missing userId');
    const doc = await Model.findOneAndUpdate(
      { _id, userId },
      data,
      { new: true, runValidators: true }
    );
    if (!doc) throw new Error('Document not found');
    return doc;
  } catch (err) {
    throw new Error(`Update failed: ${err.message}`);
  }
}

export async function deleteDocumentById({ Model, _id, userId }) {
  try {
    if (!userId) throw new Error('Missing userId');
    const doc = await Model.findOneAndDelete({ _id, userId });
    if (!doc) throw new Error('Document not found');
    return doc;
  } catch (err) {
    throw new Error(`Delete failed: ${err.message}`);
  }
}

export async function listDocuments({ Model, userId, filter = {}, options = {} } = {}) {
  try {
    if (!userId) throw new Error('Missing userId');
    const docs = await Model.find({ ...filter, userId }, null, options);
    return docs;
  } catch (err) {
    throw new Error(`List failed: ${err.message}`);
  }
}
