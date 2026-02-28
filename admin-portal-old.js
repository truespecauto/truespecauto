// --- STATE ---
let adminToken = localStorage.getItem('adminToken');
let adminUser = JSON.parse(localStorage.getItem('adminUser'));
let currentAuthEmail = '';

// --- INIT ---
if (adminToken && adminUser && adminUser.role === 'admin') {
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('portalContent').classList.remove('hidden');
    document.getElementById('adminNameDisplay').innerText = adminUser.name;
    fetchAdminData();
}

// --- AUTHENTICATION FLOW ---
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.innerText = "Checking...";

    try {
        const res = await fetch('/api/auth/login', {
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
        const res = await fetch('/api/auth/verify-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentAuthEmail, otp })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data));
            window.location.reload(); // Reload to initialize portal
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

// --- FETCH WRAPPER (Handles 401 Expiry) ---
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

// --- DASHBOARD ---
async function fetchAdminData() {
    try {
        const res = await adminFetch('/api/data/dashboard');
        const data = await res.json();
        renderTable(data.bookings);
    } catch (err) {
        console.error("Failed to fetch dashboard data");
    }
}

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
            <td class="px-6 py-4 text-right">
                ${renderActionButton(b)}
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
    if (b.status === 'pending') {
        return `<button onclick="openUploadModal('${b._id}')" class="px-3 py-1.5 bg-truespec-navy text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-blue-900">Upload Docs</button>`;
    }
    if (b.status === 'payment_submitted') {
        return `<button onclick="openVerifyModal('${b._id}', '${b.paymentTransactionCode}', '${b.paymentScreenshotKey}')" class="px-3 py-1.5 bg-truespec-amber text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-yellow-600 animate-pulse">Verify Pay</button>`;
    }
    return `<span class="text-xs text-gray-400 font-bold uppercase tracking-widest">-</span>`;
}

// --- ACTIONS & MODALS ---

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
        document.getElementById('verifyScreenshotLink').href = `/api/data/files/${screenshotKey}?token=${adminToken}`;
    } else {
        ssContainer.classList.add('hidden');
    }
    document.getElementById('verifyModal').classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Handle Upload Form
document.getElementById('uploadDocsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('uploadBookingId').value;
    const price = document.getElementById('uploadPrice').value;
    const reportFile = document.getElementById('uploadReport').files[0];
    const invoiceFile = document.getElementById('uploadInvoice').files[0];
    
    const btn = document.getElementById('btnUploadSubmit');
    btn.disabled = true; btn.innerText = "Uploading...";

    const formData = new FormData();
    formData.append('price', price);
    formData.append('report', reportFile);
    formData.append('invoice', invoiceFile);

    try {
        const res = await adminFetch(`/api/data/admin/upload-docs/${id}`, {
            method: 'PUT',
            body: formData // DO NOT set Content-Type header with FormData
        });
        
        if (res.ok) {
            closeModal('uploadModal');
            document.getElementById('uploadDocsForm').reset();
            fetchAdminData();
        } else {
            const data = await res.json();
            alert(data.message || 'Upload failed');
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; btn.innerText = "Upload & Bill"; }
});

// Handle Verification
async function confirmPayment() {
    const id = document.getElementById('verifyBookingId').value;
    const btn = document.getElementById('btnVerifySubmit');
    btn.disabled = true; btn.innerText = "Processing...";

    try {
        const res = await adminFetch(`/api/data/admin/verify-payment/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            closeModal('verifyModal');
            fetchAdminData();
        } else {
            alert("Error verifying payment");
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; btn.innerText = "Approve & Unlock"; }
}

// Handle Manual Booking
document.getElementById('manualBookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('mbName').value,
        email: document.getElementById('mbEmail').value,
        phone: document.getElementById('mbPhone').value,
        make: document.getElementById('mbMake').value,
        model: document.getElementById('mbModel').value,
        year: document.getElementById('mbYear').value,
        inspectionType: document.getElementById('mbType').value,
        sellerName: document.getElementById('mbSeller').value,
        locationText: document.getElementById('mbLocation').value,
        preferredDate: document.getElementById('mbPreferredDate').value
    };

    try {
        const res = await adminFetch('/api/data/admin/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Booking Created!");
            document.getElementById('manualBookingForm').reset();
            switchTab('dashboard');
            fetchAdminData();
        } else {
            alert("Error creating booking");
        }
    } catch (e) { console.error(e); }
});

// Tab Logic
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
}
