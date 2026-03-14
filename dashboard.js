
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
    
    // We only consider it 'past' if it's unlocked or cancelled
    const activeBookings = bookings.filter(b => b.status !== 'completed_unlocked' && b.status !== 'cancelled');
    const pastBookings = bookings.filter(b => b.status === 'completed_unlocked' || b.status === 'cancelled');
    
    let html = '';

    console.log('Rendering dashboard with bookings:', activeBookings);

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
            <h2 class="text-xl font-bold text-truespec-navy uppercase tracking-widest border-b pb-2 mb-6">Completed Inspections</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${pastBookings.map(booking => renderPastBookingCard(booking)).join('')}
            </div>
        </div>`;
    }

    container.innerHTML = html;
}

// --- NEW PIPELINE UI RENDERER ---
function renderActiveBookingCard(booking) {
    // Map the 8 DB statuses to a 5-step visual pipeline
    const pipelineSteps = [
        { label: "Submitted", keys: ['submitted'] },
        { label: "Scheduled", keys: ['scheduled'] },
        { label: "Inspected", keys: ['inspection_completed', 'invoice_report_ready','pending_admin_review'] },
        { label: "Payment", keys: ['awaiting_payment', 'payment_submitted', 'payment_verified'] },
        { label: "Unlocked", keys: ['completed_unlocked'] }
    ];

    let currentStepIndex = pipelineSteps.findIndex(step => step.keys.includes(booking.status));
    if (currentStepIndex === -1) currentStepIndex = 0; // Fallback

    // Progress Bar HTML generator
    const renderProgressBar = () => {
        return `
        <div class="mt-6">
            <div class="relative pt-1">
                <div class="flex items-center justify-between mb-2">
                    ${pipelineSteps.map((step, index) => `
                        <div class="text-center w-1/5 relative">
                            <div class="w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] font-bold z-10 relative
                                ${index <= currentStepIndex ? 'bg-truespec-sky text-white ring-4 ring-blue-50' : 'bg-gray-200 text-gray-400'}">
                                ${index < currentStepIndex ? '✓' : index + 1}
                            </div>
                            <div class="text-[10px] uppercase tracking-widest mt-2 font-bold ${index <= currentStepIndex ? 'text-truespec-navy' : 'text-gray-400'}">
                                ${step.label}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <!-- Connecting Line -->
                <div class="absolute top-4 left-[10%] right-[10%] h-1 bg-gray-200 -z-0 rounded">
                    <div class="h-1 bg-truespec-sky rounded transition-all duration-500" style="width: ${(currentStepIndex / (pipelineSteps.length - 1)) * 100}%"></div>
                </div>
            </div>
        </div>`;
    };

    // Card UI
    return `
    <div class="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6 overflow-hidden">
        <div class="flex justify-between items-start border-b pb-4">
            <div>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Ref: ${booking._id.substring(0,6).toUpperCase()}</p>
                <h3 class="text-xl font-extrabold text-truespec-navy">${booking.make} ${booking.model}</h3>
                <p class="text-sm text-gray-500">${booking.year} • ${booking.inspectionType}</p>
            </div>
            <button onclick="openClientDetailsModal('${booking._id}')" class="text-xs font-bold text-truespec-sky hover:text-blue-800 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded">
                View Details
            </button>
        </div>

        ${renderProgressBar()}

        ${renderClientActionSection(booking)}
    </div>`;
}

function renderClientActionSection(booking) {
    console.log('Rendering action section for booking status:', booking);
    if (booking.status === 'awaiting_payment') {
        return `
        <div class="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-5">
            <h4 class="font-bold text-yellow-800 uppercase tracking-widest text-sm mb-2">Invoice Ready</h4>
            <p class="text-sm text-yellow-700 mb-4">Your inspection is complete. Please download the invoice and submit your M-Pesa transaction code to unlock the full report.</p>
            <div class="flex gap-4 items-center">
                <a href="${API_BASE_URL}/api/data/files/${booking.invoice.invoicePdfKey}?token=${token}" target="_blank" class="px-4 py-2 bg-white border border-gray-300 rounded font-bold text-xs uppercase text-gray-700 hover:bg-gray-50 shadow-sm">View Invoice</a>
                <button onclick="openPaymentModal('${booking._id}', ${booking.invoice.amount})" class="px-4 py-2 bg-truespec-amber text-white font-bold text-xs uppercase rounded hover:bg-yellow-600 shadow animate-pulse">Submit Payment</button>
            </div>
        </div>`;
    }
    if (booking.status === 'payment_submitted') {
        return `
        <div class="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-5">
            <h4 class="font-bold text-orange-800 uppercase tracking-widest text-sm mb-1">Verifying Payment</h4>
            <p class="text-sm text-orange-700">We have received your payment details. Our team is verifying it and will unlock your report shortly.</p>
        </div>`;
    }
    return ''; // Other statuses don't require explicit action boxes
}

function renderPastBookingCard(booking) {
    //console.log('Rendering past booking', booking);
    const reportKey = booking.report ? booking.report.reportPdfKey : booking.reportPdfKey;
    return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
        <div>
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-lg font-bold text-truespec-navy">${booking.make} ${booking.model}</h3>
                <span class="px-2 py-1 bg-green-100 text-green-800 text-[10px] font-bold uppercase tracking-widest rounded">Completed</span>
            </div>
            <p class="text-xs text-gray-500 mb-4">Inspected on: ${new Date(booking.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="pt-4 border-t flex justify-between items-center">
            <button onclick="openClientDetailsModal('${booking._id}')" class="text-xs font-bold text-gray-500 hover:text-truespec-navy uppercase">Details</button>
            <a href="${API_BASE_URL}/api/data/files/${reportKey}?token=${token}" target="_blank" class="px-4 py-2 bg-truespec-navy text-white text-xs font-bold uppercase rounded shadow hover:bg-blue-900">Download Report</a>
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
                        <span class="text-2xl font-extrabold text-truespec-navy">KES ${booking.invoice.amount.toLocaleString()}</span>
                    </div>
                    ${booking.invoice.invoicePdfKey ? `<a href="${API_BASE_URL}/api/data/files/${booking.invoice.invoicePdfKey}?token=${token}" target="_blank" class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded uppercase tracking-wide transition">View Invoice</a>` : ''}
                </div>
                <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                    <span class="font-bold block mb-1">Payment via M-Pesa</span>
                    Number: <span class="font-mono font-bold text-lg tracking-widest"><a href="tel:+254758632987" target="_blank">0758 632 987</a></span><br>
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

/*function openClientDetailsModal(id) {
    const b = globalClientBookings.find(x => x._id === id);
    if (!b) return;

    // Populate Fields
    document.getElementById('cDetVehicle').innerText = `${b.make} ${b.model}`;
    document.getElementById('cDetYear').innerText = b.year || '-';
    document.getElementById('cDetReg').innerText = b.registrationNumber || 'N/A';
    document.getElementById('cDetPlan').innerText = b.inspectionType || '-';
    
    document.getElementById('cDetSeller').innerText = b.sellerName || '-';
    document.getElementById('cDetLocation').innerText = b.locationText || '-';
    const preferredDate = b.preferredDate ? new Date(b.preferredDate).toLocaleDateString() : '-';
    console.log('Preferred Date:', b.preferredDate, 'Formatted:', preferredDate);
    document.getElementById('cDetDate').innerText = preferredDate;
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
}*/

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
    const preferredDate = b.preferredDate ? new Date(b.preferredDate).toLocaleDateString() : '-';
    const preferredTime = b.preferredDate ? new Date(b.preferredDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    document.getElementById('cDetDate').innerText = preferredDate + (preferredTime ? ` at ${preferredTime}` : '') ;
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
    // --- RENDER GOOGLE MAP (Client Details) ---
    const mapContainer = document.getElementById('cDetMapContainer');
    const noMapMsg = document.getElementById('cDetNoMapMsg');
    window.initMap = function() {}; // Dummy callback

    if (b.mapCoordinates && b.mapCoordinates.lat && b.mapCoordinates.lng) {
        mapContainer.classList.remove('hidden');
        noMapMsg.classList.add('hidden');
        
        const lat = parseFloat(b.mapCoordinates.lat);
        const lng = parseFloat(b.mapCoordinates.lng);

        if (!window.clientDetailsMap) {
            window.clientDetailsMap = new google.maps.Map(mapContainer, {
                zoom: 15,
                center: { lat, lng },
                mapTypeControl: false,
                streetViewControl: false
            });
            window.clientDetailsMarker = new google.maps.Marker({
                position: { lat, lng },
                map: window.clientDetailsMap
            });
        } else {
            window.clientDetailsMap.setCenter({ lat, lng });
            window.clientDetailsMarker.setPosition({ lat, lng });
        }
    } else {
        mapContainer.classList.add('hidden');
        noMapMsg.classList.remove('hidden');
    }


    document.getElementById('clientDetailsModal').classList.remove('hidden');
}

function closeClientDetailsModal() {
    document.getElementById('clientDetailsModal').classList.add('hidden');
}



// --- PAYMENT MODAL LOGIC ---

// 1. Open Modal and set data
function openPaymentModal(id, price) {
    document.getElementById('payBookingId').value = id;
    document.getElementById('payAmountDisplay').innerText = price ? price.toLocaleString() : '0';
    document.getElementById('payAccountDisplay').innerText = id.substring(0, 6).toUpperCase();
    
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentModal').classList.remove('hidden');
}

// 2. Close Modal
function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

// 3. Handle Form Submission
document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('payBookingId').value;
    const btn = document.getElementById('btnPaymentSubmit');
    btn.disabled = true;
    btn.innerText = "Submitting...";

    // Use FormData because we might have a file upload (screenshot)
    const formData = new FormData();
    formData.append('paymentTransactionCode', document.getElementById('payTxCode').value.toUpperCase());
    
    const screenshotFile = document.getElementById('payScreenshot').files[0];
    if (screenshotFile) {
        formData.append('screenshot', screenshotFile); // Note: Make sure your backend multer uses 'screenshot' as the field name
    }

    try {
        // Assuming your backend route is PUT /api/data/submit-payment/:id (as per dataRoutes.js expectations)
        const res = await fetch(`${API_BASE_URL}/api/data/payment/${id}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}` 
                // Do NOT set Content-Type to application/json, fetch will automatically set it to multipart/form-data with boundaries
            },
            body: formData
        });

        if (res.ok) {
            alert("Payment details submitted successfully! Our team will verify it shortly and unlock your report.");
            closePaymentModal();
            fetchDashboardData(); // Refresh the dashboard to show the new "Verifying Payment" status
        } else {
            const data = await res.json();
            alert(data.message || "Failed to submit payment. Please try again.");
        }
    } catch (err) {
        console.error(err);
        alert("A network error occurred.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Payment";
    }
});
