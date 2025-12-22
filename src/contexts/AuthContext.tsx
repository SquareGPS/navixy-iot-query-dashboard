import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, role: 'admin' | 'editor' | 'viewer', iotDbUrl: string, userDbUrl: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing token in localStorage
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      // Verify token and get user info
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const text = await response.text();
        if (!text) {
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
          return;
        }
        try {
          const data = JSON.parse(text);
          if (data.success && data.user) {
            setUser(data.user);
            setToken(tokenToVerify);
          } else {
            localStorage.removeItem('auth_token');
            setToken(null);
            setUser(null);
          }
        } catch {
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
        }
      } else {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (
    email: string,
    role: 'admin' | 'editor' | 'viewer',
    iotDbUrl: string,
    userDbUrl: string
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role, iotDbUrl, userDbUrl }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Login failed';
        try {
          const data = JSON.parse(text);
          errorMessage = data.error?.message || data.message || errorMessage;
        } catch {
          errorMessage = text || `HTTP ${response.status}`;
        }
        return { error: new Error(errorMessage) };
      }

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('auth_token', data.token);
        navigate('/app');
        return { error: null };
      } else {
        return { error: new Error(data.error?.message || 'Login failed') };
      }
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Network error') };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  const refreshUser = async () => {
    if (token) {
      await verifyToken(token);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      signIn,
      signOut, 
      refreshUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
