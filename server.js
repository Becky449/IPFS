const express = require('express');
const mongoose = require('mongoose');
const { ThirdwebStorage } = require('@thirdweb-dev/storage');
require('dotenv').config();
const { Readable } = require('stream');

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define schema and model
const ipfsDataSchema = new mongoose.Schema({
  cid: { type: String, required: true },
  text: { type: String, required: true },
});

const IPFSData = mongoose.model('IPFSData', ipfsDataSchema);

// Initialize Thirdweb Storage client
const storage = new ThirdwebStorage({
  secretKey: process.env.THIRDWEB_API_KEY,
});

// Helper function to convert text to a stream
const textToStream = (text) => {
  const stream = new Readable();
  stream.push(text);
  stream.push(null); // Indicates the end of the stream
  return stream;
};

// API endpoint to store text data on IPFS and save hash in MongoDB
app.post('/store-text', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text data is required.' });
    }

    // Convert text to a readable stream
    const stream = textToStream(text);

    // Upload to IPFS
    const uris = await storage.upload([stream]);

    if (uris.length === 0) {
      throw new Error('Failed to get URI from upload');
    }

    const cid = uris[0]; // IPFS CID

    // Store the IPFS hash and text in MongoDB
    const ipfsData = new IPFSData({ cid, text });
    await ipfsData.save();

    res.json({ cid });
  } catch (error) {
    console.error('Error storing data on IPFS:', error.message || error);
    res.status(500).json({ error: 'Failed to store data on IPFS.' });
  }
});

// API endpoint to retrieve data by IPFS hash
app.get('/retrieve-text/:cid', async (req, res) => {
  try {
    const { cid } = req.params;

    // Retrieve the data from MongoDB based on the IPFS hash
    const ipfsData = await IPFSData.findOne({ cid });

    if (!ipfsData) {
      return res.status(404).json({ error: 'Data not found for the provided IPFS hash.' });
    }

    // Download from IPFS
    const file = await storage.download(cid);
    const text = await file.text(); // Assuming the file is text

    res.json({ text });
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ error: 'Failed to retrieve data.' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
