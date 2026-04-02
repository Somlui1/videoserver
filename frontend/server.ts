import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection, getDocs, orderBy, query, deleteDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
async function startServer() {
  const app = express();
  const PORT = 4000;

  app.use(cors());
  app.use(express.json());

  // Auth Middleware (Simplified for demo, in production verify Firebase ID token)
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    next();
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    // Mock authentication
    if (email && password) {
      res.json({
        token: "mock-jwt-token-" + Date.now(),
        role: "admin",
        user: {
          uid: "system-admin",
          email: email,
          displayName: "System Admin"
        }
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/videos", authenticateToken, async (req, res) => {
    try {
      const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const videos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ data: videos });
    } catch (error) {
      console.error("Failed to fetch videos", error);
      res.status(500).json({ error: "Failed to fetch videos" });
    }
  });

  app.get("/api/stats", authenticateToken, async (req, res) => {
    try {
      const statsRef = doc(db, 'system', 'stats');
      const statsSnap = await getDoc(statsRef);
      if (statsSnap.exists()) {
        res.json(statsSnap.data());
      } else {
        res.json({
          jobsWaiting: 0,
          activeWorkers: 8,
          storageUsed: "0 GB",
          storagePercentage: 0
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/videos/upload", authenticateToken, upload.single('file'), async (req, res) => {
    const { title } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const videoId = `AAP-${Math.floor(Math.random() * 100000)}`;
    const newVideo = {
      id: videoId,
      title: title || "New Upload",
      description: "",
      status: "queued",
      quality: "1080p",
      duration: "--:--",
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      createdAt: new Date().toISOString(),
      views: 0,
      thumbnailUrl: `/thumbnails/${videoId}.jpg`,
      authorUid: "system" // In production, extract from verified token
    };

    try {
      await setDoc(doc(db, 'videos', videoId), newVideo);

      // Simulate transcoding to 'ready' after 10 seconds
      setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'videos', videoId), { status: 'ready' });
        } catch (e) {
          console.error("Failed to update status", e);
        }
      }, 10000);

      res.json({ video_id: videoId });
    } catch (error) {
      res.status(500).json({ error: "Failed to create video record" });
    }
  });

  app.get("/api/videos/:id/status", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const videoSnap = await getDoc(doc(db, 'videos', id));
      if (!videoSnap.exists()) {
        return res.status(404).json({ error: "Video not found" });
      }
      res.json(videoSnap.data());
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/videos/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const videoRef = doc(db, 'videos', id);
      const videoSnap = await getDoc(videoRef);
      if (!videoSnap.exists()) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      // In production, also delete files from MinIO here
      
      // Delete from Firestore
      await deleteDoc(videoRef);
      res.json({ success: true, message: `Video ${id} deleted` });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  app.get("/hls/:id/master.m3u8", async (req, res) => {
    const { id } = req.params;
    try {
      const videoSnap = await getDoc(doc(db, 'videos', id));
      if (!videoSnap.exists()) {
        return res.status(404).json({ error: "Video not found" });
      }
      // Demo: Redirect to a sample HLS stream
      res.redirect("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n  \x1b[32m🚀 AAPICO Video Portal Server\x1b[0m`);
    console.log(`  - \x1b[1mLocal:   \x1b[0mhttp://localhost:${PORT}`);
    console.log(`  - \x1b[1mNetwork: \x1b[0mhttp://0.0.0.0:${PORT}\n`);
    console.log(`  \x1b[2mPress Ctrl+C to stop\x1b[0m\n`);
  });
}

startServer();
