document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        document.body.innerHTML = '<div class="p-10 text-center text-red-600 font-bold">Invalid or missing link.</div>';
        return;
    }

    const saveStatus = document.getElementById('saveStatus');
    const reportForm = document.getElementById('reportForm');

    // 1. Fetch Initial Data
    try {
        const response = await fetch(`/api/data/mechanic/report/${token}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        // Populate Car Info Banner
        const b = data.booking;
        document.getElementById('carInfo').innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <div class="font-bold text-lg">${b.year} ${b.make} ${b.model}</div>
                    <div class="opacity-90">${b.registrationNumber} • ${b.locationText}</div>
                </div>
                <div class="text-right">
                    <div class="font-mono text-xs opacity-75">ID: ${token.slice(0,8)}</div>
                    <div>${new Date(b.scheduledTime).toLocaleString()}</div>
                </div>
            </div>
        `;

        // Populate existing report data
        if (data.report) {
            Object.keys(data.report).forEach(key => {
                if(typeof data.report[key] === 'string'||typeof data.report[key] === 'number') {
                      const input = reportForm.elements[key];
                        if (input) {
                            if (input.type === 'radio') {
                                // Handle radio buttons
                                const radio = Array.from(reportForm.elements[key]).find(r => r.value === data.report[key]);
                                console.log('Setting radio', key, 'to', data.report[key], radio);
                                if (radio) radio.checked = true;
                            } else {
                                input.value = data.report[key];
                            }
                        }

                }else if(typeof data.report[key] === 'object' && data.report[key] !== null) {
                    // Handle nested objects (e.g., engine, brakes)
                    Object.keys(data.report[key]).forEach(subKey => {
                        const input = reportForm.elements[`${key}_${subKey}`];
                        if (input) {
                            if (input.type === 'radio') {
                                const radio = Array.from(reportForm.elements[`${key}_${subKey}`]).find(r => r.value === data.report[key][subKey]);
                                console.log('Setting radio', `${key}_${subKey}`, 'to', data.report[key][subKey], radio);
                                if (radio) radio.checked = true;
                            } else {
                                console.log('Setting input', `${key}_${subKey}`, 'to', data.report[key][subKey]);
                                input.value = data.report[key][subKey];
                            }
                        }
                        

                });
            }
                
              
            });
        }

        if (data.report.status !== 'draft') {
            document.getElementById('reportForm').innerHTML = `
                <div class="bg-white p-10 text-center rounded-lg shadow">
                    <div class="text-green-500 text-5xl mb-4">✓</div>
                    <p class="text-green-600 font-bold text-xl">Report Already Submitted</p>
                    <p class="text-gray-500">This report has been finalized and sent to admin.</p>
                </div>`;
        }

    } catch (error) {
        document.body.innerHTML = `<div class="p-10 text-center text-red-600">${error.message}</div>`;
        return;
    }

    // 2. Auto-Save Logic (Using FormData to handle all input types)
    let timeoutId;

    const autoSave = async () => {
        saveStatus.textContent = 'Saving...';
        
        const formData = new FormData(reportForm);
        const reportData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`/api/data/mechanic/report/${token}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData)
            });

            if (response.ok) {
                saveStatus.textContent = 'All changes saved.';
                setTimeout(() => { if(saveStatus.textContent === 'All changes saved.') saveStatus.textContent = ''; }, 3000);
            }
        } catch (error) {
            saveStatus.textContent = 'Error saving!';
            saveStatus.classList.add('bg-red-600');
        }
    };

    // Attach listeners to all inputs/selects/textareas
    reportForm.addEventListener('input', (e) => {
        if (e.target.classList.contains('auto-save-field')) {
            saveStatus.textContent = 'Typing...';
            clearTimeout(timeoutId);
            timeoutId = setTimeout(autoSave, 1000); 
        }
    });

    // 3. Submit Function
    document.getElementById('submitBtn').addEventListener('click', async () => {
        const confirmMsg = "Finalizing will lock this report and send it to the Admin. Proceed?";
        if (!confirm(confirmMsg)) return;

        // One last save before submitting
        await autoSave();

        try {
            const response = await fetch(`/api/data/mechanic/report/${token}/submit`, {
                method: 'POST'
            });

            if (response.ok) {
                window.scrollTo(0,0);
                document.getElementById('reportForm').innerHTML = `
                    <div class="text-center py-20 bg-white rounded-lg shadow">
                        <h2 class="text-3xl font-bold text-green-600">Success!</h2>
                        <p class="text-gray-600 mt-4 text-lg">Report submitted. You can safely close this window.</p>
                    </div>`;
            }
        } catch (error) {
            alert('Failed to submit. Please check your internet and try again.');
        }
    });
});