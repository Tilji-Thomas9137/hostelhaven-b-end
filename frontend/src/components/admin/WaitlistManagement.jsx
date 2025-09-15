import React, { useState, useEffect } from 'react';
import { 
  UserGroupIcon, 
  ClockIcon, 
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  PhoneIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';

const WaitlistManagement = () => {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchWaitlist();
  }, []);

  const fetchWaitlist = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/room-allocation/waitlist', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setWaitlist(data.data.waitlist);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessWaitlist = async () => {
    try {
      setProcessing(true);
      const response = await fetch('/api/room-allocation/process-waitlist', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert(`Processed ${data.data.processed_count} waitlist entries`);
        fetchWaitlist();
      } else {
        alert('Waitlist processing failed: ' + data.message);
      }
    } catch (error) {
      alert('Error processing waitlist');
    } finally {
      setProcessing(false);
    }
  };

  const getPriorityColor = (priority) => {
    if (priority >= 10000) return 'text-purple-600 bg-purple-100';
    if (priority >= 8000) return 'text-blue-600 bg-blue-100';
    if (priority >= 6000) return 'text-green-600 bg-green-100';
    if (priority >= 1000) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getPriorityLabel = (priority) => {
    if (priority >= 10000) return 'Admin';
    if (priority >= 8000) return 'Warden';
    if (priority >= 6000) return 'Staff';
    if (priority >= 1000) return 'Student';
    return 'Guest';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeOnWaitlist = (addedAt) => {
    const now = new Date();
    const added = new Date(addedAt);
    const diffInHours = Math.floor((now - added) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours} hours`;
    } else {
      const days = Math.floor(diffInHours / 24);
      return `${days} days`;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waitlist Management</h1>
          <p className="text-gray-600 mt-1">
            {waitlist.length} students currently on waitlist
          </p>
        </div>
        <button
          onClick={handleProcessWaitlist}
          disabled={processing || waitlist.length === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <ArrowPathIcon className="w-4 h-4" />
          {processing ? 'Processing...' : 'Process Waitlist'}
        </button>
      </div>

      {/* Waitlist Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <UserGroupIcon className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Waitlist</p>
              <p className="text-2xl font-semibold text-gray-900">{waitlist.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <ClockIcon className="w-8 h-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Average Wait Time</p>
              <p className="text-2xl font-semibold text-gray-900">
                {waitlist.length > 0 
                  ? getTimeOnWaitlist(waitlist[0]?.added_at) 
                  : '0 hours'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">High Priority</p>
              <p className="text-2xl font-semibold text-gray-900">
                {waitlist.filter(entry => entry.priority_score >= 10000).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Ready to Process</p>
              <p className="text-2xl font-semibold text-gray-900">
                {waitlist.filter(entry => entry.priority_score >= 1000).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Waitlist Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Waitlist Entries</h2>
        </div>
        
        {waitlist.length === 0 ? (
          <div className="text-center py-12">
            <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No waitlist entries</h3>
            <p className="text-gray-500">All students have been allocated rooms or no requests are pending.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preferences
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wait Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {waitlist.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg font-semibold text-gray-900">
                          #{entry.position}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {entry.user?.full_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {entry.user?.email || 'No email'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <a 
                            href={`tel:${entry.user?.phone}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <PhoneIcon className="w-4 h-4" />
                          </a>
                          <a 
                            href={`mailto:${entry.user?.email}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <EnvelopeIcon className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {entry.preferred_room_type && (
                          <div>Type: {entry.preferred_room_type}</div>
                        )}
                        {entry.room_request?.special_requirements && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {entry.room_request.special_requirements}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(entry.priority_score)}`}>
                        {getPriorityLabel(entry.priority_score)}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        Score: {entry.priority_score}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(entry.added_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getTimeOnWaitlist(entry.added_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedEntry(entry);
                          setShowDetailsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <EyeIcon className="w-4 h-4" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Waitlist Entry Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Position</label>
                  <p className="text-sm text-gray-900">#{selectedEntry.position}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority Score</label>
                  <p className="text-sm text-gray-900">{selectedEntry.priority_score}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Student Information</label>
                <div className="mt-1 text-sm text-gray-900">
                  <div><strong>Name:</strong> {selectedEntry.user?.full_name || 'Unknown'}</div>
                  <div><strong>Email:</strong> {selectedEntry.user?.email || 'No email'}</div>
                  {selectedEntry.user?.phone && (
                    <div><strong>Phone:</strong> {selectedEntry.user.phone}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Room Preferences</label>
                <div className="mt-1 text-sm text-gray-900">
                  <div><strong>Preferred Type:</strong> {selectedEntry.preferred_room_type || 'Any'}</div>
                  {selectedEntry.room_request?.special_requirements && (
                    <div><strong>Special Requirements:</strong> {selectedEntry.room_request.special_requirements}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Added to Waitlist</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedEntry.added_at)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Wait Time</label>
                  <p className="text-sm text-gray-900">{getTimeOnWaitlist(selectedEntry.added_at)}</p>
                </div>
              </div>

              {selectedEntry.expires_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Expires At</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedEntry.expires_at)}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaitlistManagement;
