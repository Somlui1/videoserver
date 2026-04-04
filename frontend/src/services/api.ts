import { API_CONFIG } from '../config';

/**
 * Service to handle all API calls to the AAPICO Video Server (Fastify Backend)
 */

const getHeaders = (isFormData = false) => {
  const token = localStorage.getItem('aapico_token');
  const headers: any = {
    'Authorization': token ? `Bearer ${token}` : '',
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

export const VideoService = {
  /**
   * Authenticate with credentials using the Fastify Backend
   */
  async login(email: string, password: string) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      localStorage.setItem('aapico_token', data.token);
      localStorage.setItem('aapico_user', JSON.stringify({
        email: email,
        role: data.role || 'viewer'
      }));

      return data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Authentication failed');
    }
  },

  /**
   * Logout from the system
   */
  async logout() {
    localStorage.removeItem('aapico_token');
    localStorage.removeItem('aapico_user');
  },

  /**
   * Fetch all videos from the Fastify Backend
   */
  async getVideos(params?: { search?: string; page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set('search', params.search);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const url = `${API_CONFIG.BASE_URL}/api/videos${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch videos');
    }
    
    // The Fastify backend returns { data: [...] }
    return data.data;
  },

  /**
   * Placeholder for real-time updates (replaces Firebase onSnapshot)
   */
  subscribeToVideos(callback: (videos: any[]) => void) {
    console.warn('Real-time subscriptions are not supported on the standard REST API. Use polling instead.');
    return () => {}; // return empty unsubscribe function
  },

  /**
   * Upload a new video using FormData
   */
  async uploadVideo(formData: FormData) {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/videos/upload`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    
    return data;
  },

  /**
   * Get the status of a video for polling
   */
  async getVideoStatus(videoId: string) {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/videos/${videoId}/status`, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch status');
    }
    
    return data;
  },

  /**
   * Update video metadata (Uses the admin patch route)
   */
  async updateVideo(id: string, data: any) {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/videos/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update video');
    }
    return result;
  },

  /**
   * Delete a video from the system
   */
  async deleteVideo(id: string) {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/videos/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete video');
    }
    
    return data;
  },

  /**
   * Get system statistics (from the admin routes)
   */
  async getStats() {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/jobs`, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch stats');
    }
    
    // Map the worker stats to the UI's expected format
    return {
      jobsWaiting: data.waiting || 0,
      activeWorkers: data.active || 0,
      completedJobs: data.completed || 0,
      failedJobs: data.failed || 0,
      storageUsed: "N/A",
      storagePercentage: 0
    };
  },

  /**
   * Get admin videos (from admin route for full details)
   */
  async getAdminVideos() {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/videos`, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch admin videos');
    }
    
    return data.data;
  },

  /**
   * Get system health status
   */
  async getHealth() {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/health`, {
        method: 'GET',
      });
      const data = await response.json();
      return data;
    } catch {
      return { status: 'error', db: 'error', timestamp: new Date().toISOString() };
    }
  },

  /**
   * Get the HLS stream URL for a video
   */
  getHlsUrl(videoId: string) {
    return `${API_CONFIG.VIDEO_SERVER_URL}/hls/${videoId}/master.m3u8`;
  },

  /**
   * Get the thumbnail URL for a video
   */
  getThumbnailUrl(videoId: string) {
    return `${API_CONFIG.VIDEO_SERVER_URL}/thumbnails/${videoId}.jpg`;
  }
};
