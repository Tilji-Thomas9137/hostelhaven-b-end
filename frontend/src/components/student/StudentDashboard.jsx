import React, { useState, useEffect } from 'react';
import { 
  HomeIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  UserGroupIcon,
  EyeIcon,
  XMarkIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import RoomRequestForm from './RoomRequestForm';

const StudentDashboard = () => {
  const [currentRequest, setCurrentRequest] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCurrentRequest(),
        fetchAvailableRooms()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
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

  const fetchAvailableRooms = async () => {
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
        alert('Request cancelled successfully');
      } else {
        alert('Failed to cancel request: ' + data.message);
      }
    } catch (error) {
      alert('Error cancelling request');
    }
  };

  const handleDeleteRequest = async () => {
    if (!currentRequest) return;
    
    if (!confirm('Are you sure you want to delete this request? This action cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/room-allocation/request/${currentRequest.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setCurrentRequest(null);
        alert('Request deleted successfully');
      } else {
        alert('Failed to delete request: ' + data.message);
      }
    } catch (error) {
      alert('Error deleting request');
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
          <h1 className="text-2xl font-bold text-gray-900">My Room Allocation</h1>
          <p className="text-gray-600 mt-1">Manage your room request and view available rooms</p>
        </div>
        {!currentRequest && (
          <button
            onClick={() => setShowRequestForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Request Room
          </button>
        )}
      </div>

      {/* Current Request Status */}
      {currentRequest ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Current Request Status</h2>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentRequest.status)}`}>
              {getStatusIcon(currentRequest.status)}
              {currentRequest.status.charAt(0).toUpperCase() + currentRequest.status.slice(1)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Requested At</label>
                <p className="text-sm text-gray-900">{formatDate(currentRequest.requested_at)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority Score</label>
                <p className="text-sm text-gray-900">{currentRequest.priority_score}</p>
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
            </div>

            <div className="space-y-4">
              {currentRequest.special_requirements && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Requirements</label>
                  <p className="text-sm text-gray-900">{currentRequest.special_requirements}</p>
                </div>
              )}

              {currentRequest.waitlist_position && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Waitlist Position</label>
                  <p className="text-sm text-blue-600 font-medium">#{currentRequest.waitlist_position}</p>
                </div>
              )}

              {currentRequest.expires_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Request Expires</label>
                  <p className="text-sm text-gray-900">{formatDate(currentRequest.expires_at)}</p>
                </div>
              )}
            </div>
          </div>

          {currentRequest.allocated_room && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800 mb-2">🎉 Congratulations! You've been allocated a room</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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

          {currentRequest.status === 'pending' && (
            <div className="mt-6 flex gap-2">
              <button
                onClick={handleCancelRequest}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Cancel Request
              </button>
              <button
                onClick={handleDeleteRequest}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Delete Request
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <HomeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Room Request</h3>
          <p className="text-gray-600 mb-4">You haven't submitted a room request yet.</p>
          <button
            onClick={() => setShowRequestForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Submit Room Request
          </button>
        </div>
      )}

      {/* Available Rooms */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Available Rooms</h2>
          <button
            onClick={fetchAvailableRooms}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Refresh
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-8">
            <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Available Rooms</h3>
            <p className="text-gray-600">All rooms are currently occupied or under maintenance.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div key={room.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900">Room {room.room_number}</h3>
                  <span className="text-sm text-gray-500">{room.room_type}</span>
                </div>
                
                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  <div>Floor: {room.floor}</div>
                  <div>Capacity: {room.occupied || room.current_occupancy || 0} / {room.capacity}</div>
                  <div className="text-green-600 font-medium">
                    Available: {room.available_spots} spots
                  </div>
                  {room.price && (
                    <div>Price: ₹{room.price}/month</div>
                  )}
                </div>

                {room.amenities && room.amenities.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Amenities:</div>
                    <div className="flex flex-wrap gap-1">
                      {room.amenities.slice(0, 3).map((amenity, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {amenity}
                        </span>
                      ))}
                      {room.amenities.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{room.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setSelectedRoom(room);
                    setShowRoomDetails(true);
                  }}
                  className="w-full bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 text-sm flex items-center justify-center gap-1"
                >
                  <EyeIcon className="w-4 h-4" />
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Room Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Submit Room Request</h2>
              <button
                onClick={() => setShowRequestForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <RoomRequestForm onSuccess={() => {
              setShowRequestForm(false);
              fetchData();
            }} />
          </div>
        </div>
      )}

      {/* Room Details Modal */}
      {showRoomDetails && selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Room Details</h2>
              <button
                onClick={() => setShowRoomDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Room {selectedRoom.room_number}</h3>
                <p className="text-sm text-gray-600">{selectedRoom.room_type} • Floor {selectedRoom.floor}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Capacity:</span>
                  <p className="text-gray-900">{selectedRoom.occupied || selectedRoom.current_occupancy || 0} / {selectedRoom.capacity}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Available:</span>
                  <p className="text-green-600 font-medium">{selectedRoom.available_spots} spots</p>
                </div>
                {selectedRoom.price && (
                  <div>
                    <span className="font-medium text-gray-700">Price:</span>
                    <p className="text-gray-900">₹{selectedRoom.price}/month</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <p className="text-gray-900 capitalize">{selectedRoom.status}</p>
                </div>
              </div>

              {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700 text-sm">Amenities:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRoom.amenities.map((amenity, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowRoomDetails(false)}
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

export default StudentDashboard;
