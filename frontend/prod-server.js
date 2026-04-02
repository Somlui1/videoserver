import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const DIST_DIR = path.join(__dirname, 'dist');

// Serve static files from the dist directory
app.use(express.static(DIST_DIR));

// Handle SPA client-side routing: forward all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🚀 AAPICO Video Portal Production Server`);
  console.log(`  - Serving from: ${DIST_DIR}`);
  console.log(`  - Listening on: http://0.0.0.0:${PORT}\n`);
});
