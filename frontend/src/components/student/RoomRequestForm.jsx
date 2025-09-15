import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  CalendarIcon,
  HomeIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

const RoomRequestForm = () => {
  const [formData, setFormData] = useState({
    preferred_room_type: '',
    preferred_floor: '',
    special_requirements: '',
    expires_at: ''
  });
  const [currentRequest, setCurrentRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [roomTypes, setRoomTypes] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchCurrentRequest();
    fetchRoomData();
  }, []);

  const fetchRoomData = async () => {
    try {
      setLoadingData(true);
      const response = await fetch('/api/room-allocation/room-options');
      const data = await response.json();
      
      console.log('Room options API response:', data);
      
      if (data.success) {
        console.log('Room types:', data.data.room_types);
        console.log('Floors:', data.data.floors);
        setRoomTypes(data.data.room_types);
        setFloors(data.data.floors);
      } else {
        console.error('API returned error:', data.message);
        // Fallback to default room types if API fails
        setRoomTypes([
          { value: 'standard', label: 'Standard', description: 'Basic room with shared facilities' },
          { value: 'deluxe', label: 'Deluxe', description: 'Enhanced room with better amenities' },
          { value: 'premium', label: 'Premium', description: 'Luxury room with premium features' },
          { value: 'suite', label: 'Suite', description: 'Spacious suite with private facilities' }
        ]);
        setFloors([1, 2, 3, 4, 5]);
      }
    } catch (error) {
      console.error('Error fetching room data:', error);
      // Fallback to default room types if network fails
      setRoomTypes([
        { value: 'standard', label: 'Standard', description: 'Basic room with shared facilities' },
        { value: 'deluxe', label: 'Deluxe', description: 'Enhanced room with better amenities' },
        { value: 'premium', label: 'Premium', description: 'Luxury room with premium features' },
        { value: 'suite', label: 'Suite', description: 'Spacious suite with private facilities' }
      ]);
      setFloors([1, 2, 3, 4, 5]);
    } finally {
      setLoadingData(false);
    }
  };

  const getRoomTypeDescription = (type) => {
    const descriptions = {
      'standard': 'Basic room with shared facilities',
      'deluxe': 'Enhanced room with better amenities',
      'premium': 'Luxury room with premium features',
      'suite': 'Spacious suite with private facilities',
      'economy': 'Budget-friendly room with essential amenities'
    };
    return descriptions[type] || 'Room with standard amenities';
  };

  const fetchCurrentRequest = async () => {
    try {
      const response = await fetch('/api/room-allocation/request', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.data.request) {
        setCurrentRequest(data.data.request);
      }
    } catch (error) {
      console.error('Error fetching current request:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/room-allocation/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        setSubmitted(true);
        setCurrentRequest(data.data.request);
        setFormData({
          preferred_room_type: '',
          preferred_floor: '',
          special_requirements: '',
          expires_at: ''
        });
      } else {
        setError(data.message || 'Failed to submit request');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!currentRequest) return;
    
    try {
      const response = await fetch(`/api/room-allocation/request/${currentRequest.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setCurrentRequest(null);
        setSubmitted(false);
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
    }
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
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'pending':
        return <ClockIcon className="w-5 h-5" />;
      case 'waitlisted':
        return <UserGroupIcon className="w-5 h-5" />;
      default:
        return <ExclamationTriangleIcon className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // If user already has a request, show status
  if (currentRequest) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(currentRequest.status)}`}>
              {getStatusIcon(currentRequest.status)}
              {currentRequest.status.charAt(0).toUpperCase() + currentRequest.status.slice(1)}
            </div>
            <h2 className="text-xl font-semibold mt-4">Room Request Status</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Requested At</label>
                <p className="text-sm text-gray-900">{formatDate(currentRequest.requested_at)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority Score</label>
                <p className="text-sm text-gray-900">{currentRequest.priority_score}</p>
              </div>
            </div>

            {currentRequest.preferred_room_type && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred Room Type</label>
                <p className="text-sm text-gray-900 capitalize">{currentRequest.preferred_room_type}</p>
              </div>
            )}

            {currentRequest.preferred_floor && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred Floor</label>
                <p className="text-sm text-gray-900">Floor {currentRequest.preferred_floor}</p>
              </div>
            )}

            {currentRequest.special_requirements && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Special Requirements</label>
                <p className="text-sm text-gray-900">{currentRequest.special_requirements}</p>
              </div>
            )}

            {currentRequest.allocated_room && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2">Allocated Room</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Room Number:</span> {currentRequest.allocated_room.room_number}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {currentRequest.allocated_room.room_type}
                  </div>
                  <div>
                    <span className="font-medium">Floor:</span> {currentRequest.allocated_room.floor}
                  </div>
                  {currentRequest.allocated_room.price && (
                    <div>
                      <span className="font-medium">Price:</span> ₹{currentRequest.allocated_room.price}/month
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentRequest.waitlist_position && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Waitlist Information</h3>
                <p className="text-sm text-blue-700">
                  You are position #{currentRequest.waitlist_position} on the waitlist.
                </p>
              </div>
            )}

            {currentRequest.expires_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Request Expires</label>
                <p className="text-sm text-gray-900">{formatDate(currentRequest.expires_at)}</p>
              </div>
            )}

            {currentRequest.status === 'pending' && (
              <div className="pt-4 border-t">
                <button
                  onClick={handleCancelRequest}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Cancel Request
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show request form
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <HomeIcon className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Request Room Allocation</h2>
          <p className="text-gray-600 mt-2">Submit your preferences for room allocation</p>
        </div>

        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-green-800">Request submitted successfully!</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Room Type
            </label>
            {loadingData ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Loading room types...</span>
              </div>
            ) : (
              <div>
                <select
                  value={formData.preferred_room_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, preferred_room_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select room type (optional)</option>
                  {roomTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
                {roomTypes.length === 0 && (
                  <p className="text-sm text-red-500 mt-1">No room types available. Please contact admin.</p>
                )}
                {roomTypes.length > 0 && (
                  <p className="text-sm text-green-600 mt-1">✓ {roomTypes.length} room types loaded from database</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Floor (Optional)
            </label>
            <select
              value={formData.preferred_floor}
              onChange={(e) => setFormData(prev => ({ ...prev, preferred_floor: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any floor</option>
              {floors.map((floor) => (
                <option key={floor} value={floor}>
                  Floor {floor}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Requirements (Optional)
            </label>
            <textarea
              value={formData.special_requirements}
              onChange={(e) => setFormData(prev => ({ ...prev, special_requirements: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any special requirements or preferences..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Request Expiration Date (Optional)
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for no expiration
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">Allocation Priority</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Earlier requests get higher priority</li>
              <li>• Your role and account seniority affect priority</li>
              <li>• You'll be notified when a room is allocated</li>
              <li>• If no rooms are available, you'll be added to the waitlist</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RoomRequestForm;
