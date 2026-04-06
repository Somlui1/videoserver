import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  CloudUpload,
  Video,
  Settings,
  LayoutDashboard,
  Search,
  Bell,
  HelpCircle,
  LogOut,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Database,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Eye,
  BadgeCheck,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import Hls from 'hls.js';

// --- Assets ---
// @ts-ignore
import BackgroundImg from '../Background.png';

// --- Configuration & Services ---
import { API_CONFIG } from './config';
import { VideoService } from './services/api';

/**
 * Utility for Tailwind classes
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Video {
  id: string;
  title: string;
  description?: string;
  status: string;
  quality?: string;
  duration?: string;
  duration_seconds?: number;
  size?: string;
  file_size_bytes?: number;
  progress?: number;
  createdAt?: string;
  views?: number;
  thumbnailUrl?: string;
}

interface LogEntry {
  id: string;
  time: string;
  message: string;
}

// --- Context/Props Helpers ---
interface LogProps {
  addLog: (msg: string) => void;
}

// --- Components ---

const Sidebar = ({ addLog, currentPath }: { addLog: (msg: string) => void, currentPath: string }) => {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('aapico_token');
    localStorage.removeItem('aapico_user');
    addLog("User logged out.");
    navigate('/login');
  };

  const navItems = [
    { icon: 'cloud_upload', label: 'Upload', path: '/upload' },
    { icon: 'video_library', label: 'Library', path: '/library' },
    { icon: 'settings_applications', label: 'Admin Jobs', path: '/admin' },
    { icon: 'settings', label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="w-80 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col h-full shadow-2xl z-20">
      <div className="p-10 border-b border-outline-variant/30">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-primary text-white flex items-center justify-center sharp-edge">
            <span className="material-symbols-outlined text-2xl font-black">play_circle</span>
          </div>
          <h1 className="text-[18px] font-black text-primary leading-none tracking-tighter font-bai uppercase">Hub for e-Learning Systems</h1>
        </div>
        <p className="text-[10px] text-outline font-black uppercase tracking-[0.3em] ml-1">e-Learning Video Ecosystem v3.0</p>
      </div>

      <nav className="flex-1 p-6 space-y-4">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-4 px-6 py-5 text-sm font-bold uppercase tracking-widest transition-all duration-300 sharp-edge group",
              currentPath === item.path
                ? "bg-primary text-white shadow-lg shadow-primary/20 translate-x-2"
                : "text-on-surface-variant hover:bg-surface-container-high hover:translate-x-1"
            )}
          >
            <span className={cn(
              "material-symbols-outlined text-2xl transition-transform group-hover:scale-110",
              currentPath === item.path ? "text-white" : "text-outline"
            )}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-6 border-t border-outline-variant/30">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-6 py-5 text-sm font-bold uppercase tracking-widest text-error hover:bg-error/10 transition-all sharp-edge group"
        >
          <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform">logout</span>
          System Logout
        </button>
      </div>
    </aside>
  );
};

const TopBar = ({ searchQuery, setSearchQuery }: { searchQuery: string, setSearchQuery: (q: string) => void }) => {
  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-10 py-6 z-10 shadow-sm">
      <div className="flex items-center gap-8 flex-1">
        <div className="relative w-full max-w-xl group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">search</span>
          <input
            type="text"
            placeholder="Search enterprise video assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-low pl-12 pr-4 py-3 text-sm font-bold sharp-edge border border-transparent focus:border-outline-variant focus:bg-surface-container-lowest outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 flex items-center justify-center text-outline hover:text-primary hover:bg-surface-container-high transition-all sharp-edge">
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>

        <div className="h-8 w-[1px] bg-outline-variant/30 mx-2"></div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-primary uppercase tracking-widest">Admin User</p>
            <p className="text-[10px] text-outline font-bold uppercase tracking-tighter">System Architect</p>
          </div>
          <div className="w-12 h-12 bg-primary-container p-1 sharp-edge shadow-lg">
            <img
              src="https://picsum.photos/seed/admin/100/100"
              alt="Profile"
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all cursor-pointer"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

const Layout = ({ children, logs, addLog, currentPath, searchQuery, setSearchQuery }: { children: React.ReactNode, logs: LogEntry[], addLog: (msg: string) => void, currentPath: string, searchQuery: string, setSearchQuery: (q: string) => void }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="flex min-h-screen bg-surface overflow-hidden">
      <Sidebar addLog={addLog} currentPath={currentPath} />
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-y-auto">
        <TopBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        <main className="p-12 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="max-w-7xl mx-auto space-y-12">
            {children}

            {/* Console Logs Section */}
            <div className="bg-surface-container-lowest p-8 border border-outline-variant/30 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-primary flex items-center gap-3 uppercase tracking-[0.2em] font-bai">
                  <span className="material-symbols-outlined text-secondary">terminal</span>
                  System Console Logs
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_rgba(0,110,33,0.6)]"></div>
                    <span className="text-[10px] text-secondary font-black uppercase tracking-widest">Live Telemetry</span>
                  </div>
                  <button
                    onClick={() => addLog("Console cleared.")}
                    className="text-outline hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  </button>
                </div>
              </div>
              <div className="h-[200px] overflow-y-auto bg-surface-container-low p-6 font-mono text-[11px] border border-outline-variant/20 whitespace-pre-wrap text-on-surface-variant scrollbar-thin scrollbar-thumb-outline-variant/30">
                {logs.length === 0 && <div className="text-outline/30 italic">Waiting for system events...</div>}
                {logs.map(log => (
                  <div key={log.id} className="mb-2 flex gap-4 group hover:bg-white/5 transition-colors p-1">
                    <span className="text-secondary font-bold shrink-0">[{log.time}]</span>
                    <span className="text-on-surface-variant break-all">{log.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const VideoPlayer = ({ videoId, addLog, onClose, inline = false }: { videoId: string, addLog: (msg: string) => void, onClose: () => void, inline?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const streamUrl = VideoService.getHlsUrl(videoId);
    addLog(`Loading player for: ${streamUrl}`);

    if (Hls.isSupported()) {
      const hls = new Hls({ debug: false });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        addLog("HLS Manifest parsed. Starting playback...");
        setLevels(data.levels);
        video.play().catch(e => addLog("Auto-play blocked: " + e.message));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          addLog("HLS Fatal error: " + data.type);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play();
      });
    } else {
      addLog("HLS is not supported in this browser.");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [videoId]);

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const level = parseInt(e.target.value);
    setCurrentLevel(level);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      const levelName = level === -1 ? "Auto" : `${levels[level]?.height}p`;
      addLog(`Switched quality to: ${levelName}`);
    }
  };

  const playerContent = (
    <div className="space-y-6">
      <div className="bg-tertiary overflow-hidden aspect-video relative border-4 border-primary-container">
        <video ref={videoRef} controls className="w-full h-full" />
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-4">
          <label className="font-bold text-xs uppercase tracking-widest text-outline">Quality Selector:</label>
          <select
            value={currentLevel}
            onChange={handleQualityChange}
            className="p-3 border border-outline-variant bg-surface-container-low text-sm font-bold sharp-edge outline-none focus:ring-2 focus:ring-primary-container"
          >
            <option value="-1">Auto (Adaptive)</option>
            {levels.map((level, index) => (
              <option key={index} value={index}>{level.height}p</option>
            ))}
          </select>
        </div>

        <div className="text-center w-full max-w-md">
          <p className="text-[10px] text-outline uppercase tracking-widest mb-2">HLS Stream Endpoint:</p>
          <div className="bg-surface-container-low p-3 border border-outline-variant/30 text-[10px] text-primary font-mono break-all">
            {VideoService.getHlsUrl(videoId)}
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="bg-surface-container-lowest p-8 border border-outline-variant/30 animate-in fade-in slide-in-from-top-4 duration-500">
        <h2 className="text-2xl font-black text-primary mb-8 uppercase tracking-tighter font-bai">3. Video Playback (HLS stream)</h2>
        {playerContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-primary/90 backdrop-blur-sm">
      <div className="bg-surface-container-lowest p-8 shadow-2xl w-full max-w-4xl relative border border-outline-variant/30">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-outline hover:text-error transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">close</span>
        </button>
        <h2 className="text-2xl font-black text-primary mb-8 uppercase tracking-tighter font-bai">3. Video Playback (HLS stream)</h2>
        {playerContent}
      </div>
    </div>
  );
};

const LoginPage = ({ addLog }: { addLog: (msg: string) => void }) => {
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Authenticating with enterprise server...', type: 'info' });
    addLog(`Login attempt for: ${email}`);

    try {
      const data = await VideoService.login(email, password);
      localStorage.setItem('aapico_token', data.token);
      localStorage.setItem('aapico_user', JSON.stringify(data.user));

      setStatus({ message: '✅ Authentication successful!', type: 'success' });
      addLog(`Token received: ${data.token.substring(0, 20)}...`);

      setTimeout(() => navigate('/upload'), 1000);
    } catch (err: any) {
      setStatus({ message: `❌ ${err.message}`, type: 'error' });
      addLog(`Login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col md:flex-row bg-surface selection:bg-secondary-container selection:text-on-secondary-container font-bai">
      <section className="relative w-full md:w-1/2 bg-primary-container flex flex-col justify-between p-12 lg:p-20 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${BackgroundImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield_person</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white text-2xl font-bold tracking-tighter leading-none">Hub for e-Learning Systems</span>
              <span className="text-on-primary-container text-xs font-medium tracking-[0.2em] uppercase">e-Learning Video Ecosystem v3.0</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-24">
          <h1 className="text-white text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tighter max-w-lg mb-8">
            Centralized Video <br />
            <span className="text-secondary-fixed">e-Learning Stream.</span>
          </h1>
          <p className="text-on-primary-container text-lg max-w-md font-light leading-relaxed">
            The dedicated media engine for the AAPICO Learn portal. Securely managing, transcoding, and distributing high-definition educational content to our global workforce.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-2">
          <p className="text-[#A1A1A5] text-sm tracking-tight font-medium">
            © 2024 AAPICO Hitech Public Company Limited.
          </p>
          <div className="flex gap-6">
            <a className="text-[#A1A1A5] hover:text-white transition-colors text-xs font-semibold uppercase tracking-widest" href="#">Internal Use Only</a>
            <a className="text-[#A1A1A5] hover:text-white transition-colors text-xs font-semibold uppercase tracking-widest" href="#">Security Policy</a>
          </div>
        </div>
      </section>

      <section className="w-full md:w-1/2 bg-white flex items-center justify-center p-8 lg:p-24 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {status?.type === 'success' ? (
            <motion.div
              key="success-screen"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="w-full max-w-md flex flex-col items-center justify-center gap-8 text-center"
            >
              <div className="w-24 h-24 bg-secondary text-white rounded-full flex items-center justify-center shadow-2xl">
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                  className="material-symbols-outlined text-6xl"
                >
                  check_circle
                </motion.span>
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Access Granted</h2>
                <p className="text-on-surface-variant font-medium">Initializing secure workspace for system architect...</p>
              </div>
              <div className="w-48 h-1 bg-surface-container-highest relative overflow-hidden">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "0%" }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                  className="absolute inset-0 bg-secondary"
                ></motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-md flex flex-col gap-12"
            >
              <div className="flex flex-col gap-4 text-center items-center">
                <div className="h-1 w-16 bg-primary"></div>
                <h2 className="text-on-surface text-[32px] font-bold leading-tight tracking-tight uppercase font-bai">
                  Learning Portal Authentication
                </h2>
                <p className="text-on-surface-variant text-sm max-w-[300px]">
                  Access the corporate e-Learning media hub using the managed credentials provided by the IT department.
                </p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-8">
                <div className="flex flex-col gap-2">
                  <label className="text-on-surface text-xs font-bold uppercase tracking-widest" htmlFor="username">Corporate Username</label>
                  <div className="group relative">
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant px-0 py-4 text-base focus:ring-0 focus:border-primary transition-all placeholder:text-outline"
                      id="username"
                      name="username"
                      placeholder="e.g. j.doe@aapico.com"
                      required
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline group-focus-within:text-primary">
                      badge
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-on-surface text-xs font-bold uppercase tracking-widest" htmlFor="password">Secure Password</label>
                    <a className="text-primary text-xs font-bold hover:underline" href="#">Forgot password?</a>
                  </div>
                  <div className="group relative">
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant px-0 py-4 text-base focus:ring-0 focus:border-primary transition-all placeholder:text-outline"
                      id="password"
                      name="password"
                      placeholder="••••••••••••"
                      required
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline group-focus-within:text-primary">
                      lock
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input className="w-5 h-5 text-primary border-outline focus:ring-primary-container rounded-none" id="remember" type="checkbox" />
                  <label className="text-on-surface-variant text-sm font-medium cursor-pointer" htmlFor="remember">Remember my session for 24 hours</label>
                </div>

                <div className="flex flex-col gap-4 mt-4">
                  <button
                    className="w-full bg-primary py-5 text-white font-bold text-base tracking-widest uppercase flex items-center justify-center gap-3 hover:bg-on-primary-fixed-variant transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Authenticating Access...' : 'Authenticate Access'}
                    <span className={cn("material-symbols-outlined text-xl", loading && "animate-spin")}>
                      {loading ? 'sync' : 'login'}
                    </span>
                  </button>

                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-grow h-px bg-surface-container-highest"></div>
                    <span className="text-outline text-[10px] font-bold uppercase tracking-widest">Support</span>
                    <div className="flex-grow h-px bg-surface-container-highest"></div>
                  </div>

                  <button className="w-full border-2 border-primary text-primary py-4 font-bold text-sm tracking-widest uppercase hover:bg-primary hover:text-white transition-all" type="button">
                    Contact IT Helpdesk
                  </button>
                </div>
              </form>

              <div className={cn(
                "p-4 flex gap-4 items-start border-l-4 transition-all duration-300",
                status ? (
                  status.type === 'success' ? "bg-secondary-container border-secondary" :
                    status.type === 'error' ? "bg-error-container border-error" :
                      "bg-surface-container-low border-primary"
                ) : "bg-surface-container-low border-secondary"
              )}>
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {status?.type === 'error' ? 'error' : 'verified_user'}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-[13px] text-on-surface-variant leading-relaxed">
                    {status ? status.message : "Security verification is handled by encrypted Microsoft Active Directory. Your IP is logged for security auditing purposes."}
                  </p>
                  {!status && (
                    <p className="text-[10px] text-outline font-bold">IP: 192.168.1.1</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
};

const UploadPage = ({ addLog }: { addLog: (msg: string) => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('My Test Video');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const navigate = useNavigate();

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first!');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('access_level', 'org');
    formData.append('file', file);

    setUploading(true);
    setStatus({ message: 'Uploading directly to MinIO...', type: 'info' });
    addLog(`Starting upload for file: ${file.name}`);

    try {
      const data = await VideoService.uploadVideo(formData);
      setStatus({ message: `✅ Uploaded! Video ID: ${data.video_id}`, type: 'success' });
      addLog(`Upload finished. Job pushed to worker.`);

      startPolling(data.video_id);
    } catch (err: any) {
      setStatus({ message: `❌ Failed: ${err.message}`, type: 'error' });
      addLog(`Upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const startPolling = (videoId: string) => {
    addLog(`Started polling status for video ${videoId}...`);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const data = await VideoService.getVideoStatus(videoId);
        addLog(`Polled status: ${data.status}`);
        setPollingStatus(`Current Status: ${data.status.toUpperCase()} (waiting for worker)`);

        if (data.status === 'ready') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setPollingStatus(null);
          addLog('Transcoding COMPLETE. Loading player...');
          setPlayingVideoId(videoId);
        } else if (data.status === 'error') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setPollingStatus('❌ Transcoding failed!');
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-[48px] font-black text-primary leading-none tracking-tight font-bai uppercase">Ingest Training Content</h1>
          <p className="text-[16px] text-on-surface-variant mt-2 max-w-2xl font-bai">Directly upload training videos into the e-Learning transcoding pipeline for global curriculum deployment.</p>
        </div>
        <button
          onClick={() => navigate('/library')}
          className="bg-primary-container text-white px-8 py-4 text-sm font-bold uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all sharp-edge"
        >
          <span className="material-symbols-outlined">video_library</span>
          View Library
        </button>
      </div>

      <div className="bg-surface-container-lowest p-8 border border-outline-variant/30">
        <h2 className="text-2xl font-black text-primary mb-8 uppercase tracking-tighter font-bai">2. Upload Video</h2>
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-outline">Select Video File:</label>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full p-4 border border-outline-variant bg-surface-container-low text-sm font-bold sharp-edge outline-none focus:ring-2 focus:ring-primary-container file:mr-4 file:py-2 file:px-4 file:bg-primary-container file:text-white file:font-bold file:uppercase file:text-[10px] file:tracking-widest file:sharp-edge file:border-0 hover:file:brightness-110"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-outline">Video Title:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 border border-outline-variant bg-surface-container-low text-sm font-bold sharp-edge outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-secondary text-white px-12 py-4 text-sm font-bold uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all sharp-edge disabled:bg-outline disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <span className="material-symbols-outlined animate-spin">sync</span> Uploading...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">cloud_upload</span> Upload to MinIO
              </>
            )}
          </button>
        </div>

        {status && (
          <div className={cn(
            "mt-8 p-6 text-sm font-bold uppercase tracking-widest sharp-edge",
            status.type === 'success' && "bg-secondary-container text-on-secondary-container border-l-4 border-secondary",
            status.type === 'error' && "bg-error-container text-on-error-container border-l-4 border-error",
            status.type === 'info' && "bg-primary-fixed text-on-primary-fixed border-l-4 border-primary"
          )}>
            {status.message}
          </div>
        )}
      </div>

      {pollingStatus && (
        <div className="bg-surface-container-lowest p-8 border border-outline-variant/30 animate-pulse">
          <h2 className="text-2xl font-black text-primary mb-8 uppercase tracking-tighter font-bai">3. Video Playback (HLS stream)</h2>
          <div className="bg-primary-fixed text-on-primary-fixed p-6 border-l-4 border-primary text-xs font-bold uppercase tracking-widest flex items-center gap-3">
            <span className="material-symbols-outlined animate-spin">sync</span> {pollingStatus}
          </div>
        </div>
      )}

      {playingVideoId && (
        <VideoPlayer
          videoId={playingVideoId}
          addLog={addLog}
          onClose={() => setPlayingVideoId(null)}
          inline={true}
        />
      )}
    </div>
  );
};

const LibraryPage = ({ addLog, searchQuery }: { addLog: (msg: string) => void, searchQuery: string }) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const navigate = useNavigate();

  const handleEditVideo = (id: string, currentTitle: string) => {
    setEditingVideoId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveTitle = async (id: string) => {
    try {
      addLog(`Updating video ${id} title to: ${editTitle}`);
      await VideoService.updateVideo(id, { title: editTitle });
      setVideos(prev => prev.map(v => v.id === id ? { ...v, title: editTitle } : v));
      setEditingVideoId(null);
      addLog(`Update successful.`);
    } catch (err: any) {
      addLog(`Update failed: ${err.message}`);
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleDeleteVideo = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    addLog(`Attempting to delete video: ${id}`);
    
    // Optimistic Update: Remove from UI immediately
    const previousVideos = [...videos];
    setVideos(prev => prev.filter(v => v.id !== id));
    
    try {
      await VideoService.deleteVideo(id);
      addLog(`Video ${id} deletion triggered successfully.`);
    } catch (err: any) {
      // Rollback on failure
      setVideos(previousVideos);
      addLog(`Delete failed: ${err.message}`);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const loadVideos = async () => {
    addLog('Fetching video library...');
    setLoading(true);
    try {
      const data = await VideoService.getVideos({ search: searchQuery });
      setVideos(data);
      addLog(`Loaded ${data.length} videos${searchQuery ? ` matching "${searchQuery}"` : ''}.`);
    } catch (err: any) {
      addLog(`Error loading library: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [searchQuery]);

  return (
    <div className="space-y-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-[48px] font-black text-primary leading-none tracking-tight font-bai uppercase">Learning Resource Library</h1>
          <p className="text-[16px] text-on-surface-variant mt-2 max-w-2xl font-bai">Manage and optimize the repository of educational video assets and training materials.</p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="bg-secondary text-white px-8 py-4 text-sm font-bold uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all sharp-edge"
        >
          <span className="material-symbols-outlined">add</span>
          Upload New Video
        </button>
      </div>

      <div className="bg-surface-container-low p-1 mb-8 flex flex-wrap items-center gap-2">
        <div className="px-6 py-4 flex items-center gap-4 border-r border-outline-variant/20">
          <span className="text-xs font-bold uppercase tracking-wider text-outline">Filter by Status:</span>
        </div>
        <div className="flex items-center gap-2 px-4">
          <button className="px-4 py-2 text-xs font-bold bg-primary-container text-white sharp-edge">All Assets</button>
          <button className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors sharp-edge">Finished</button>
          <button className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors sharp-edge">Processing</button>
          <button className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors sharp-edge">Failed</button>
        </div>
        <div className="ml-auto px-6 py-2 flex items-center gap-4">
          <span className="text-xs text-outline italic">Showing {videos.length} videos</span>
          <button
            onClick={loadVideos}
            disabled={loading}
            className="p-2 hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            <span className={cn("material-symbols-outlined", loading && "animate-spin")}>sync</span>
          </button>
        </div>
      </div>

      {/* Video Grid using VideoCardVideo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {videos.length === 0 && !loading && (
          <div className="col-span-full text-center py-20 bg-surface-container-lowest border border-dashed border-outline-variant/30 text-outline italic font-bai">
            No videos found in the enterprise library.
          </div>
        )}

        {videos.map((v) => (
          <VideoCardVideo
            key={v.id}
            video={v}
            onPlay={() => setPlayingVideoId(v.id)}
            onEdit={() => handleEditVideo(v.id, v.title)}
            onDelete={() => handleDeleteVideo(v.id, v.title)}
            editingVideoId={editingVideoId}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            handleSaveTitle={handleSaveTitle}
            setEditingVideoId={setEditingVideoId}
          />
        ))}
      </div>

      <div className="mt-20 pt-8 border-t border-outline-variant/30 flex items-center justify-between">
        <div className="text-[16px] text-on-surface-variant font-bai">
          Showing <span className="font-bold text-primary">1-{videos.length}</span> of {videos.length} results
        </div>
        <div className="flex items-center gap-1">
          <button className="w-10 h-10 flex items-center justify-center border border-outline-variant/30 text-outline hover:bg-surface-container transition-colors sharp-edge"><span className="material-symbols-outlined">chevron_left</span></button>
          <button className="w-10 h-10 flex items-center justify-center bg-primary-container text-white font-bold sharp-edge">1</button>
          <button className="w-10 h-10 flex items-center justify-center border border-outline-variant/30 text-outline hover:bg-surface-container transition-colors sharp-edge"><span className="material-symbols-outlined">chevron_right</span></button>
        </div>
      </div>

      {playingVideoId && (
        <VideoPlayer
          videoId={playingVideoId}
          addLog={addLog}
          onClose={() => setPlayingVideoId(null)}
        />
      )}
    </div>
  );
};

interface AdminJobRowProps {
  video: Video;
  onDelete: (id: string, title: string) => Promise<void>;
  [key: string]: any; // Allow for 'key' or other React-injected props
}

const AdminJobRow = ({ video, onDelete }: AdminJobRowProps) => {
  const { progress, status } = useVideoProgress(video.id, video.status, video.progress || 0);
  
  return (
    <tr key={video.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
      <td className="px-8 py-6 text-sm font-mono text-primary font-bold">#{video.id.substring(0, 8).toUpperCase()}</td>
      <td className="px-8 py-6">
        <div className="flex flex-col">
          <span className="font-bold text-primary-container text-[16px] font-bai">{video.title}</span>
          <span className="text-outline text-[10px] uppercase tracking-widest mt-1">
            {video.file_size_bytes ? `${(video.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : '0 GB'} / {video.quality || 'N/A'} Source
          </span>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full",
            status.toLowerCase() === 'ready' ? "bg-secondary shadow-[0_0_8px_rgba(0,110,33,0.6)]" : 
            status.toLowerCase() === 'error' ? "bg-error" : "bg-primary-container animate-pulse"
          )}></div>
          <span className={cn(
            "text-[11px] font-black uppercase tracking-widest",
            status.toLowerCase() === 'ready' ? "text-secondary" : 
            status.toLowerCase() === 'error' ? "text-error" : "text-primary-container"
          )}>
            {status} {status === 'transcoding' && `(${progress}%)`}
          </span>
        </div>
      </td>
      <td className="px-8 py-6">
        <span className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-widest sharp-edge border border-outline-variant/20">
            {video.quality || (status === 'ready' ? 'Unknown' : '...')}
        </span>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end gap-4">
          <button
            onClick={() => onDelete(video.id, video.title)}
            className="text-error hover:bg-error-container/20 p-2 transition-colors sharp-edge"
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
          <button className="text-outline hover:text-primary transition-colors">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </td>
    </tr>
  );
};

const SettingsPage = ({ addLog }: { addLog: (msg: string) => void }) => {
  const getUser = () => {
    try {
      const stored = localStorage.getItem('aapico_user');
      if (!stored || stored === 'undefined') return {};
      return JSON.parse(stored);
    } catch { return {}; }
  };
  const user = getUser();
  const [name, setName] = useState(user.name || 'System Administrator');
  const [email, setEmail] = useState(user.email || 'admin@company.com');
  const [updating, setUpdating] = useState(false);

  const handleSave = async () => {
    if (!name || !email) return alert('Name and Email are required.');
    setUpdating(true);
    try {
      const updatedUser = await VideoService.updateProfile({ name, email });
      localStorage.setItem('aapico_user', JSON.stringify({
          ...user,
          name: updatedUser.name,
          email: updatedUser.email
      }));
      addLog(`Profile updated: ${updatedUser.name} (${updatedUser.email})`);
      alert('Profile updated successfully.');
    } catch (err: any) {
      addLog(`Failed to update profile: ${err.message}`);
      alert(`Error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-[48px] font-black text-primary leading-none tracking-tight font-bai uppercase">Account Settings</h1>
        <p className="text-[16px] text-on-surface-variant mt-2 max-w-2xl font-bai">Manage your administrative profile and security credentials.</p>
      </div>

      <div className="bg-surface-container-lowest p-8 border border-outline-variant/30 space-y-8">
        <div className="max-w-2xl space-y-8">
          <div className="flex items-center gap-8 mb-12">
            <div className="w-32 h-32 bg-primary-container p-1 sharp-edge shadow-xl">
              <img src="https://picsum.photos/seed/admin/300/300" alt="Admin" className="w-full h-full object-cover grayscale" />
            </div>
            <div>
              <h3 className="text-sm font-black text-primary uppercase tracking-widest mb-1">Profile Photo</h3>
              <p className="text-xs text-outline mb-4">Click to upload a new personnel photo (JPG/PNG, max 2MB).</p>
              <button className="text-[10px] font-black text-secondary uppercase tracking-widest border border-secondary/30 px-4 py-2 hover:bg-secondary/10 transition-all sharp-edge">Update Identity Image</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-outline uppercase tracking-widest">Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 p-4 font-bold text-primary sharp-edge focus:border-primary outline-none transition-all"
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-outline uppercase tracking-widest">Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 p-4 font-bold text-primary sharp-edge focus:border-primary outline-none transition-all"
                placeholder="Enter email address"
              />
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-outline-variant/30">
          <button 
            onClick={handleSave}
            disabled={updating}
            className="bg-primary text-white px-12 py-4 text-sm font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all sharp-edge flex items-center gap-2"
          >
            {updating && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
            Save Profile Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminJobsPage = ({ addLog, searchQuery }: { addLog: (msg: string) => void, searchQuery: string }) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<any>({
    jobsWaiting: 0,
    activeWorkers: 0,
    storageUsed: '0 GB',
    storagePercentage: 0
  });
  const [loading, setLoading] = useState(false);

  const handleDeleteVideo = async (id: string, title: string) => {
    if (!window.confirm(`Admin: Force delete video "${title}"?`)) return;

    addLog(`Admin attempting to delete video: ${id}`);
    try {
      await VideoService.deleteVideo(id);
      addLog(`Video ${id} removed from system.`);
      setVideos(prev => prev.filter(v => v.id !== id));
    } catch (err: any) {
      addLog(`Force delete failed: ${err.message}`);
      alert(`Force delete failed: ${err.message}`);
    }
  };

  const fetchData = async () => {
    addLog("Fetching admin dashboard data...");
    setLoading(true);
    try {
    const [videosData, statsData] = await Promise.all([
      VideoService.getAdminVideos(),
      VideoService.getStats()
    ]);
    const filteredVideos = searchQuery
      ? videosData.filter((v: any) => v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.id.toLowerCase().includes(searchQuery.toLowerCase()))
      : videosData;
    setVideos(filteredVideos);
    setStats({
      jobsWaiting: statsData.jobsWaiting,
      activeWorkers: statsData.activeWorkers,
      storageUsed: statsData.storageUsed,
      storagePercentage: statsData.storagePercentage
    });
    addLog(`Loaded ${videosData.length} jobs and system stats.`);
    } catch (err: any) {
      console.error(err);
      addLog(`Error fetching admin data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery]);

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-[48px] font-black text-primary leading-none tracking-tight font-bai uppercase">Learning Cluster Admin</h1>
          <p className="text-[16px] text-on-surface-variant mt-2 max-w-2xl font-bai">Monitor the performance of the e-Learning media processing cluster and system telemetry.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-secondary text-white px-8 py-4 text-sm font-bold uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all sharp-edge disabled:opacity-50"
        >
          <span className={cn("material-symbols-outlined", loading && "animate-spin")}>sync</span>
          Refresh Stats
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-surface-container-highest p-8 flex flex-col justify-between border-l-8 border-secondary sharp-edge shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <span className="text-on-surface-variant uppercase text-xs font-black tracking-[0.2em]">Jobs Waiting</span>
            <span className="material-symbols-outlined text-secondary text-3xl">schedule</span>
          </div>
          <div>
            <div className="text-6xl font-black text-white mb-2 tracking-tighter">{stats.jobsWaiting}</div>
            <div className="text-[11px] text-secondary font-bold uppercase tracking-widest">In Processing Queue</div>
          </div>
        </div>

        <div className="bg-surface-container-highest p-8 flex flex-col justify-between border-l-8 border-primary-container sharp-edge shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <span className="text-on-surface-variant uppercase text-xs font-black tracking-[0.2em]">Active Workers</span>
            <span className="material-symbols-outlined text-white text-3xl">engineering</span>
          </div>
          <div>
            <div className="text-6xl font-black text-white mb-2 tracking-tighter">{stats.activeWorkers.toString().padStart(2, '0')}</div>
            <div className="text-[11px] text-white/60 font-bold uppercase tracking-widest">Transcoding Cluster Active</div>
          </div>
        </div>

        <div className="bg-surface-container-highest p-8 flex flex-col justify-between border-l-8 border-outline sharp-edge shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <span className="text-on-surface-variant uppercase text-xs font-black tracking-[0.2em]">Storage Used</span>
            <span className="material-symbols-outlined text-white text-3xl">database</span>
          </div>
          <div>
            <div className="text-6xl font-black text-white mb-2 tracking-tighter">{stats.storageUsed}</div>
            <div className="w-full bg-surface-container-high h-2 mt-4 sharp-edge overflow-hidden">
              <div className="bg-secondary h-full transition-all duration-1000" style={{ width: `${stats.storagePercentage}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/30 sharp-edge overflow-hidden shadow-2xl">
        <div className="bg-surface-container-low px-8 py-6 flex items-center justify-between border-b border-outline-variant/30">
          <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em]">Detailed Processing Queue</h3>
          <span className="px-4 py-1 bg-secondary/20 text-secondary text-[10px] font-black uppercase tracking-widest border border-secondary/30">Cluster-01 Active</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] text-outline uppercase tracking-[0.2em] bg-surface-container-lowest border-b border-outline-variant/30">
                <th className="px-8 py-5 font-black">Job ID</th>
                <th className="px-8 py-5 font-black">Video Source</th>
                <th className="px-8 py-5 font-black">Status</th>
                <th className="px-8 py-5 font-black">Quality</th>
                <th className="px-8 py-5 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {videos.map((video) => (
                <AdminJobRow key={video.id} video={video} onDelete={handleDeleteVideo} />
              ))}
              {videos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-outline italic font-bai">
                    No active jobs in the processing queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Hooks ---

const useVideoProgress = (videoId: string, initialStatus: string, initialProgress: number = 0) => {
  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status === 'ready' || status === 'error') return;
    const token = localStorage.getItem('aapico_token');
    const es = new EventSource(`${API_CONFIG.BASE_URL}/api/videos/${videoId}/progress?token=${token}`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.progress !== undefined) setProgress(data.progress);
        if (data.percent !== undefined) setProgress(data.percent);
        if (data.status) setStatus(data.status);
        if (data.status === 'ready' || data.status === 'error') es.close();
      } catch (err) { console.error('SSE Error:', err); }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [videoId, initialStatus]);
  return { progress, status };
};

// --- New SemiCircleProgress Component ---
const SemiCircleProgress = ({ progress }: { progress: number }) => {
  const radius = 40;
  const circumference = Math.PI * radius; // Half circle circumference
  const p = Math.max(0, Math.min(100, progress));
  const strokeDashoffset = circumference - (p / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-end w-24 h-12 mt-4">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
        {/* Background Track */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="currentColor"
          className="text-white/20"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Progress Arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="currentColor"
          className="text-secondary transition-all duration-700 ease-out"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      {/* Number Display */}
      <span className="absolute -bottom-2 text-[14px] font-black text-white drop-shadow-md">
        {Math.round(p)}%
      </span>
    </div>
  );
};

const VideoCardVideo = ({
  video,
  onPlay,
  onEdit,
  onDelete,
  editingVideoId,
  editTitle,
  setEditTitle,
  handleSaveTitle,
  setEditingVideoId
}: {
  video: Video,
  onPlay: any,
  onEdit: any,
  onDelete: any,
  editingVideoId: string | null,
  editTitle: string,
  setEditTitle: any,
  handleSaveTitle: any,
  setEditingVideoId: any
}) => {
  const { progress, status } = useVideoProgress(video.id, video.status, video.progress || 0);

  return (
    <div className="group bg-surface-container-lowest flex flex-col transition-all hover:translate-y-[-4px] border border-outline-variant/10 relative">
      <div className="relative aspect-video bg-tertiary overflow-hidden">

        {/* Real-time Progress Overlay with SemiCircle */}
        {(status === 'transcoding' || status === 'pending') && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-primary/80 backdrop-blur-sm transition-all duration-500">
            <SemiCircleProgress progress={progress} />
            <p className="mt-6 text-[10px] font-black text-white uppercase tracking-widest animate-pulse drop-shadow-lg">
              {status === 'transcoding' ? 'Optimizing Stream...' : 'In Queue...'}
            </p>
          </div>
        )}

        <img
          className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
          src={VideoService.getThumbnailUrl(video.id)}
          alt={video.title}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            const placeholder = img.parentElement?.querySelector('.thumb-placeholder');
            if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
          }}
        />
        <div className="thumb-placeholder absolute inset-0 bg-surface-container-highest items-center justify-center" style={{ display: 'none' }}>
          <span className="material-symbols-outlined text-outline text-5xl">videocam</span>
        </div>
        <div className="absolute inset-0 bg-primary/20 group-hover:bg-primary/0 transition-colors"></div>

        {/* Only show top-left status pill if it's ready or error. Hide during transcoding to avoid clutter */}
        {(status === 'ready' || status === 'error') && (
          <div className="absolute top-4 left-4 z-30">
            <span className={cn(
              "text-[10px] font-black px-2 py-1 uppercase tracking-tighter shadow-md",
              status === 'ready' ? "bg-secondary text-white" :
                status === 'error' ? "bg-error text-white" :
                  "bg-primary-container text-white"
            )}>
              {status}
            </span>
          </div>
        )}

        {status === 'ready' && video.duration && (
          <div className="absolute bottom-4 right-4 bg-tertiary/80 backdrop-blur-md px-2 py-1 text-[10px] text-white font-mono shadow-sm">{video.duration}</div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <span className="text-[10px] font-mono text-outline mb-1 uppercase tracking-widest">ID: {video.id.substring(0, 8).toUpperCase()}</span>
        {editingVideoId === video.id ? (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 bg-surface-container-low border border-primary p-2 text-sm font-bold font-bai sharp-edge outline-none"
              autoFocus
            />
            <button
              onClick={() => handleSaveTitle(video.id)}
              className="bg-primary text-white p-2 sharp-edge hover:brightness-110"
            >
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
            <button
              onClick={() => setEditingVideoId(null)}
              className="bg-error/10 text-error p-2 sharp-edge hover:bg-error/20"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        ) : (
          <h3 className="text-[24px] font-bold text-primary-container leading-tight mb-4 font-bai group-hover:text-primary transition-colors line-clamp-2">
            {video.title}
          </h3>
        )}

        <div className="mt-auto flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-1 pt-4 border-t border-surface-container">
            <button
              onClick={onEdit}
              className="flex items-center justify-center py-2 text-primary-container hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
            <button
              onClick={onPlay}
              disabled={status !== 'ready'}
              className="flex items-center justify-center py-2 text-primary-container hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">play_arrow</span>
            </button>
            <button
              onClick={onDelete}
              className="flex items-center justify-center py-2 text-error hover:bg-error-container/20 transition-colors"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('aapico_token');
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default function App() {
  const addLog = (message: string) => {
    // Top level app block
  };

  return (
    <BrowserRouter>
      <AppWrapper addLog={addLog} />
    </BrowserRouter>
  );
}

function AppWrapper({ addLog }: { addLog: (msg: string) => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const handleAddLog = (message: string) => {
    const newLog = {
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString(),
      message
    };
    setLogs(prev => [...prev, newLog]);
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage addLog={handleAddLog} />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppRoutes logs={logs} addLog={handleAddLog} />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function AppRoutes({ logs, addLog }: { logs: LogEntry[], addLog: (msg: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Layout logs={logs} addLog={addLog} currentPath={currentPath} searchQuery={searchQuery} setSearchQuery={setSearchQuery}>
      <Routes>
        <Route path="/upload" element={<UploadPage addLog={addLog} />} />
        <Route path="/library" element={<LibraryPage addLog={addLog} searchQuery={searchQuery} />} />
        <Route path="/admin" element={<AdminJobsPage addLog={addLog} searchQuery={searchQuery} />} />
        <Route path="/settings" element={<SettingsPage addLog={addLog} />} />
        <Route path="/" element={<Navigate to="/upload" />} />
      </Routes>
    </Layout>
  );
}