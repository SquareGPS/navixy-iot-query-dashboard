import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';

const AppPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-4xl font-bold text-foreground">Welcome to Reports MVP</h1>
          <p className="text-muted-foreground text-lg">
            Select a report from the sidebar to get started
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default AppPage;
