
// --- Global State & Init ---
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));
let globalClientBookings = [];

if (!token || !user) {
    window.location.href = 'login.html';
} else if (user.role === 'admin') {
    window.location.href = 'admin-portal.html'; 
}

document.getElementById('user-greeting').innerText = `HELLO, ${user.name}`;

if (user.requirePasswordChange) {
    document.getElementById('passwordModal').classList.remove('hidden');
}

fetchDashboardData();

async function fetchDashboardData() {
    try {
        const res = await fetch(API_BASE_URL + '/api/data/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch data');
        const data = await res.json();
        
        globalClientBookings = data.bookings; // Store locally for modal
        renderClientDashboard(data.bookings);

    } catch (err) {
        console.error(err);
        document.getElementById('app-content').innerHTML = `
            <div class="bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
                Error loading dashboard. Please check your connection.
            </div>`;
    }
}

function renderClientDashboard(bookings) {
    const container = document.getElementById('app-content');
    const activeStatuses = ['pending', 'inspected_awaiting_payment', 'payment_submitted'];
    const activeBookings = bookings.filter(b => activeStatuses.includes(b.status));
    const pastBookings = bookings.filter(b => !activeStatuses.includes(b.status));
    let html = '';

    if (activeBookings.length > 0) {
        html += `<h2 class="text-xl font-bold text-truespec-navy uppercase tracking-widest border-b pb-2 mb-6">Active Inspections</h2>`;
        html += activeBookings.map(booking => renderActiveBookingCard(booking)).join('');
    } else if (pastBookings.length === 0) {
        html += `
        <div class="bg-white p-10 rounded-xl shadow-sm border border-gray-100 text-center">
            <h3 class="text-xl font-bold text-gray-800 mb-2">No Inspections Yet</h3>
            <p class="text-gray-500 mb-6">You don't have any vehicle inspections on file.</p>
            <a href="book.html" class="inline-block bg-truespec-amber text-white px-8 py-3 rounded font-bold hover:bg-yellow-600 transition uppercase tracking-wide">Book Now</a>
        </div>`;
    }

    if (pastBookings.length > 0) {
        html += `
        <div class="mt-16">
            <h2 class="text-xl font-bold text-truespec-navy uppercase tracking-widest border-b pb-2 mb-6">Inspection History</h2>
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style="overflow-x: auto;">
                <table class="min-w-full text-sm text-left">
                    <thead class="bg-slate-50 text-gray-500 uppercase tracking-wider text-xs font-bold">
                        <tr>
                            <th class="px-6 py-4">Date</th>
                            <th class="px-6 py-4">Vehicle</th>
                            <th class="px-6 py-4">Status</th>
                            <th class="px-6 py-4 text-right">Report</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${pastBookings.map(b => `
                            <tr class="hover:bg-slate-50 transition">
                               <td class="px-6 py-4 text-right space-x-2">
                                    <button onclick="openClientDetailsModal('${b._id}')" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1.5 px-3 rounded uppercase tracking-wide mr-2 transition">Details</button>
                                    ${b.status === 'completed_unlocked' && b.reportPdfKey ? 
                                    `<a href="${API_BASE_URL}/api/data/files/${b.reportPdfKey}?token=${token}" target="_blank" class="text-truespec-sky font-bold hover:underline uppercase tracking-wide">Download</a>` 
                                    : '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }
    container.innerHTML = html;
}

function renderActiveBookingCard(booking) {
    let step = 1;
    if (booking.status === 'inspected_awaiting_payment') step = 2;
    if (booking.status === 'payment_submitted') step = 3;
    if (booking.status === 'completed_unlocked') step = 4;

    return `
      <div class="bg-slate-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
                <h3 class="text-xl font-bold text-gray-900 uppercase tracking-wide">${booking.make} ${booking.model} <span class="text-gray-500 font-normal">(${booking.year})</span></h3>
                <p class="text-xs text-gray-500 mt-1 uppercase tracking-widest">Ref: ${booking._id.substring(0,8)} | Location: ${booking.sellerName}</p>
            </div>
            <div class="text-right flex flex-col items-end">
                <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-blue-100 text-blue-800 mb-2">
                    ${formatStatus(booking.status)}
                </span>
                <button onclick="openClientDetailsModal('${booking._id}')" class="text-xs bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 font-bold py-1 px-3 rounded uppercase transition">View Details</button>
            </div>
        </div>
        <div class="p-6 md:p-8">
            <div class="relative max-w-3xl mx-auto mb-12">
                <div class="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 z-0"></div>
                <div class="absolute top-1/2 left-0 h-1 bg-truespec-navy -translate-y-1/2 z-0 transition-all duration-500" style="width: ${(step-1) * 33.33}%"></div>
                <div class="relative z-10 flex justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
                    <div class="flex flex-col items-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 1 ? 'bg-truespec-navy text-white' : 'bg-gray-200 text-gray-400'} shadow">1</div>
                        <span>Pending</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 2 ? 'bg-truespec-navy text-white' : 'bg-gray-200 text-gray-400'} shadow">2</div>
                        <span>Inspected</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 3 ? 'bg-truespec-navy text-white' : 'bg-gray-200 text-gray-400'} shadow">3</div>
                        <span>Verifying</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 4 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'} shadow">4</div>
                        <span>Unlocked</span>
                    </div>
                </div>
            </div>
            ${renderActionArea(booking)}
        </div>
    </div>`;
}

function renderActionArea(booking) {
    if (booking.status === 'pending') {
        return `
        <div class="text-center bg-blue-50 p-6 rounded-lg border border-blue-100">
            <svg class="mx-auto h-12 w-12 text-truespec-sky mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 class="text-lg font-bold text-truespec-navy uppercase tracking-wide">Inspection Scheduled</h4>
            <p class="text-gray-600 text-sm mt-2 max-w-md mx-auto">Our inspector is coordinating with the seller. We will notify you via email once the physical inspection is complete and the report is generated.</p>
        </div>`;
    }

    if (booking.status === 'inspected_awaiting_payment') {
        return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="bg-slate-50 p-6 rounded-lg border border-gray-200">
                <h4 class="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">Payment Required</h4>
                <p class="text-sm text-gray-600 mb-4">Your vehicle inspection is complete. Please settle the invoice below to unlock your comprehensive condition report.</p>
                <div class="bg-white p-4 rounded border border-gray-200 mb-4 flex justify-between items-center shadow-sm">
                    <div>
                        <span class="block text-xs text-gray-500 uppercase font-bold tracking-widest">Amount Due</span>
                        <span class="text-2xl font-extrabold text-truespec-navy">KES ${booking.price.toLocaleString()}</span>
                    </div>
                    ${booking.invoicePdfKey ? `<a href="${API_BASE_URL}/api/data/files/${booking.invoicePdfKey}?token=${token}" target="_blank" class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded uppercase tracking-wide transition">View Invoice</a>` : ''}
                </div>
                <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                    <span class="font-bold block mb-1">M-Pesa Paybill / Buy Goods</span>
                    Till Number: <span class="font-mono font-bold text-lg tracking-widest">123456</span><br>
                    <span class="text-xs text-green-700">Name: TrueSpec Automotive</span>
                </div>
                <form id="payment-form-${booking._id}" class="space-y-4" onsubmit="submitPayment(event, '${booking._id}')">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1">M-Pesa Transaction Code</label>
                        <input type="text" id="txCode-${booking._id}" placeholder="e.g. QFE2XY8Z..." class="w-full border p-2.5 rounded font-mono uppercase text-sm focus:ring-truespec-sky">
                    </div>
                    <div class="text-center text-xs text-gray-400 font-bold uppercase tracking-widest">- OR -</div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1">Upload Screenshot</label>
                        <input type="file" id="txFile-${booking._id}" accept="image/*,application/pdf" class="w-full text-sm border p-2 rounded bg-white">
                    </div>
                    <button type="submit" id="btn-pay-${booking._id}" class="w-full bg-truespec-navy text-white font-bold py-3 rounded hover:bg-blue-900 uppercase tracking-wide transition shadow mt-2">Submit Payment Details</button>
                </form>
            </div>
            <div class="flex flex-col justify-center items-center bg-gray-100 rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <div class="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                    <svg class="h-10 w-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                    </svg>
                </div>
                <h4 class="text-xl font-bold text-gray-600 uppercase tracking-wide mb-2">Report Locked</h4>
                <p class="text-sm text-gray-500 max-w-xs">Submit payment confirmation to unlock and download your detailed vehicle condition report.</p>
                <button disabled class="mt-6 px-6 py-3 bg-gray-300 text-gray-500 font-bold rounded uppercase tracking-widest cursor-not-allowed">Download Report</button>
            </div>
        </div>`;
    }

    if (booking.status === 'payment_submitted') {
        return `
        <div class="text-center bg-yellow-50 p-8 rounded-lg border border-yellow-200">
            <svg class="mx-auto h-12 w-12 text-truespec-amber mb-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 class="text-xl font-bold text-gray-900 uppercase tracking-wide">Verifying Payment</h4>
            <p class="text-gray-600 text-sm mt-2 max-w-md mx-auto">We have received your payment details. Our accounts team is verifying the transaction. Your report will unlock automatically once confirmed.</p>
        </div>`;
    }
    return '';
}

async function submitPayment(e, bookingId) {
    e.preventDefault();
    const btn = document.getElementById(`btn-pay-${bookingId}`);
    btn.disabled = true;
    btn.innerText = "Submitting...";

    const txCode = document.getElementById(`txCode-${bookingId}`).value;
    const fileInput = document.getElementById(`txFile-${bookingId}`);
    
    if (!txCode && fileInput.files.length === 0) {
        alert("Please provide either a transaction code or a screenshot.");
        btn.disabled = false; btn.innerText = "Submit Payment Details";
        return;
    }

    const formData = new FormData();
    if (txCode) formData.append('paymentTransactionCode', txCode);
    if (fileInput.files.length > 0) formData.append('screenshot', fileInput.files[0]);

    try {
        const res = await fetch(`${API_BASE_URL}/api/data/payment/${bookingId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            alert("Payment details submitted successfully!");
            fetchDashboardData();
        } else {
            const data = await res.json();
            alert(data.message || "Error submitting payment");
            btn.disabled = false; btn.innerText = "Submit Payment Details";
        }
    } catch (err) {
        console.error(err);
        alert("Network error.");
        btn.disabled = false; btn.innerText = "Submit Payment Details";
    }
}

async function updatePassword() {
    const newPass = document.getElementById('newPassword').value;
    if (newPass.length < 6) return alert("Password must be at least 6 characters");

    try {
        const res = await fetch(API_BASE_URL + '/api/auth/update-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ newPassword: newPass })
        });
        if (res.ok) {
            document.getElementById('passwordModal').classList.add('hidden');
            alert("Password secured successfully.");
            user.requirePasswordChange = false;
            localStorage.setItem('user', JSON.stringify(user));
            window.location.href = 'login.html';
        } else alert("Error updating password");
    } catch (e) { console.error(e); }
}

function formatStatus(status) {
    const map = {
        'pending': 'Pending Inspection',
        'inspected_awaiting_payment': 'Awaiting Payment',
        'payment_submitted': 'Verifying Payment',
        'completed_unlocked': 'Completed'
    };
    return map[status] || status;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function openClientDetailsModal(id) {
    const b = globalClientBookings.find(x => x._id === id);
    if (!b) return;

    // Populate Fields
    document.getElementById('cDetVehicle').innerText = `${b.make} ${b.model}`;
    document.getElementById('cDetYear').innerText = b.year || '-';
    document.getElementById('cDetReg').innerText = b.registrationNumber || 'N/A';
    document.getElementById('cDetPlan').innerText = b.inspectionType || '-';
    
    document.getElementById('cDetSeller').innerText = b.sellerName || '-';
    document.getElementById('cDetLocation').innerText = b.locationText || '-';
    document.getElementById('cDetDate').innerText = b.preferredDate || '-';
    document.getElementById('cDetNotes').innerText = b.notes || 'No specific notes provided.';

    // Populate Photos
    const photoContainer = document.getElementById('cDetPhotos');
    if (b.photos && b.photos.length > 0) {
        photoContainer.innerHTML = b.photos.map((photoKey, index) => `
            <a href="${API_BASE_URL}/api/data/files/${photoKey}?token=${token}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Attachment ${index + 1}
            </a>
        `).join('');
    } else {
        photoContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No photos attached.</span>`;
    }

    document.getElementById('clientDetailsModal').classList.remove('hidden');
}

function closeClientDetailsModal() {
    document.getElementById('clientDetailsModal').classList.add('hidden');
}


// --- MAP VARIABLES ---
let clientDetailsMap = null;
let clientDetailsMarker = null;

function openClientDetailsModal(id) {
    const b = globalClientBookings.find(x => x._id === id);
    if (!b) return;

    // Populate Fields
    document.getElementById('cDetVehicle').innerText = `${b.make} ${b.model}`;
    document.getElementById('cDetYear').innerText = b.year || '-';
    document.getElementById('cDetReg').innerText = b.registrationNumber || 'N/A';
    document.getElementById('cDetPlan').innerText = b.inspectionType || '-';
    
    document.getElementById('cDetSeller').innerText = b.sellerName || '-';
    document.getElementById('cDetLocation').innerText = b.locationText || '-';
    document.getElementById('cDetDate').innerText = b.preferredDate || '-';
    document.getElementById('cDetNotes').innerText = b.notes || 'No specific notes provided.';

    // Populate Photos
    const photoContainer = document.getElementById('cDetPhotos');
    if (b.photos && b.photos.length > 0) {
        photoContainer.innerHTML = b.photos.map((photoKey, index) => `
            <a href="${API_BASE_URL}/api/data/files/${photoKey}?token=${token}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Attachment ${index + 1}
            </a>
        `).join('');
    } else {
        photoContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No photos attached.</span>`;
    }

    // --- RENDER MAP ---
    const mapContainer = document.getElementById('cDetMapContainer');
    const noMapMsg = document.getElementById('cDetNoMapMsg');
    
    if (b.mapCoordinates && b.mapCoordinates.lat && b.mapCoordinates.lng) {
        mapContainer.classList.remove('hidden');
        noMapMsg.classList.add('hidden');
        
        const lat = b.mapCoordinates.lat;
        const lng = b.mapCoordinates.lng;

        if (!clientDetailsMap) {
            clientDetailsMap = L.map('cDetMapContainer').setView([lat, lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(clientDetailsMap);
            clientDetailsMarker = L.marker([lat, lng]).addTo(clientDetailsMap);
        } else {
            clientDetailsMap.setView([lat, lng], 15);
            clientDetailsMarker.setLatLng([lat, lng]);
        }
        
        // Timeout needed for Leaflet maps hidden inside modals to size correctly
        setTimeout(() => clientDetailsMap.invalidateSize(), 100);
    } else {
        mapContainer.classList.add('hidden');
        noMapMsg.classList.remove('hidden');
    }

    document.getElementById('clientDetailsModal').classList.remove('hidden');
}

function closeClientDetailsModal() {
    document.getElementById('clientDetailsModal').classList.add('hidden');
}

