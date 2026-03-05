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
function renderActionButton(b) {
    // Inside your renderActionButton function:
if (b.status === 'pending') return `<button onclick="openScheduleModal('${b._id}')" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-blue-700">Schedule</button>`;

    if (b.status === 'scheduled') return `<button onclick="updateAdminStatus('${b._id}', 'inspection_completed')" class="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-indigo-700">Mark Inspected</button>`;
    
    // NEW BUILD REPORT BUTTON
    if (b.status === 'inspection_completed') return `<button onclick="openGenerateModal('${b._id}')" class="px-3 py-1.5 bg-truespec-navy text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-blue-900">Build Report</button>`;
    
    if (b.status === 'payment_submitted') return `<button onclick="openVerifyModal('${b._id}', '${b.paymentTransactionCode}', '${b.paymentScreenshotKey}')" class="px-3 py-1.5 bg-truespec-amber text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-yellow-600 animate-pulse">Verify Pay</button>`;
    return `<span class="text-xs text-gray-400 font-bold uppercase tracking-widest">-</span>`;
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
    
    document.getElementById('detVehicle').innerText = `${b.make} ${b.model}`;
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
    
    document.getElementById('detVehicle').innerText = `${b.make} ${b.model}`;
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
    if (b.paymentScreenshotKey) {
        paymentProofContainer.innerHTML = `
            <a href="${API_BASE_URL}/api/data/files/${b.paymentScreenshotKey}?token=${adminToken}" target="_blank" 
               class="px-4 py-2 bg-blue-50 border border-blue-200 text-truespec-sky text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-100 flex items-center">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View Payment Proof
            </a>
            <p class="text-xs text-gray-500 mt-1">Transaction Code: ${b.paymentTransactionCode || 'N/A'}</p>
        `;
    } else {
        paymentProofContainer.innerHTML = `<span class="text-gray-400 italic text-xs">No payment proof provided.</span>`;
    }


    //Populate Report
    const reportContainer = document.getElementById('detReports');
    console.log("Report Key:", reportContainer); // Debug log to check the value
    if (b.reportPdfKey) {
        reportContainer.innerHTML = `
            <a href="${API_BASE_URL}/api/data/files/${b.reportPdfKey}?token=${adminToken}" target="_blank" 
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

document.getElementById('generateReportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('genBookingId').value;
    const btn = document.getElementById('btnGenerateSubmit');
    
    // Collect System Checks
    const systemChecks = [];
    for (let i = 0; i < standardChecks.length; i++) {
        systemChecks.push({
            name: document.getElementById(`check_name_${i}`).value,
            status: document.getElementById(`check_status_${i}`).value,
            notes: document.getElementById(`check_notes_${i}`).value
        });
    }

    const payload = {
        price: document.getElementById('genPrice').value,
        overallRating: document.getElementById('genRating').value,
        summaryNotes: document.getElementById('genSummary').value,
        systemChecks: systemChecks
    };

    btn.disabled = true; 
    btn.innerText = "Generating PDFs... Please Wait.";

    try {
        const res = await adminFetch(`${API_BASE_URL}/api/data/admin/generate-report/${id}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            alert("Report & Invoice Generated Successfully! Client Billed.");
            closeModal('generateModal');
            fetchAdminData();
        } else {
            const data = await res.json(); 
            alert(data.message || 'Generation failed');
        }
    } catch (e) { 
        console.error(e); 
        alert("Network Error");
    } finally { 
        btn.disabled = false; 
        btn.innerText = "Generate & Bill Client"; 
    }
});


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
        const res = await adminFetch(`${API_BASE_URL}/api/data/admin/status/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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


