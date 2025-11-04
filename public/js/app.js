class AttendanceDashboard {
    constructor() {
        this.apiBaseUrl = '/api';
        this.refreshInterval = 30000;
        this.currentFilters = {};
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.students = new Map();
        this.sortColumn = 'timestamp';
        this.sortDirection = 'desc';

        this.init();
    }

    init() {
        console.log('Dashboard initializing...');

        // Set initial loading state for QR container
        const qrContainer = document.getElementById('qrContainer');
        if (qrContainer) {
            qrContainer.innerHTML = '<div style="color: #6c757d; padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i><br>Initializing...</div>';
        }

        this.testAPIConnection();
        this.setupEventListeners();
        this.loadStudents();
        this.loadData();
        this.startAutoRefresh();
        this.setTodayDate();
        this.checkWhatsAppStatus(); // Check if WhatsApp is already running
    }

    async testAPIConnection() {
        try {
            console.log('Testing API connection...');
            const response = await fetch('/api/health');
            console.log('Health check response:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('Health check data:', data);
            return true;
        } catch (error) {
            console.error('API connectivity test failed:', error);
            document.getElementById('statusText').textContent = 'API Error';
            document.getElementById('statusText').style.color = '#dc3545';
            document.getElementById('qrContainer').innerHTML = `<div style="color: #dc3545; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br>Cannot connect to server<br><small>${error.message}</small></div>`;
            return false;
        }
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.showLoading();
            this.loadData();
        });

        // Upload button and modal
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadModal = document.getElementById('uploadModal');
        const closeModal = uploadModal.querySelector('.close');
        const fileInput = document.getElementById('fileInput');
        const fileUploadArea = document.getElementById('fileUploadArea');
        const browseLink = fileUploadArea.querySelector('.browse-link');
        const startBtn = document.getElementById('startAgentBtn');
        const stopBtn = document.getElementById('stopAgentBtn');
        const statusText = document.getElementById('statusText');
        const qrContainer = document.getElementById('qrContainer');

        const launchCollegeBtn = document.getElementById('launchCollegeBtn');
        const markCollegeBtn = document.getElementById('markCollegeBtn');
        const stopCollegeBtn = document.getElementById('stopCollegeBtn');

        if (launchCollegeBtn) {
            launchCollegeBtn.addEventListener('click', async () => {
                this.showToast('Launching browser... Please log in.', 'info');
                launchCollegeBtn.disabled = true;
                launchCollegeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Launching...';
                try {
                    const response = await fetch('/api/college/start', { method: 'POST' });
                    const result = await response.json();
                    if (result.success) {
                        this.showToast('Browser launched. Please log in. Once you are on the dashboard, you can mark attendance.', 'success');
                    } else {
                        this.showToast(`Error: ${result.message}`, 'error');
                    }
                } catch (e) {
                    this.showToast(`Fetch error: ${e.message}`, 'error');
                }
                launchCollegeBtn.disabled = false;
                launchCollegeBtn.innerHTML = '<i class="fas fa-rocket"></i> Launch College Portal';
            });
        }

        if (markCollegeBtn) {
            markCollegeBtn.addEventListener('click', async () => {
                const date = document.getElementById('dateFilter').value;
                const groupName = document.getElementById('groupFilter').value;

                if (!date || !groupName) {
                    this.showToast('Please select a Date and Group from the filters below first!', 'warning');
                    return;
                }

                this.showToast('Starting automation... The browser window will now be controlled.', 'info');
                markCollegeBtn.disabled = true;
                markCollegeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marking...';

                try {
                    const response = await fetch('/api/college/mark', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date, groupName })
                    });
                    const result = await response.json();
                    if (result.success) {
                        this.showToast(result.message, 'success');
                    } else {
                        this.showToast(`Error: ${result.message}`, 'error');
                    }
                } catch (e) {
                    this.showToast(`Fetch error: ${e.message}`, 'error');
                }
                markCollegeBtn.disabled = false;
                markCollegeBtn.innerHTML = '<i class="fas fa-check-double"></i> Mark Attendance on Portal';
            });
        }

        if (stopCollegeBtn) {
            stopCollegeBtn.addEventListener('click', async () => {
                this.showToast('Stopping agent and closing browser...', 'info');
                try {
                    await fetch('/api/college/stop', { method: 'POST' });
                    this.showToast('Portal agent stopped.', 'success');
                } catch (e) {
                    this.showToast(`Error: ${e.message}`, 'error');
                }
            });
        }

        startBtn.addEventListener('click', async () => {
            try {
                startBtn.disabled = true;
                startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';

                const res = await fetch('/api/whatsapp/start', { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    statusText.textContent = 'Starting...';
                    this.showToast(data.message, 'success');
                    this.pollForQr();
                } else {
                    this.showToast(data.message, 'error');
                }
            } catch (e) {
                this.showToast('Failed to start WhatsApp agent', 'error');
            } finally {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-play"></i> Start WhatsApp Agent';
            }
        });

        stopBtn.addEventListener('click', async () => {
            try {
                stopBtn.disabled = true;
                stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stopping...';

                const res = await fetch('/api/whatsapp/stop', { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    statusText.textContent = 'Stopped';
                    qrContainer.innerHTML = '';
                    this.showToast(data.message, 'success');
                } else {
                    this.showToast(data.message, 'error');
                }
            } catch (e) {
                this.showToast('Failed to stop WhatsApp agent', 'error');
            } finally {
                stopBtn.disabled = false;
                stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop WhatsApp Agent';
            }
        });

        uploadBtn.addEventListener('click', () => {
            uploadModal.style.display = 'block';
        });

        closeModal.addEventListener('click', () => {
            uploadModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === uploadModal) {
                uploadModal.style.display = 'none';
            }
        });

        browseLink.addEventListener('click', () => {
            fileInput.click();
        });

        fileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag and drop
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('drag-over');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadFile(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadFile(e.target.files[0]);
            }
        });

        // Filter events
        document.getElementById('dateFilter').addEventListener('change', (e) => {
            this.currentFilters.date = e.target.value;
            this.currentPage = 1;
            this.loadAttendance();
        });

        document.getElementById('groupFilter').addEventListener('change', (e) => {
            this.currentFilters.group = e.target.value;
            this.currentPage = 1;
            this.loadAttendance();
        });

        document.getElementById('rollFilter').addEventListener('input',
            this.debounce((e) => {
                this.currentFilters.rollNo = e.target.value;
                this.currentPage = 1;
                this.loadAttendance();
            }, 500)
        );

        document.getElementById('nameFilter').addEventListener('input',
            this.debounce((e) => {
                this.currentFilters.name = e.target.value;
                this.currentPage = 1;
                this.loadAttendance();
            }, 500)
        );

        // Clear filters
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Apply filters
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.currentPage = 1;
            this.loadAttendance();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Print button
        document.getElementById('printBtn').addEventListener('click', () => {
            window.print();
        });

        // View toggle
        document.getElementById('tableView').addEventListener('click', () => {
            this.switchView('table');
        });

        document.getElementById('cardView').addEventListener('click', () => {
            this.switchView('card');
        });

        // Select all checkbox
        document.getElementById('selectAll').addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // Sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                const column = e.target.dataset.column;
                this.sortTable(column);
            });
        });
    }

    async uploadFile(file) {
        //  UPDATED FILE CHECK 
        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedExtensions.includes(fileExt)) {
            this.showToast('Please upload a CSV, XLSX, or XLS file', 'error');
            return;
        }
        // END OF UPDATED CHECK 
        
        const formData = new FormData();
        formData.append('studentFile', file);

        const progressElement = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        try {
            progressElement.style.display = 'block';
            progressFill.style.width = '0%';
            progressText.textContent = 'Uploading...';

            // Simulate progress
            const progressInterval = setInterval(() => {
                const currentWidth = parseFloat(progressFill.style.width);
                if (currentWidth < 90) {
                    progressFill.style.width = (currentWidth + 10) + '%';
                }
            }, 100);

            const response = await fetch(`${this.apiBaseUrl}/students/upload`, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            progressText.textContent = 'Processing...';

            const result = await response.json();

            if (result.success) {
                this.showToast(result.message, 'success');
                document.getElementById('uploadModal').style.display = 'none';
                await this.loadStudents();
                await this.loadData();
            } else {
                this.showToast(result.error, 'error');
            }
        } catch (error) {
            this.showToast('Upload failed: ' + error.message, 'error');
        } finally {
            setTimeout(() => {
                progressElement.style.display = 'none';
                progressFill.style.width = '0%';
            }, 2000);
        }
    }

    async loadStudents() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/students`);
            const result = await response.json();

            if (result.success) {
                this.students.clear();
                result.data.forEach(student => {
                    this.students.set(student.roll_no, student);
                });
                document.getElementById('studentCount').textContent = result.data.length;
            }
        } catch (error) {
            console.error('Error loading students:', error);
        }
    }

    setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dateFilter').value = today;
        this.currentFilters.date = today;
    }

    async checkWhatsAppStatus() {
        try {
            console.log('Checking WhatsApp status...');
            console.log('API URL:', `${window.location.origin}/api/whatsapp/status`);

            const res = await fetch('/api/whatsapp/status');
            console.log('Response received:', res);
            console.log('Response status:', res.status);
            console.log('Response ok:', res.ok);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            console.log('Status response:', data);

            if (data.success) {
                const status = data.status;
                const statusText = document.getElementById('statusText');
                const qrContainer = document.getElementById('qrContainer');

                console.log('Status details:', status);

                if (!status.running) {
                    statusText.textContent = 'Stopped';
                    statusText.style.color = '#dc3545';
                    qrContainer.innerHTML = '<div style="color: #666; padding: 20px; text-align: center;"><i class="fas fa-power-off"></i><br>Click "Start WhatsApp Agent" to begin</div>';
                } else if (status.hasQrCode) {
                    statusText.textContent = 'Waiting for QR scan...';
                    statusText.style.color = '#ffc107';
                    console.log('Rendering QR code:', status.qrCode ? 'QR data available' : 'No QR data');
                    this.renderQr(status.qrCode);
                    this.pollForQr(); // Start polling for status updates
                } else if (status.connected) {
                    statusText.textContent = 'Connected';
                    statusText.style.color = '#25D366';
                    qrContainer.innerHTML = '<div style="color: #25D366; font-weight: bold; padding: 20px; text-align: center;"><i class="fas fa-check-circle fa-2x"></i><br>WhatsApp Connected Successfully!</div>';
                } else {
                    statusText.textContent = 'Starting...';
                    statusText.style.color = '#17a2b8';
                    qrContainer.innerHTML = '<div style="color: #17a2b8; padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i><br>Initializing WhatsApp...</div>';
                }
            } else {
                throw new Error('API returned success: false');
            }
        } catch (error) {
            console.error('Error checking WhatsApp status:', error);
            document.getElementById('statusText').textContent = 'Unknown';
            document.getElementById('statusText').style.color = '#6c757d';
            document.getElementById('qrContainer').innerHTML = `<div style="color: #dc3545; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br>Connection error: ${error.message}</div>`;
        }
    }

    async pollForQr() {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();

            if (data.success) {
                const status = data.status;
                const statusText = document.getElementById('statusText');
                const qrContainer = document.getElementById('qrContainer');

                if (status.hasQrCode) {
                    statusText.textContent = 'Waiting for QR scan...';
                    statusText.style.color = '#ffc107';
                    this.renderQr(status.qrCode);
                    setTimeout(() => this.pollForQr(), 2000); // Poll every 2 seconds
                } else if (status.connected) {
                    statusText.textContent = 'Connected';
                    statusText.style.color = '#25D366';
                    qrContainer.innerHTML = '<div style="color: #25D366; font-weight: bold; padding: 20px; text-align: center;"><i class="fas fa-check-circle fa-2x"></i><br>WhatsApp Connected Successfully!</div>';
                    // Stop polling when connected
                } else if (status.running) {
                    statusText.textContent = 'Connecting...';
                    statusText.style.color = '#17a2b8';
                    qrContainer.innerHTML = '<div style="color: #17a2b8; padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i><br>Establishing connection...</div>';
                    setTimeout(() => this.pollForQr(), 2000);
                } else {
                    // Agent stopped
                    statusText.textContent = 'Stopped';
                    statusText.style.color = '#dc3545';
                    qrContainer.innerHTML = '<div style="color: #dc3545; padding: 20px; text-align: center;"><i class="fas fa-times-circle"></i><br>Agent not running</div>';
                }
            }
        } catch (error) {
            console.error('QR polling error:', error);
            document.getElementById('qrContainer').innerHTML = '<div style="color: #dc3545; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br>Connection error</div>';
        }
    }

    // renderQr(qrString) {
    //     const qrContainer = document.getElementById('qrContainer');

    //     // Check if QRCode library is loaded
    //     if (typeof QRCode === 'undefined') {
    //         console.error('QRCode library not loaded, waiting...');
    //         qrContainer.innerHTML = '<div style="color: #ffc107; padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i><br>Loading QR Code...</div>';

    //         // Wait for library to load and retry with shorter timeout
    //         setTimeout(() => {
    //             if (typeof QRCode !== 'undefined') {
    //                 this.renderQr(qrString);
    //             } else {
    //                 qrContainer.innerHTML = '<div style="color: #dc3545; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br>QR Code library failed to load. Please refresh the page.</div>';
    //             }
    //         }, 500); // Reduced from 1000ms to 500ms
    //         return;
    //     }

    //     // Show immediate loading state
    //     qrContainer.innerHTML = '<div style="color: #333; margin-bottom: 10px;">Scan this QR code with WhatsApp:</div><div style="color: #6c757d; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Generating QR code...</div>';

    //     // Use setTimeout to allow UI to update before heavy QR generation
    //     setTimeout(() => {
    //         const canvas = document.createElement('canvas');
    //         qrContainer.innerHTML = '<div style="color: #333; margin-bottom: 10px;">Scan this QR code with WhatsApp:</div>';
    //         qrContainer.appendChild(canvas);

    //         QRCode.toCanvas(canvas, qrString, {
    //             width: 256,
    //             height: 256,
    //             margin: 1, // Reduced margin for faster generation
    //             color: {
    //                 dark: '#000000',
    //                 light: '#FFFFFF'
    //             },
    //             errorCorrectionLevel: 'M' // Medium error correction for faster generation
    //         }, function (error) {
    //             if (error) {
    //                 console.error('QR Code generation error:', error);
    //                 qrContainer.innerHTML = '<div style="color: #dc3545;">Error generating QR code</div>';
    //             }
    //         });
    //     }, 10); // Small delay to allow UI update
    // }

    renderQr(qrString) {
    const qrContainer = document.getElementById('qrContainer');

    // Check if QRCode library is loaded
    if (typeof QRCode === 'undefined') {
        console.error('QRCode library not loaded, waiting...');
        qrContainer.innerHTML = '<div style="color: #ffc107; padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i><br>Loading QR Code...</div>';

        setTimeout(() => {
            if (typeof QRCode !== 'undefined') {
                this.renderQr(qrString);
            } else {
                qrContainer.innerHTML = '<div style="color: #dc3545; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br>QR Code library failed to load. Please refresh the page.</div>';
            }
        }, 500);
        return;
    }

    // Clear the container
    qrContainer.innerHTML = '<div style="color: #333; margin-bottom: 10px;">Scan this QR code with WhatsApp:</div>';

    // Create a new QRCode instance
    new QRCode(qrContainer, {
        text: qrString,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
        margin : 200
    });
}
    async loadData() {
        try {
            await Promise.all([
                this.loadStats(),
                this.loadAttendance()
            ]);
            this.updateConnectionStatus(true);
        } catch (error) {
            console.error('Error loading data:', error);
            this.updateConnectionStatus(false);
            this.showToast('Failed to load data', 'error');
        }
    }

    async loadStats() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/stats`);
            const result = await response.json();

            if (result.success) {
                this.updateStats(result.data);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    updateStats(stats) {
        // Animate counter updates
        this.animateCounter('totalCount', stats.total || 0);
        this.animateCounter('todayCount', stats.today || 0);
        this.animateCounter('groupCount', stats.groups?.length || 0);

        // Update group filter options
        this.updateGroupFilter(stats.groups || []);
    }

    animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        const currentValue = parseInt(element.textContent) || 0;
        const increment = (targetValue - currentValue) / 20;
        let current = currentValue;

        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= targetValue) || (increment < 0 && current <= targetValue)) {
                current = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current);
        }, 50);
    }

    updateGroupFilter(groups) {
        const groupFilter = document.getElementById('groupFilter');
        const currentValue = groupFilter.value;

        groupFilter.innerHTML = '<option value="">All Groups</option>';

        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.group_name;
            option.textContent = `${group.group_name} (${group.count})`;
            groupFilter.appendChild(option);
        });

        if (currentValue) {
            groupFilter.value = currentValue;
        }
    }

    async loadAttendance() {
        try {
            const params = new URLSearchParams({
                ...this.currentFilters,
                page: this.currentPage,
                limit: this.itemsPerPage,
                sortBy: this.sortColumn,
                sortDir: this.sortDirection
            });

            const response = await fetch(`${this.apiBaseUrl}/attendance?${params}`);
            const result = await response.json();

            if (result.success) {
                this.updateAttendanceTable(result.data);
                this.updatePagination(result.total || result.data.length);
            }
        } catch (error) {
            console.error('Error loading attendance:', error);
            this.showToast('Failed to load attendance data', 'error');
        }
    }

    updateAttendanceTable(data) {
        const tbody = document.getElementById('attendanceBody');

        if (!data || data.length === 0) {
            tbody.innerHTML = `
        <tr class="empty-state">
          <td colspan="9">
            <div class="loading">
              <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.5;"></i>
              <div>
                <h3>No attendance records found</h3>
                <p>Try adjusting your filters or upload student data first.</p>
              </div>
            </div>
          </td>
        </tr>
      `;
            return;
        }

        tbody.innerHTML = data.map((record, index) => {
            const date = new Date(record.timestamp);
            const formattedDate = date.toLocaleDateString();
            const formattedTime = date.toLocaleTimeString();

            // Enhanced student name with lookup
            const student = this.students.get(record.roll_no);
            const displayName = student ? student.name : (record.student_name || 'Unknown');
            const hasStudentData = !!student;

            return `
        <tr class="animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.1}s">
          <td>
            <input type="checkbox" class="row-select" data-id="${record.id}">
          </td>
          <td>
            <div class="student-info">
              <strong class="${hasStudentData ? 'verified' : 'unverified'}">${displayName}</strong>
              ${hasStudentData ? '<i class="fas fa-check-circle" style="color: var(--success-color); margin-left: 5px;"></i>' : ''}
              ${student?.email ? `<br><small>${student.email}</small>` : ''}
            </div>
          </td>
          <td>
            <span class="roll-number">${record.roll_no}</span>
            ${student?.branch ? `<br><small>${student.branch} - ${student.section || ''}</small>` : ''}
          </td>
          <td>
            <span class="group-name">${record.group_name || 'N/A'}</span>
          </td>
          <td>${formattedDate}</td>
          <td>${formattedTime}</td>
          <td>
            <span class="status-badge present">Present</span>
          </td>
          <td>
            <div class="message-preview" title="${record.message}">
              ${record.message}
            </div>
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn action-btn btn-info" onclick="dashboard.showMessageDetails('${record.id}')" title="View Details">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn action-btn btn-secondary" onclick="dashboard.editRecord('${record.id}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
        }).join('');
    }

    updateConnectionStatus(isOnline) {
        const statusElement = document.getElementById('connectionStatus');
        const statusIcon = statusElement.querySelector('i');
        const statusText = statusElement.querySelector('span');

        if (isOnline) {
            statusElement.className = 'status online';
            statusText.textContent = 'Connected';
            statusIcon.className = 'fas fa-circle';
        } else {
            statusElement.className = 'status offline';
            statusText.textContent = 'Disconnected';
            statusIcon.className = 'fas fa-circle';
        }
    }

    updatePagination(totalRecords) {
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);
        const pagination = document.getElementById('pagination');
        const showingFrom = (this.currentPage - 1) * this.itemsPerPage + 1;
        const showingTo = Math.min(this.currentPage * this.itemsPerPage, totalRecords);

        document.getElementById('showingFrom').textContent = showingFrom;
        document.getElementById('showingTo').textContent = showingTo;
        document.getElementById('totalRecords').textContent = totalRecords;

        let paginationHTML = '';

        // Previous button
        paginationHTML += `
      <button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
              onclick="dashboard.changePage(${this.currentPage - 1})" 
              ${this.currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
      </button>
    `;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
        <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                onclick="dashboard.changePage(${i})">
          ${i}
        </button>
      `;
        }

        // Next button
        paginationHTML += `
      <button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" 
              onclick="dashboard.changePage(${this.currentPage + 1})" 
              ${this.currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
      </button>
    `;

        pagination.innerHTML = paginationHTML;
    }

    changePage(page) {
        if (page < 1 || page === this.currentPage) return;
        this.currentPage = page;
        this.loadAttendance();
    }

    sortTable(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'desc';
        }

        // Update sort icons
        document.querySelectorAll('.sortable').forEach(icon => {
            icon.className = 'fas fa-sort sortable';
        });

        const activeIcon = document.querySelector(`[data-column="${column}"]`);
        if (activeIcon) {
            activeIcon.className = `fas fa-sort-${this.sortDirection === 'asc' ? 'up' : 'down'} sortable`;
        }

        this.loadAttendance();
    }

    clearFilters() {
        this.currentFilters = {};
        document.getElementById('dateFilter').value = '';
        document.getElementById('groupFilter').value = '';
        document.getElementById('rollFilter').value = '';
        document.getElementById('nameFilter').value = '';
        this.currentPage = 1;
        this.loadAttendance();
    }

    switchView(viewType) {
        const tableView = document.getElementById('tableView');
        const cardView = document.getElementById('cardView');

        if (viewType === 'table') {
            tableView.classList.add('active');
            cardView.classList.remove('active');
            // Implement table view
        } else {
            cardView.classList.add('active');
            tableView.classList.remove('active');
            // Implement card view
        }
    }

    toggleSelectAll(checked) {
        const checkboxes = document.querySelectorAll('.row-select');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    showMessageDetails(recordId) {
        // Implementation for showing detailed message info
        this.showToast('Message details feature coming soon!', 'info');
    }

    editRecord(recordId) {
        // Implementation for editing records
        this.showToast('Edit feature coming soon!', 'info');
    }

    async exportData() {
        try {
            const params = new URLSearchParams(this.currentFilters);
            const response = await fetch(`${this.apiBaseUrl}/attendance?${params}`);
            const result = await response.json();

            if (result.success) {
                this.downloadCSV(result.data);
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showToast('Failed to export data', 'error');
        }
    }

    downloadCSV(data) {
        const headers = ['Student Name', 'Roll No', 'Group', 'Date', 'Time', 'Status', 'Message'];
        const csvContent = [
            headers.join(','),
            ...data.map(record => {
                const date = new Date(record.timestamp);
                const student = this.students.get(record.roll_no);
                const displayName = student ? student.name : (record.student_name || 'Unknown');

                return [
                    `"${displayName}"`,
                    record.roll_no,
                    `"${record.group_name || 'N/A'}"`,
                    date.toLocaleDateString(),
                    date.toLocaleTimeString(),
                    'Present',
                    `"${record.message.replace(/"/g, '""')}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Data exported successfully!', 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }

    showLoading() {
        const tbody = document.getElementById('attendanceBody');
        tbody.innerHTML = `
      <tr class="loading-row">
        <td colspan="9">
          <div class="loading">
            <div class="spinner"></div>
            <span>Loading attendance data...</span>
          </div>
        </td>
      </tr>
    `;
    }

    startAutoRefresh() {
        setInterval(() => {
            this.loadData();
        }, this.refreshInterval);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize dashboard when DOM is loaded
// document.addEventListener('DOMContentLoaded', () => {
//     let attemptCount = 0;
//     const maxAttempts = 100; // 1 second maximum wait time (100 * 10ms)

//     // Wait for external libraries to load with faster polling
//     // const initDashboard = () => {
//     //     if (typeof QRCode !== 'undefined') {
//     //         console.log('All dependencies loaded, initializing dashboard...');
//     //         window.dashboard = new AttendanceDashboard();
//     //     } else if (attemptCount < maxAttempts) {
//     //         attemptCount++;
//     //         console.log(`Waiting for QRCode library to load... (attempt ${attemptCount}/${maxAttempts})`);
//     //         setTimeout(initDashboard, 10); // Much faster polling - 10ms instead of 100ms
//     //     } else {
//     //         console.warn('QRCode library failed to load within timeout, initializing anyway...');
//     //         window.dashboard = new AttendanceDashboard();
//     //     }
//     // };


//     // Also try to initialize immediately in case library is already loaded
//     if (typeof QRCode !== 'undefined') {
//         window.dashboard = new AttendanceDashboard();
//     } else {
//         initDashboard();
//     }
// });


// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for the QR Code library to load
    // The setTimeout ensures that the browser has enough time to fetch and execute the script
    setTimeout(() => {
        if (typeof QRCode !== 'undefined') {
            console.log('All Dependencies loaded, initializing dashboard... ')
            window.dashboard = new AttendanceDashboard()
        } else {
            console.error('QR Code library failed to load. Please check your network connection and the script tag in index.html')
            // Fallback UI message for the user
            const qrContainer = document.getElementById('qrContainer');
            if (qrContainer) {
                qrContainer.innerHTML = '<div style="color: #dc3545; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br>QR Code library failed to load. Please refresh the page.</div>';
            }
        }
    }, 500) // 500ms should be more than enough time for the library to load
})
// Service worker for offline support
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         navigator.serviceWorker.register('/sw.js')
//             .then((registration) => {
//                 console.log('SW registered: ', registration);
//             })
//             .catch((registrationError) => {
//                 console.log('SW registration failed: ', registrationError);
//             });
//     });
// }
