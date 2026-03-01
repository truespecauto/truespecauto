let adminToken = localStorage.getItem('adminToken');
let adminUser = JSON.parse(localStorage.getItem('adminUser'));
let currentAuthEmail = '';
let globalAdminBookings = [];

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

function renderActionButton(b) {
    if (b.status === 'pending') return `<button onclick="openUploadModal('${b._id}')" class="px-3 py-1.5 bg-truespec-navy text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-blue-900">Upload Docs</button>`;
    if (b.status === 'payment_submitted') return `<button onclick="openVerifyModal('${b._id}', '${b.paymentTransactionCode}', '${b.paymentScreenshotKey}')" class="px-3 py-1.5 bg-truespec-amber text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-yellow-600 animate-pulse">Verify Pay</button>`;
    return `<span class="text-xs text-gray-400 font-bold uppercase tracking-widest">-</span>`;
}

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

document.getElementById('uploadDocsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('uploadBookingId').value;
    const price = document.getElementById('uploadPrice').value;
    const reportFile = document.getElementById('uploadReport').files[0];
    const invoiceFile = document.getElementById('uploadInvoice').files[0];
    const btn = document.getElementById('btnUploadSubmit');
    
    btn.disabled = true; btn.innerText = "Uploading...";
    const formData = new FormData();
    formData.append('price', price); formData.append('report', reportFile); formData.append('invoice', invoiceFile);

    try {
        const res = await adminFetch(`${API_BASE_URL}/api/data/admin/upload-docs/${id}`, { method: 'PUT', body: formData });
        if (res.ok) {
            closeModal('uploadModal'); document.getElementById('uploadDocsForm').reset(); fetchAdminData();
        } else {
            const data = await res.json(); alert(data.message || 'Upload failed');
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; btn.innerText = "Upload & Bill"; }
});

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
    const payload = {
        name: document.getElementById('mbName').value, email: document.getElementById('mbEmail').value,
        phone: document.getElementById('mbPhone').value, make: document.getElementById('mbMake').value,
        model: document.getElementById('mbModel').value, year: document.getElementById('mbYear').value,
        inspectionType: document.getElementById('mbType').value, sellerName: document.getElementById('mbSeller').value,
        locationText: document.getElementById('mbLocation').value, preferredDate: document.getElementById('mbPreferredDate').value
    };

    try {
        const res = await adminFetch(API_BASE_URL + '/api/data/admin/book', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Booking Created!"); document.getElementById('manualBookingForm').reset();
            switchTab('dashboard'); fetchAdminData();
        } else { alert("Error creating booking"); }
    } catch (e) { console.error(e); }
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
        activeBtn.classList.remove('text-gray-400'); activeBtn.classList.add('text-truespec-navy', 'border-b-2', 'border-truespec-navy');
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

    document.getElementById('detailsModal').classList.remove('hidden');
}



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

    // --- RENDER MAP ---
    const mapContainer = document.getElementById('detMapContainer');
    const noMapMsg = document.getElementById('detNoMapMsg');
    
    if (b.mapCoordinates && b.mapCoordinates.lat && b.mapCoordinates.lng) {
        mapContainer.classList.remove('hidden');
        noMapMsg.classList.add('hidden');
        
        const lat = b.mapCoordinates.lat;
        const lng = b.mapCoordinates.lng;

        if (!adminDetailsMap) {
            adminDetailsMap = L.map('detMapContainer').setView([lat, lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminDetailsMap);
            adminDetailsMarker = L.marker([lat, lng]).addTo(adminDetailsMap);
        } else {
            adminDetailsMap.setView([lat, lng], 15);
            adminDetailsMarker.setLatLng([lat, lng]);
        }
        
        // Timeout needed for Leaflet maps hidden inside modals to size correctly
        setTimeout(() => adminDetailsMap.invalidateSize(), 100);
    } else {
        mapContainer.classList.add('hidden');
        noMapMsg.classList.remove('hidden');
    }

    document.getElementById('detailsModal').classList.remove('hidden');
}


