/**
 * Script to download the westwood_restaurant_metadata.json file from S3 and save it locally
 * 
 * Usage:
 * 1. Update the S3_URL constant with your actual S3 URL
 * 2. Run this script with Node.js: node scripts/downloadMetadata.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Update this with your actual S3 URL
const S3_URL = 'https://your-s3-bucket-name.s3.amazonaws.com/westwood_restaurant_metadata.json';

// Local path to save the metadata file
const LOCAL_PATH = path.join(__dirname, '..', 'assets', 'westwood_restaurant_metadata.json');

// Ensure the assets directory exists
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Function to download the file
function downloadFile(url, outputPath) {
  console.log(`Downloading metadata from ${url}...`);
  
  return new Promise((resolve, reject) => {
    // Determine whether to use http or https based on the URL
    const client = url.startsWith('https') ? https : http;
    
    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`Following redirect to ${response.headers.location}`);
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }
      
      // Check if the request was successful
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
      }
      
      // Create a write stream to save the file
      const fileStream = fs.createWriteStream(outputPath);
      
      // Pipe the response to the file
      response.pipe(fileStream);
      
      // Handle errors
      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if there's an error
        reject(err);
      });
      
      // Resolve the promise when the file is downloaded
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`File downloaded successfully to ${outputPath}`);
        resolve();
      });
    });
    
    // Handle request errors
    request.on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file if there's an error
      reject(err);
    });
    
    // Set a timeout
    request.setTimeout(30000, () => {
      request.abort();
      fs.unlink(outputPath, () => {}); // Delete the file if there's a timeout
      reject(new Error('Request timed out'));
    });
  });
}

// Download the file
downloadFile(S3_URL, LOCAL_PATH)
  .then(() => {
    // Validate the downloaded file
    try {
      const metadata = JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8'));
      console.log(`Metadata file contains ${metadata.length} items`);
      console.log('Sample item:', JSON.stringify(metadata[0], null, 2));
    } catch (error) {
      console.error('Error validating metadata file:', error);
    }
  })
  .catch((error) => {
    console.error('Error downloading metadata file:', error);
  }); 