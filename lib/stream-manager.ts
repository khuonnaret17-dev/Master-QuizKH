import { spawn, ChildProcess } from 'child_process';

export interface StreamSession {
  id: string;
  rtmpUrl: string;
  streamKey: string;
  isTestMode: boolean;
  ffmpeg: ChildProcess | null;
  createdAt: number;
  lastChunkAt: number;
  totalBytes: number;
  chunksCount: number;
  status: 'initializing' | 'streaming' | 'stopped' | 'error';
  errorMsg: string | null;
  logs: string[];
  width: number;
  height: number;
  fps: number;
  bitrate: string;
}

// Global declaration to survive Next.js module reloading
const globalSessions = globalThis as unknown as {
  __streamSessions?: Map<string, StreamSession>;
};

if (!globalSessions.__streamSessions) {
  globalSessions.__streamSessions = new Map<string, StreamSession>();
}

const sessions = globalSessions.__streamSessions;

// Clean up stale sessions older than 5 minutes without activity
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.status !== 'stopped' && now - session.lastChunkAt > 45000) {
      console.log(`[StreamManager] Auto-terminating inactive session: ${id}`);
      stopStreamSession(id, 'Session timed out due to lack of input chunks');
    }
  }
}, 15000);

export function getStreamSession(id: string): StreamSession | undefined {
  return sessions.get(id);
}

export function listStreamSessions(): StreamSession[] {
  return Array.from(sessions.values());
}

export interface StartStreamOptions {
  rtmpUrl: string;
  streamKey: string;
  isTestMode?: boolean;
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: string;
  audioBitrate?: string;
}

export function startStreamSession(options: StartStreamOptions): { session: StreamSession; error?: string } {
  const {
    rtmpUrl,
    streamKey,
    isTestMode = false,
    width = 1280,
    height = 720,
    fps = 30,
    videoBitrate = '2500k',
    audioBitrate = '128k',
  } = options;

  const id = `live_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Construct target URL for Telegram RTMP Ingest
  let fullTargetUrl = '';
  if (!isTestMode) {
    let cleanUrl = (rtmpUrl || '').trim();
    if (!cleanUrl) {
      cleanUrl = 'rtmps://dc4-1.rtmp.t.me/s/';
    }
    if (!cleanUrl.toLowerCase().startsWith('rtmp://') && !cleanUrl.toLowerCase().startsWith('rtmps://')) {
      cleanUrl = `rtmps://${cleanUrl}`;
    }
    const cleanKey = (streamKey || '').trim().replace(/^["']|["']$/g, '');
    if (cleanUrl.endsWith('/')) {
      fullTargetUrl = `${cleanUrl}${cleanKey}`;
    } else {
      fullTargetUrl = `${cleanUrl}/${cleanKey}`;
    }
  }

  const session: StreamSession = {
    id,
    rtmpUrl,
    streamKey,
    isTestMode,
    ffmpeg: null,
    createdAt: Date.now(),
    lastChunkAt: Date.now(),
    totalBytes: 0,
    chunksCount: 0,
    status: 'initializing',
    errorMsg: null,
    logs: [`[${new Date().toLocaleTimeString()}] Session created: ${id}`],
    width,
    height,
    fps,
    bitrate: videoBitrate,
  };

  sessions.set(id, session);

  if (isTestMode) {
    // In test mode, we just consume chunks or transcode to null output
    session.logs.push(`[${new Date().toLocaleTimeString()}] Test Mode active: local diagnostic stream`);
    session.status = 'streaming';
    return { session };
  }

  // Telegram RTMP broadcast parameters
  // Telegram expects H.264 video (YUV420p) + AAC audio in an FLV container
  const ffmpegArgs: string[] = [
    '-fflags', '+nobuffer', // Disable buffering for ultra-low latency input reading
    '-flags', '+low_delay', // Configure decoder for lowest possible processing delay
    '-i', 'pipe:0', // Read WebM from stdin (chunks fed in real-time)
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-g', `${fps}`, // 1-second keyframe GOP for quick Telegram player sync
    '-keyint_min', `${fps}`,
    '-b:v', videoBitrate,
    '-maxrate', videoBitrate,
    '-bufsize', videoBitrate, // Match bufsize with videoBitrate for smooth CBR control
    '-c:a', 'aac',
    '-b:a', audioBitrate,
    '-ar', '44100',
    '-f', 'flv',
    fullTargetUrl,
  ];

  try {
    session.logs.push(`[${new Date().toLocaleTimeString()}] Spawning ffmpeg to: ${fullTargetUrl.replace(streamKey, '***KEY***')}`);
    const ff = spawn('ffmpeg', ffmpegArgs);

    session.ffmpeg = ff;
    session.status = 'streaming';

    if (ff.stdin) {
      ff.stdin.on('error', (err: Error) => {
        // Handled silently or logged into session logs to prevent Node crash
        session.logs.push(`[stdin info] ${err.message}`);
      });
    }

    ff.stdout.on('data', (data: Buffer) => {
      const msg = data.toString();
      session.logs.push(`[stdout] ${msg.trim()}`);
      if (session.logs.length > 50) session.logs.shift();
    });

    ff.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      // Filter noisy frame logs, keep meaningful connection/error messages
      const trimmed = msg.trim();
      if (trimmed.length > 0) {
        session.logs.push(`[ffmpeg] ${trimmed.substring(0, 160)}`);
        if (session.logs.length > 60) session.logs.shift();
      }
    });

    ff.on('error', (err: Error) => {
      console.error(`[StreamManager] FFmpeg process error (${id}):`, err);
      session.status = 'error';
      session.errorMsg = err.message;
      session.logs.push(`[error] ${err.message}`);
    });

    ff.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      console.log(`[StreamManager] FFmpeg closed (${id}) code=${code} signal=${signal}`);
      if (session.status !== 'stopped') {
        session.status = code === 0 ? 'stopped' : 'error';
        if (code !== 0 && !session.errorMsg) {
          session.errorMsg = `FFmpeg exited with code ${code}`;
        }
      }
      session.logs.push(`[${new Date().toLocaleTimeString()}] Stream process ended (code: ${code})`);
      session.ffmpeg = null;
    });

    return { session };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    session.status = 'error';
    session.errorMsg = errorMsg;
    session.logs.push(`[error] Spawn failed: ${errorMsg}`);
    return { session, error: errorMsg };
  }
}

export function writeStreamChunk(id: string, chunk: Buffer): { success: boolean; error?: string } {
  const session = sessions.get(id);
  if (!session) {
    return { success: false, error: 'Session not found or expired' };
  }

  session.lastChunkAt = Date.now();
  session.totalBytes += chunk.length;
  session.chunksCount += 1;

  if (session.isTestMode) {
    return { success: true };
  }

  if (!session.ffmpeg || !session.ffmpeg.stdin || session.ffmpeg.stdin.destroyed) {
    return { success: false, error: 'FFmpeg process is not running or stdin is closed' };
  }

  try {
    const ok = session.ffmpeg.stdin.write(chunk);
    if (!ok) {
      // Buffer full, stdin will drain soon
    }
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    session.errorMsg = errorMsg;
    return { success: false, error: errorMsg };
  }
}

export function stopStreamSession(id: string, reason = 'User requested stop'): { success: boolean; session?: StreamSession } {
  const session = sessions.get(id);
  if (!session) {
    return { success: false };
  }

  session.status = 'stopped';
  session.logs.push(`[${new Date().toLocaleTimeString()}] Stopping session: ${reason}`);

  if (session.ffmpeg) {
    try {
      if (session.ffmpeg.stdin && !session.ffmpeg.stdin.destroyed) {
        session.ffmpeg.stdin.end();
      }
      setTimeout(() => {
        if (session.ffmpeg && !session.ffmpeg.killed) {
          try {
            session.ffmpeg.kill('SIGTERM');
          } catch {
            // Ignore
          }
        }
      }, 3000);
    } catch (err) {
      console.error('[StreamManager] Error closing ffmpeg process:', err);
    }
  }

  return { success: true, session };
}
