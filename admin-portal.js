let adminToken = localStorage.getItem('adminToken');
let adminUser = JSON.parse(localStorage.getItem('adminUser'));
let currentAuthEmail = '';
let globalAdminBookings = [];



const standardChecks = [
    "Engine & Transmission", 
    "Steering & Suspension", 
    "Brakes & Tyres", 
    "Bodywork & Chassis", 
    "Interior & Electrical", 
    "Test Drive & OBD2"
];

// Update your renderActionButton function (the one we made in Phase 2)
/*function renderActionButton(b) {
    // Inside your renderActionButton function:
if (b.status === 'pending') return `<button onclick="openScheduleModal('${b._id}')" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-blue-700">Schedule</button>`;

    if (b.status === 'scheduled') return `<button onclick="updateAdminStatus('${b._id}', 'inspection_completed')" class="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-indigo-700">Mark Inspected</button>`;
    
    // NEW BUILD REPORT BUTTON
    if (b.status === 'inspection_completed') return `<button onclick="openGenerateModal('${b._id}')" class="px-3 py-1.5 bg-truespec-navy text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-blue-900">Build Report</button>`;
    
    if (b.status === 'payment_submitted') return `<button onclick="openVerifyModal('${b._id}', '${b.paymentTransactionCode}', '${b.paymentScreenshotKey}')" class="px-3 py-1.5 bg-truespec-amber text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-yellow-600 animate-pulse">Verify Pay</button>`;
    return `<span class="text-xs text-gray-400 font-bold uppercase tracking-widest">-</span>`;
}*/

function renderActionButton(b) {
    // If it's pending scheduling
    if (b.status === 'pending') {
        return `<button onclick="openScheduleModal('${b._id}')" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-blue-700">Schedule</button>`;
    }
    
    // Check if the mechanic has submitted the report for review
    if (b.status === 'scheduled' && b.report && b.report.status === 'pending_admin_review') {
        return `<button onclick="openReviewModal('${b._id}')" class="px-3 py-1.5 bg-yellow-500 text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-yellow-600">Review Report</button>`;
    }

    // If it's waiting for payment
    if (b.status === 'awaiting_payment') {
        return `<span class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-widest rounded shadow">Awaiting Pay</span>`;
    }

    if (b.status === 'payment_submitted') return `<button onclick="openVerifyModal('${b._id}', '${b.invoice.paymentTransactionCode}', '${b.invoice.paymentScreenshotKey}')" class="px-3 py-1.5 bg-truespec-amber text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-yellow-600 animate-pulse">Verify Pay</button>`;

    // Default catch-all
    return `<span class="text-xs text-gray-400 font-bold uppercase tracking-widest"></span>`;
}

async function updateAdminStatus(id, newStatus) {
    if(!confirm(`Are you sure you want to move this booking to: ${formatStatus(newStatus)}?`)) return;
    
    try {
        const res = await adminFetch(`${API_BASE_URL}/api/data/admin/status/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) fetchAdminData();
        else alert("Failed to update status");
    } catch (e) {
        console.error(e);
    }
}





if (adminToken && adminUser && adminUser.role === 'admin') {
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('portalContent').classList.remove('hidden');
    document.getElementById('adminNameDisplay').innerText = adminUser.name;
    fetchAdminData();
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.innerText = "Checking...";

    try {
        const res = await fetch(API_BASE_URL + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok && data.requires2FA) {
            currentAuthEmail = data.email;
            document.getElementById('loginFormContainer').classList.add('hidden');
            document.getElementById('otpFormContainer').classList.remove('hidden');
        } else {
            alert(data.message || 'Login failed.');
            btn.disabled = false; btn.innerText = "Login";
        }
    } catch (err) {
        console.error(err); alert("Network error.");
        btn.disabled = false; btn.innerText = "Login";
    }
});

document.getElementById('adminOtpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('adminOtp').value;
    const btn = document.getElementById('otpBtn');
    btn.disabled = true; btn.innerText = "Verifying...";

    try {
        const res = await fetch(API_BASE_URL + '/api/auth/verify-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentAuthEmail, otp })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data));
            window.location.reload(); 
        } else {
            alert(data.message || 'Invalid OTP.');
            btn.disabled = false; btn.innerText = "Verify & Enter";
        }
    } catch (err) {
        console.error(err); alert("Network error.");
        btn.disabled = false; btn.innerText = "Verify & Enter";
    }
});

function logoutAdmin() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.reload();
}

async function adminFetch(url, options = {}) {
    options.headers = { ...options.headers, 'Authorization': `Bearer ${adminToken}` };
    const res = await fetch(url, options);
    
    if (res.status === 401) {
        alert("Session expired or unauthorized. Please log in again.");
        logoutAdmin();
        throw new Error("Unauthorized");
    }
    return res;
}

// --- UPDATE THE FETCH FUNCTION ---
async function fetchAdminData() {
    try {
        const res = await adminFetch(API_BASE_URL + '/api/data/dashboard');
        const data = await res.json();
        globalAdminBookings = data.bookings; // Store locally for the modal
        renderTable(data.bookings);
    } catch (err) {
        console.error("Failed to fetch dashboard data");
    }
}

// --- UPDATE THE RENDER TABLE FUNCTION ---
function renderTable(bookings) {
    const tbody = document.getElementById('bookingsTableBody');
    tbody.innerHTML = bookings.map(b => {
        return `
        <tr class="hover:bg-slate-50 border-b border-gray-100 transition">
            <td class="px-6 py-4">
                <span class="font-bold text-gray-900">${b._id.substring(0,6).toUpperCase()}</span><br>
                <span class="text-xs text-gray-500">${new Date(b.createdAt).toLocaleDateString()}</span>
            </td>
            <td class="px-6 py-4">
                <span class="font-bold text-gray-800">${b.name}</span><br>
                <span class="text-xs text-gray-500">${b.phone}</span>
            </td>
            <td class="px-6 py-4 text-xs">
                <span class="font-bold text-truespec-navy">${b.make} ${b.model} (${b.year})</span><br>
                <span class="text-gray-500">${b.sellerName}</span>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${getStatusStyle(b.status)}">
                    ${formatStatus(b.status)}
                </span>
            </td>
            <!-- UPDATED ACTION COLUMN -->
            <td class="px-6 py-4 text-right">
                <div class="flex justify-end items-center space-x-2">
                    <button onclick="openDetailsModal('${b._id}')" class="px-3 py-1.5 border border-gray-300 text-gray-600 hover:text-truespec-navy text-xs font-bold uppercase tracking-widest rounded shadow-sm hover:bg-gray-50">View</button>
                    ${renderActionButton(b)}
                </div>
            </td>
        </tr>`;
    }).join('');
}

function getStatusStyle(status) {
    if (status === 'pending') return 'bg-gray-100 text-gray-600';
    if (status === 'inspected_awaiting_payment') return 'bg-blue-100 text-blue-800';
    if (status === 'payment_submitted') return 'bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-sm';
    if (status === 'completed_unlocked') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
}

function formatStatus(status) {
    if(status === 'inspected_awaiting_payment') return 'Awaiting Pay';
    if(status === 'payment_submitted') return 'Verify Pay';
    if(status === 'completed_unlocked') return 'Completed';
    return status;
}

/*function renderActionButton(b) {
    if (b.status === 'pending') return `<button onclick="openUploadModal('${b._id}')" class="px-3 py-1.5 bg-truespec-navy text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-blue-900">Upload Docs</button>`;
    if (b.status === 'payment_submitted') return `<button onclick="openVerifyModal('${b._id}', '${b.paymentTransactionCode}', '${b.paymentScreenshotKey}')" class="px-3 py-1.5 bg-truespec-amber text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-yellow-600 animate-pulse">Verify Pay</button>`;
    return `<span class="text-xs text-gray-400 font-bold uppercase tracking-widest">-</span>`;
}*/

function openUploadModal(id) {
    document.getElementById('uploadBookingId').value = id;
    document.getElementById('uploadModal').classList.remove('hidden');
}

function openVerifyModal(id, txCode, screenshotKey) {
    document.getElementById('verifyBookingId').value = id;
    document.getElementById('verifyTxCode').innerText = txCode && txCode !== 'undefined' ? txCode : 'N/A';
    
    const ssContainer = document.getElementById('verifyScreenshotContainer');
    if (screenshotKey && screenshotKey !== 'undefined') {
        ssContainer.classList.remove('hidden');
        document.getElementById('verifyScreenshotLink').href = `${API_BASE_URL}/api/data/files/${screenshotKey}?token=${adminToken}`;
    } else {
        ssContainer.classList.add('hidden');
    }
    document.getElementById('verifyModal').classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }



async function confirmPayment() {
    const id = document.getElementById('verifyBookingId').value;
    const btn = document.getElementById('btnVerifySubmit');
    btn.disabled = true; btn.innerText = "Processing...";

    try {
        const res = await adminFetch(`${API_BASE_URL}/api/data/admin/verify-payment/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) { closeModal('verifyModal'); fetchAdminData(); } 
        else { alert("Error verifying payment"); }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; btn.innerText = "Approve & Unlock"; }
}

document.getElementById('manualBookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('mbSubmitBtn');
    btn.disabled = true; btn.innerText = "Creating...";

    const formData = new FormData();
    formData.append('name', document.getElementById('mbName').value);
    formData.append('email', document.getElementById('mbEmail').value);
    formData.append('phone', document.getElementById('mbPhone').value);
    formData.append('whatsapp', document.getElementById('mbWhatsApp').value);
    
    formData.append('make', document.getElementById('mbMake').value);
    formData.append('model', document.getElementById('mbModel').value);
    formData.append('year', document.getElementById('mbYear').value);
    formData.append('registrationNumber', document.getElementById('mbReg').value);
    formData.append('inspectionType', document.getElementById('mbType').value);
    
    formData.append('sellerName', document.getElementById('mbSeller').value);
    formData.append('locationText', document.getElementById('mbLocation').value);
    formData.append('lat', document.getElementById('mbLat').value);
    formData.append('lng', document.getElementById('mbLng').value);
    
    formData.append('preferredDate', document.getElementById('mbPreferredDate').value);
    formData.append('notes', document.getElementById('mbNotes').value);

    // Append Photos
    const fileInput = document.getElementById('mbPhotos');
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('photos', fileInput.files[i]);
    }

    try {
        // NOTE: We do NOT pass 'Content-Type': 'application/json' because FormData handles multipart boundaries
        const res = await adminFetch(API_BASE_URL + '/api/data/admin/book', {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            alert("Booking Created!"); 
            document.getElementById('manualBookingForm').reset();
            switchTab('dashboard'); 
            fetchAdminData();
        } else { 
            const data = await res.json();
            alert(data.message || "Error creating booking"); 
        }
    } catch (e) { 
        console.error(e); 
        alert("Network error.");
    } finally {
        btn.disabled = false; btn.innerText = "Create Booking";
    }
});


function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('text-truespec-navy', 'border-b-2', 'border-truespec-navy');
        el.classList.add('text-gray-400');
    });
    
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(el => el.getAttribute('onclick').includes(tabId));
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-400'); 
        activeBtn.classList.add('text-truespec-navy', 'border-b-2', 'border-truespec-navy');
    }

    // Refresh Google Map layout if switching to manual booking tab
    if (tabId === 'manualBooking' && window.mbMap) {
        // Give the tab a tiny moment to render before triggering resize
        setTimeout(() => {
            google.maps.event.trigger(window.mbMap, "resize");
            window.mbMap.setCenter(window.mbMarker.getPosition());
        }, 50);
    }
}



function togglePasswordVisibility(inputId, eyeIconId, eyeSlashIconId) {
    const input = document.getElementById(inputId);
    const eyeIcon = document.getElementById(eyeIconId);
    const eyeSlashIcon = document.getElementById(eyeSlashIconId);
    
    if (input.type === "password") {
        input.type = "text";
        eyeIcon.classList.add("hidden");
        eyeSlashIcon.classList.remove("hidden");
    } else {
        input.type = "password";
        eyeIcon.classList.remove("hidden");
        eyeSlashIcon.classList.add("hidden");
    }
}


// --- FORGOT PASSWORD FLOW ---
let resetEmail = '';

function showForgotForm() {
    document.getElementById('loginFormContainer').classList.add('hidden');
    document.getElementById('forgotPasswordContainer').classList.remove('hidden');
}

function showLoginForm() {
    document.getElementById('forgotPasswordContainer').classList.add('hidden');
    document.getElementById('resetPasswordContainer').classList.add('hidden');
    document.getElementById('loginFormContainer').classList.remove('hidden');
}

// 1. Request the code
document.getElementById('adminForgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const btn = document.getElementById('forgotBtn');
    btn.disabled = true; btn.innerText = "Sending...";

    try {
        const res = await fetch(API_BASE_URL + '/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (res.ok) {
            resetEmail = email;
            document.getElementById('forgotPasswordContainer').classList.add('hidden');
            document.getElementById('resetPasswordContainer').classList.remove('hidden');
        } else {
            alert(data.message || 'Error sending reset email.');
        }
    } catch (err) {
        console.error(err); alert("Network error.");
    } finally {
        btn.disabled = false; btn.innerText = "Send Code";
    }
});

// 2. Submit the new password with the code
document.getElementById('adminResetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('resetCode').value;
    const newPassword = document.getElementById('newAdminPassword').value;
    const btn = document.getElementById('resetBtn');
    
    if(newPassword.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }

    btn.disabled = true; btn.innerText = "Resetting...";

    try {
        const res = await fetch(API_BASE_URL + '/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, code, newPassword })
        });
        const data = await res.json();
        
        if (res.ok) {
            alert('Password reset successful! You can now log in.');
            document.getElementById('adminLoginForm').reset();
            showLoginForm();
        } else {
            alert(data.message || 'Invalid or expired code.');
        }
    } catch (err) {
        console.error(err); alert("Network error.");
    } finally {
        btn.disabled = false; btn.innerText = "Reset Password";
    }
});

// --- ADD THE MODAL LOGIC (Paste at the bottom of the file) ---

/*
function openDetailsModal(id) {
    console.log("Opening details for booking ID:", id); // Debug log to check the ID
    const b = globalAdminBookings.find(x => x._id === id);
    if (!b) return;

    // Populate Fields
    document.getElementById('detName').innerText = b.name || '-';
    document.getElementById('detEmail').innerText = b.email || '-';
    document.getElementById('detPhone').innerText = b.phone || '-';
    document.getElementById('detWhatsApp').innerText = b.whatsapp || 'N/A';
    
    document.getElementById('detCar').innerText = `${b.make} ${b.model}`;
    document.getElementById('detYear').innerText = b.year || '-';
    document.getElementById('detReg').innerText = b.registrationNumber || 'N/A';
    document.getElementById('detPlan').innerText = b.inspectionType || '-';

    document.getElementById('detSeller').innerText = b.sellerName || '-';
    document.getElementById('detLocation').innerText = b.locationText || '-';
    document.getElementById('detDate').innerText = b.preferredDate || '-';
    document.getElementById('detNotes').innerText = b.notes || 'None';

    // Populate Photos
    const photoContainer = document.getElementById('detPhotos');
    if (b.photos && b.photos.length > 0) {
        photoContainer.innerHTML = b.photos.map((photoKey, index) => `
            <a href="${API_BASE_URL}/api/data/files/${photoKey}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View File ${index + 1}
            </a>
        `).join('');
    } else {
        photoContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No photos attached.</span>`;
    }

    //Populate Invoice
    const invoiceContainer = document.getElementById('detInvoice');
    console.log("Invoice PDF Key:", b.invoicePdfKey); // Debug log to check the value
    if (b.invoicePdfKey) {
        invoiceContainer.innerHTML = `
            <a href="${API_BASE_URL}/api/data/files/${b.invoicePdfKey}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Invoice
            </a>
        `;
    } else {
        invoiceContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No invoice generated.</span>`;
    }

    //Populate Payment Proof
    const paymentProofContainer = document.getElementById('detPaymentProof');
    if (b.paymentProof) {
        paymentProofContainer.innerHTML = `
            <a href="${API_BASE_URL}/api/data/files/${b.paymentProof}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Payment Proof
            </a>
        `;
    } else {
        paymentProofContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No payment proof provided.</span>`;
    }


    //Populate Report
    const reportContainer = document.getElementById('detReport');
    if (b.report) {
        reportContainer.innerHTML = `
            <a href="${API_BASE_URL}/api/data/files/${b.report}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Report
            </a>
        `;
    } else {
        reportContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No report generated.</span>`;
    }

    document.getElementById('detailsModal').classList.remove('hidden');
}

*/

// --- MAP VARIABLES ---
let adminDetailsMap = null;
let adminDetailsMarker = null;

function openDetailsModal(id) {
    const b = globalAdminBookings.find(x => x._id === id);
    if (!b) return;

    // Populate Fields
    document.getElementById('detName').innerText = b.name || '-';
    document.getElementById('detEmail').innerText = b.email || '-';
    document.getElementById('detPhone').innerText = b.phone || '-';
    document.getElementById('detWhatsApp').innerText = b.whatsapp || 'N/A';
    
    document.getElementById('detCar').innerText = `${b.make} ${b.model}`;
    document.getElementById('detYear').innerText = b.year || '-';
    document.getElementById('detReg').innerText = b.registrationNumber || 'N/A';
    document.getElementById('detPlan').innerText = b.inspectionType || '-';

    document.getElementById('detSeller').innerText = b.sellerName || '-';
    document.getElementById('detLocation').innerText = b.locationText || '-';
    const preferredDate = b.preferredDate ? new Date(b.preferredDate).toLocaleString() : '-';
    document.getElementById('detDate').innerText = preferredDate ;
    document.getElementById('detNotes').innerText = b.notes || 'None';

    // Populate Photos
    const photoContainer = document.getElementById('detPhotos');
    if (b.photos && b.photos.length > 0) {
        photoContainer.innerHTML = b.photos.map((photoKey, index) => `
            <a href="${API_BASE_URL}/api/data/files/${photoKey}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View File ${index + 1}
            </a>
        `).join('');
    } else {
        photoContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No photos attached.</span>`;
    }

    //Populate Invoice
    const invoiceContainer = document.getElementById('detInvoice');
    //console.log("Invoice PDF Key:", b.invoice.invoicePdfKey); // Debug log to check the value
    if (b.invoice?.invoicePdfKey) {
        invoiceContainer.innerHTML = `
            <a href="${API_BASE_URL}/api/data/files/${b.invoice.invoicePdfKey}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Invoice
            </a>
        `;
    } else {
        invoiceContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No invoice generated.</span>`;
    }

    //Populate Payment Proof
    const paymentProofContainer = document.getElementById('detPaymentProof');
    if (b?.invoice?.paymentScreenshotKey) {
        paymentProofContainer.innerHTML = `
            <a href="${API_BASE_URL}/api/data/files/${b.invoice.paymentScreenshotKey}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Payment Proof
            </a>
            <p class="text-xs text-gray-500 mt-1">Transaction Code: ${b.invoice.paymentTransactionCode || 'N/A'}</p>
        `;
    } else {
        paymentProofContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No payment proof provided.</span>`;
    }


    //Populate Report
    const reportContainer = document.getElementById('detReports');
    //console.log("Report Key:", b.report.reportPdfKey); // Debug log to check the value
    if (b?.report?.reportPdfKey) {
        reportContainer.innerHTML = `
            <a href="${API_BASE_URL}/api/data/files/${b.report.reportPdfKey}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Report
            </a>
        `;
    } else {
        reportContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No report generated.</span>`;
    }


    // --- RENDER MAP ---
     // --- RENDER GOOGLE MAP (Admin Details) ---
    const mapContainer = document.getElementById('detMapContainer');
    const noMapMsg = document.getElementById('detNoMapMsg');
    const gMapsLink = document.getElementById('detGoogleMapsLink');
    
    // We need a dummy initMap function to satisfy the Google Maps script callback, 
    // even though we initialize manually inside the modal.
        // Update window.initMap to handle the Manual Booking Map too
    window.initMap = function() {
        const defaultLat = -1.2921; // Nairobi
        const defaultLng = 36.8219;
        
        document.getElementById('mbLat').value = defaultLat;
        document.getElementById('mbLng').value = defaultLng;

        window.mbMap = new google.maps.Map(document.getElementById("mbMapPlaceholder"), {
            zoom: 12,
            center: { lat: defaultLat, lng: defaultLng },
            mapTypeControl: false,
            streetViewControl: false
        });

        window.mbMarker = new google.maps.Marker({
            position: { lat: defaultLat, lng: defaultLng },
            map: window.mbMap,
            draggable: true,
            title: "Drag to exact location",
            animation: google.maps.Animation.DROP
        });

        window.mbMarker.addListener('dragend', function() {
            const pos = window.mbMarker.getPosition();
            document.getElementById('mbLat').value = pos.lat();
            document.getElementById('mbLng').value = pos.lng();
        });
        
        window.mbMap.addListener('click', function(e) {
            window.mbMarker.setPosition(e.latLng);
            document.getElementById('mbLat').value = e.latLng.lat();
            document.getElementById('mbLng').value = e.latLng.lng();
        });
    };
 

    if (b.mapCoordinates && b.mapCoordinates.lat && b.mapCoordinates.lng) {
        mapContainer.classList.remove('hidden');
        gMapsLink.classList.remove('hidden');
        noMapMsg.classList.add('hidden');
        
        const lat = parseFloat(b.mapCoordinates.lat);
        const lng = parseFloat(b.mapCoordinates.lng);

        // Update external Google Maps Link
        gMapsLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

        // Render Map
        if (!window.adminDetailsMap) {
            window.adminDetailsMap = new google.maps.Map(mapContainer, {
                zoom: 15,
                center: { lat, lng },
                mapTypeControl: false,
                streetViewControl: false
            });
            window.adminDetailsMarker = new google.maps.Marker({
                position: { lat, lng },
                map: window.adminDetailsMap
            });
        } else {
            window.adminDetailsMap.setCenter({ lat, lng });
            window.adminDetailsMarker.setPosition({ lat, lng });
        }
    } else {
        mapContainer.classList.add('hidden');
        gMapsLink.classList.add('hidden');
        noMapMsg.classList.remove('hidden');
    }


    document.getElementById('detailsModal').classList.remove('hidden');
}



function openGenerateModal(id) {
    document.getElementById('genBookingId').value = id;
    document.getElementById('generateReportForm').reset();
    
    // Populate the 6 standard checks dynamically
    const container = document.getElementById('systemChecksContainer');
    container.innerHTML = standardChecks.map((check, index) => `
        <div class="bg-white border border-gray-200 p-4 rounded shadow-sm">
            <div class="flex justify-between items-center mb-2">
                <label class="font-bold text-gray-800 uppercase tracking-widest text-xs">${check}</label>
                <select id="check_status_${index}" required class="border p-1 text-xs rounded font-bold bg-gray-50">
                    <option value="Pass">PASS</option>
                    <option value="Warning">WARNING</option>
                    <option value="Fail">FAIL</option>
                </select>
                <input type="hidden" id="check_name_${index}" value="${check}">
            </div>
            <textarea id="check_notes_${index}" rows="2" placeholder="Notes for ${check}..." class="w-full border p-2 rounded text-sm mt-1 focus:ring-truespec-sky"></textarea>
        </div>
    `).join('');

    document.getElementById('generateModal').classList.remove('hidden');
}




// Open the Scheduling Modal
function openScheduleModal(id) {
    document.getElementById('schedBookingId').value = id;
    document.getElementById('scheduleForm').reset();
    document.getElementById('scheduleModal').classList.remove('hidden');
}

// Handle Scheduling Form Submission
document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('schedBookingId').value;
    const btn = document.getElementById('btnScheduleSubmit');
    
    const payload = {
        status: 'scheduled',
        assignedMechanic: document.getElementById('schedMechanic').value,
        scheduledTime: document.getElementById('schedTime').value,
        estimatedDuration: document.getElementById('schedDuration').value
    };

    btn.disabled = true; btn.innerText = "Saving...";

    try {
        const res = await adminFetch(`${API_BASE_URL}/api/data/admin/bookings/${id}/schedule`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            closeModal('scheduleModal');
            fetchAdminData();
        } else {
            alert("Failed to schedule booking");
        }
    } catch (e) {
        console.error(e);
        alert("Network Error");
    } finally {
        btn.disabled = false; btn.innerText = "Confirm Schedule";
    }
});




// Note: You will need to build the actual HTML modal in your admin-portal.html 
// with the ID 'reviewModal', containing inputs for the report fields and the invoice price.

async function openReviewModal(bookingId) {
    // 1. Find the booking from your global state
    const booking = globalAdminBookings.find(b => b._id === bookingId);
    if (!booking || !booking.report) {
        alert("Report data not found for this booking.");
        return;
    }

    const r = booking.report; // Short reference for easier typing

    // 2. Populate Admin Review Modal fields (Mirroring our Mongoose Schema)
    
    // Technical Specs
    document.getElementById('admin_odometer').value = r.odometer || '';
    document.getElementById('admin_vin').value = r.vin || '';
    document.getElementById('admin_engine_type').value = r.engineType || 'Petrol';
    document.getElementById('admin_transmission').value = r.transmission || 'Automatic';

    // Exterior & Body
    document.getElementById('admin_exterior_status').value = r.exterior?.status || 'Green';
    document.getElementById('admin_exterior_alignment').value = r.exterior?.alignment || 'OK';
    document.getElementById('admin_exterior_paint').value = r.exterior?.paint || 'OK';
    document.getElementById('admin_exterior_dents').value = r.exterior?.dents || 'None';
    document.getElementById('admin_exterior_glass').value = r.exterior?.glass || 'OK';
    document.getElementById('admin_exterior_notes').value = r.exterior?.notes || '';

    // Tyres, Engine, Interior, Diag, Road Test (Status + Notes)
    const sections = ['tyres', 'engineBay', 'interior', 'diagnostics', 'roadTest'];
    sections.forEach(sec => {
        if (document.getElementById(`admin_${sec}_status`)) {
            document.getElementById(`admin_${sec}_status`).value = r[sec]?.status || 'Green';
        }
        if (document.getElementById(`admin_${sec}_notes`)) {
            document.getElementById(`admin_${sec}_notes`).value = r[sec]?.notes || '';
        }
    });

    // Final Assessment
    document.getElementById('admin_overallRating').value = r.overallRating || 'AMBER';
    document.getElementById('admin_professionalRecommendation').value = r.professionalRecommendation || 'Suitable';
    document.getElementById('admin_keyFindings').value = r.keyFindings || '';

    // Invoice Price (stored on the Booking, not the report)
    document.getElementById('invoicePrice').value = booking.price || 5000;

    // 3. Show the modal
    document.getElementById('reviewModal').classList.remove('hidden');

    // 4. Handle the Approval Submission
    const approveBtn = document.getElementById('approveReportBtn');
    
    // Clear old listeners
    const newApproveBtn = approveBtn.cloneNode(true);
    approveBtn.parentNode.replaceChild(newApproveBtn, approveBtn);

    newApproveBtn.addEventListener('click', async () => {
        newApproveBtn.textContent = 'Publishing...';
        newApproveBtn.disabled = true;

        // Collect all data back into an object
        // We use underscores so the backend mapping logic we wrote earlier handles it perfectly
        const editedReportData = {
            odometer: document.getElementById('admin_odometer').value,
            vin: document.getElementById('admin_vin').value,
            engine_type: document.getElementById('admin_engine_type').value,
            transmission: document.getElementById('admin_transmission').value,
            
            exterior_status: document.getElementById('admin_exterior_status').value,
            exterior_alignment: document.getElementById('admin_exterior_alignment').value,
            exterior_paint: document.getElementById('admin_exterior_paint').value,
            exterior_dents: document.getElementById('admin_exterior_dents').value,
            exterior_glass: document.getElementById('admin_exterior_glass').value,
            exterior_notes: document.getElementById('admin_exterior_notes').value,

            tyres_status: document.getElementById('admin_tyres_status').value,
            tyres_notes: document.getElementById('admin_tyres_notes').value,

            engine_status: document.getElementById('admin_engineBay_status').value,
            engine_notes: document.getElementById('admin_engineBay_notes').value,

            interior_status: document.getElementById('admin_interior_status').value,
            interior_notes: document.getElementById('admin_interior_notes').value,

            diag_status: document.getElementById('admin_diagnostics_status').value,
            diag_notes: document.getElementById('admin_diagnostics_notes').value,

            road_status: document.getElementById('admin_roadTest_status').value,
            road_notes: document.getElementById('admin_roadTest_notes').value,

            overall_rating: document.getElementById('admin_overallRating').value,
            recommendation: document.getElementById('admin_professionalRecommendation').value,
            key_findings: document.getElementById('admin_keyFindings').value
        };

        const finalPrice = document.getElementById('invoicePrice').value;

        try {
            const response = await fetch(`/api/data/bookings/${bookingId}/approve-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}` // Ensure token is passed
                },
                body: JSON.stringify({
                    reportData: editedReportData,
                    price: finalPrice
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Success! Report published and invoice generated.');
                document.getElementById('reviewModal').classList.add('hidden');
                // Trigger dashboard refresh
                window.location.reload(); // Simple way to refresh all data and reflect changes 
            } else {
                throw new Error(data.message || 'Failed to approve');
            }
        } catch (error) {
            console.error('Approval Error:', error);
            alert(`Error: ${error.message}`);
            newApproveBtn.textContent = 'Approve & Generate PDF';
            newApproveBtn.disabled = false;
        }
    });

    setTimeout(() => {
        const allStatusSelects = document.querySelectorAll('.admin-status-select');
        allStatusSelects.forEach(select => applyStatusColoring(select));
    }, 500); // Small timeout to ensure DOM is ready
}




/**
 * Updates the visual style of a section based on its status value (Green/Amber/Red)
 * @param {HTMLElement} selectElement - The select dropdown that was changed
 */
function applyStatusColoring(selectElement) {
    // Find the closest container to highlight. 
    // In our modal, this is the <section> or the <div> with 'border'
    const container = selectElement.closest('section') || selectElement.closest('.border');
    if (!container) return;

    const val = selectElement.value.toUpperCase();

    // Reset classes
    container.classList.remove('bg-green-50', 'border-green-400', 'bg-yellow-50', 'border-yellow-400', 'bg-red-50', 'border-red-400', 'bg-gray-50');

    // Apply specific styles
    if (val === 'GREEN') {
        container.classList.add('bg-green-50', 'border-green-400');
    } else if (val === 'AMBER') {
        container.classList.add('bg-yellow-50', 'border-yellow-400');
    } else if (val === 'RED') {
        container.classList.add('bg-red-50', 'border-red-400');
    } else {
        container.classList.add('bg-gray-50');
    }
}

// Event Listener for real-time changes
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('admin-status-select')) {
        applyStatusColoring(e.target);
    }
});