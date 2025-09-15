import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  HomeIcon, 
  UserGroupIcon, 
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const AllocationStatistics = () => {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchStatistics();
  }, [timeRange]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/room-allocation/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setStatistics(data.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOccupancyColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getOccupancyStatus = (percentage) => {
    if (percentage >= 90) return 'Critical';
    if (percentage >= 75) return 'High';
    return 'Good';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
        <p className="text-gray-500">Unable to load statistics at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Allocation Statistics</h1>
          <p className="text-gray-600 mt-1">Monitor room allocation performance and occupancy</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={fetchStatistics}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Rooms */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <HomeIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Rooms</p>
              <p className="text-2xl font-semibold text-gray-900">{statistics.rooms.total}</p>
            </div>
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <ChartBarIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Occupancy Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {statistics.rooms.occupancy_rate}%
              </p>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getOccupancyColor(parseFloat(statistics.rooms.occupancy_rate))}`}>
                {getOccupancyStatus(parseFloat(statistics.rooms.occupancy_rate))}
              </span>
            </div>
          </div>
        </div>

        {/* Available Rooms */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Available Rooms</p>
              <p className="text-2xl font-semibold text-gray-900">{statistics.rooms.available}</p>
            </div>
          </div>
        </div>

        {/* Total Requests */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <UserGroupIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Requests</p>
              <p className="text-2xl font-semibold text-gray-900">{statistics.requests.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Room Statistics */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Room Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Capacity</span>
              <span className="text-sm font-medium text-gray-900">{statistics.rooms.total_capacity}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Occupied</span>
              <span className="text-sm font-medium text-gray-900">{statistics.rooms.total_occupied}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Available Rooms</span>
              <span className="text-sm font-medium text-green-600">{statistics.rooms.available}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Occupancy Rate</span>
              <span className={`text-sm font-medium ${getOccupancyColor(parseFloat(statistics.rooms.occupancy_rate))}`}>
                {statistics.rooms.occupancy_rate}%
              </span>
            </div>
          </div>
          
          {/* Occupancy Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Occupancy</span>
              <span>{statistics.rooms.total_occupied} / {statistics.rooms.total_capacity}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  parseFloat(statistics.rooms.occupancy_rate) >= 90 ? 'bg-red-500' :
                  parseFloat(statistics.rooms.occupancy_rate) >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${statistics.rooms.occupancy_rate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Request Statistics */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Requests</span>
              <span className="text-sm font-medium text-yellow-600">{statistics.requests.pending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Allocated Requests</span>
              <span className="text-sm font-medium text-green-600">{statistics.requests.allocated}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Waitlisted Requests</span>
              <span className="text-sm font-medium text-blue-600">{statistics.requests.waitlisted}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Requests</span>
              <span className="text-sm font-medium text-gray-900">{statistics.requests.total}</span>
            </div>
          </div>

          {/* Request Status Chart */}
          <div className="mt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Allocated</span>
                <span className="text-xs text-gray-600">
                  {statistics.requests.total > 0 
                    ? Math.round((statistics.requests.allocated / statistics.requests.total) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ 
                    width: statistics.requests.total > 0 
                      ? `${(statistics.requests.allocated / statistics.requests.total) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
            </div>

            <div className="space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Waitlisted</span>
                <span className="text-xs text-gray-600">
                  {statistics.requests.total > 0 
                    ? Math.round((statistics.requests.waitlisted / statistics.requests.total) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ 
                    width: statistics.requests.total > 0 
                      ? `${(statistics.requests.waitlisted / statistics.requests.total) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
            </div>

            <div className="space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Pending</span>
                <span className="text-xs text-gray-600">
                  {statistics.requests.total > 0 
                    ? Math.round((statistics.requests.pending / statistics.requests.total) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ 
                    width: statistics.requests.total > 0 
                      ? `${(statistics.requests.pending / statistics.requests.total) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
            <ArrowPathIcon className="w-5 h-5" />
            Process Waitlist
          </button>
          <button className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
            <ChartBarIcon className="w-5 h-5" />
            Run Batch Allocation
          </button>
          <button className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
            <HomeIcon className="w-5 h-5" />
            View All Rooms
          </button>
        </div>
      </div>

      {/* Alerts and Recommendations */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alerts & Recommendations</h3>
        <div className="space-y-3">
          {parseFloat(statistics.rooms.occupancy_rate) >= 90 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">High Occupancy Alert</h4>
                  <p className="text-sm text-red-700">
                    Occupancy rate is {statistics.rooms.occupancy_rate}%. Consider adding more rooms or processing waitlist.
                  </p>
                </div>
              </div>
            </div>
          )}

          {statistics.requests.waitlisted > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <ClockIcon className="w-5 h-5 text-blue-600 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800">Waitlist Processing</h4>
                  <p className="text-sm text-blue-700">
                    {statistics.requests.waitlisted} students are on waitlist. Process waitlist to allocate available rooms.
                  </p>
                </div>
              </div>
            </div>
          )}

          {statistics.requests.pending > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <ClockIcon className="w-5 h-5 text-yellow-600 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Pending Requests</h4>
                  <p className="text-sm text-yellow-700">
                    {statistics.requests.pending} requests are pending. Run batch allocation to process them.
                  </p>
                </div>
              </div>
            </div>
          )}

          {parseFloat(statistics.rooms.occupancy_rate) < 50 && statistics.requests.total === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-green-800">System Status: Good</h4>
                  <p className="text-sm text-green-700">
                    Low occupancy and no pending requests. System is running smoothly.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllocationStatistics;
