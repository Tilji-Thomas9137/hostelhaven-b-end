import React, { useState, useEffect } from 'react';
import { 
  HomeIcon, 
  UserGroupIcon, 
  ChartBarIcon, 
  CogIcon,
  UserIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

// Import all components
import RoomManagement from './admin/RoomManagement';
import AllocationDashboard from './admin/AllocationDashboard';
import WaitlistManagement from './admin/WaitlistManagement';
import AllocationStatistics from './admin/AllocationStatistics';
import StudentDashboard from './student/StudentDashboard';

const RoomAllocationApp = () => {
  const [currentView, setCurrentView] = useState('student-dashboard');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setUser(data.data.user);
        // Set default view based on user role
        if (data.data.user.role === 'admin' || data.data.user.role === 'hostel_operations_assistant') {
          setCurrentView('allocation-dashboard');
        } else {
          setCurrentView('student-dashboard');
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'hostel_operations_assistant';

  const adminNavigation = [
    { id: 'room-management', name: 'Room Management', icon: HomeIcon, description: 'Manage rooms and availability' },
    { id: 'allocation-dashboard', name: 'Allocation Dashboard', icon: UserGroupIcon, description: 'Process room requests and allocations' },
    { id: 'waitlist-management', name: 'Waitlist Management', icon: UserGroupIcon, description: 'Manage waitlisted students' },
    { id: 'statistics', name: 'Statistics', icon: ChartBarIcon, description: 'View allocation statistics and reports' }
  ];

  const studentNavigation = [
    { id: 'student-dashboard', name: 'My Room Request', icon: HomeIcon, description: 'View and manage your room request' }
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'room-management':
        return <RoomManagement />;
      case 'allocation-dashboard':
        return <AllocationDashboard />;
      case 'waitlist-management':
        return <WaitlistManagement />;
      case 'statistics':
        return <AllocationStatistics />;
      case 'student-dashboard':
        return <StudentDashboard />;
      default:
        return <StudentDashboard />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <HomeIcon className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">HostelHaven Room Allocation</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <UserIcon className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user?.full_name || 'User'}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {user?.role || 'student'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600 flex items-center space-x-1"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64">
            <nav className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                {isAdmin ? 'Admin Panel' : 'Student Portal'}
              </h2>
              
              {(isAdmin ? adminNavigation : studentNavigation).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    currentView === item.id
                      ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {renderCurrentView()}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; 2024 HostelHaven. All rights reserved.</p>
            <p className="mt-1">Room Allocation System v1.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RoomAllocationApp;
