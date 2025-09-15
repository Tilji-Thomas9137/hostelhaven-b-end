import React, { useState, useEffect } from 'react';
import { 
  PlayIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  UserGroupIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const AllocationDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    room_type: ''
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [roomTypes, setRoomTypes] = useState([]);

  useEffect(() => {
    fetchData();
    fetchRoomOptions();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchRequests(),
        fetchRooms()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.room_type) queryParams.append('room_type', filters.room_type);

      const response = await fetch(`/api/room-allocation/requests?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setRequests(data.data.requests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/room-allocation/rooms?status=available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setRooms(data.data.rooms.filter(room => room.is_available));
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchRoomOptions = async () => {
    try {
      const response = await fetch('/api/room-allocation/room-options');
      const data = await response.json();
      
      if (data.success) {
        setRoomTypes(data.data.room_types);
      }
    } catch (error) {
      console.error('Error fetching room options:', error);
    }
  };

  const handleBatchAllocation = async () => {
    try {
      setBatchLoading(true);
      const response = await fetch('/api/room-allocation/batch-allocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          batch_name: `Batch Allocation - ${new Date().toLocaleString()}`
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Batch allocation completed successfully!');
        fetchData();
      } else {
        alert('Batch allocation failed: ' + data.message);
      }
    } catch (error) {
      alert('Error running batch allocation');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleProcessWaitlist = async () => {
    try {
      setWaitlistLoading(true);
      const response = await fetch('/api/room-allocation/process-waitlist', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert(`Processed ${data.data.processed_count} waitlist entries`);
        fetchData();
      } else {
        alert('Waitlist processing failed: ' + data.message);
      }
    } catch (error) {
      alert('Error processing waitlist');
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleManualAllocation = async (requestId, roomId) => {
    try {
      const response = await fetch(`/api/room-allocation/requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ room_id: roomId })
      });

      const data = await response.json();
      if (data.success) {
        alert('Room allocated successfully!');
        setShowAllocationModal(false);
        setSelectedRequest(null);
        fetchData();
      } else {
        alert('Allocation failed: ' + data.message);
      }
    } catch (error) {
      alert('Error allocating room');
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    try {
      const response = await fetch(`/api/room-allocation/requests/${requestId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('Request cancelled successfully');
        fetchData();
      } else {
        alert('Failed to cancel request: ' + data.message);
      }
    } catch (error) {
      alert('Error cancelling request');
    }
  };

  const openAllocationModal = (request) => {
    setSelectedRequest(request);
    setAvailableRooms(rooms.filter(room => 
      room.is_available && 
      (!request.preferred_room_type || room.room_type === request.preferred_room_type) &&
      (!request.preferred_floor || room.floor === request.preferred_floor)
    ));
    setSelectedRoomId('');
    setShowAllocationModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'allocated':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'waitlisted':
        return 'text-blue-600 bg-blue-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'allocated':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4" />;
      case 'waitlisted':
        return <UserGroupIcon className="w-4 h-4" />;
      default:
        return <ExclamationTriangleIcon className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <h1 className="text-2xl font-bold text-gray-900">Room Allocation Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={handleProcessWaitlist}
            disabled={waitlistLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            {waitlistLoading ? 'Processing...' : 'Process Waitlist'}
          </button>
          <button
            onClick={handleBatchAllocation}
            disabled={batchLoading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <PlayIcon className="w-4 h-4" />
            {batchLoading ? 'Running...' : 'Run Batch Allocation'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="allocated">Allocated</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
            <select
              value={filters.room_type}
              onChange={(e) => setFilters(prev => ({ ...prev, room_type: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Types</option>
              {roomTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', room_type: '' })}
              className="w-full bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Room Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Preferences
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {request.users?.full_name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {request.users?.email || 'No email'}
                      </div>
                      {request.users?.user_profiles && (
                        <div className="text-xs text-gray-400">
                          {request.users.user_profiles.admission_number} • {request.users.user_profiles.course}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {request.preferred_room_type && (
                        <div>Type: {request.preferred_room_type}</div>
                      )}
                      {request.preferred_floor && (
                        <div>Floor: {request.preferred_floor}</div>
                      )}
                      {request.special_requirements && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {request.special_requirements}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status}
                    </span>
                    {request.allocated_room && (
                      <div className="text-xs text-gray-500 mt-1">
                        Room: {request.allocated_room.room_number}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.priority_score}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(request.requested_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {request.status === 'pending' && (
                        <button
                          onClick={() => openAllocationModal(request)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Allocate
                        </button>
                      )}
                      <button
                        onClick={() => handleCancelRequest(request.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Allocation Modal */}
      {showAllocationModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Allocate Room</h2>
              <button
                onClick={() => setShowAllocationModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Student: {selectedRequest.users?.full_name}</h3>
              <div className="text-sm text-gray-600">
                <div>Preferred Type: {selectedRequest.preferred_room_type || 'Any'}</div>
                <div>Preferred Floor: {selectedRequest.preferred_floor || 'Any'}</div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Room</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Choose a room...</option>
                {availableRooms.map(room => (
                  <option key={room.id} value={room.id}>
                    Room {room.room_number} - {room.room_type} (Floor {room.floor}) - {room.available_spots} spots
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAllocationModal(false)}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleManualAllocation(selectedRequest.id, selectedRoomId)}
                disabled={!selectedRoomId}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Allocate Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllocationDashboard;
