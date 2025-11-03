// TEST: Room Request Approval Flow
// This script tests if room allocation happens automatically on approval

const testRoomApproval = async () => {
  console.log('🧪 Testing Room Request Approval Flow...');
  
  try {
    // Step 1: Find a pending room request
    const pendingRequestsResponse = await fetch('http://localhost:3002/api/room-requests/all', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const pendingRequests = await pendingRequestsResponse.json();
    console.log('📋 Pending requests:', pendingRequests);
    
    if (!pendingRequests.data || pendingRequests.data.length === 0) {
      console.log('❌ No pending requests found');
      return;
    }
    
    const testRequest = pendingRequests.data.find(req => req.status === 'pending');
    if (!testRequest) {
      console.log('❌ No pending requests to test with');
      return;
    }
    
    console.log('🎯 Testing with request:', testRequest.id);
    
    // Step 2: Check room allocations before approval
    const beforeResponse = await fetch(`http://localhost:3002/api/room-allocations/user/${testRequest.user_id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const beforeAllocation = await beforeResponse.json();
    console.log('📊 Allocations BEFORE approval:', beforeAllocation);
    
    // Step 3: Approve the request (this should create room allocation automatically)
    const approveResponse = await fetch(`http://localhost:3002/api/room-requests/${testRequest.id}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        room_id: testRequest.preferred_room_type === 'single' ? 'some-room-id' : 'some-room-id',
        notes: 'Test approval - automatic allocation'
      })
    });
    
    const approveResult = await approveResponse.json();
    console.log('✅ Approval result:', approveResult);
    
    // Step 4: Check room allocations after approval
    const afterResponse = await fetch(`http://localhost:3002/api/room-allocations/user/${testRequest.user_id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const afterAllocation = await afterResponse.json();
    console.log('📊 Allocations AFTER approval:', afterAllocation);
    
    // Step 5: Verify allocation was created
    if (afterAllocation.data && afterAllocation.data.length > 0) {
      console.log('🎉 SUCCESS: Room allocation created automatically!');
      console.log('📝 Allocation details:', afterAllocation.data[0]);
    } else {
      console.log('❌ FAILED: No room allocation found after approval');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
testRoomApproval();
